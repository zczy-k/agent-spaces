"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Brain,
  Server,
  Pencil,
  Sparkles,
  MessageSquare,
  Plug,
  PanelLeftClose,
  Settings,
  Hash,
  CircleDot,
  Zap,
  Wrench,
  Terminal,
  GitBranch,
} from "lucide-react";
import { useCommandPalette } from "@/stores/command-palette";
import { useChannelStore } from "@/stores/channel";
import { useIssueStore } from "@/stores/issue";
import { useMobilePanelStore } from "@/stores/mobile-panel";
import type { useSidebarDialogs } from "./use-sidebar-dialogs";

export function useSidebarCommands({
  isMobile,
  router,
  toggleSidebarWithAnimation,
  dialogs,
}: {
  isMobile: boolean;
  router: ReturnType<typeof useRouter>;
  toggleSidebarWithAnimation: () => void;
  dialogs: ReturnType<typeof useSidebarDialogs>;
}) {
  const registerCommands = useCommandPalette((s) => s.registerMany);

  useEffect(() => {
    const openSettingsPage = (path: string, setter?: React.Dispatch<React.SetStateAction<boolean>>) => {
      if (isMobile || !setter) {
        router.push(path);
      } else {
        setter(true);
      }
    };

    const cmds = [
      {
        id: "toggle-sidebar",
        label: "Toggle Sidebar",
        group: "View",
        icon: PanelLeftClose,
        action: () => toggleSidebarWithAnimation(),
      },
      {
        id: "latest-channel",
        label: "Open Latest Channel",
        group: "Navigation",
        icon: Hash,
        action: () => {
          const { channels, setActiveChannel } = useChannelStore.getState();
          if (channels.length > 0) {
            setActiveChannel(channels[channels.length - 1].id);
            useMobilePanelStore.getState().setActivePanel("chat");
          }
        },
      },
      {
        id: "latest-issue",
        label: "Open Latest Issue",
        group: "Navigation",
        icon: CircleDot,
        action: () => {
          const { issues, setActiveIssue } = useIssueStore.getState();
          if (issues.length > 0) {
            setActiveIssue(issues[issues.length - 1].id);
            useMobilePanelStore.getState().setActivePanel("issue-detail");
          }
        },
      },
      {
        id: "open-settings",
        label: "Open General Settings",
        group: "Settings",
        icon: Settings,
        action: () => openSettingsPage("/settings", dialogs.setSettingsDialogOpen),
      },
      {
        id: "open-agents",
        label: "Open Agent Settings",
        group: "Settings",
        icon: Bot,
        action: () => openSettingsPage("/settings/agents", dialogs.setAgentDialogOpen),
      },
      {
        id: "open-skills",
        label: "Open Skills Settings",
        group: "Settings",
        icon: Sparkles,
        action: () => openSettingsPage("/settings/skills", dialogs.setSkillsDialogOpen),
      },
      {
        id: "open-prompts",
        label: "Open Prompt Settings",
        group: "Settings",
        icon: MessageSquare,
        action: () => openSettingsPage("/settings/prompts", dialogs.setPromptsDialogOpen),
      },
      {
        id: "open-output-styles",
        label: "Open Output Style Settings",
        group: "Settings",
        icon: Pencil,
        action: () => openSettingsPage("/settings/output-styles", dialogs.setOutputStylesDialogOpen),
      },
      {
        id: "open-mcps",
        label: "Open MCP Settings",
        group: "Settings",
        icon: Plug,
        action: () => openSettingsPage("/settings/mcps", dialogs.setMcpsDialogOpen),
      },
      {
        id: "open-models",
        label: "Open Model Settings",
        group: "Settings",
        icon: Brain,
        action: () => {
          if (isMobile) {
            router.push("/settings/models");
          } else {
            dialogs.setModelsDialogProvider(undefined);
            dialogs.setModelsDialogOpen(true);
          }
        },
      },
      {
        id: "open-providers",
        label: "Open Provider Settings",
        group: "Settings",
        icon: Server,
        action: () => openSettingsPage("/settings/providers", dialogs.setProvidersDialogOpen),
      },
      {
        id: "open-hooks",
        label: "Open Hook Settings",
        group: "Settings",
        icon: Zap,
        action: () => {
          if (isMobile) {
            router.push("/settings");
          } else {
            dialogs.setHooksDialogOpen(true);
          }
        },
      },
      {
        id: "open-commands",
        label: "Open Agent Commands",
        group: "Settings",
        icon: Terminal,
        action: () => {
          if (isMobile) {
            router.push("/settings");
          } else {
            dialogs.setAgentCommandsDialogOpen(true);
          }
        },
      },
      {
        id: "open-tools",
        label: "Open Tools Settings",
        group: "Settings",
        icon: Wrench,
        action: () => {
          if (isMobile) {
            router.push("/settings/tools");
          } else {
            dialogs.setToolsDialogOpen(true);
          }
        },
      },
      {
        id: "open-workflows",
        label: "Open Workflow Settings",
        group: "Navigation",
        icon: GitBranch,
        action: () => {
          router.push("/workflows");
        },
      },
    ];
    return registerCommands(cmds);
  }, [registerCommands, toggleSidebarWithAnimation, isMobile, dialogs, router]);
}
