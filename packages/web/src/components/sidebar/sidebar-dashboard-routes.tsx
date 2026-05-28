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
    {
      id: "settings",
      title: ts("nav.settings"),
      icon: <Settings className="size-4" />,
      link: "#",
      subs: isMobile
        ? [
            { title: ts("nav.general"), link: "/settings", icon: <Wrench className="size-3.5" /> },
            { title: ts("nav.agents"), link: "/settings/agents", icon: <Bot className="size-3.5" /> },
            { title: ts("nav.skills"), link: "/settings/skills", icon: <Sparkles className="size-3.5" /> },
            { title: ts("nav.prompts"), link: "/settings/prompts", icon: <MessageSquare className="size-3.5" /> },
            { title: ts("nav.outputStyles"), link: "/settings/output-styles", icon: <Pencil className="size-3.5" /> },
            { title: ts("nav.mcps"), link: "/settings/mcps", icon: <Plug className="size-3.5" /> },
            { title: ts("nav.tools"), link: "/settings/tools", icon: <Wrench className="size-3.5" /> },
            { title: ts("nav.models"), link: "/settings/models", icon: <Brain className="size-3.5" /> },
            { title: ts("nav.providers"), link: "/settings/providers", icon: <Server className="size-3.5" /> },
          ]
        : [
            { title: ts("nav.general"), link: "#", icon: <Wrench className="size-3.5" />, onClick: () => setterMap.settings?.(true) },
            { title: ts("nav.agents"), link: "#", icon: <Bot className="size-3.5" />, onClick: () => setterMap.agents?.(true) },
            { title: ts("nav.skills"), link: "#", icon: <Sparkles className="size-3.5" />, onClick: () => setterMap.skills?.(true) },
            { title: ts("nav.prompts"), link: "#", icon: <MessageSquare className="size-3.5" />, onClick: () => setterMap.prompts?.(true) },
            { title: ts("nav.outputStyles"), link: "#", icon: <Pencil className="size-3.5" />, onClick: () => setterMap["output-styles"]?.(true) },
            { title: ts("nav.mcps"), link: "#", icon: <Plug className="size-3.5" />, onClick: () => setterMap.mcps?.(true) },
            { title: ts("nav.tools"), link: "#", icon: <Wrench className="size-3.5" />, onClick: () => setterMap.tools?.(true) },
            { title: ts("nav.models"), link: "#", icon: <Brain className="size-3.5" />, onClick: () => { setModelsDialogProvider(undefined); setterMap.models?.(true); } },
            { title: ts("nav.providers"), link: "#", icon: <Server className="size-3.5" />, onClick: () => setterMap.providers?.(true) },
            { title: ts("nav.hooks"), link: "#", icon: <Zap className="size-3.5" />, onClick: () => setterMap.hooks?.(true) },
            { title: ts("nav.commands"), link: "#", icon: <Terminal className="size-3.5" />, onClick: () => setterMap.commands?.(true) },
          ],
    },
  ];
}
