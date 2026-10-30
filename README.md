# Leading Plumbing Services clearinghouse

Next.js App Router, TypeScript, Tailwind and shadcn-style Radix components, PostgreSQL/Prisma, structured Gemini underwriting, a PostgreSQL-backed SMTP queue, Playwright ingestion, preliminary hydraulic screening PDFs, and ERC-721/ERC-4626 escrow contracts.

**This is an initial implementation, not an audited or production-certified financial platform.** No county records, contacts, offers, or risk evidence are seeded. Test fixtures exist only in tests. No real outreach, money transfer, or deployment has been performed. See [validation and remaining work](docs/VALIDATION.md) before use.

## Local development

Use Node 22.12+ or Node 24, npm, and PostgreSQL 16+. Existing cloud tasks are already isolated; use this checkout without creating a worktree.

```sh
npm ci
cp .env.example .env
# Set DATABASE_URL and APP_URL in .env. Supply other integration settings as needed.
npm run db:generate
npm run db:migrate
npm run dev
```

The landing page runs without external services. APIs deliberately return errors if required credentials/evidence are missing. There is no fabricated success mode. API keys, terms, contact details, and records are never embedded in the frontend.

```sh
npm run typecheck
npm test
# Set DATABASE_URL and RUN_DATABASE_TESTS=1 to include real persistence checks:
RUN_DATABASE_TESTS=1 npm test
npm run test:contracts
npm run build
npm start
```

The test process reads exported environment variables. `prisma.config.ts`, migrations, and Next read `.env`; for standalone scripts use `node --env-file=.env --import tsx scripts/outreach-worker.ts` or export the variables securely before running npm scripts. Do not commit `.env`.

Production setup, environment variable requirements, SMTP events, migrations, chain deployment, and Linux/Vercel browser constraints are covered in [deployment](docs/DEPLOYMENT.md). Portal source configuration is covered in [ingestion](docs/INGESTION.md).

## HTTP contracts

- `POST /api/v1/risk-score`: `Authorization: Bearer B2B_API_KEY`, JSON `{ "address": "<full commercial property address>" }`. Requires uniquely matching real property/soil evidence and Gemini. Returns the evidence, screening analysis, and a PDF URL valid for one hour. A score of 100 means lower modeled risk. The heuristic is not calibrated or an engineering certification.
- `GET /api/reports/:token`: expiring bearer-capability PDF download. Treat the URL as sensitive; suppress full URL logging at the edge.
- `POST /api/cron/trigger-outreach`: `Authorization: Bearer CRON_SECRET`, drains at most ten approved campaigns. This route does not manufacture contacts or approve offers. Run periodically on a trusted scheduler.
- `POST /api/outreach/events`: normalized SMTP-provider events, HMAC authenticated; see deployment. Provider-native payloads/signatures require a trusted adapter. Open events are provider observations and may reflect privacy proxies, not human engagement.
- `GET /api/unsubscribe?token=...`: confirmation form. `POST` performs durable suppression, including RFC 8058 one-click POSTs. Unsubscribe tokens continue to work after offer expiry.
- `/escrow/:token`: private offer review and wallet-signed acceptance; `POST /api/escrow/:token` verifies the signature, expiry, and origin. It never claims that a web signature automatically records an assignment or transfers funds.

Deduplication is `(county, instrument_number)`: county instrument namespaces overlap. Imported records are immutable on duplicate ingestion, preserving evidence used for existing offers; source corrections require explicit reconciliation.
