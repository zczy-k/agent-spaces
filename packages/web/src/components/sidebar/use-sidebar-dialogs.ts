"use client";

import { useState } from "react";

export type DialogSetterMap = Record<string, React.Dispatch<React.SetStateAction<boolean>>>;

export function useSidebarDialogs() {
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [modelsDialogOpen, setModelsDialogOpen] = useState(false);
  const [providersDialogOpen, setProvidersDialogOpen] = useState(false);
  const [skillsDialogOpen, setSkillsDialogOpen] = useState(false);
  const [promptsDialogOpen, setPromptsDialogOpen] = useState(false);
  const [outputStylesDialogOpen, setOutputStylesDialogOpen] = useState(false);
  const [mcpsDialogOpen, setMcpsDialogOpen] = useState(false);
  const [hooksDialogOpen, setHooksDialogOpen] = useState(false);
  const [agentCommandsDialogOpen, setAgentCommandsDialogOpen] = useState(false);
  const [toolsDialogOpen, setToolsDialogOpen] = useState(false);
  const [layoutDialogOpen, setLayoutDialogOpen] = useState(false);
  const [modelsDialogProvider, setModelsDialogProvider] = useState<string | undefined>(undefined);

  const setterMap: DialogSetterMap = {
    agents: setAgentDialogOpen,
    skills: setSkillsDialogOpen,
    prompts: setPromptsDialogOpen,
    "output-styles": setOutputStylesDialogOpen,
    mcps: setMcpsDialogOpen,
    models: setModelsDialogOpen,
    providers: setProvidersDialogOpen,
    hooks: setHooksDialogOpen,
    commands: setAgentCommandsDialogOpen,
    tools: setToolsDialogOpen,
    layout: setLayoutDialogOpen,
    settings: setSettingsDialogOpen,
  };

  return {
    agentDialogOpen,
    setAgentDialogOpen,
    settingsDialogOpen,
    setSettingsDialogOpen,
    modelsDialogOpen,
    setModelsDialogOpen,
    providersDialogOpen,
    setProvidersDialogOpen,
    skillsDialogOpen,
    setSkillsDialogOpen,
    promptsDialogOpen,
    setPromptsDialogOpen,
    outputStylesDialogOpen,
    setOutputStylesDialogOpen,
    mcpsDialogOpen,
    setMcpsDialogOpen,
    hooksDialogOpen,
    setHooksDialogOpen,
    agentCommandsDialogOpen,
    setAgentCommandsDialogOpen,
    toolsDialogOpen,
    setToolsDialogOpen,
    layoutDialogOpen,
    setLayoutDialogOpen,
    modelsDialogProvider,
    setModelsDialogProvider,
    setterMap,
  };
}
