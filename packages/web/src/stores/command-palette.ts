import { create } from 'zustand';
import type { LucideIcon } from 'lucide-react';

export interface CommandEntry {
  id: string;
  label: string;
  group: string;
  icon?: LucideIcon;
  shortcut?: string;
  action: () => void | Promise<void>;
}

interface CommandPaletteState {
  open: boolean;
  commands: CommandEntry[];
  setOpen: (open: boolean) => void;
  toggle: () => void;
  register: (command: CommandEntry) => () => void;
  registerMany: (commands: CommandEntry[]) => () => void;
  unregister: (id: string) => void;
}

export const useCommandPalette = create<CommandPaletteState>((set, get) => ({
  open: false,
  commands: [],
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  register: (command) => {
    set((s) => {
      if (s.commands.some((c) => c.id === command.id)) return s;
      return { commands: [...s.commands, command] };
    });
    return () => get().unregister(command.id);
  },
  registerMany: (commands) => {
    const ids = new Set(commands.map((c) => c.id));
    set((s) => ({
      commands: [...s.commands.filter((c) => !ids.has(c.id)), ...commands],
    }));
    return () => set((s) => ({ commands: s.commands.filter((c) => !ids.has(c.id)) }));
  },
  unregister: (id) => set((s) => ({ commands: s.commands.filter((c) => c.id !== id) })),
}));
