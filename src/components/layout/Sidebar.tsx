"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Bot, LayoutDashboard, Plus, Search, Settings, Users, X } from "lucide-react";
import { formatPKR } from "@/lib/utils";
import { notifyDataChanged, useDashboard } from "./DashboardContext";
import { createCustomer } from "@/lib/db";
import { NewCustomerModal } from "@/components/ledger";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agent", label: "AI Agent", icon: Bot },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SidebarContent() {
  const pathname = usePathname();
  const { customers, selectedCustomerId, setSelectedCustomerId, setSidebarOpen } = useDashboard();
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q));
  }, [customers, query]);

  const receivable = customers.reduce((s, c) => s + Math.max(0, c.balance), 0);
  const payable = customers.reduce((s, c) => s + Math.max(0, -c.balance), 0);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-emerald-700" />
          <span className="text-lg font-bold tracking-tight">KhattaSync</span>
        </div>
        <button type="button" aria-label="Close menu" onClick={() => setSidebarOpen(false)} className="rounded-lg p-1 hover:bg-stone-100 md:hidden">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="space-y-1 px-4" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} onClick={() => setSidebarOpen(false)} aria-current={pathname === href ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${pathname === href ? "bg-emerald-50 text-emerald-800" : "text-stone-600 hover:bg-stone-50"}`}>
            <Icon className="h-4 w-4" /> {label}
          </Link>
        ))}
      </nav>

      <div className="mt-6 flex-1 overflow-y-auto px-4 pb-4">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-stone-500">Customer Ledgers (Khata)</h2>

        <div className="mt-3 flex gap-2">
          <span className="flex-1 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">Lena Hai · {formatPKR(receivable)}</span>
          <span className="flex-1 whitespace-nowrap rounded-full bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-800">Dena Hai · {formatPKR(payable)}</span>
        </div>

        <label className="mt-3 flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-stone-400" />
          <span className="sr-only">Search customers</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search khata…" className="min-w-0 flex-1 text-sm outline-none" />
        </label>

        <button type="button" onClick={() => setNewOpen(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
          <Plus className="h-4 w-4" /> New Customer
        </button>

        {filtered.length === 0 ? (
          <p className="mt-4 px-1 text-sm text-stone-500">{customers.length === 0 ? "No customers yet — add your first khata, or load the sample shop." : "No customer matches that search."}</p>
        ) : (
          <ul className="mt-3 space-y-1" aria-label="Customer ledgers">
            <li>
              <button type="button" onClick={() => { setSelectedCustomerId(null); setSidebarOpen(false); }}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium ${selectedCustomerId === null ? "bg-emerald-50 text-emerald-800" : "hover:bg-stone-50"}`}>
                All customers · {customers.length}
              </button>
            </li>
            {filtered.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => { setSelectedCustomerId(c.id); setSidebarOpen(false); }}
                  className={`w-full rounded-xl px-3 py-2.5 text-left ${selectedCustomerId === c.id ? "bg-emerald-50 ring-1 ring-emerald-200" : "hover:bg-stone-50"}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    <span className={`shrink-0 text-sm font-bold tabular-nums ${c.balance > 0 ? "text-amber-700" : c.balance < 0 ? "text-red-700" : "text-emerald-700"}`}>
                      {formatPKR(Math.abs(c.balance))}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-500">{c.balance > 0 ? "To collect" : c.balance < 0 ? "To pay" : "Settled"}{c.isOverdue ? " · Overdue" : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="border-t border-stone-100 px-4 py-3 text-xs text-stone-400">Your data stays in this browser only.</p>
      <NewCustomerModal open={newOpen} onClose={() => setNewOpen(false)} onCreate={(name, phone) => {
        void (async () => {
          const id = `cust-${crypto.randomUUID()}`;
          await createCustomer({ id, name, phone, balance: 0, totalGave: 0, totalGot: 0, lastActivity: new Date().toISOString().slice(0, 10), isOverdue: false });
          notifyDataChanged();
          setSelectedCustomerId(id);
        })();
      }} />
    </div>
  );
}

export function Sidebar() {
  const { sidebarOpen } = useDashboard();
  return (
    <>
      {/* Desktop: static left column */}
      <aside className="hidden w-80 shrink-0 border-r border-stone-200 md:block" aria-label="Customer ledgers">
        <SidebarContent />
      </aside>
      {/* Mobile: slide-over drawer */}
      {sidebarOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-label="Customer ledgers">
          <button type="button" aria-label="Close menu" onClick={() => {}} className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 w-80 max-w-[85vw] shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      ) : null}
    </>
  );
}
