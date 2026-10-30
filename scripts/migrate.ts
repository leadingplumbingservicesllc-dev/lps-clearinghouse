import "dotenv/config";
import { Pool } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(7037132026)");
    await client.query(
      'CREATE TABLE IF NOT EXISTS "_lps_migrations" (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())',
    );
    const entries = (
      await readdir("prisma/migrations", { withFileTypes: true })
    )
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    for (const name of entries) {
      const sql = await readFile(
        `prisma/migrations/${name}/migration.sql`,
        "utf8",
      );
      if (!sql.trim()) throw new Error(`Empty migration: ${name}`);
      const hash = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query(
        'SELECT checksum FROM "_lps_migrations" WHERE name=$1',
        [name],
      );
      if (existing.rows.length) {
        if (existing.rows[0].checksum !== hash)
          throw new Error(`Migration checksum mismatch: ${name}`);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO "_lps_migrations"(name,checksum) VALUES($1,$2)',
          [name, hash],
        );
        await client.query("COMMIT");
        console.log(`Applied ${name}`);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(7037132026)");
    client.release();
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
