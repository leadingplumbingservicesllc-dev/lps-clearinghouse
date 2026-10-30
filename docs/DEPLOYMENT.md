# Configuration and deployment

## Required settings

`.env.example` lists every supported variable. Never commit real secrets or print a process environment. Generate API keys and encryption keys independently, for example `openssl rand -hex 32`, and enter them through your deployment's secret manager. Readiness is specific to a component: the landing page does not prove external APIs work.

| Component | Settings and prerequisites |
| --- | --- |
| Application/database | `APP_URL` (public HTTPS origin in production), `DATABASE_URL` (PostgreSQL/Supabase direct or session-mode connection for migrations; runtime pool limits matched to hosting capacity) |
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL` matching a currently available JSON-schema-capable Gemini model in your project; the requested SDK is implemented, but availability and free quotas are external |
| Risk API | `B2B_API_KEY` (single shared B2B key; rotate via host settings), property evidence configuration below |
| Outreach | `CRON_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_PER_MINUTE`, `BUSINESS_POSTAL_ADDRESS`, `DKIM_SELECTOR`, `DKIM_PRIVATE_KEY_PATH`, `TOKEN_ENCRYPTION_KEY`, `MAIL_EVENT_SECRET`, `ASSIGNMENT_TERMS_PATH` |
| Ingestion | `PORTAL_CONFIG_PATH`, optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; independently verified selectors, document labels, and portal terms |
| Optional contact directory | `LICENSE_DIRECTORY_URL`; explicit matching published emails, not inferred contacts |
| Contracts | `RPC_URL`, `DEPLOYER_PRIVATE_KEY` (deployment only), `USDC_ADDRESS` (verify official chain-specific asset), `MULTISIG_ADMIN` |

DKIM private key and legal terms must be mounted securely at the supplied paths. Use an SMTP account authorized for `liquidity@leadingplumbingservices.com`. Verify SPF, publish the corresponding DKIM DNS record, configure DMARC and a monitored return path with the SMTP provider. STARTTLS is mandatory except implicit TLS on port 465. Do not disable certificate verification. SMTP is TCP, so the cloud HTTP proxy alone does not grant SMTP reachability; configure supported TCP egress or run workers on a host with approved SMTP access. Proxy credential placeholders are not raw passwords usable on arbitrary TCP sockets.

SMTP queues cannot guarantee exactly-once delivery. A crash after SMTP accepts a message but before the database update leaves `SENDING`; the worker does not automatically resend. Reconcile with the SMTP provider using deterministic Message-ID. Only after verifying non-delivery, run:

```sh
node --env-file=.env --import tsx scripts/review.ts reconcile-not-delivered CAMPAIGN_ID --reviewed
```

For provider events, deploy a trusted normalizer receiving that provider's authentic webhook or delivery-status notifications. Validate the provider's native signatures before forwarding. POST JSON `{id, messageId, type}` where type is `open`, `hard_bounce`, or `complaint`. Headers: `x-event-timestamp` (10-digit Unix seconds), `x-event-signature` (hex HMAC-SHA256 over `timestamp + "." + exactRawJson`, key `MAIL_EVENT_SECRET`). Events are deduplicated; hard bounces and complaints suppress recipients. Configure this integration before sending. No direct Brevo/SendGrid-specific receiver or tracking pixel is claimed.

Offers require counsel-approved assignment terms and operator verification; AI-generated text does not establish compliance with Florida Chapter 713, CAN-SPAM, lending, factoring, privacy, or securities requirements. Electronic acceptance includes wallet proof and exact terms hash, but legal identity, signatory authority, required notices, priority, recordability, and recordation/satisfaction remain independently verified processes. Do not advertise guaranteed non-recourse funding or statutory deadlines without approved terms.

## Real property and soil evidence

Two supported modes:

1. `PROPERTY_EVIDENCE_URL` supplies a trusted HTTPS adapter accepting `?address=`. Optional bearer `PROPERTY_EVIDENCE_API_KEY`. Return `{address, parcelId, buildingYear, latitude, longitude, soilSalinityDsM, coastDistanceMeters, sources:[{url,retrievedAt,description}]}`. Numbers must be JSON numbers, source timestamps ISO UTC, and at least two source citations are required. The exact normalized address must match; stale retrievals are rejected.
2. Built-in ArcGIS queries: set `APPRAISER_QUERY_URL` to an official point-feature layer's `/query` endpoint and set `APPRAISER_ADDRESS_FIELD`, `APPRAISER_YEAR_FIELD`, `APPRAISER_PARCEL_FIELD`, `APPRAISER_DATA_DESCRIPTION`. Set `SOIL_QUERY_URL` to a properly sourced regional polygon layer with `SOIL_SALINITY_FIELD` in dS/m and `SOIL_COAST_DISTANCE_FIELD` in meters, plus `SOIL_DATA_DESCRIPTION` including dataset edition/vintage and methodology. The query performs exact-address property lookup then a point-in-polygon soil query. Ambiguous matches fail.

No salinity dataset or appraiser layer URL is invented or bundled. An authoritative, licensed, mapped regional dataset is still required. Coastal proximity is not a salinity measurement. Retrieval time does not prove dataset currency; record vintage in the source description and assess it independently. Parcel-centroid queries are screening approximations. GIS schemas and address normalization differ by county; validate them with known commercial parcels. Risk costs come from model estimates, not a construction quote or validated cost database.

The heuristic baseline is `100 - min(age,100)*0.5 - min(salinity,20)*1.5 - coastalPenalty`, rounded and clamped to 0–100. Coastal penalty is 20 below 1 km and 10 below 5 km. These weights are **uncalibrated**. Gemini explains the supplied baseline and returns a preliminary cost range; it cannot override the baseline or invent cast-iron evidence. No engineering certification is claimed.

## Database and application

1. Provision PostgreSQL 16+ or Supabase. Enforce TLS with a verified CA in production, restrict network access, configure backups/PITR, and use a migration role distinct from the runtime role.
2. Run `npm ci`, configure environment variables, then `npm run db:generate` and `npm run db:migrate` from the checkout root. The SQL was generated by Prisma's schema diff. The migration runner uses PostgreSQL advisory locks, transactions, and immutable SHA-256 migration checksums, tracked in `_lps_migrations`. It is intentionally used instead of the experimental Prisma 6 driver-adapter deploy command, which failed on PostgreSQL's `name` type. Do not mix migration runners or edit applied migrations. Create new SQL migrations and review them before applying. Back up before destructive schema changes; restore from backups for rollback.
3. Run `RUN_DATABASE_TESTS=1 npm test` with `DATABASE_URL` exported, then `npm run typecheck`, `npm run test:contracts`, and `npm run build`.
4. Start `npm start`. Terminate TLS at the hosting edge. Use least-privilege database grants, structured access logs with capability URLs redacted, monitoring for errors and queue age, dependency patching, secret rotation, and a tested restore process.
5. Run ingestion and outreach as separate scheduled workers. Schedule authenticated POST calls to `/api/cron/trigger-outreach`; Vercel's native cron uses GET, so use an external scheduler or a dedicated worker rather than exposing an unauthenticated GET. Do not send or ingest at build time.

For Vercel, import this repository with Node 22+; build `npm run build` and configure variables securely. Run database migrations as a controlled deployment step. `maxDuration` declarations do not grant plan entitlements; choose a host/plan with sufficient request time or move risk requests to a durable job workflow. Gemini, SMTP, PostgreSQL, and hosting free tiers are quota-limited; zero cost is not guaranteed.

## Headless browser and Linux

On a supported Debian/Ubuntu worker:

```sh
npx playwright install --with-deps chromium
npm run scrape
```

OS package installation may require administrator access. Keep download checksums and TLS verification enabled. Alternatively supply a compatible existing Chromium executable. Playwright's bundled Chromium is not guaranteed to fit or run within a Vercel function's size, memory, and execution limits. Run the browser worker on an approved Linux host/container; use Vercel for the web/API tier. Allow the actual county hosts and only their verified required subresources. No challenge/CAPTCHA bypass is included.

## Contracts

Contracts are unaudited. Test first on a local chain, then an appropriate testnet with a test asset. Production USDC can freeze addresses; ERC-4626 shares can lose principal, withdrawals can be illiquid, and recorded lien face value is not a guaranteed collectible asset. Default/NAV recognition requires timely operator action. LP returns derive only from actual repayment spread; there is no external yield protocol or promised yield.

1. Independently audit contracts, the USDC address, legal assignment mechanics, access controls, and economic model. Establish a multisig and loss/servicing policy.
2. Set deployment-only variables and run `npm run deploy:contracts`. The deployer grants the clearing contract the vault's `CLEARING_ROLE`, grants vault administration to the multisig, and renounces its own vault administration when distinct. The clearing contract starts with only the multisig as admin; no underwriting or resolver roles are granted automatically.
3. Through the multisig, grant clearing `UNDERWRITER_ROLE` and `RESOLVER_ROLE` only to reviewed servicing identities. Deposit approved six-decimal USDC into the ERC-4626 vault after approving the asset transfer. Record all deployed addresses and chain IDs.
4. After independent verification of an executed assignment, an underwriter calls `verifyClaim` with canonical county, instrument, parcel, face value in USDC units (six decimals), contractor wallet, and terms hash. County spelling must be normalized by servicing policy. On-chain duplicates are scoped to exact county/instrument strings.
5. Contractor signs EIP-712 domain `{name:"LPS Mechanics Lien Assignment",version:"1",chainId,verifyingContract}` and type `Assignment(uint256 tokenId,bytes32 termsHash,uint256 advance,uint256 deadline)`. Submit `fund(tokenId, deadline, signature)`. The contract checks signer, terms, amount, expiry, chain/contract domain, and state before advancing exactly 93% of face value. EIP-1271 contract wallets are supported. Web acceptance is a separate proof and cannot substitute for this signature. An operational bridge and live transaction UI are **not included**.
6. Payer approves the **vault** for full face value and calls `resolve(tokenId)` on clearing. The principal plus 7% spread increases LP NAV; the 7% is not separately sent to an operator treasury. The claim is burned and metadata/state retained. A blockchain settlement does not record a county satisfaction; servicing must do so independently. Partial repayments and statutory disputes require off-chain servicing; the contract only handles full resolution or write-off.
7. To recognize a fully impaired claim, pause both clearing and vault, then have an authorized resolver call `writeOff(tokenId,evidenceHash)`. LP NAV loses outstanding principal. Document loss evidence and have the admin unpause only after review. Pausing blocks new funding/deposits/withdrawals but does not block full repayment.

Role holders are trusted and can cause financial loss by approving invalid claims or misrecognizing losses. Minimize permissions, use multisig/delayed operations, and monitor emitted events. Do not deploy with depositor funds based solely on the tests in this repository.
