"use client";
import { useEffect, useState } from "react";
import type { AdminConfig, ThinkingBudget } from "@/types";
import { getAdminConfig, getSettings, saveAdminConfig } from "@/lib/db";
import { hashAdminPassword, verifyAdminPassword } from "@/lib/security";
import { AI_MODEL_LABELS } from "@/constants";
import { PROVIDER_LABELS, PROVIDER_MODELS, detectProvider, type AiProvider } from "@/lib/ai/providers";
import { notifyDataChanged } from "@/components/layout/DashboardContext";
import { Lock, ShieldCheck } from "lucide-react";

export function AdminVault() {
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // The model list follows the provider of the key actually in use: the
  // host key is Gemini; a personal key's provider is detected from the key.
  const [activeProvider, setActiveProvider] = useState<AiProvider>("gemini");

  useEffect(() => {
    void getAdminConfig().then(setConfig);
    void getSettings().then((s) => setActiveProvider(s.geminiApiKey ? detectProvider(s.geminiApiKey) ?? "gemini" : "gemini"));
  }, []);

  async function update(patch: Partial<AdminConfig>) {
    if (!config) return;
    const next = { ...config, ...patch };
    setConfig(next);
    await saveAdminConfig(next);
    setNotice("Admin setting saved in this browser.");
    // Host-key withdrawal / model changes must reach the dashboard badge
    // and the entry bar immediately, not on the next page refresh.
    notifyDataChanged();
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    const ok = await verifyAdminPassword(password, config.passwordHash);
    if (!ok) { setError("Wrong password. The vault stays locked."); return; }
    setError(null);
    setUnlocked(true);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    if (newPassword.length < 4) { setError("New password must be at least 4 characters."); return; }
    if (newPassword !== confirmPassword) { setError("New passwords do not match."); return; }
    const hash = await hashAdminPassword(newPassword);
    await update({ passwordHash: hash });
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setNotice("Admin password changed (stored as a hash only).");
  }

  if (!config) return <section className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-sm text-stone-500">Loading vault…</p></section>;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4" /> Admin Control Vault</h2>
      <p className="mt-1 text-sm text-stone-500">Password-protected. Without the password, no control inside this vault can be viewed or changed.</p>

      {!unlocked ? (
        <form className="mt-3 flex gap-2" onSubmit={(e) => void unlock(e)}>
          <label htmlFor="vault-password" className="sr-only">Admin password</label>
          <input id="vault-password" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(null); }} placeholder="Admin password" autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border border-stone-300 px-4 py-2.5 text-sm outline-none focus:border-emerald-600" />
          <button type="submit" className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white">Unlock</button>
        </form>
      ) : (
        <div className="mt-4 space-y-5">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700"><ShieldCheck className="h-4 w-4" /> Vault unlocked — Admin controls active.</p>

          <div>
            <h3 className="text-sm font-semibold">1. Host API key</h3>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={config.hostKeyWithdrawn} onChange={(e) => void update({ hostKeyWithdrawn: e.target.checked })} />
              Withdraw host API key — enforce User BYOK Mode
            </label>
            {config.hostKeyWithdrawn ? <p className="mt-1 text-sm text-red-700">Host key withdrawn. Users must enter their own AI key (Gemini, OpenAI, or Claude) in Settings to run AI parsing.</p> : null}
          </div>

          <div>
            <h3 className="text-sm font-semibold">2. Model &amp; speed</h3>
            <p className="mt-1 text-xs text-stone-500">Models for the provider in use: {PROVIDER_LABELS[activeProvider]}. Thinking budget applies to Gemini only.</p>
            <div className="mt-2 space-y-2">
              {PROVIDER_MODELS[activeProvider].map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="ai-model" checked={config.model === m} onChange={() => void update({ model: m })} />
                  {AI_MODEL_LABELS[m]}
                </label>
              ))}
            </div>
            <label className="mt-3 block text-sm">Thinking budget
              <select value={config.thinkingBudget} onChange={(e) => void update({ thinkingBudget: e.target.value as ThinkingBudget })} className="ml-2 rounded-lg border px-2 py-1 text-sm">
                <option value="low">Low — fastest</option>
                <option value="standard">Standard</option>
                <option value="high">High — most careful</option>
              </select>
            </label>
            <p className="mt-1 text-xs text-stone-500">Current model: {config.model} · budget: {config.thinkingBudget}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold">3. Strictness &amp; quota</h3>
            <label className="mt-2 block text-sm">Max AI entries per browser session (per day)
              <input type="number" min={1} max={5000} value={config.maxDailyEntries} onChange={(e) => void update({ maxDailyEntries: Math.max(1, Number(e.target.value) || 1) })} className="ml-2 w-24 rounded-lg border px-2 py-1 text-sm" />
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={config.audioTranscriptionEnabled} onChange={(e) => void update({ audioTranscriptionEnabled: e.target.checked })} />
              Audio transcription support
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={config.sampleDataLocked} onChange={(e) => void update({ sampleDataLocked: e.target.checked })} />
              Lock sample data presets (users cannot load demo data)
            </label>
          </div>

          <div>
            <h3 className="text-sm font-semibold">4. Change Admin password</h3>
            <form className="mt-2 flex flex-wrap gap-2" onSubmit={(e) => void changePassword(e)}>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" autoComplete="off" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" autoComplete="off" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" />
              <button type="submit" className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white">Change password</button>
            </form>
          </div>

          <button type="button" onClick={() => { setUnlocked(false); setPassword(""); setNotice(null); }} className="rounded-xl border px-4 py-2 text-sm font-medium">Lock vault</button>
        </div>
      )}
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
    </section>
  );
}
