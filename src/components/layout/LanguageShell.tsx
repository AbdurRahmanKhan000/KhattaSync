import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, isAppLanguage } from "@/lib/i18n/languages";
import { AppShell } from "./AppShell";

/**
 * The saved UI language, read from the cookie on the server so the first
 * paint already speaks the shopkeeper's language — no flash of English
 * and no hydration mismatch when the choice is Urdu or Pashto.
 *
 * The read sits inside a Suspense boundary: with cacheComponents the
 * static shell (English fallback) prerenders and the language-aware
 * shell streams in, so the build never tries to prerender a page with
 * request data it cannot have.
 */
async function LanguageShellInner({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const saved = cookieStore.get(LANGUAGE_COOKIE)?.value;
  const initialLang = isAppLanguage(saved) ? saved : DEFAULT_LANGUAGE;
  return <AppShell initialLang={initialLang}>{children}</AppShell>;
}

export function LanguageShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppShell initialLang={DEFAULT_LANGUAGE}>{children}</AppShell>}>
      <LanguageShellInner>{children}</LanguageShellInner>
    </Suspense>
  );
}
