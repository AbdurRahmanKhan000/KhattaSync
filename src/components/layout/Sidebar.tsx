"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, LayoutDashboard, Settings, Users } from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-stone-200 bg-white p-4 md:flex">
      <div className="flex items-center gap-2 px-2 py-3">
        <BookOpen className="h-6 w-6 text-emerald-700" />
        <span className="text-lg font-bold tracking-tight">KhattaSync</span>
      </div>
      <nav className="mt-4 space-y-1" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${pathname === href ? "bg-emerald-50 text-emerald-800" : "text-stone-600 hover:bg-stone-50"}`}>
            <Icon className="h-4 w-4" /> {label}
          </Link>
        ))}
      </nav>
      <p className="mt-auto px-2 text-xs text-stone-400">Your data stays in this browser.</p>
    </aside>
  );
}
