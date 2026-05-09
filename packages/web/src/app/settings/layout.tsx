"use client";

import { SettingsPageLayout } from "@/components/settings/settings-page-layout";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-[calc(100vh-4rem)]">
      {children}
    </div>
  );
}
