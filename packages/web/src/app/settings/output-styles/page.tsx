"use client";

import { useTranslations } from "next-intl";
import { SettingsPageLayout } from "@/components/settings/settings-page-layout";
import { OutputStylesDialog } from "@/components/sidebar/output-styles-dialog";

export default function OutputStylesPage() {
  const t = useTranslations("outputStyles");
  return (
    <SettingsPageLayout title={t("title")}>
      <OutputStylesDialog open={true} onOpenChange={() => {}} standalone />
    </SettingsPageLayout>
  );
}
