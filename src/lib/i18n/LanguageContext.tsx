"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, LANGUAGE_STORAGE_KEY, languageInfo, type AppLanguage } from "./languages";
import { translate, type I18nKey } from "./strings";

interface LanguageState {
  lang: AppLanguage;
  rtl: boolean;
  setLang: (code: AppLanguage) => void;
  t: (key: I18nKey) => string;
}

const LanguageContext = createContext<LanguageState | null>(null);

/**
 * The UI language. English is the default (the whole app is English);
 * the shopkeeper can switch the entire app — labels, buttons, headings
 * — into Urdu, Pashto, Punjabi, Sindhi, Arabic, or Hindi from the
 * language list in the top bar. The choice lives only in this browser
 * (localStorage) and applies instantly, including right-to-left layout
 * for Urdu, Pashto, Punjabi, Sindhi, and Arabic.
 */
export function LanguageProvider({ children, initialLang }: { children: ReactNode; initialLang?: AppLanguage }) {
  // The initial language comes from the server (read from the cookie in
  // the root layout), so the first paint already matches the saved
  // choice — no flash of English, no hydration mismatch. Client-side
  // switches write the choice back to both the cookie and localStorage.
  const [lang, setLangState] = useState<AppLanguage>(initialLang ?? DEFAULT_LANGUAGE);

  useEffect(() => {
    const info = languageInfo(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = info.rtl ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((code: AppLanguage) => {
    setLangState(code);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
      document.cookie = `${LANGUAGE_COOKIE}=${code}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Private mode or blocked storage — the language still applies for this visit.
    }
  }, []);

  const t = useCallback((key: I18nKey) => translate(lang, key), [lang]);

  const value = useMemo<LanguageState>(
    () => ({ lang, rtl: languageInfo(lang).rtl, setLang, t }),
    [lang, setLang, t],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageState {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
