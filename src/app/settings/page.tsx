import { Topbar } from "@/components/layout";
import { AdminVault, ApiKeySettings, DataExportImport } from "@/components/settings";
import { DbSelfTest } from "@/components/shared";

export default function SettingsPage() {
  return (
    <div>
      <Topbar title="Settings" subtitle="Your key, your data, your vault." />
      <div className="space-y-4 p-6">
        <ApiKeySettings />
        <DataExportImport />
        <AdminVault />
        <DbSelfTest />
      </div>
    </div>
  );
}
