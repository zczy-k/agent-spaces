"use client";

import { useTranslations } from "next-intl";
import { SettingsPageLayout } from "@/components/settings/settings-page-layout";
import { SettingsDialog } from "@/components/sidebar/settings-dialog";

export default function SettingsPage() {
  const t = useTranslations("settings");
  return (
    <SettingsPageLayout title={t("title")}>
      <SettingsDialog open={true} onOpenChange={() => {}} standalone />
    </SettingsPageLayout>
  );
}
