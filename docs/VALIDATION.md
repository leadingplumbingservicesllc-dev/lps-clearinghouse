# Validation and known gaps

## Executed in the cloud environment

- Locked npm dependency installation and generated Prisma 6.19.3 JavaScript-engine client.
- TypeScript compilation and optimized Next.js 16 production build passed.
- A real PostgreSQL 16 container received the initial migration. A second migration run made no changes.
- Seven application tests passed, none skipped: exact monetary parsing, strict dates, authenticated token encryption/tamper rejection, underwriting constraints, rejection of incomplete records, PDF generation, and real PostgreSQL deduplication/concurrent rate limiting. Synthetic fixtures are confined to tests and cleaned from the database.
- Three Solidity lifecycle tests passed on Hardhat using local, npm-verified Solidity 0.8.38: full funding/settlement, authorization/duplicate/replay controls, and paused loss recognition. Forty-one Solidity source files compiled; upstream OpenZeppelin emitted warnings about a future reserved identifier. TestAsset is test-only, never selected by deployment scripts.
- Production server HTTP checks passed for homepage content, unauthorized risk/cron requests, malformed authenticated risk input, invalid report/offer links, and invalid unsubscribe tokens.
- `npm audit --omit=dev` reported zero advisories after overriding the vulnerable `deepmerge-ts` transitive dependency to version 8 and rerunning generation/build/tests. Full dependency audit still reported 20 development-tool advisories (8 high, 2 moderate, 10 low), principally Hardhat 2/its test tooling and compiler dependencies. Resolve these before relying on the build toolchain for production deployment; the runtime-only audit does not certify overall supply-chain security.

These checks validate specific local capabilities. GitHub Actions was supplied but has not been observed running remotely. No new-task snapshot restoration or production deployment was validated.

## Not executed / incomplete

- Live county searches, form selectors, portal schema/type verification, image/OCR extraction, public search availability, and NTO coverage: both requested hosts were denied by the current proxy policy. The generic configurable Playwright form adapter is not a verified county integration. Source access and county-specific implementation may still be required.
- Gemini calls: no application Gemini credentials/model were configured. Structured output validation was tested locally, not a live model response.
- Real SMTP delivery, provider-specific bounce/open webhook integration, DKIM DNS verification, mailbox monitoring, or campaigns: no credentials, approved terms, or verified contacts were available. No mail was sent.
- County appraiser/soil queries and real risk-score/PDF API success: authoritative layer URLs, schema fields, regional salinity/coastal data, and model credentials are required. The score has not been calibrated or validated against field inspections. Only PDF rendering and API negative paths were exercised.
- Wallet UI acceptance against a live campaign, legal identity/authority verification, automated web-to-chain bridge, title verification, recorded assignment/satisfaction, partial repayments, dispute servicing, or deployed USDC transfers: not validated; several are explicitly out-of-band operational integrations. The contracts execute separately verified EIP-712 assignments; the website's personal-sign acceptance is not an on-chain funding authorization.
- Independent security audit, penetration test, accessibility audit, legal/regulatory review, load/failover testing, operational observability/alerts, managed KYC/identity controls, and disaster recovery drills.

The repository is a tested initial implementation with explicit integration boundaries. It does **not** meet the prompt's “100% production-ready, fully functional ecosystem” claim. Do not enable real outreach or deposit real funds until the above requirements are resolved and independently reviewed.

## Cloud configuration

Network additions were saved to the environment draft for the requested county hosts, Sunbiz, Gemini, and Prisma binaries. Saving a draft does not update the running policy or publish a snapshot. Review/save these additions in environment settings, then publish the environment. Also add the actual verified property/soil/contact hosts and approved SMTP TCP access when those integrations are selected. Do not replace an unknown existing allowlist.
