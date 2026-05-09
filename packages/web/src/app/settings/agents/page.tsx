"use client";

import { useTranslations } from "next-intl";
import { SettingsPageLayout } from "@/components/settings/settings-page-layout";
import { AgentDialog } from "@/components/sidebar/agent-dialog";

export default function AgentsPage() {
  const t = useTranslations("agent");
  return (
    <SettingsPageLayout title={t("dialog.title")}>
      <AgentDialog open={true} onOpenChange={() => {}} standalone />
    </SettingsPageLayout>
  );
}
