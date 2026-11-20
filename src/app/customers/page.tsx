import { DEMO_CUSTOMERS } from "@/constants";
import { Topbar } from "@/components/layout";
import { CustomerCard, WhatsAppReminderModal } from "@/components/ledger";

export default function CustomersPage() {
  return (
    <div>
      <Topbar title="Customers" subtitle="One running balance per person — the khata, organised by party." />
      <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
        {DEMO_CUSTOMERS.map((c) => (
          <div key={c.id} className="space-y-2">
            <CustomerCard customer={c} />
            <WhatsAppReminderModal customer={c} />
          </div>
        ))}
      </div>
    </div>
  );
}
