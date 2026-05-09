"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SettingsPageLayout } from "@/components/settings/settings-page-layout";
import { ModelsDialog } from "@/components/sidebar/models-dialog";

export default function ModelsPage() {
  const t = useTranslations("models");
  const searchParams = useSearchParams();
  const provider = searchParams.get("provider") ?? undefined;
  return (
    <SettingsPageLayout title={t("dialog.title")}>
      <ModelsDialog open={true} onOpenChange={() => {}} initialProvider={provider} standalone />
    </SettingsPageLayout>
  );
}
