"use client";
import { useState } from "react";
import { BrowserProvider } from "ethers";
import { Button } from "@/components/ui/button";
export function Acceptance({
  token,
  message,
}: {
  token: string;
  message: string;
}) {
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      const ethereum = (
        window as unknown as {
          ethereum?: ConstructorParameters<typeof BrowserProvider>[0];
        }
      ).ethereum;
      if (!ethereum) throw new Error("Install an EIP-1193 compatible wallet");
      const provider = new BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(message);
      const response = await fetch(`/api/escrow/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          wallet: await signer.getAddress(),
          signature,
          consent,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setStatus("Acceptance recorded. Funding verification is pending.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Unable to record signature");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <label className="block">
        Authorized signatory name
        <input
          className="my-3 block w-full rounded border border-slate-600 bg-slate-900 p-3"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={150}
        />
      </label>
      <label className="my-5 flex gap-3">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        I have authority to accept and consent to an electronic record and
        wallet signature.
      </label>
      <Button
        onClick={submit}
        disabled={busy || !consent || name.trim().length < 2}
      >
        {busy ? "Awaiting signature…" : "Sign acceptance with wallet"}
      </Button>
      <p role="status" className="mt-5">
        {status}
      </p>
    </section>
  );
}
