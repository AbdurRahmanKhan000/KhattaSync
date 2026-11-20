"use client";
import { CheckCircle2, AlertCircle } from "lucide-react";

export function Toast({ message, tone = "success" }: { message: string; tone?: "success" | "error" }) {
  return (
    <div role="status" className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm shadow-sm">
      {tone === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
      <span>{message}</span>
    </div>
  );
}
