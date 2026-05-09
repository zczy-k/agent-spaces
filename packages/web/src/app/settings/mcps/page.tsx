"use client";

import { useTranslations } from "next-intl";
import { SettingsPageLayout } from "@/components/settings/settings-page-layout";
import { McpsDialog } from "@/components/sidebar/mcps-dialog";

export default function McpsPage() {
  const t = useTranslations("mcps");
  return (
    <SettingsPageLayout title={t("title")}>
      <McpsDialog open={true} onOpenChange={() => {}} standalone />
    </SettingsPageLayout>
  );
}
