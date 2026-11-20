import { formatPKR } from "./utils";
import { addTransaction, createCustomer, listCustomers, logEntry } from "./db";
import { saveParsedEntry } from "./ledger-save";
import type { AgentAction } from "./ai/agent";
import type { CustomerAccount, LedgerEntry } from "../types";

/**
 * The agent's HANDS. The model only ever returns a PLAN (actions); this
 * executor is the only code that touches the ledger for the agent, and
 * it runs the plan in order against IndexedDB. Each action is
 * independent — one failing never blocks the rest — and every result
 * says exactly what happened, with the real new balance, so the chat can
 * show the truth instead of trusting the model's arithmetic. There is
 * deliberately no delete action: the agent can add and settle, never
 * remove.
 */

export interface AgentActionResult {
  kind: AgentAction["type"];
  ok: boolean;
  customerName: string;
  amount?: number;
  newBalance?: number;
  /** Machine-readable reason for a failure ("not_found" | "already_exists" | "nothing_to_settle" | "save_failed"). */
  reason?: string;
}

function findCustomer(customers: CustomerAccount[], name: string): CustomerAccount | undefined {
  const wanted = name.trim().toLowerCase();
  return customers.find((c) => c.name.toLowerCase() === wanted)
    ?? customers.find((c) => c.name.toLowerCase().startsWith(wanted) || wanted.startsWith(c.name.toLowerCase()));
}

async function settleBalance(
  customerName: string,
  amount: number | null | undefined,
  rawInput: string,
  customers: CustomerAccount[],
): Promise<AgentActionResult> {
  const customer = findCustomer(customers, customerName);
  if (!customer) {
    return { kind: "settle_balance", ok: false, customerName, reason: "not_found" };
  }
  const outstanding = Math.max(0, customer.balance);
  if (outstanding <= 0) {
    return { kind: "settle_balance", ok: false, customerName: customer.name, newBalance: customer.balance, reason: "nothing_to_settle" };
  }
  const pay = amount == null ? outstanding : Math.min(amount, outstanding);
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const stamp = now.toISOString();
  const entry: LedgerEntry = {
    id: `txn-${crypto.randomUUID()}`,
    customerId: customer.id,
    customerName: customer.name,
    type: "got",
    amount: pay,
    status: "paid",
    note: "Settled via AI Agent",
    date,
    createdAt: stamp,
    updatedAt: stamp,
    source: "text",
    rawInput,
  };
  await addTransaction(entry);
  await logEntry({
    id: `log-${crypto.randomUUID()}`, rawInput, source: "text",
    status: "parsed", customerName: customer.name, amount: pay,
    transactionId: entry.id, createdAt: stamp,
  });
  const fresh = (await listCustomers()).find((c) => c.id === customer.id);
  return { kind: "settle_balance", ok: true, customerName: customer.name, amount: pay, newBalance: fresh?.balance ?? customer.balance - pay };
}

export async function executeAgentActions(
  actions: AgentAction[],
  opts: { customers: CustomerAccount[]; rawInput: string; source: "text" | "voice" },
): Promise<AgentActionResult[]> {
  const results: AgentActionResult[] = [];
  let customers = opts.customers;
  for (const action of actions) {
    if (action.type === "create_customer") {
      const name = action.customer_name.trim();
      if (findCustomer(customers, name)) {
        results.push({ kind: "create_customer", ok: false, customerName: name, reason: "already_exists" });
        continue;
      }
      const id = `cust-${crypto.randomUUID()}`;
      const date = new Date().toISOString().slice(0, 10);
      await createCustomer({ id, name, balance: 0, totalGave: 0, totalGot: 0, lastActivity: date, isOverdue: false });
      customers = await listCustomers();
      const created = customers.find((c) => c.id === id);
      results.push(created
        ? { kind: "create_customer", ok: true, customerName: created.name, newBalance: 0 }
        : { kind: "create_customer", ok: false, customerName: name, reason: "save_failed" });
      continue;
    }
    if (action.type === "save_entry") {
      // The agent must create a customer first (its own create_customer
      // action) — the executor never invents a customer from a bare name.
      // A save for a name that is not in the ledger fails, loudly.
      if (!findCustomer(customers, action.entry.customer_name)) {
        results.push({ kind: "save_entry", ok: false, customerName: action.entry.customer_name, reason: "not_found" });
        continue;
      }
      const saved = await saveParsedEntry(action.entry, opts.rawInput, opts.source, { customers });
      customers = await listCustomers();
      if (!saved) {
        results.push({ kind: "save_entry", ok: false, customerName: action.entry.customer_name, reason: "save_failed" });
        continue;
      }
      const fresh = findCustomer(customers, saved.customerName);
      results.push({
        kind: "save_entry", ok: true, customerName: saved.customerName,
        amount: saved.amount, newBalance: fresh?.balance,
      });
      continue;
    }
    // settle_balance
    results.push(await settleBalance(action.customer_name, action.amount, opts.rawInput, customers));
    customers = await listCustomers();
  }
  return results;
}

/** One-line English summary of a result, for the chat's "Done" list. */
export function describeActionResult(r: AgentActionResult): string {
  if (!r.ok) {
    switch (r.reason) {
      case "not_found": return `Could not find ${r.customerName} in the ledger.`;
      case "already_exists": return `${r.customerName} is already in the ledger.`;
      case "nothing_to_settle": return `${r.customerName} has nothing to settle.`;
      default: return `Could not save that for ${r.customerName}.`;
    }
  }
  const balance = r.newBalance == null ? "" : ` — new balance ${formatPKR(Math.abs(r.newBalance))} ${r.newBalance > 0 ? "to collect" : r.newBalance < 0 ? "to pay" : "settled"}`;
  switch (r.kind) {
    case "create_customer": return `Added customer ${r.customerName}.`;
    case "save_entry": return `Saved: ${r.customerName} · ${formatPKR(r.amount ?? 0)}${balance}`;
    case "settle_balance": return `Settled ${formatPKR(r.amount ?? 0)} for ${r.customerName}${balance}`;
  }
}
