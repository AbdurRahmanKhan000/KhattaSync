export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="border-b border-stone-200 bg-white px-6 py-4">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      {subtitle ? <p className="text-sm text-stone-500">{subtitle}</p> : null}
    </header>
  );
}
