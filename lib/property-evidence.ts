import { z } from "zod";
import { httpsUrl, required } from "./config";
async function query(url: URL, params: Record<string, string>) {
  for (const [key, value] of Object.entries({
    ...params,
    f: "json",
    outFields: "*",
    returnGeometry: "true",
  }))
    url.searchParams.set(key, value);
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`GIS HTTP ${response.status}`);
  const body = z
    .object({
      features: z.array(
        z.object({
          attributes: z.record(z.string(), z.unknown()),
          geometry: z.object({ x: z.number(), y: z.number() }).optional(),
        }),
      ),
    })
    .parse(await response.json());
  if (body.features.length !== 1)
    throw new Error("GIS requires a unique property / soil polygon match");
  return body.features[0];
}
const field = (name: string) =>
  z
    .string()
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
    .parse(required(name));
export async function officialEvidence(address: string) {
  const appraiser = httpsUrl("APPRAISER_QUERY_URL"),
    soil = httpsUrl("SOIL_QUERY_URL");
  const addressField = field("APPRAISER_ADDRESS_FIELD"),
    yearField = field("APPRAISER_YEAR_FIELD"),
    parcelField = field("APPRAISER_PARCEL_FIELD");
  const property = await query(new URL(appraiser), {
    where: `UPPER(${addressField}) = '${address.toUpperCase().replace(/'/g, "''")}'`,
    outSR: "4326",
  });
  if (!property.geometry) throw new Error("Parcel point geometry required");
  const { x, y } = property.geometry;
  const salinityField = field("SOIL_SALINITY_FIELD"),
    distanceField = field("SOIL_COAST_DISTANCE_FIELD");
  const soilRecord = await query(new URL(soil), {
    geometry: JSON.stringify({ x, y, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    returnGeometry: "false",
  });
  const year = z.number().int().parse(property.attributes[yearField]);
  const salinity = z.number().parse(soilRecord.attributes[salinityField]);
  const distance = z.number().parse(soilRecord.attributes[distanceField]);
  return {
    address: z.string().parse(property.attributes[addressField]),
    parcelId: z
      .union([z.string(), z.number()])
      .parse(property.attributes[parcelField])
      .toString(),
    buildingYear: year,
    latitude: y,
    longitude: x,
    soilSalinityDsM: salinity,
    coastDistanceMeters: distance,
    sources: [
      {
        url: appraiser.toString(),
        retrievedAt: new Date().toISOString(),
        description: required("APPRAISER_DATA_DESCRIPTION"),
      },
      {
        url: soil.toString(),
        retrievedAt: new Date().toISOString(),
        description: required("SOIL_DATA_DESCRIPTION"),
      },
    ],
  };
}
