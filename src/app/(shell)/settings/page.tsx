"use client";
import { Topbar } from "@/components/layout";
import { AdminVault, ApiKeySettings, DataExportImport } from "@/components/settings";
import { DbSelfTest } from "@/components/shared";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function SettingsPage() {
  const { t } = useLanguage();
  return (
    <div>
      <Topbar title={t("settingsTitle")} subtitle={t("settingsSubtitle")} />
      <div className="space-y-4 p-6">
        <ApiKeySettings />
        <DataExportImport />
        <AdminVault />
        <DbSelfTest />
      </div>
    </div>
  );
}
