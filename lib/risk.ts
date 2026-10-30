import { officialEvidence } from "./property-evidence";
import { SchemaType } from "@google/generative-ai";
import { z } from "zod";
import { structured } from "./agents/underwriting-swarm";
import { httpsUrl, required } from "./config";
const Evidence = z
  .object({
    address: z.string(),
    parcelId: z.string().min(1),
    buildingYear: z.number().int().min(1800).max(new Date().getFullYear()),
    latitude: z.number().min(25).max(28),
    longitude: z.number().min(-82).max(-79),
    soilSalinityDsM: z.number().min(0).max(100),
    coastDistanceMeters: z.number().nonnegative(),
    sources: z
      .array(
        z.object({
          url: z.string().url(),
          retrievedAt: z.string().datetime(),
          description: z.string().min(5),
        }),
      )
      .min(2),
  })
  .strict();
const Analysis = z
  .object({
    score: z.number().int().min(0).max(100),
    castIronDegradationLikelihood: z.enum([
      "low",
      "moderate",
      "high",
      "unknown",
    ]),
    estimatedRemediationMinUsd: z.number().nonnegative(),
    estimatedRemediationMaxUsd: z.number().nonnegative(),
    explanation: z.string().min(50),
    limitations: z.array(z.string()).min(1),
  })
  .strict()
  .refine(
    (v) => v.estimatedRemediationMaxUsd >= v.estimatedRemediationMinUsd,
    "Invalid cost range",
  );
export async function assessRisk(address: string) {
  // Operator-owned adapter must join official appraiser parcel data and a sourced salinity/coastal GIS layer.
  let raw: unknown;
  if (process.env.PROPERTY_EVIDENCE_URL) {
    const url = httpsUrl("PROPERTY_EVIDENCE_URL");
    url.searchParams.set("address", address);
    const headers: Record<string, string> = {};
    if (process.env.PROPERTY_EVIDENCE_API_KEY)
      headers.authorization = `Bearer ${required("PROPERTY_EVIDENCE_API_KEY")}`;
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(20000),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(`Property evidence HTTP ${response.status}`);
    raw = await response.json();
  } else {
    raw = await officialEvidence(address);
  }
  const evidence = Evidence.parse(raw);
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalize(evidence.address) !== normalize(address))
    throw new Error("Evidence address mismatch");
  for (const source of evidence.sources) {
    if (
      Date.now() - Date.parse(source.retrievedAt) > 30 * 86400000 ||
      Date.parse(source.retrievedAt) > Date.now() + 60000
    )
      throw new Error("Evidence freshness invalid");
  }
  const age = new Date().getFullYear() - evidence.buildingYear;
  const baseline = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        100 -
          Math.min(age, 100) * 0.5 -
          Math.min(evidence.soilSalinityDsM, 20) * 1.5 -
          (evidence.coastDistanceMeters < 1000
            ? 20
            : evidence.coastDistanceMeters < 5000
              ? 10
              : 0),
      ),
    ),
  );
  const analysis = await structured(
    "Provide a preliminary hydraulic screening, not an engineering inspection or insurance rating. Score 100 means lower risk. Use supplied deterministic baseline as the score; explain age, measured salinity, and coastal distance. Pipe material is unverified: report castIronDegradationLikelihood as unknown unless there is direct material evidence (none supplied). Costs are preliminary scenario ranges, not quotes. Never claim calibration, measured pipe condition, or Chapter 713 legal conclusions.",
    { evidence, baseline },
    {
      type: SchemaType.OBJECT,
      properties: {
        score: { type: SchemaType.INTEGER },
        castIronDegradationLikelihood: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["low", "moderate", "high", "unknown"],
        },
        estimatedRemediationMinUsd: { type: SchemaType.NUMBER },
        estimatedRemediationMaxUsd: { type: SchemaType.NUMBER },
        explanation: { type: SchemaType.STRING },
        limitations: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
        },
      },
      required: [
        "score",
        "castIronDegradationLikelihood",
        "estimatedRemediationMinUsd",
        "estimatedRemediationMaxUsd",
        "explanation",
        "limitations",
      ],
    },
    Analysis,
  );
  if (
    analysis.score !== baseline ||
    analysis.castIronDegradationLikelihood !== "unknown"
  )
    throw new Error("Model contradicted evidence constraints");
  return { evidence, analysis };
}
