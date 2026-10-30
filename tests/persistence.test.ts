import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import { rateLimit, HttpError } from "../lib/security";
test(
  "PostgreSQL preserves county-scoped deduplication and concurrent rate limits",
  { skip: !process.env.RUN_DATABASE_TESTS },
  async () => {
    const instrumentNumber = `integration-test-${randomUUID()}`;
    const bucket = `test:${instrumentNumber}`;
    try {
      const data = {
        instrumentNumber,
        county: "palm-beach",
        documentType: "LIEN",
        recordingDate: new Date(),
        grantor: "Integration test only",
        grantee: "Integration test only",
        amountCents: 123456n,
        legalDescription: "Integration test only",
        siteAddress: "Integration test only",
        sourceUrl: "https://example.com/test-only",
        sourceDigest: "0".repeat(64),
      };
      await db.lien.create({ data });
      await assert.rejects(db.lien.create({ data }));
      await db.lien.create({ data: { ...data, county: "broward" } });
      assert.equal(await db.lien.count({ where: { instrumentNumber } }), 2);
      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () => rateLimit(bucket, 3, 60)),
      );
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
      assert.equal(
        results.filter(
          (r) => r.status === "rejected" && r.reason instanceof HttpError,
        ).length,
        5,
      );
    } finally {
      await db.lien.deleteMany({ where: { instrumentNumber } });
      await db.rateBucket.deleteMany({ where: { key: bucket } });
      await db.$disconnect();
    }
  },
);
