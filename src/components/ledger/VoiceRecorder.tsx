"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

type SpeechRecognitionInstance = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Language fallbacks: en-PK / ur-PK / ps-AF are not supported in every Chrome build. */
function languageChain(language: string): string[] {
  if (language.startsWith("ps")) return ["ps-AF", "ps", "ur-PK", "en-US"];
  return language.startsWith("ur") ? ["ur-PK", "ur-IN", "en-US"] : ["en-PK", "en-US", "en-GB"];
}

const MAX_RESTARTS = 5;

/**
 * Hands-free dictation that actually keeps listening.
 * Two modes:
 *  - "speech": live Web Speech API (no key needed) - continuous +
 *    interim results, auto-restart, language fallback. Used when no
 *    Gemini key is available, or when the key is OpenAI/Claude (those
 *    providers have no audio input, so speech is transcribed live and
 *    the transcript is parsed as text).
 *  - "audio": record a voice note and hand the audio to Gemini, which
 *    transcribes + parses it itself - the path the hackathon statement
 *    describes, and the accurate one for Pashto/Urdu speech that the
 *    browser's speech recognition mangles. Used only with a Gemini key.
 * Fixes over the first version, which stopped after the first pause
 * (continuous=false, interimResults=false) and showed nothing while
 * the user was speaking, and whose recording fallback was never
 * transcribed at all.
 */
export function VoiceRecorder({ onTranscript, onAudio, mode = "speech", language = "en-PK", disabled = false }: {
  onTranscript?: (text: string) => void; onAudio?: (blob: Blob) => void;
  mode?: "speech" | "audio"; language?: string; disabled?: boolean;
}) {
  const supported = mode === "audio" ? true : getSpeechRecognition() !== null;
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const wantListening = useRef(false);
  const restarts = useRef(0);
  const langIndex = useRef(0);
  const finalRef = useRef("");

  useEffect(() => () => {
    wantListening.current = false;
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    try { mediaRef.current?.stop(); } catch { /* already stopped */ }
  }, []);

  function startRecognition() {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const langs = languageChain(language);
    const rec = new Ctor();
    rec.lang = langs[Math.min(langIndex.current, langs.length - 1)];
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          const text = result[0]?.transcript?.trim();
          if (text) {
            finalRef.current = finalRef.current ? `${finalRef.current} ${text}` : text;
            onTranscript?.(text);
          }
        } else {
          interimText += result[0]?.transcript ?? "";
        }
      }
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return; // keep listening
      if (e.error === "language-not-supported" && langIndex.current < languageChain(language).length - 1) {
        langIndex.current += 1;
        try { rec.start(); } catch { /* will surface on next error */ }
        return;
      }
      const messages: Record<string, string> = {
        "not-allowed": "Microphone blocked — allow it in the browser, or type the entry.",
        "audio-capture": "No microphone found — type the entry instead.",
        "language-not-supported": "Voice typing isn't available in this language on this browser — type the entry.",
        "network": "Voice typing needs internet — check the connection, or type the entry.",
      };
      setError(messages[e.error] ?? "Voice recognition failed — type the entry instead.");
      wantListening.current = false;
      setListening(false);
    };
    rec.onend = () => {
      setInterim("");
      // Chrome ends recognition after a silence even with continuous=true.
      // Restart while the user still wants to speak, a few times max.
      if (wantListening.current && restarts.current < MAX_RESTARTS) {
        restarts.current += 1;
        window.setTimeout(() => { if (wantListening.current) { try { rec.start(); } catch { /* stopped */ } } }, 250);
        return;
      }
      if (wantListening.current) setError("Voice stopped after a long pause — tap Speak entry to continue, or type the rest.");
      setListening(false);
    };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setError("Could not start voice recognition."); }
  }

  function start() {
    if (!supported) return;
    setError(null);
    if (mode === "audio") { void startVoiceNote(); return; }
    setInterim("");
    finalRef.current = "";
    wantListening.current = true;
    restarts.current = 0;
    langIndex.current = 0;
    startRecognition();
  }

  /** Audio mode: record the voice note; the audio goes to Gemini on stop. */
  async function startVoiceNote() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => {
        try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
      }) ?? "";
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size > 0) onAudio?.(blob);
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setError("Microphone unavailable — allow it in the browser, or type the entry.");
    }
  }

  function stop() {
    if (recording) { try { mediaRef.current?.stop(); } catch { /* noop */ } return; }
    wantListening.current = false;
    try { recRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
    setInterim("");
  }

  const active = listening || recording;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" aria-pressed={active} disabled={disabled || !supported}
        title={supported ? undefined : "Voice typing needs Chrome or Edge — type the entry instead."}
        onClick={() => (active ? stop() : start())}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${active ? "bg-red-600 text-white" : "border border-stone-300 bg-white hover:bg-stone-50"} disabled:opacity-50`}>
        {active ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        {listening ? "Listening… tap to stop" : recording ? "Recording voice note… tap to stop" : mode === "audio" ? "Record voice note" : "Speak entry"}
      </button>
      {listening && interim ? <span className="max-w-64 text-xs italic text-stone-500" aria-live="polite">“{interim}”</span> : null}
      {recording ? <span className="max-w-56 text-xs text-stone-500">Gemini will transcribe and parse this voice note.</span> : null}
      {!supported ? <span className="max-w-56 text-xs text-stone-500">Voice typing needs Chrome or Edge — type the entry instead.</span> : null}
      {error ? <span role="alert" className="max-w-56 text-xs text-red-700">{error}</span> : null}
    </span>
  );
}
