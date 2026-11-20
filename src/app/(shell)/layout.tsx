import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Layout for the app itself (dashboard, agent, customers, settings).
 * The cover page at / deliberately stays outside this shell — no
 * sidebar, no top bar — it is just the logo, the name, one sentence,
 * and the button into the app.
 */
export default function ShellLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
