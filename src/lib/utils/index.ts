import type { CustomerAccount, LedgerEntry } from "@/types";

export function formatPKR(amount: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-PK").format(amount);
}

export function buildWhatsAppLink(phone: string | undefined, message: string): string {
  const digits = (phone ?? "").replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildReminderMessage(customer: CustomerAccount): string {
  const amount = formatPKR(Math.abs(customer.balance));
  return customer.balance > 0
    ? `Assalam-o-Alaikum ${customer.name}, aap ka ${amount} udhaar baqi hai. Meherbani kar ke jald ada kar dein. — KhattaSync`
    : `Assalam-o-Alaikum ${customer.name}, aap ka khata clear hai. Shukriya! — KhattaSync`;
}

export function entriesToCSV(entries: LedgerEntry[]): string {
  const header = "date,customer,type,amount,status,note";
  const rows = entries.map((e) =>
    [e.date, `"${e.customerName.replace(/"/g, '""')}"`, e.type, String(e.amount), e.status, `"${(e.note ?? "").replace(/"/g, '""')}"`].join(","),
  );
  return [header, ...rows].join("\n");
}

export function toJsonDownload(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function downloadFile(filename: string, content: string, mime = "text/plain"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
