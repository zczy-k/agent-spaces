"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { getStoreApiBase, setStoreApiBase } from "@/lib/agent-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { User, Palette, Globe, Shield, Mic, GitBranch, Store, Bot } from "lucide-react";
import { GitSettingsForm } from "@/components/git/git-settings-form";
import { AppearanceTab } from "./settings/appearance-tab";
import { LanguageTab } from "./settings/language-tab";
import { AccountTab } from "./settings/account-tab";
import { SecurityTab } from "./settings/security-tab";
import { SpeechSettingsTab } from "./settings/speech-settings-tab";
import { RobotAccountsTab } from "./settings/robot-accounts-tab";

const tabs = [
  { key: "appearance", icon: Palette },
  { key: "language", icon: Globe },
  { key: "account", icon: User },
  { key: "security", icon: Shield },
  { key: "robots", icon: Bot },
  { key: "agent_store", icon: Store },
  { key: "git", icon: GitBranch },
  { key: "speech", icon: Mic },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function SettingsDialog({
  open,
  onOpenChange,
  standalone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  standalone?: boolean;
}) {
  const t = useTranslations("settings");
  const [activeTab, setActiveTab] = useState<TabKey>("appearance");

  const tabLabels: Record<TabKey, string> = {
    appearance: t("theme"),
    language: t("language"),
    account: t("userAvatar"),
    security: t("security"),
    robots: t("robots"),
    agent_store: t("agentStore"),
    git: t("git"),
    speech: t("speech"),
  };

  const renderContent = () => {
    switch (activeTab) {
      case "appearance":
        return <AppearanceTab />;
      case "language":
        return <LanguageTab />;
      case "account":
        return <AccountTab />;
      case "security":
        return <SecurityTab />;
      case "robots":
        return <RobotAccountsTab />;
      case "agent_store":
        return <AgentStoreTab />;
      case "git":
        return <GitSettings />;
      case "speech":
        return <SpeechSettingsTab />;
    }
  };

  const sidebar = (
    <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
      <div className="flex sm:flex-col sm:w-36 sm:border-r sm:py-3 sm:px-2 shrink-0 overflow-x-auto border-b sm:border-b-0 gap-1 px-2 py-2">
        {tabs.map(({ key, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium transition-colors whitespace-nowrap",
              activeTab === key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {tabLabels[key]}
          </button>
        ))}
      </div>
      <div className="flex-1 p-5 min-w-0 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );

  if (standalone) return sidebar;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b shrink-0">
          <DialogTitle className="text-base">{t("title")}</DialogTitle>
          <DialogDescription className="text-xs">{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{sidebar}</div>
      </DialogContent>
    </Dialog>
  );
}

function GitSettings() {
  return (
    <div className="space-y-5">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
          Git
        </label>
        <GitSettingsForm scope="global" />
      </div>
    </div>
  );
}

function AgentStoreTab() {
  const [url, setUrl] = useState(() => getStoreApiBase());
  const [saved, setSaved] = useState(false);
  const t = useTranslations("settings");

  const handleSave = () => {
    setStoreApiBase(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
          {t("storeApiBase")}
        </label>
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://raw.githubusercontent.com/user/repo/main/packages/agents"
            className="text-sm"
          />
          <Button size="sm" onClick={handleSave}>
            {saved ? "✓" : t("save")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {t("storeApiBaseDesc")}
        </p>
      </div>
    </div>
  );
}
