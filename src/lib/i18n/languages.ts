/** App languages for the UI language selector. The ledger itself stays
 *  in English by default; this list lets a shopkeeper switch the whole
 *  app into the language they read best. Everything is stored only in
 *  this browser (localStorage), and any missing string falls back to
 *  English so the UI can never show a blank label. */

export type AppLanguage = "en" | "ur" | "ps" | "pa" | "sd" | "ar" | "hi";

export interface LanguageInfo {
  code: AppLanguage;
  /** English name, for the selector list. */
  name: string;
  /** Name in its own language/script. */
  nativeName: string;
  rtl: boolean;
  /** Web Speech recognition code for voice input in this language, when supported. */
  speechCode?: string;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: "en", name: "English", nativeName: "English", rtl: false, speechCode: "en-PK" },
  { code: "ur", name: "Urdu", nativeName: "اردو", rtl: true, speechCode: "ur-PK" },
  { code: "ps", name: "Pashto", nativeName: "پښتو", rtl: true, speechCode: "ps-AF" },
  { code: "pa", name: "Punjabi", nativeName: "پنجابی", rtl: true },
  { code: "sd", name: "Sindhi", nativeName: "سنڌي", rtl: true },
  { code: "ar", name: "Arabic", nativeName: "العربية", rtl: true },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", rtl: false },
];

export const DEFAULT_LANGUAGE: AppLanguage = "en";

export const LANGUAGE_STORAGE_KEY = "khattasync:lang";

/** Same choice, as a cookie, so the server can render the first paint in
 *  the right language — otherwise the server renders English, the client
 *  hydrates Urdu from localStorage, and React logs a hydration error. */
export const LANGUAGE_COOKIE = "khattasync-lang";

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === "string" && (LANGUAGES as { code: string }[]).some((l) => l.code === value);
}

export function languageInfo(code: AppLanguage): LanguageInfo {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
