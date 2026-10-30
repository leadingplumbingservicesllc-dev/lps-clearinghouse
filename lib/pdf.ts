import PDFDocument from "pdfkit";
export async function reportPdf(
  address: string,
  evidence: unknown,
  analysis: unknown,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    margin: 50,
    info: {
      Title: "Hydraulic screening — Leading Plumbing Services",
      Author: "Leading Plumbing Services",
    },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.fontSize(22).text("Sub-Surface Hydraulic Screening").moveDown();
  doc.fontSize(12).text(address).text(new Date().toISOString()).moveDown();
  doc
    .fontSize(10)
    .text(
      "Preliminary screening only. Not a site inspection, certified technical audit, engineering opinion, credit rating, or legal advice. Pipe material and condition require physical inspection. Cost ranges are unverified planning estimates.",
    )
    .moveDown();
  doc.fontSize(14).text("Analysis");
  doc
    .fontSize(10)
    .text(JSON.stringify(analysis, null, 2))
    .moveDown();
  doc.fontSize(14).text("Source evidence");
  doc
    .fontSize(9)
    .text(JSON.stringify(evidence, null, 2))
    .moveDown();
  doc
    .fontSize(12)
    .text(
      "Request an on-site diagnostic assessment from Leading Plumbing Services before committing capital or planning remediation.",
    );
  doc.end();
  return done;
}
