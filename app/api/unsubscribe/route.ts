import { db } from "@/lib/db";
import { digest, failure, HttpError } from "@/lib/security";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    if (!token || token.length > 128) throw new HttpError(400, "Invalid token");
    const campaign = await db.campaign.findUnique({
      where: { tokenHash: digest(token) },
    });
    if (!campaign) throw new HttpError(404, "Unknown subscription");
    await db.$transaction([
      db.suppression.upsert({
        where: { email: campaign.email },
        create: { email: campaign.email, reason: "unsubscribe" },
        update: { reason: "unsubscribe" },
      }),
      db.campaign.updateMany({
        where: {
          email: campaign.email,
          status: { in: ["APPROVED", "RETRY", "PENDING_REVIEW"] },
        },
        data: { status: "SUPPRESSED" },
      }),
    ]);
    return new Response("Unsubscribed");
  } catch (e) {
    return failure(e);
  }
}
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
    return new Response("Invalid token", { status: 400 });
  return new Response(
    `<html lang="en"><title>Unsubscribe</title><body><h1>Stop financing invitations</h1><form method="post" action="?token=${token}"><button>Unsubscribe</button></form></body></html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
