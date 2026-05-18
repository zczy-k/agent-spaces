"use client";

import { useTranslations } from "next-intl";
import { SettingsPageLayout } from "@/components/settings/settings-page-layout";
import { PromptsDialog } from "@/components/sidebar/prompts-dialog";

export default function PromptsPage() {
  const t = useTranslations("prompts");
  return (
    <SettingsPageLayout title={t("title")}>
      <PromptsDialog open={true} onOpenChange={() => {}} standalone />
    </SettingsPageLayout>
  );
}
