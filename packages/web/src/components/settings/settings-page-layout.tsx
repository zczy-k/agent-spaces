"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function SettingsPageLayout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-base font-medium">{title}</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
