"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SettingsPageLayout } from "@/components/settings/settings-page-layout";
import { ProvidersDialog } from "@/components/sidebar/providers-dialog";

export default function ProvidersPage() {
  const t = useTranslations("providers");
  const router = useRouter();
  return (
    <SettingsPageLayout title={t("dialog.title")}>
      <ProvidersDialog
        open={true}
        onOpenChange={() => {}}
        onAddModel={(providerName) => router.push(`/settings/models?provider=${encodeURIComponent(providerName)}`)}
        standalone
      />
    </SettingsPageLayout>
  );
}
