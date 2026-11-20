import type { ParsedLedgerResult } from "@/types";
import type { AgentAction, AgentHistoryItem, LedgerSnapshot } from "@/lib/ai/agent";

/** What the agent endpoint returns (client-safe shape of the route's JSON). */
export interface AgentApiResult {
  ok?: boolean;
  reply?: string;
  intent?: string;
  actions?: AgentAction[];
  /** Legacy v1 shape — kept only so an older cached response cannot crash a caller. */
  entry?: ParsedLedgerResult | null;
  error?: string;
  detail?: string;
  provider?: string;
  model?: string;
}

/** One shared call for every surface that talks to the agent (Quick Record bar + AI Agent page). */
export async function callAgentApi(args: {
  input: string;
  history: AgentHistoryItem[];
  snapshot: LedgerSnapshot;
  apiKey?: string;
  hostKeyAllowed?: boolean;
  model?: string;
  thinkingBudget?: string;
  language?: string;
}): Promise<AgentApiResult> {
  const res = await fetch("/api/parse-ledger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "agent",
      input: args.input,
      history: args.history,
      snapshot: args.snapshot,
      apiKey: args.apiKey,
      hostKeyAllowed: args.hostKeyAllowed !== false,
      model: args.model,
      thinkingBudget: args.thinkingBudget,
      language: args.language ?? "en",
    }),
  });
  return (await res.json()) as AgentApiResult;
}

/** Build the snapshot the agent answers from: the app's own live ledger
 *  data, including each customer's last few entries so the agent can
 *  answer in full ("what did she buy last?") instead of one line. */
export function buildLedgerSnapshot(args: {
  customers: { name: string; balance: number }[];
  totalUdhaar: number;
  collectedToday: number;
  transactions?: { customerName: string; type: "gave" | "got"; amount: number; date: string; note?: string; createdAt?: string }[];
}): LedgerSnapshot {
  const byCustomer = new Map<string, { date: string; type: "gave" | "got"; amount: number; note?: string }[]>();
  for (const tx of args.transactions ?? []) {
    const list = byCustomer.get(tx.customerName) ?? [];
    list.push({ date: tx.date, type: tx.type, amount: tx.amount, ...(tx.note ? { note: tx.note } : {}) });
    byCustomer.set(tx.customerName, list);
  }
  return {
    customers: args.customers.map((c) => ({
      name: c.name,
      balance: c.balance,
      recent: (byCustomer.get(c.name) ?? [])
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 3),
    })),
    totalUdhaar: args.totalUdhaar,
    collectedToday: args.collectedToday,
    totalCustomers: args.customers.length,
  };
}
