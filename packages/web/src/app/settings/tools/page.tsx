"use client";

import { useTranslations } from "next-intl";
import { SettingsPageLayout } from "@/components/settings/settings-page-layout";
import { ToolsDialog } from "@/components/sidebar/tools-dialog";

export default function ToolsPage() {
  const t = useTranslations("tools");
  return (
    <SettingsPageLayout title={t("title")}>
      <ToolsDialog open={true} onOpenChange={() => {}} standalone />
    </SettingsPageLayout>
  );
}
