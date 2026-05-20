"use client";

import { useTranslations } from "next-intl";
import { SettingsPageLayout } from "@/components/settings/settings-page-layout";
import { AgentDialog } from "@/components/sidebar/agent-dialog";

export default function OutputStylesPage() {
  const t = useTranslations("agent");
  return (
    <SettingsPageLayout title={t("detail.outputStyle")}>
      <AgentDialog open={true} onOpenChange={() => {}} standalone />
    </SettingsPageLayout>
  );
}
