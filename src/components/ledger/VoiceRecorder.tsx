"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

type SpeechRecognitionCtor = new () => {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
};

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Hands-free dictation: Web Speech API first (Urdu/English).
 * Fallback: MediaRecorder audio capture — if speech recognition is
 * unavailable the recording is kept local and the user is told to type
 * instead; nothing is transcribed by guessing.
 */
export function VoiceRecorder({ onTranscript, language = "en-PK", disabled = false }: {
  onTranscript?: (text: string) => void; language?: string; disabled?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);

  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* already stopped */ } }, []);

  async function start() {
    setError(null);
    const Ctor = getSpeechRecognition();
    if (Ctor) {
      const rec = new Ctor();
      rec.lang = language;
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = (e) => {
        const text = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" ").trim();
        if (text) onTranscript?.(text);
      };
      rec.onerror = (e) => { setError(e.error === "not-allowed" ? "Microphone blocked — allow it in the browser, or type the entry." : "Voice recognition failed — type the entry instead."); setListening(false); };
      rec.onend = () => setListening(false);
      recRef.current = rec;
      try { rec.start(); setListening(true); } catch { setError("Could not start voice recognition."); }
      return;
    }
    // Fallback: MediaRecorder — capture only, no fake transcription.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); setRecording(false); setError("This browser has no speech recognition — audio was recorded locally only. Please type the entry."); };
    } catch {
      setError("Microphone unavailable — type the entry instead.");
    }
  }

  function stop() {
    if (listening) { try { recRef.current?.stop(); } catch { /* noop */ } setListening(false); return; }
    if (recording) { try { mediaRef.current?.stop(); } catch { /* noop */ } }
  }

  const active = listening || recording;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" aria-pressed={active} disabled={disabled} onClick={() => (active ? stop() : void start())}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${active ? "bg-red-600 text-white" : "border border-stone-300 bg-white hover:bg-stone-50"} disabled:opacity-50`}>
        {active ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {listening ? "Listening… tap to stop" : recording ? "Recording… tap to stop" : "Speak entry"}
      </button>
      {error ? <span role="alert" className="max-w-56 text-xs text-red-700">{error}</span> : null}
    </span>
  );
}
