import { db } from "@/lib/db";
import { digest } from "@/lib/security";
import { notFound } from "next/navigation";
import { Acceptance } from "./signature";
export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Escrow({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) notFound();
  const c = await db.campaign.findUnique({
    where: { tokenHash: digest(token) },
    include: { lien: true },
  });
  if (
    !c ||
    c.tokenExpiresAt < new Date() ||
    !c.approvedAt ||
    c.status !== "SENT"
  )
    notFound();
  const message = `Leading Plumbing Services assignment review\nCampaign: ${c.id}\nCounty: ${c.lien.county}\nInstrument: ${c.lien.instrumentNumber}\nTerms SHA-256: ${c.assignmentDigest}\nExpires: ${c.tokenExpiresAt.toISOString()}\nI reviewed and accept these terms as the authorized signatory. Funding requires a separately verified on-chain authorization.`;
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl">Assignment review</h1>
      <p className="my-5">
        {c.lien.county} · Instrument {c.lien.instrumentNumber}
      </p>
      <p>
        Face amount: ${(Number(c.lien.amountCents) / 100).toFixed(2)} · Proposed
        advance: ${(Number((c.lien.amountCents * 93n) / 100n) / 100).toFixed(2)}
      </p>
      <pre className="my-8 whitespace-pre-wrap rounded border border-slate-700 p-6 font-sans text-sm leading-7">
        {c.assignmentText}
      </pre>
      {c.acceptedAt ? (
        <p>
          Acceptance recorded. Independent verification and funding review are
          pending.
        </p>
      ) : (
        <Acceptance token={token} message={message} />
      )}
    </main>
  );
}
