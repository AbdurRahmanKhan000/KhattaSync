import type { ParsedLedgerResult } from "@/types";
import type { AgentHistoryItem, LedgerSnapshot } from "@/lib/ai/agent";

/** What the agent endpoint returns (client-safe shape of the route's JSON). */
export interface AgentApiResult {
  ok?: boolean;
  reply?: string;
  intent?: string;
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
    }),
  });
  return (await res.json()) as AgentApiResult;
}

/** Build the snapshot the agent answers from: the app's own live ledger data. */
export function buildLedgerSnapshot(args: {
  customers: { name: string; balance: number }[];
  totalUdhaar: number;
  collectedToday: number;
}): LedgerSnapshot {
  return {
    customers: args.customers.map((c) => ({ name: c.name, balance: c.balance })),
    totalUdhaar: args.totalUdhaar,
    collectedToday: args.collectedToday,
    totalCustomers: args.customers.length,
  };
}
