import { z } from "zod";
import { db } from "@/lib/db";
import {
  equal,
  webhookSignature,
  failure,
  HttpError,
  readText,
} from "@/lib/security";
export async function POST(req: Request) {
  try {
    const raw = await readText(req);
    const ts = req.headers.get("x-event-timestamp") ?? "";
    if (!/^\d{10}$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300)
      throw new HttpError(401, "Expired signature");
    if (
      !equal(
        req.headers.get("x-event-signature") ?? "",
        webhookSignature(`${ts}.${raw}`),
      )
    )
      throw new HttpError(401, "Invalid signature");
    const event = z
      .object({
        id: z.string().max(128),
        messageId: z.string().max(256),
        type: z.enum(["open", "hard_bounce", "complaint"]),
      })
      .strict()
      .parse(JSON.parse(raw));
    const campaign = await db.campaign.findUnique({
      where: { messageId: event.messageId },
    });
    if (!campaign) throw new HttpError(404, "Unknown message");
    await db.$transaction(async (tx) => {
      const inserted = await tx.mailEvent.createMany({
        data: [{ id: event.id, campaignId: campaign.id, type: event.type }],
        skipDuplicates: true,
      });
      if (!inserted.count) return;
      if (event.type === "open")
        await tx.campaign.update({
          where: { id: campaign.id },
          data: { openedAt: new Date() },
        });
      else {
        await tx.campaign.update({
          where: { id: campaign.id },
          data: { bouncedAt: new Date(), status: "SUPPRESSED" },
        });
        await tx.suppression.upsert({
          where: { email: campaign.email },
          create: { email: campaign.email, reason: event.type },
          update: { reason: event.type },
        });
      }
    });
    return Response.json({ received: true });
  } catch (e) {
    return failure(e);
  }
}
