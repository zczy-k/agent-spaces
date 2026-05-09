"use client";

import { useTranslations } from "next-intl";
import { SettingsPageLayout } from "@/components/settings/settings-page-layout";
import { SkillsDialog } from "@/components/sidebar/skills-dialog";

export default function SkillsPage() {
  const t = useTranslations("skills");
  return (
    <SettingsPageLayout title={t("title")}>
      <SkillsDialog open={true} onOpenChange={() => {}} standalone />
    </SettingsPageLayout>
  );
}
