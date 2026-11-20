"use client";
import { useEffect } from "react";

/** Root error boundary — last resort if even the layout fails to render. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Intentionally not sending the error anywhere — ledger data never leaves the browser.
  }, [error]);
  return (
    <html lang="en">
      <body className="min-h-full bg-[#f8f7f4] text-stone-900">
        <div className="mx-auto max-w-lg p-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-bold">Something went wrong</h1>
            <p className="mt-2 text-sm text-stone-600">
              KhattaSync could not start on this page. Your ledger is safe in this browser&apos;s IndexedDB — reload and try again.
            </p>
            <button type="button" onClick={() => reset()} className="mt-4 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white">
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
