"use client";

import {
  Home,
  FolderOpen,
  Settings,
  Bot,
  Brain,
  Server,
  Pencil,
  Trash2,
  FolderSearch,
  GitBranch,
  Sparkles,
  MessageSquare,
  Plug,
  Zap,
  Wrench,
  Terminal,
} from "lucide-react";
import type { Workspace } from "@agent-spaces/shared";
import type { Route } from "./nav-main";
import type { DialogSetterMap } from "./use-sidebar-dialogs";

interface DashboardRoutesConfig {
  tSidebar: (key: string) => string;
  tCommon: (key: string) => string;
  isMobile: boolean;
  workspaces: Workspace[];
  openWorkspaceDialog: (ws?: Workspace) => void;
  handleDelete: (ws: Workspace) => Promise<void>;
  setterMap: DialogSetterMap;
  setModelsDialogProvider: React.Dispatch<React.SetStateAction<string | undefined>>;
}

function buildWorkspaceHref(id: string) {
  return `/workspace/${id}`;
}

export function buildDashboardRoutes(config: DashboardRoutesConfig): Route[] {
  const {
    tSidebar: ts,
    tCommon: tc,
    isMobile,
    workspaces,
    openWorkspaceDialog,
    handleDelete,
    setterMap,
    setModelsDialogProvider,
  } = config;

  return [
    {
      id: "home",
      title: ts("nav.home"),
      icon: <Home className="size-4" />,
      link: "/",
    },
    {
      id: "workspaces",
      title: ts("nav.workspaces"),
      icon: <FolderOpen className="size-4" />,
      link: "/",
      onAdd: () => openWorkspaceDialog(),
      addLabel: ts("nav.addWorkspace"),
      manageLink: "/workspaces",
      subs: [
        ...workspaces
          .filter((ws) => !ws.isWorktree)
          .map((ws) => ({
            title: ws.name,
            link: buildWorkspaceHref(ws.id),
            icon: <FolderOpen className="size-4" />,
            menuItems: [
              {
                label: tc("edit"),
                icon: <Pencil className="size-3.5" />,
                onClick: () => openWorkspaceDialog(ws),
              },
              {
                label: tc("open"),
                icon: <FolderSearch className="size-3.5" />,
                onClick: () =>
                  fetch(`/api/workspaces/${ws.id}/reveal`, {
                    method: "POST",
                  }),
              },
              {
                label: tc("delete"),
                icon: <Trash2 className="size-3.5" />,
                variant: "destructive" as const,
                onClick: () => handleDelete(ws),
              },
            ],
          })),
      ],
    },
    {
      id: "workflows",
      title: ts("nav.workflows"),
      icon: <GitBranch className="size-4" />,
      link: "/workflows",
    },
    ...(isMobile
      ? [
          { id: "settings", title: ts("nav.general"), icon: <Wrench className="size-4" />, link: "/settings" },
          { id: "settings-agents", title: ts("nav.agents"), icon: <Bot className="size-4" />, link: "/settings/agents" },
          { id: "settings-skills", title: ts("nav.skills"), icon: <Sparkles className="size-4" />, link: "/settings/skills" },
          { id: "settings-prompts", title: ts("nav.prompts"), icon: <MessageSquare className="size-4" />, link: "/settings/prompts" },
          { id: "settings-output-styles", title: ts("nav.outputStyles"), icon: <Pencil className="size-4" />, link: "/settings/output-styles" },
          { id: "settings-mcps", title: ts("nav.mcps"), icon: <Plug className="size-4" />, link: "/settings/mcps" },
          { id: "settings-tools", title: ts("nav.tools"), icon: <Wrench className="size-4" />, link: "/settings/tools" },
          { id: "settings-models", title: ts("nav.models"), icon: <Brain className="size-4" />, link: "/settings/models" },
          { id: "settings-providers", title: ts("nav.providers"), icon: <Server className="size-4" />, link: "/settings/providers" },
        ]
      : [
          { id: "settings", title: ts("nav.general"), icon: <Settings className="size-4" />, link: "#", onClick: () => setterMap.settings?.(true) },
          { id: "settings-agents", title: ts("nav.agents"), icon: <Bot className="size-4" />, link: "#", onClick: () => setterMap.agents?.(true) },
          { id: "settings-skills", title: ts("nav.skills"), icon: <Sparkles className="size-4" />, link: "#", onClick: () => setterMap.skills?.(true) },
          { id: "settings-prompts", title: ts("nav.prompts"), icon: <MessageSquare className="size-4" />, link: "#", onClick: () => setterMap.prompts?.(true) },
          { id: "settings-output-styles", title: ts("nav.outputStyles"), icon: <Pencil className="size-4" />, link: "#", onClick: () => setterMap["output-styles"]?.(true) },
          { id: "settings-mcps", title: ts("nav.mcps"), icon: <Plug className="size-4" />, link: "#", onClick: () => setterMap.mcps?.(true) },
          { id: "settings-tools", title: ts("nav.tools"), icon: <Wrench className="size-4" />, link: "#", onClick: () => setterMap.tools?.(true) },
          { id: "settings-models", title: ts("nav.models"), icon: <Brain className="size-4" />, link: "#", onClick: () => { setModelsDialogProvider(undefined); setterMap.models?.(true); } },
          { id: "settings-providers", title: ts("nav.providers"), icon: <Server className="size-4" />, link: "#", onClick: () => setterMap.providers?.(true) },
          { id: "settings-hooks", title: ts("nav.hooks"), icon: <Zap className="size-4" />, link: "#", onClick: () => setterMap.hooks?.(true) },
          { id: "settings-commands", title: ts("nav.commands"), icon: <Terminal className="size-4" />, link: "#", onClick: () => setterMap.commands?.(true) },
        ]
    ),
  ];
}
