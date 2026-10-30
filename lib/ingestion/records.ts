import { z } from "zod";
export const RecordSchema = z.object({
  county: z.enum(["palm-beach", "broward"]),
  instrumentNumber: z.string().min(1).max(100),
  documentType: z.enum(["LIEN", "MECHANICS LIEN", "NOTICE TO OWNER"]),
  bookPage: z.string().optional(),
  recordingDate: z.coerce.date(),
  grantor: z.string().min(1),
  grantee: z.string().min(1),
  amountCents: z.bigint().positive(),
  legalDescription: z.string().min(5),
  siteAddress: z.string().min(5),
  parcelId: z.string().optional(),
  sourceUrl: z.string().url(),
  sourceDigest: z.string().length(64),
});
export function moneyCents(value: string): bigint {
  const text = value
    .trim()
    .replace(/^\$\s*/, "")
    .replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error("Unparseable monetary amount");
  const [whole, frac = ""] = text.split(".");
  return BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0"));
}
export function recordingDate(value: string): Date {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) throw new Error("Expected MM/DD/YYYY recording date");
  const [, m, d, y] = match;
  const date = new Date(Date.UTC(+y, +m - 1, +d));
  if (
    date.getUTCFullYear() !== +y ||
    date.getUTCMonth() !== +m - 1 ||
    date.getUTCDate() !== +d
  )
    throw new Error("Invalid recording date");
  return date;
}
