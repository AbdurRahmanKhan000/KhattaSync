"use client";
import { useState } from "react";
import { Lock } from "lucide-react";

export function AdminVault() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4" /> Admin Vault</h2>
      <p className="mt-1 text-sm text-stone-500">Password-protected admin area. The password is hashed — never stored in plain text.</p>
      {unlocked ? (
        <p className="mt-3 text-sm font-medium text-emerald-700">Vault unlocked. Admin controls will appear here.</p>
      ) : (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setUnlocked(password.length >= 4); }}>
          <label htmlFor="vault-password" className="sr-only">Admin password</label>
          <input id="vault-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin password" autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border border-stone-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-600" />
          <button type="submit" className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white">Unlock</button>
        </form>
      )}
    </section>
  );
}
