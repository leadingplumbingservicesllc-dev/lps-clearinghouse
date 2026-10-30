import { z } from "zod";
export function required(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Missing configuration: ${name}`);
  return value;
}
export function publicOrigin(): string {
  const url = new URL(required("APP_URL"));
  if (url.protocol !== "https:" && process.env.NODE_ENV === "production")
    throw new Error("APP_URL must use HTTPS");
  return url.origin;
}
export function httpsUrl(name: string): URL {
  return new URL(
    z
      .string()
      .url()
      .refine((v) => new URL(v).protocol === "https:", "HTTPS required")
      .parse(required(name)),
  );
}
