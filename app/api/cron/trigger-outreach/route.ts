import { authorize, failure } from "@/lib/security";
import { drainQueue } from "@/lib/outreach/mailer";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(req: Request) {
  try {
    authorize(req, "CRON_SECRET");
    return Response.json(await drainQueue());
  } catch (e) {
    return failure(e);
  }
}
