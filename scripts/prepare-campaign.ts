import "dotenv/config";
import { prepareCampaign } from "../lib/outreach/mailer";
import { db } from "../lib/db";
const id = process.argv[2];
if (!id) throw new Error("Usage: npx tsx scripts/prepare-campaign.ts LIEN_ID");
prepareCampaign(id)
  .then((c) => console.log({ id: c.id, status: c.status }))
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
