"use client";
import { useState } from "react";
import { Mic, Square } from "lucide-react";

export function VoiceRecorder({ onTranscript }: { onTranscript?: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={recording}
      onClick={() => { const next = !recording; setRecording(next); if (!next) onTranscript?.(""); }}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${recording ? "bg-red-600 text-white" : "border border-stone-300 bg-white hover:bg-stone-50"}`}
    >
      {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      {recording ? "Stop recording" : "Record voice entry"}
    </button>
  );
}
