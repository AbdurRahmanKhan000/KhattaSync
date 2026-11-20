"use client";
import { useState } from "react";
import { DEMO_CUSTOMERS, DEMO_ENTRIES } from "@/constants";

export function DemoLoader() {
  const [loaded, setLoaded] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setLoaded(true)}
      className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-stone-50"
    >
      {loaded ? `Demo loaded: ${DEMO_CUSTOMERS.length} customers, ${DEMO_ENTRIES.length} entries` : "Load sample demo data"}
    </button>
  );
}
