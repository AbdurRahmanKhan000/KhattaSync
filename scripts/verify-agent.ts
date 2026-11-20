/**
 * KhattaSync agent executor verification — run with: npm run verify:agent
 * The executor is the agent's hands: it runs a validated plan of actions
 * (create_customer / save_entry / settle_balance) in order against the
 * real IndexedDB layer and reports each real result with the real new
 * balance. No AI call is made — the plan is supplied directly.
 */
import "fake-indexeddb/auto";
import { executeAgentActions, describeActionResult } from "../src/lib/agent-actions.js";
import { listCustomers } from "../src/lib/db/index.js";
import type { AgentAction } from "../src/lib/ai/agent.js";

let failures = 0;
function check(name: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures += 1;
}

const sale = (name: string, amount: number) => ({
  action_type: "sale" as const,
  customer_name: name,
  items: [{ name: "flour", quantity: 1, amount }],
  total_amount: amount, amount_paid: 0, credit_balance_change: amount, currency: "PKR" as const,
  whatsapp_reminder_draft: "", is_valid_ledger_entry: true, rejection_reason: "",
});

async function main(): Promise<void> {
  let customers = await listCustomers();
  check("Executor starts from an empty ledger", customers.length === 0);

  // create_customer
  let results = await executeAgentActions(
    [{ type: "create_customer", customer_name: "Faizan" }],
    { customers, rawInput: "Add Faizan", source: "text" },
  );
  check("create_customer succeeds with balance 0",
    results[0].ok && results[0].newBalance === 0, describeActionResult(results[0]));
  customers = await listCustomers();
  check("Faizan is in the ledger after creation",
    customers.some((c) => c.name === "Faizan"));

  // duplicate create fails, does not crash the plan
  results = await executeAgentActions(
    [{ type: "create_customer", customer_name: "Faizan" }],
    { customers, rawInput: "Add Faizan", source: "text" },
  );
  check("Duplicate create_customer fails already_exists",
    !results[0].ok && results[0].reason === "already_exists");

  // save_entry: sale on credit
  results = await executeAgentActions(
    [{ type: "save_entry", entry: sale("Faizan", 500) }],
    { customers, rawInput: "Faizan took 500 on credit", source: "text" },
  );
  check("save_entry succeeds with new balance 500",
    results[0].ok && results[0].newBalance === 500, describeActionResult(results[0]));
  customers = await listCustomers();
  check("Ledger balance is 500 after the sale",
    customers.find((c) => c.name === "Faizan")?.balance === 500);

  // save_entry for an unknown customer fails
  results = await executeAgentActions(
    [{ type: "save_entry", entry: sale("Ghost", 100) }],
    { customers, rawInput: "Ghost took 100", source: "text" },
  );
  check("save_entry for an unknown customer fails not_found",
    !results[0].ok && results[0].reason === "not_found");

  // settle_balance: partial, then full (no amount = whole balance)
  results = await executeAgentActions(
    [{ type: "settle_balance", customer_name: "Faizan", amount: 200 }],
    { customers, rawInput: "Faizan paid 200", source: "text" },
  );
  check("settle_balance 200 leaves 300 to collect",
    results[0].ok && results[0].newBalance === 300, describeActionResult(results[0]));
  results = await executeAgentActions(
    [{ type: "settle_balance", customer_name: "Faizan" }],
    { customers: await listCustomers(), rawInput: "Settle Faizan", source: "text" },
  );
  check("settle_balance with no amount settles the full balance",
    results[0].ok && results[0].newBalance === 0, describeActionResult(results[0]));

  // settle an unknown customer fails; settling a zero balance fails
  results = await executeAgentActions(
    [{ type: "settle_balance", customer_name: "Ghost" }],
    { customers: await listCustomers(), rawInput: "Settle Ghost", source: "text" },
  );
  check("settle_balance for an unknown customer fails not_found",
    !results[0].ok && results[0].reason === "not_found");
  results = await executeAgentActions(
    [{ type: "settle_balance", customer_name: "Faizan" }],
    { customers: await listCustomers(), rawInput: "Settle Faizan again", source: "text" },
  );
  check("settle_balance on a zero balance fails nothing_to_settle",
    !results[0].ok && results[0].reason === "nothing_to_settle");

  // Multi-action plan: create then save, in order, against the live ledger.
  const plan: AgentAction[] = [
    { type: "create_customer", customer_name: "Bilal" },
    { type: "save_entry", entry: sale("Bilal", 500) },
  ];
  results = await executeAgentActions(plan, { customers: await listCustomers(), rawInput: "Add Bilal, he took 500 on credit", source: "text" });
  check("Multi-action plan executes both steps",
    results.length === 2 && results[0].ok && results[1].ok);
  check("Bilal ends with balance 500 after create + save",
    results[1].newBalance === 500, describeActionResult(results[1]));
  customers = await listCustomers();
  check("Ledger holds Faizan (0) and Bilal (500)",
    customers.length === 2 && customers.find((c) => c.name === "Bilal")?.balance === 500);

  if (failures > 0) throw new Error(`${failures} check(s) failed`);
  console.log("\nAll agent executor verification checks passed.");
}

main().catch((err: unknown) => {
  console.error("FAIL  verify-agent crashed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
