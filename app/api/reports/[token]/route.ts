import { db } from "@/lib/db";
import { digest, failure, HttpError } from "@/lib/security";
import { reportPdf } from "@/lib/pdf";
export const runtime = "nodejs";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new HttpError(404, "Report not found");
    const report = await db.riskReport.findUnique({
      where: { tokenHash: digest(token) },
    });
    if (!report || report.expiresAt < new Date())
      throw new HttpError(404, "Report expired or not found");
    const pdf = await reportPdf(
      report.address,
      report.evidence,
      report.analysis,
    );
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition":
          'attachment; filename="lps-hydraulic-screening.pdf"',
        "cache-control": "private, no-store",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
