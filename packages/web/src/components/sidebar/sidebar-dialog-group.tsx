"use client";

import { AgentDialog } from "@/components/sidebar/agent-dialog";
import { ModelsDialog } from "@/components/sidebar/models-dialog";
import { ProvidersDialog } from "@/components/sidebar/providers-dialog";
import { SettingsDialog } from "@/components/sidebar/settings-dialog";
import { SkillsDialog } from "@/components/sidebar/skills-dialog";
import { PromptsDialog } from "@/components/sidebar/prompts-dialog";
import { OutputStylesDialog } from "@/components/sidebar/output-styles-dialog";
import { McpsDialog } from "@/components/sidebar/mcps-dialog";
import { HooksDialog } from "@/components/sidebar/hooks-dialog";
import { AgentCommandsDialog } from "@/components/sidebar/agent-commands-dialog";
import { ToolsDialog } from "@/components/sidebar/tools-dialog";
import type { useSidebarDialogs } from "./use-sidebar-dialogs";

export function SidebarDialogGroup({
  dialogs,
}: {
  dialogs: ReturnType<typeof useSidebarDialogs>;
}) {
  return (
    <>
      <AgentDialog open={dialogs.agentDialogOpen} onOpenChange={dialogs.setAgentDialogOpen} />
      <SkillsDialog open={dialogs.skillsDialogOpen} onOpenChange={dialogs.setSkillsDialogOpen} />
      <PromptsDialog open={dialogs.promptsDialogOpen} onOpenChange={dialogs.setPromptsDialogOpen} />
      <OutputStylesDialog open={dialogs.outputStylesDialogOpen} onOpenChange={dialogs.setOutputStylesDialogOpen} />
      <McpsDialog open={dialogs.mcpsDialogOpen} onOpenChange={dialogs.setMcpsDialogOpen} />
      <HooksDialog open={dialogs.hooksDialogOpen} onOpenChange={dialogs.setHooksDialogOpen} />
      <AgentCommandsDialog open={dialogs.agentCommandsDialogOpen} onOpenChange={dialogs.setAgentCommandsDialogOpen} />
      <ToolsDialog open={dialogs.toolsDialogOpen} onOpenChange={dialogs.setToolsDialogOpen} />
      <SettingsDialog open={dialogs.settingsDialogOpen} onOpenChange={dialogs.setSettingsDialogOpen} />
      <ModelsDialog open={dialogs.modelsDialogOpen} onOpenChange={dialogs.setModelsDialogOpen} initialProvider={dialogs.modelsDialogProvider} />
      <ProvidersDialog
        open={dialogs.providersDialogOpen}
        onOpenChange={dialogs.setProvidersDialogOpen}
        onAddModel={(providerName) => {
          dialogs.setModelsDialogProvider(providerName);
          dialogs.setModelsDialogOpen(true);
        }}
      />
    </>
  );
}
