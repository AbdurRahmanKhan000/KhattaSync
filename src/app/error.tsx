"use client";
import { useEffect } from "react";

/** Route-level error boundary: a crash in one page never takes down the whole khata. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Intentionally not sending the error anywhere — ledger data never leaves the browser.
  }, [error]);
  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-stone-600">
          This page hit an unexpected error. Your ledger is safe — it lives in this browser&apos;s IndexedDB and was not affected.
        </p>
        <button type="button" onClick={() => reset()} className="mt-4 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
          Try again
        </button>
      </div>
    </div>
  );
}
