import "dotenv/config";
import { drainQueue } from "../lib/outreach/mailer";
import { db } from "../lib/db";
drainQueue()
  .then(console.log)
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
