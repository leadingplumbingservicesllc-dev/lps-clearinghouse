import { z } from "zod";
import { verifyMessage } from "ethers";
import { db } from "@/lib/db";
import {
  digest,
  failure,
  HttpError,
  jsonBody,
  sameOrigin,
  rateLimit,
} from "@/lib/security";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    sameOrigin(req);
    const { token } = await params;
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new HttpError(404, "Offer unavailable");
    await rateLimit(`accept:${digest(token)}`, 10, 3600);
    const input = z
      .object({
        name: z.string().trim().min(2).max(150),
        wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
        signature: z.string().max(300),
        consent: z.literal(true),
      })
      .strict()
      .parse(await jsonBody(req));
    const c = await db.campaign.findUnique({
      where: { tokenHash: digest(token) },
      include: { lien: true },
    });
    if (
      !c ||
      c.tokenExpiresAt < new Date() ||
      !c.approvedAt ||
      c.status !== "SENT"
    )
      throw new HttpError(404, "Offer unavailable");
    const message = `Leading Plumbing Services assignment review\nCampaign: ${c.id}\nCounty: ${c.lien.county}\nInstrument: ${c.lien.instrumentNumber}\nTerms SHA-256: ${c.assignmentDigest}\nExpires: ${c.tokenExpiresAt.toISOString()}\nI reviewed and accept these terms as the authorized signatory. Funding requires a separately verified on-chain authorization.`;
    let recovered: string;
    try {
      recovered = verifyMessage(message, input.signature);
    } catch {
      throw new HttpError(400, "Invalid signature");
    }
    if (recovered.toLowerCase() !== input.wallet.toLowerCase())
      throw new HttpError(400, "Signer mismatch");
    const updated = await db.campaign.updateMany({
      where: { id: c.id, acceptedAt: null },
      data: {
        acceptedAt: new Date(),
        signerName: input.name,
        signerWallet: input.wallet,
        walletSignature: input.signature,
      },
    });
    if (!updated.count) throw new HttpError(409, "Already accepted");
    return Response.json({
      accepted: true,
      fundingStatus: "PENDING_VERIFICATION",
    });
  } catch (e) {
    return failure(e);
  }
}
