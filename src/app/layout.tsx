import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LanguageShell } from "@/components/layout/LanguageShell";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KhattaSync — Digital Ledger for Shopkeepers",
  description: "AI-powered voice and text ledger (credit ledger) for neighbourhood shopkeepers and small merchants.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#f8f7f4] text-stone-900">
        <LanguageShell>{children}</LanguageShell>
      </body>
    </html>
  );
}
