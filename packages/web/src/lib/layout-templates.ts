import type { IJsonModel } from "flexlayout-react";

export interface LayoutTemplate {
  id: string;
  name: string;
  json: IJsonModel;
  createdAt: number;
}

const STORAGE_KEY = "agent-spaces:layout-templates";

export function loadLayoutTemplates(): LayoutTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLayoutTemplates(templates: LayoutTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function addLayoutTemplate(name: string, json: IJsonModel): LayoutTemplate {
  const templates = loadLayoutTemplates();
  const t: LayoutTemplate = { id: crypto.randomUUID(), name, json, createdAt: Date.now() };
  templates.push(t);
  saveLayoutTemplates(templates);
  return t;
}

export function renameLayoutTemplate(id: string, name: string) {
  const templates = loadLayoutTemplates();
  const t = templates.find((t) => t.id === id);
  if (t) t.name = name;
  saveLayoutTemplates(templates);
}

export function deleteLayoutTemplate(id: string) {
  const templates = loadLayoutTemplates().filter((t) => t.id !== id);
  saveLayoutTemplates(templates);
}

export const LAYOUT_STORAGE_KEY = "flexlayout-global";

export function applyLayoutTemplate(_workspaceId: string, json: IJsonModel) {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(json));
  window.dispatchEvent(new CustomEvent("apply-layout"));
}
