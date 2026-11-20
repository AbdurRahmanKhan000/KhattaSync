"use client";
import { useState } from "react";
import { Plus } from "lucide-react";

export function TransactionEntryBar({ onSubmit }: { onSubmit?: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onSubmit?.(text.trim()); setText(""); } }}
    >
      <label htmlFor="ledger-entry" className="sr-only">New ledger entry</label>
      <input id="ledger-entry" value={text} onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Ahmed ko 4500 ka udhaar diya"
        className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
      <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800">
        <Plus className="h-4 w-4" /> Add entry
      </button>
    </form>
  );
}
