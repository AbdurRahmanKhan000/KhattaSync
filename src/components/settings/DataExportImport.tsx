"use client";
import { DEMO_ENTRIES } from "@/constants";
import { downloadFile, entriesToCSV, toJsonDownload } from "@/lib/utils";

export function DataExportImport() {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-semibold">Export / import</h2>
      <p className="mt-1 text-sm text-stone-500">Download your whole khata as CSV or JSON. Import coming in the next prompt.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => downloadFile("khattasync-ledger.csv", entriesToCSV(DEMO_ENTRIES), "text/csv")} className="rounded-lg border px-3 py-2 text-sm font-medium">Export CSV</button>
        <button type="button" onClick={() => downloadFile("khattasync-ledger.json", toJsonDownload(DEMO_ENTRIES), "application/json")} className="rounded-lg border px-3 py-2 text-sm font-medium">Export JSON</button>
      </div>
    </section>
  );
}
