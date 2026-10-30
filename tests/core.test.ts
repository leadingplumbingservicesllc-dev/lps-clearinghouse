import { test } from "node:test";
import assert from "node:assert/strict";
import {
  moneyCents,
  recordingDate,
  RecordSchema,
} from "../lib/ingestion/records";
import { digest, newToken, seal, unseal, equal } from "../lib/security";
import { Underwriting } from "../lib/agents/underwriting-swarm";
import { reportPdf } from "../lib/pdf";
test("currency parsing preserves exact cents and rejects OCR ambiguity", () => {
  assert.equal(moneyCents("$1,234.56"), 123456n);
  assert.equal(moneyCents("0.09"), 9n);
  for (const bad of ["amount unknown", "-1", "1.234", "1e6"])
    assert.throws(() => moneyCents(bad));
});
test("recording dates reject rollover and ambiguous formats", () => {
  assert.equal(
    recordingDate("02/29/2024").toISOString(),
    "2024-02-29T00:00:00.000Z",
  );
  assert.throws(() => recordingDate("02/29/2025"));
  assert.throws(() => recordingDate("2026-01-01"));
});
test("tokens roundtrip under authenticated encryption; tampering fails", () => {
  process.env.TOKEN_ENCRYPTION_KEY = "a1".repeat(32);
  const token = newToken();
  const encrypted = seal(token);
  assert.equal(unseal(encrypted), token);
  const bytes = Buffer.from(encrypted, "base64url");
  bytes[20] ^= 1;
  assert.throws(() => unseal(bytes.toString("base64url")));
  assert.equal(digest(token).length, 64);
  assert.equal(equal("abc", "abd"), false);
  assert.equal(equal("abc", "abc"), true);
});
test("underwriting enforces economics and risk bounds", () => {
  const input = {
    defaultRiskScore: 40,
    clearanceTimelineDays: 120,
    recommendedLiquidityAdvance: 0.93,
    platformFee: 0.07,
    rationale: "Test-only underwriting input for schema constraint validation.",
    limitations: ["No verified title evidence"],
  };
  assert.ok(Underwriting.safeParse(input).success);
  assert.ok(
    !Underwriting.safeParse({ ...input, defaultRiskScore: 101 }).success,
  );
  assert.ok(
    !Underwriting.safeParse({ ...input, recommendedLiquidityAdvance: 1 })
      .success,
  );
  assert.ok(!Underwriting.safeParse({ ...input, platformFee: 0 }).success);
});
test("incomplete county records cannot be persisted as validated records", () => {
  assert.ok(
    !RecordSchema.safeParse({ instrumentNumber: "test-fixture-only" }).success,
  );
});
test("PDF output is a complete PDF artifact", async () => {
  const pdf = await reportPdf(
    "Test-only address",
    { source: "unit-test" },
    { score: 50 },
  );
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.toString().includes("%%EOF"));
});
