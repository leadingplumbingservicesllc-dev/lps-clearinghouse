import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { required, publicOrigin } from "./config";
import { db } from "./db";
export const digest = (v: string) =>
  createHash("sha256").update(v).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export function equal(a: string, b: string): boolean {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function authorize(req: Request, variable: string) {
  if (
    !equal(
      req.headers.get("authorization") ?? "",
      `Bearer ${required(variable)}`,
    )
  )
    throw new HttpError(401, "Unauthorized");
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function failure(error: unknown): Response {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && error.name === "ZodError")
    return Response.json({ error: "Invalid request" }, { status: 400 });
  console.error(error instanceof Error ? error.name : "Unhandled error");
  return Response.json(
    {
      error:
        "Service unavailable; check server configuration and upstream services",
    },
    { status: 503 },
  );
}
export async function readText(req: Request, max = 16384): Promise<string> {
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "Body required");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    size += result.value.length;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, "Body too large");
    }
    chunks.push(result.value);
  }
  return Buffer.concat(chunks).toString();
}
export async function jsonBody(req: Request, max = 16384) {
  const raw = await readText(req, max);
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}
export function sameOrigin(req: Request) {
  if (req.headers.get("origin") !== publicOrigin())
    throw new HttpError(403, "Invalid origin");
}
export function seal(token: string): string {
  const key = Buffer.from(required("TOKEN_ENCRYPTION_KEY"), "hex");
  if (key.length !== 32)
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes hex");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  return Buffer.concat([
    iv,
    c.update(token),
    c.final(),
    c.getAuthTag(),
  ]).toString("base64url");
}
export function unseal(value: string): string {
  const bytes = Buffer.from(value, "base64url");
  const c = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(required("TOKEN_ENCRYPTION_KEY"), "hex"),
    bytes.subarray(0, 12),
  );
  c.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([
    c.update(bytes.subarray(12, -16)),
    c.final(),
  ]).toString();
}
export function webhookSignature(body: string) {
  return createHmac("sha256", required("MAIL_EVENT_SECRET"))
    .update(body)
    .digest("hex");
}
export async function rateLimit(key: string, limit: number, seconds: number) {
  const now = new Date();
  const reset = new Date(now.getTime() + seconds * 1000);
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateBucket" (key,count,"resetAt") VALUES (${key},1,${reset}) ON CONFLICT (key) DO UPDATE SET count = CASE WHEN "RateBucket"."resetAt" <= ${now} THEN 1 ELSE "RateBucket".count + 1 END, "resetAt" = CASE WHEN "RateBucket"."resetAt" <= ${now} THEN ${reset} ELSE "RateBucket"."resetAt" END RETURNING count`;
  if (rows[0].count > limit) throw new HttpError(429, "Rate limit exceeded");
}
