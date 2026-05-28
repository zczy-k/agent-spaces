import type { Layout } from 'react-resizable-panels';

export const GIT_LAYOUT_KEY = 'agent-spaces:git-layout';
export const GIT_CHANGES_PANEL_ID = 'changes';
export const GIT_COMMITS_PANEL_ID = 'commits';

const GIT_LAYOUT_LIMITS = {
  desktop: {
    changesMin: 15,
    changesMax: 60,
    commitsMin: 30,
  },
  mobile: {
    changesMin: 15,
    changesMax: 60,
    commitsMin: 30,
  },
} as const;

export function loadGitLayout(isMobile: boolean): Layout | undefined {
  try {
    const raw = localStorage.getItem(GIT_LAYOUT_KEY);
    if (!raw) return undefined;

    const layout = JSON.parse(raw) as Partial<Layout>;
    const limits = isMobile ? GIT_LAYOUT_LIMITS.mobile : GIT_LAYOUT_LIMITS.desktop;
    const changes = layout[GIT_CHANGES_PANEL_ID];
    const commits = layout[GIT_COMMITS_PANEL_ID];

    return typeof changes === 'number'
      && typeof commits === 'number'
      && changes >= limits.changesMin
      && changes <= limits.changesMax
      && commits >= limits.commitsMin
      ? { [GIT_CHANGES_PANEL_ID]: changes, [GIT_COMMITS_PANEL_ID]: commits }
      : undefined;
  } catch {
    return undefined;
  }
}

export function isValidGitLayout(layout: Layout, isMobile: boolean): boolean {
  const limits = isMobile ? GIT_LAYOUT_LIMITS.mobile : GIT_LAYOUT_LIMITS.desktop;
  const changes = layout[GIT_CHANGES_PANEL_ID];
  const commits = layout[GIT_COMMITS_PANEL_ID];

  return typeof changes === 'number'
    && typeof commits === 'number'
    && changes >= limits.changesMin
    && changes <= limits.changesMax
    && commits >= limits.commitsMin;
}
