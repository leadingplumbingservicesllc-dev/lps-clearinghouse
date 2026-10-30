import * as cheerio from "cheerio";
import { z } from "zod";
import { httpsUrl } from "../config";
/** Returns only email addresses explicitly published with a matching business name. */
export async function discoverContact(
  business: string,
): Promise<{ email: string; source: string } | null> {
  const url = new URL(
    "https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults",
  );
  url.searchParams.set("inquiryType", "EntityName");
  url.searchParams.set("searchTerm", business);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Sunbiz HTTP ${response.status}`);
  const $ = cheerio.load(await response.text());
  const normalized = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  const row = $("tr")
    .filter(
      (_, el) =>
        normalized($(el).find("td").first().text()) === normalized(business),
    )
    .first();
  for (const el of row.find('a[href^="mailto:"]').toArray()) {
    const email = $(el).attr("href")?.slice(7).split("?")[0].toLowerCase();
    if (email && z.string().email().safeParse(email).success)
      return { email, source: url.toString() };
  }
  // Sunbiz usually publishes mailing addresses, not email. An operator-approved municipal directory can supply a verified email.
  if (!process.env.LICENSE_DIRECTORY_URL) return null;
  const directory = httpsUrl("LICENSE_DIRECTORY_URL");
  directory.searchParams.set("business", business);
  const result = await fetch(directory, {
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!result.ok) throw new Error(`License directory HTTP ${result.status}`);
  const entries = z
    .array(
      z.object({
        business: z.string(),
        email: z.string().email(),
        sourceUrl: z.string().url(),
      }),
    )
    .parse(await result.json());
  const exact = entries.filter(
    (e) => normalized(e.business) === normalized(business),
  );
  if (exact.length !== 1) return null;
  return { email: exact[0].email.toLowerCase(), source: exact[0].sourceUrl };
}
