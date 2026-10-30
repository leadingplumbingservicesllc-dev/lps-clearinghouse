import { Button } from "@/components/ui/button";
export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex items-center justify-between border-b border-slate-800 pb-7">
        <a href="/" className="font-semibold tracking-tight">
          LEADING PLUMBING{" "}
          <span className="text-emerald-400">/ CLEARINGHOUSE</span>
        </a>
        <span className="text-xs text-slate-400">SOUTH FLORIDA</span>
      </header>
      <section className="max-w-3xl py-24">
        <p className="mb-6 text-xs tracking-[.25em] text-emerald-400">
          PUBLIC RECORDS · PRIVATE CAPITAL
        </p>
        <h1 className="text-5xl font-medium leading-tight md:text-7xl">
          Move from recorded claims to reviewed liquidity.
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-slate-400">
          A controlled workflow for trade receivables. Source records, evaluate
          evidence, review assignment terms, and fund through transparent
          escrow.
        </p>
        <div className="mt-10 flex gap-4">
          <Button asChild>
            <a href="mailto:liquidity@leadingplumbingservices.com">
              Discuss a recorded claim ↗
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="#process">How it works</a>
          </Button>
        </div>
      </section>
      <section
        id="process"
        className="grid gap-8 border-t border-slate-800 py-12 md:grid-cols-3"
      >
        {[
          {
            n: "01",
            title: "Verify the record",
            text: "County instruments and title details require independent verification before an offer.",
          },
          {
            n: "02",
            title: "Review the assignment",
            text: "Contractors receive private terms and a wallet signature request. Acceptance is subject to legal review.",
          },
          {
            n: "03",
            title: "Fund and reconcile",
            text: "Approved assignments can receive a 93% advance. Settlement depends on actual collection, not a guaranteed deadline.",
          },
        ].map((item) => (
          <article key={item.n}>
            <p className="text-sm text-emerald-400">{item.n}</p>
            <h2 className="my-4 text-xl">{item.title}</h2>
            <p className="text-sm leading-7 text-slate-400">{item.text}</p>
          </article>
        ))}
      </section>
      <aside className="rounded-xl border border-slate-800 bg-slate-900/50 p-8">
        <h2 className="text-xl">Commercial property hydraulic screening</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
          Authenticated partners can request evidence-based preliminary
          screening and a downloadable PDF. A physical inspection is required to
          establish pipe material, degradation, and remediation scope.
        </p>
      </aside>
      <footer className="mt-12 text-xs leading-6 text-slate-500">
        Leading Plumbing Services · No guaranteed funding, investment returns,
        lien priority, or title clearance. Digital records do not replace
        legally effective assignments or recorded satisfactions.
      </footer>
    </main>
  );
}
