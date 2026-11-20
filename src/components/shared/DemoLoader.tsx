"use client";
import { useState } from "react";
import { loadSampleShopData } from "@/lib/db";

export function DemoLoader() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await loadSampleShopData(false);
            setStatus(`Sample shop loaded in this browser only: ${r.customers} customers, ${r.transactions} entries`);
          } catch (err) {
            setStatus(err instanceof Error ? err.message : "Could not load sample data.");
          } finally { setBusy(false); }
        }}
        className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-50"
      >
        {busy ? "Loading…" : "Load Sample Shop Data"}
      </button>
      {status ? <span role="status" className="text-sm text-stone-600">{status}</span> : null}
    </div>
  );
}
