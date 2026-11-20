import { formatPKR } from "./utils";
import { addTransaction, createCustomer, listCustomers, logEntry } from "./db";
import type { CustomerAccount, LedgerEntry, ParsedLedgerResult } from "../types";

/**
 * The ONE save path for a parsed ledger entry — used by the Quick Record
 * bar and by the AI Agent alike, so an entry saves the same way whichever
 * surface produced it. Finds or creates the customer, posts the entry
 * (payment = "got", everything else = "gave"), logs it, and returns what
 * was saved. Callers reload their data and show their own confirmation.
 */
export async function saveParsedEntry(
  result: ParsedLedgerResult,
  rawInput: string,
  source: "text" | "voice",
  opts: { customers: CustomerAccount[] },
): Promise<{ customerName: string; amount: number } | null> {
  const name = result.customer_name.trim();
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const stamp = now.toISOString();
  let customer = opts.customers.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (!customer) {
    const id = `cust-${crypto.randomUUID()}`;
    await createCustomer({ id, name, balance: 0, totalGave: 0, totalGot: 0, lastActivity: date, isOverdue: false });
    const fresh = await listCustomers();
    customer = fresh.find((c) => c.id === id);
    if (!customer) return null;
  }
  const isPayment = result.action_type === "payment";
  const entry: LedgerEntry = {
    id: `txn-${crypto.randomUUID()}`,
    customerId: customer.id,
    customerName: customer.name,
    type: isPayment ? "got" : "gave",
    amount: result.total_amount,
    status: result.credit_balance_change > 0 ? (customer.isOverdue ? "due" : "credit") : "paid",
    note: result.items.map((i) => `${i.name} — ${formatPKR(i.amount)}`).join(", ") || undefined,
    items: result.items,
    date,
    createdAt: stamp,
    updatedAt: stamp,
    source,
    rawInput,
  };
  await addTransaction(entry);
  await logEntry({
    id: `log-${crypto.randomUUID()}`, rawInput, source,
    status: "parsed", customerName: customer.name, amount: result.total_amount,
    transactionId: entry.id, createdAt: stamp,
  });
  return { customerName: customer.name, amount: result.total_amount };
}
