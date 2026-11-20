"use client";
import { useRef, useState } from "react";
import { clearAllLocalData, exportBackup, importBackup, listTransactions } from "@/lib/db";
import { downloadFile, entriesToCSV, toJsonDownload } from "@/lib/utils";
import { ConfirmDialog } from "@/components/shared";

export function DataExportImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  async function doExportJson() {
    const backup = await exportBackup();
    downloadFile(`khattasync-backup-${new Date().toISOString().slice(0, 10)}.json`, toJsonDownload(backup), "application/json");
    setStatus(`Exported ${backup.customers.length} customers, ${backup.transactions.length} transactions.`);
  }

  async function doExportCsv() {
    const txns = await listTransactions();
    downloadFile("khattasync-ledger.csv", entriesToCSV(txns), "text/csv");
    setStatus(`Exported ${txns.length} transactions as CSV.`);
  }

  async function onImportFile(file: File) {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const r = await importBackup(parsed);
      setStatus(`Imported ${r.customers} customers, ${r.transactions} transactions, ${r.entryLogs} entry logs.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Import failed.");
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="font-semibold">Export / import / clear</h2>
      <p className="mt-1 text-sm text-stone-500">Your backup lives in this browser only. Export downloads a JSON file; import replaces local data after validation.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={doExportJson} className="rounded-lg border px-3 py-2 text-sm font-medium">Export JSON backup</button>
        <button type="button" onClick={doExportCsv} className="rounded-lg border px-3 py-2 text-sm font-medium">Export CSV</button>
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border px-3 py-2 text-sm font-medium">Import JSON backup</button>
        <button type="button" onClick={() => setConfirmClear(true)} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700">Clear My Local Data</button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImportFile(f); e.target.value = ""; }} />
      {status ? <p role="status" className="mt-3 text-sm text-stone-600">{status}</p> : null}
      {confirmClear ? (
        <ConfirmDialog
          title="Clear My Local Data?"
          message="This deletes every customer, transaction, entry log and setting in THIS browser only. Export a backup first if you want to keep it."
          onCancel={() => setConfirmClear(false)}
          onConfirm={async () => { await clearAllLocalData(); setConfirmClear(false); setStatus("All local data cleared in this browser."); }}
        />
      ) : null}
    </section>
  );
}
