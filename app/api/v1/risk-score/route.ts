import { z } from "zod";
import {
  authorize,
  failure,
  jsonBody,
  rateLimit,
  digest,
  newToken,
} from "@/lib/security";
import { publicOrigin } from "@/lib/config";
import { assessRisk } from "@/lib/risk";
import { db } from "@/lib/db";
export const runtime = "nodejs";
export const maxDuration = 90;
export async function POST(req: Request) {
  try {
    authorize(req, "B2B_API_KEY");
    await rateLimit("risk:global", 20, 3600);
    const input = z
      .object({ address: z.string().min(8).max(300) })
      .strict()
      .parse(await jsonBody(req));
    const result = await assessRisk(input.address);
    const token = newToken();
    const expiresAt = new Date(Date.now() + 3600000);
    await db.riskReport.create({
      data: {
        tokenHash: digest(token),
        address: input.address,
        ...result,
        expiresAt,
      },
    });
    return Response.json(
      {
        ...result,
        reportUrl: `${publicOrigin()}/api/reports/${token}`,
        expiresAt,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
