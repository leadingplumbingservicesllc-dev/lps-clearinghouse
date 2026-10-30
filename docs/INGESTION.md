# Source integration and verification

The requested portals are `https://erec.mypalmbeachclerk.com/` and `https://officialrecords.broward.org/`. Both returned proxy policy denials during this task, so their current forms, field mappings, document codes, pagination, coverage, and terms could not be inspected. The supplied Palm Beach URL must also be checked to ensure it is a public search portal rather than an e-recording submission portal. This adapter is **implemented but not live-verified**; do not schedule it until verified against actual instruments.

`PORTAL_CONFIG_PATH` points to a JSON file with two keys: `palm-beach` and `broward`. Each value must contain:

| Key | Required meaning |
| --- | --- |
| `searchUrl` | Actual HTTPS search form URL on the exact county host |
| `readySelector` | CSS selector confirming form loaded |
| `fromSelector`, `toSelector` | Date input selectors accepting MM/DD/YYYY |
| `typeSelector` | Native HTML select for document type |
| `submitSelector` | Search action selector |
| `rowSelector` | Repeated result-row selector |
| `detailLinkSelector` | Detail anchor selector relative to each result row |
| `nextSelector` | Optional next-page control; omission means a verified single-page result |
| `documentValues` | Actual portal values keyed by `LIEN`, `MECHANICS LIEN`, `NOTICE TO OWNER` |
| `fields` | Detail-page text selectors keyed by `instrumentNumber`, `documentType`, `recordingDate`, `grantor`, `grantee`, `amount`, `legalDescription`, `siteAddress`; optional `bookPage`, `parcelId` |

No invented selectors are distributed. The scraper submits a rolling 14-day inclusive search, iterates document types and pagination, visits detail pages, validates every required field/date/amount, hashes source values, and persists deduplicated records. It fails on an empty-result selector timeout, unsupported document types, missing metadata, changed pagination, challenges, or incomplete records. It does not bypass CAPTCHAs, guess amounts from OCR, assume every grantor is a property owner, or infer pipe/site details from an unrelated address. Instrument grantor/grantee conventions must be verified for each document type. Some NTOs are not recorded official records and some instruments require purchased images. These are coverage constraints, not permission to fabricate records.

If actual county portals require frames, custom controls, authentication, related domains, images/OCR, or different type labels, a county-specific code integration is still required. Preserve county terms, rate limits, and access restrictions. Only explicitly allow verified subresource hosts; the adapter currently restricts requests to the configured county host.

Run `npm run scrape` with exported environment variables or `node --env-file=.env --import tsx scripts/scraper-florida-liens.ts`. Install Chrome and its dependencies as documented in deployment. The import never launches outreach. Review the instrument, property, amount, contractor identity, statutory eligibility, and source before marking a record verified:

```sh
node --env-file=.env --import tsx scripts/review.ts verify-lien LIEN_ID --reviewed
node --env-file=.env --import tsx scripts/prepare-campaign.ts LIEN_ID
# Review copy, recipient provenance, economics, approved terms, and legal eligibility:
node --env-file=.env --import tsx scripts/review.ts approve-campaign CAMPAIGN_ID --reviewed
```

These are privileged operator commands requiring database access. `--reviewed` records an operator attestation; it does not perform legal review. Protect and audit access through your operational identity system. No admin UI or identity-provider integration is included.

Sunbiz discovery only accepts an explicitly published mailto in an exact matching business row. Sunbiz normally does not publish email: the usual outcome is no contact. Optional `LICENSE_DIRECTORY_URL` must be a trusted HTTPS directory accepting `?business=` and returning an array of `{business, email, sourceUrl}`. Only a unique exact business match is eligible. Do not guess email patterns or use a registered agent's address as a subcontractor contact. A native municipal directory adapter requires that municipality's documented schema and authorization.
