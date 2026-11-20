import type { AiKeyMode } from "@/types";

const STYLES: Record<AiKeyMode, string> = {
  host: "bg-emerald-100 text-emerald-800",
  personal: "bg-sky-100 text-sky-800",
  none: "bg-red-100 text-red-800",
};
const LABELS: Record<AiKeyMode, string> = {
  host: "Host Hosted Key",
  personal: "Personal User API Key",
  none: "No AI Key",
};

export function ApiModeBadge({ mode }: { mode: AiKeyMode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[mode]}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[mode]}
    </span>
  );
}
