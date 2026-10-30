import "dotenv/config";
import { chromium, type Page } from "playwright";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { db } from "../lib/db";
import { required } from "../lib/config";
import { digest } from "../lib/security";
import {
  RecordSchema,
  moneyCents,
  recordingDate,
} from "../lib/ingestion/records";
const CountyConfig = z.object({
  searchUrl: z.string().url(),
  readySelector: z.string().min(1),
  fromSelector: z.string().min(1),
  toSelector: z.string().min(1),
  typeSelector: z.string().min(1),
  submitSelector: z.string().min(1),
  rowSelector: z.string().min(1),
  detailLinkSelector: z.string().min(1),
  nextSelector: z.string().optional(),
  documentValues: z.record(z.string(), z.string()),
  fields: z.object({
    instrumentNumber: z.string(),
    documentType: z.string(),
    bookPage: z.string().optional(),
    recordingDate: z.string(),
    grantor: z.string(),
    grantee: z.string(),
    amount: z.string(),
    legalDescription: z.string(),
    siteAddress: z.string(),
    parcelId: z.string().optional(),
  }),
});
const hosts = {
  "palm-beach": "erec.mypalmbeachclerk.com",
  broward: "officialrecords.broward.org",
} as const;
const dateText = (d: Date) =>
  `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/${d.getUTCFullYear()}`;
function permitted(url: string, county: keyof typeof hosts) {
  const u = new URL(url);
  if (u.protocol !== "https:" || u.hostname !== hosts[county])
    throw new Error("Unapproved portal host; review source configuration");
}
async function scrape() {
  const configs = z
    .object({ "palm-beach": CountyConfig, broward: CountyConfig })
    .parse(JSON.parse(await readFile(required("PORTAL_CONFIG_PATH"), "utf8")));
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    proxy: process.env.HTTPS_PROXY
      ? { server: process.env.HTTPS_PROXY }
      : undefined,
  });
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 14);
  from.setUTCHours(0, 0, 0, 0);
  let saved = 0;
  try {
    for (const county of ["palm-beach", "broward"] as const) {
      const cfg = configs[county];
      permitted(cfg.searchUrl, county);
      const context = await browser.newContext();
      await context.route("**/*", async (route) => {
        const u = new URL(route.request().url());
        if (u.protocol === "https:" && u.hostname !== hosts[county])
          return route.abort();
        return route.continue();
      });
      const page = await context.newPage();
      const detail = await context.newPage();
      for (const kind of [
        "LIEN",
        "MECHANICS LIEN",
        "NOTICE TO OWNER",
      ] as const) {
        if (!cfg.documentValues[kind])
          throw new Error(
            `Missing actual portal document code: ${county}/${kind}`,
          );
        await page.goto(cfg.searchUrl, { waitUntil: "domcontentloaded" });
        await page.locator(cfg.readySelector).waitFor();
        await page.locator(cfg.fromSelector).fill(dateText(from));
        await page.locator(cfg.toSelector).fill(dateText(to));
        await page
          .locator(cfg.typeSelector)
          .selectOption(cfg.documentValues[kind]);
        await page.locator(cfg.submitSelector).click();
        await page.locator(cfg.rowSelector).first().waitFor({ timeout: 30000 });
        const visited = new Set<string>();
        let pages = 0;
        while (true) {
          if (++pages > 1000)
            throw new Error("Pagination exceeded safety limit");
          const links = await page
            .locator(cfg.rowSelector)
            .locator(cfg.detailLinkSelector)
            .evaluateAll((els) =>
              els.map((el) => (el as HTMLAnchorElement).href),
            );
          const fingerprint = digest(JSON.stringify(links));
          if (visited.has(fingerprint))
            throw new Error("Pagination did not advance");
          visited.add(fingerprint);
          for (const url of links) {
            permitted(url, county);
            await detail.goto(url, { waitUntil: "domcontentloaded" });
            const values: Record<string, string> = {};
            for (const [key, selector] of Object.entries(cfg.fields)) {
              if (selector)
                values[key] = (
                  await detail.locator(selector).innerText()
                ).trim();
            }
            const date = recordingDate(values.recordingDate);
            if (date < from || date > to)
              throw new Error("Portal returned out-of-window record");
            if (values.documentType.toUpperCase() !== kind)
              throw new Error("Portal document type requires verified mapping");
            const record = RecordSchema.parse({
              ...values,
              county,
              documentType: kind,
              recordingDate: date,
              amountCents: moneyCents(values.amount),
              sourceUrl: url,
              sourceDigest: digest(JSON.stringify(values)),
            });
            await db.lien.upsert({
              where: {
                county_instrumentNumber: {
                  county,
                  instrumentNumber: record.instrumentNumber,
                },
              },
              create: record,
              update: {},
            });
            saved++;
          }
          if (!cfg.nextSelector) break;
          const next = page.locator(cfg.nextSelector);
          if (
            !(await next.count()) ||
            !(await next.isVisible()) ||
            (await next.isDisabled()) ||
            (await next.getAttribute("aria-disabled")) === "true"
          )
            break;
          await next.click();
          await page.waitForTimeout(1500);
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
    await db.$disconnect();
  }
  console.log(
    JSON.stringify({
      processed: saved,
      from: dateText(from),
      to: dateText(to),
    }),
  );
}
scrape().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
