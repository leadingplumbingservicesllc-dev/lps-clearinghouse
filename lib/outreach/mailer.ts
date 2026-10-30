import nodemailer from "nodemailer";
import { readFile } from "node:fs/promises";
import { db } from "../db";
import { required, publicOrigin } from "../config";
import { digest, newToken, seal, unseal, rateLimit } from "../security";
import { underwrite, outreachCopy } from "../agents/underwriting-swarm";
import { discoverContact } from "./contacts";
export async function prepareCampaign(lienId: string) {
  const lien = await db.lien.findUniqueOrThrow({ where: { id: lienId } });
  if (!lien.verifiedAt)
    throw new Error("Human source/title verification is required");
  const contact = await discoverContact(lien.grantee);
  if (!contact)
    throw new Error(
      "No explicitly published matching email; manual verified contact required",
    );
  if (await db.suppression.findUnique({ where: { email: contact.email } }))
    throw new Error("Contact suppressed");
  const underwriting = await underwrite({
    amountCents: lien.amountCents.toString(),
    debtor: lien.grantor,
    parcelId: lien.parcelId,
    county: lien.county,
    instrumentNumber: lien.instrumentNumber,
  });
  if (underwriting.recommendedLiquidityAdvance !== 0.93)
    throw new Error(
      "Underwriter recommends a lower advance; bespoke reviewed terms required",
    );
  const copy = await outreachCopy({
    contractor: lien.grantee,
    instrumentNumber: lien.instrumentNumber,
    county: lien.county,
    amountCents: lien.amountCents.toString(),
    advanceCents: ((lien.amountCents * 93n) / 100n).toString(),
  });
  const token = newToken();
  const assignmentText = await readFile(
    required("ASSIGNMENT_TERMS_PATH"),
    "utf8",
  );
  if (assignmentText.length < 200)
    throw new Error("Approved assignment terms required");
  return db.campaign.create({
    data: {
      lienId,
      email: contact.email,
      contactSource: contact.source,
      contactVerifiedAt: new Date(),
      subject: copy.subject,
      body: copy.body,
      underwriting,
      tokenHash: digest(token),
      tokenCiphertext: seal(token),
      tokenExpiresAt: new Date(Date.now() + 7 * 86400000),
      assignmentText,
      assignmentDigest: digest(assignmentText),
    },
  });
}
export async function drainQueue(max = 10) {
  const smtpPort = Number(required("SMTP_PORT"));
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)
    throw new Error("Invalid SMTP port");
  const privateKey = await readFile(required("DKIM_PRIVATE_KEY_PATH"), "utf8");
  const transport = nodemailer.createTransport({
    host: required("SMTP_HOST"),
    port: smtpPort,
    secure: smtpPort === 465,
    requireTLS: smtpPort !== 465,
    auth: { user: required("SMTP_USER"), pass: required("SMTP_PASSWORD") },
    connectionTimeout: 15000,
    socketTimeout: 30000,
    dkim: {
      domainName: "leadingplumbingservices.com",
      keySelector: required("DKIM_SELECTOR"),
      privateKey,
    },
  });
  await transport.verify();
  const perMinute = Number(process.env.SMTP_PER_MINUTE ?? 5);
  if (!Number.isInteger(perMinute) || perMinute < 1 || perMinute > 60)
    throw new Error("SMTP_PER_MINUTE must be between 1 and 60");
  let sent = 0;
  try {
    for (let i = 0; i < max; i++) {
      // Persisted global rate limit works across worker instances; no in-memory queue.
      await rateLimit("smtp:minute", perMinute, 60);
      const rows = await db.$queryRaw<
        { id: string }[]
      >`UPDATE "Campaign" SET status='SENDING', "leaseUntil"=NOW()+INTERVAL '5 minutes', attempts=attempts+1 WHERE id=(SELECT id FROM "Campaign" WHERE status IN ('APPROVED','RETRY') AND "approvedAt" IS NOT NULL AND "nextAttemptAt"<=NOW() AND "tokenExpiresAt">NOW() AND attempts<5 ORDER BY "nextAttemptAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id`;
      if (!rows.length) break;
      const campaign = await db.campaign.findUniqueOrThrow({
        where: { id: rows[0].id },
      });
      if (
        await db.suppression.findUnique({ where: { email: campaign.email } })
      ) {
        await db.campaign.update({
          where: { id: campaign.id },
          data: { status: "SUPPRESSED", leaseUntil: null },
        });
        continue;
      }
      const token = unseal(campaign.tokenCiphertext);
      const origin = publicOrigin();
      const unsubscribe = `${origin}/api/unsubscribe?token=${encodeURIComponent(token)}`;
      const messageId = `<${campaign.id}@leadingplumbingservices.com>`;
      const text = `${campaign.body}\n\nReview offer and assignment terms: ${origin}/escrow/${token}\n\nLeading Plumbing Services\n${required("BUSINESS_POSTAL_ADDRESS")}\nCommercial financing invitation. Unsubscribe: ${unsubscribe}`;
      try {
        const result = await transport.sendMail({
          from: "Leading Plumbing Services <liquidity@leadingplumbingservices.com>",
          to: campaign.email,
          subject: campaign.subject,
          text,
          messageId,
          headers: {
            "List-Unsubscribe": `<${unsubscribe}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        if (!result.accepted.length) throw new Error("SMTP rejected recipient");
        await db.campaign.update({
          where: { id: campaign.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            messageId,
            leaseUntil: null,
            lastError: null,
          },
        });
        sent++;
      } catch (error) {
        // A timeout after DATA may already have delivered. Require reconciliation to avoid duplicate sends.
        const code = (error as { responseCode?: number }).responseCode;
        const safeRetry = typeof code === "number" && code >= 400 && code < 500;
        await db.campaign.update({
          where: { id: campaign.id },
          data: {
            status:
              safeRetry && campaign.attempts < 5 ? "RETRY" : "REVIEW_DELIVERY",
            leaseUntil: null,
            messageId,
            lastError: code
              ? `SMTP ${code}`
              : "Uncertain delivery; reconcile with provider",
            nextAttemptAt: new Date(
              Date.now() + 2 ** campaign.attempts * 60000,
            ),
          },
        });
      }
    }
  } finally {
    transport.close();
  }
  return { sent };
}
