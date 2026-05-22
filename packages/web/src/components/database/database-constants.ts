import type { Layout } from 'react-resizable-panels';

export const PANEL_LAYOUT_KEY = 'database-panel-layout';
export const SIDEBAR_MIN_SIZE = 12;
export const SIDEBAR_MAX_SIZE = 70;
export const MAIN_MIN_SIZE = 30;
export const DEFAULT_PANEL_LAYOUT: Layout = { sidebar: 25, main: 75 };
export const formatPanelSize = (size: number) => `${size}%`;

export const EMOJIS = ['📁', '📄', '📎', '🚀', '💡', '⭐', '🎯', '🎨', '📇', '📈', '☑️', '🔥', '🔍', '📮', '🧪', '✍️', '✅', '📸', '🔀', '🧭'];

export function loadPanelLayout(): Layout | undefined {
  try {
    const raw = localStorage.getItem(PANEL_LAYOUT_KEY);
    if (!raw) return undefined;

    const layout = JSON.parse(raw) as Partial<Layout>;
    return typeof layout.sidebar === 'number'
      && typeof layout.main === 'number'
      && layout.sidebar >= SIDEBAR_MIN_SIZE
      && layout.sidebar <= SIDEBAR_MAX_SIZE
      && layout.main >= MAIN_MIN_SIZE
      ? { sidebar: layout.sidebar, main: layout.main }
      : undefined;
  } catch {
    return undefined;
  }
}
