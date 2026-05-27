import { create } from 'zustand';

const STORAGE_KEY = 'keyboard-shortcuts';

export interface ShortcutDef {
  id: string;
  defaultKeys: string;
  labelKey: string;
}

export const SHORTCUT_DEFS: ShortcutDef[] = [
  {
    id: 'commandPalette',
    defaultKeys: 'ctrl+shift+p',
    labelKey: 'openCommandPalette',
  },
];

interface ShortcutState {
  shortcuts: Record<string, string>;
  getShortcut: (id: string) => string;
  setShortcut: (id: string, keys: string) => void;
  resetShortcut: (id: string) => void;
  matchesEvent: (id: string, e: KeyboardEvent) => boolean;
}

function loadShortcuts(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export const useKeyboardShortcuts = create<ShortcutState>((set, get) => ({
  shortcuts: loadShortcuts(),

  getShortcut: (id: string) => {
    const def = SHORTCUT_DEFS.find(d => d.id === id);
    return get().shortcuts[id] ?? def?.defaultKeys ?? '';
  },

  setShortcut: (id: string, keys: string) => {
    set(state => {
      const shortcuts = { ...state.shortcuts, [id]: keys };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
      return { shortcuts };
    });
  },

  resetShortcut: (id: string) => {
    set(state => {
      const shortcuts = { ...state.shortcuts };
      delete shortcuts[id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
      return { shortcuts };
    });
  },

  matchesEvent: (id: string, e: KeyboardEvent) => {
    const keys = get().getShortcut(id);
    if (!keys) return false;
    const parts = keys.toLowerCase().split('+').map(p => p.trim());
    const ctrl = parts.includes('ctrl');
    const shift = parts.includes('shift');
    const alt = parts.includes('alt');
    const meta = parts.includes('meta') || parts.includes('cmd');
    const key = parts[parts.length - 1];
    return (
      e.ctrlKey === ctrl &&
      e.shiftKey === shift &&
      e.altKey === alt &&
      e.metaKey === meta &&
      e.key.toLowerCase() === key
    );
  },
}));
