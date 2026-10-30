import "dotenv/config";
import { db } from "../lib/db";
async function main() {
  const [action, id, confirmation] = process.argv.slice(2);
  if (!id || confirmation !== "--reviewed")
    throw new Error(
      "Usage: npx tsx scripts/review.ts verify-lien|approve-campaign|reconcile-not-delivered ID --reviewed",
    );
  if (action === "verify-lien") {
    await db.lien.update({ where: { id }, data: { verifiedAt: new Date() } });
  } else if (action === "approve-campaign") {
    const c = await db.campaign.findUniqueOrThrow({
      where: { id },
      include: { lien: true },
    });
    if (
      !c.lien.verifiedAt ||
      c.status !== "PENDING_REVIEW" ||
      c.tokenExpiresAt < new Date()
    )
      throw new Error("Campaign not eligible");
    if (await db.suppression.findUnique({ where: { email: c.email } }))
      throw new Error("Contact suppressed");
    await db.campaign.update({
      where: { id },
      data: { status: "APPROVED", approvedAt: new Date() },
    });
  } else if (action === "reconcile-not-delivered") {
    const result = await db.campaign.updateMany({
      where: { id, status: { in: ["SENDING", "REVIEW_DELIVERY"] } },
      data: { status: "RETRY", leaseUntil: null, nextAttemptAt: new Date() },
    });
    if (!result.count) throw new Error("Campaign not in reconciliation state");
  } else throw new Error("Unknown review action");
  console.log({ action, id, reviewed: true });
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
