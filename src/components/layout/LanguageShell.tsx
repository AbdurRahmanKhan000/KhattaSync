import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, isAppLanguage } from "@/lib/i18n/languages";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

/**
 * The saved UI language, read from the cookie on the server so the first
 * paint already speaks the shopkeeper's language — no flash of English
 * and no hydration mismatch when the choice is Urdu or Pashto.
 *
 * The read sits inside a Suspense boundary: with cacheComponents the
 * static shell (English fallback) prerenders and the language-aware
 * shell streams in, so the build never tries to prerender a page with
 * request data it cannot have.
 *
 * This wraps the whole app — cover page and shell alike — so the
 * cover's tagline and button speak the saved language too. The app
 * shell (sidebar, top bar) lives one level down, in (shell)/layout.
 */
async function LanguageShellInner({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const saved = cookieStore.get(LANGUAGE_COOKIE)?.value;
  const initialLang = isAppLanguage(saved) ? saved : DEFAULT_LANGUAGE;
  return <LanguageProvider initialLang={initialLang}>{children}</LanguageProvider>;
}

export function LanguageShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LanguageProvider initialLang={DEFAULT_LANGUAGE}>{children}</LanguageProvider>}>
      <LanguageShellInner>{children}</LanguageShellInner>
    </Suspense>
  );
}
