import { create } from 'zustand';
import type { QuickCommand, CommandProcess } from '@agent-spaces/shared';
import { sdk } from '@/lib/sdk';
import { getWS } from '@/lib/ws';
import { toast } from 'sonner';
import { useTerminalStore } from '@/stores/terminal';

interface RunningState {
  sessionId: string;
  status: CommandProcess['status'];
}

interface CommandStore {
  commands: QuickCommand[];
  runningMap: Record<string, RunningState>;
  loaded: boolean;
  wsAttached: boolean;

  load: (workspaceId: string) => Promise<void>;
  create: (workspaceId: string, input: { name: string; command: string; folder?: string; cwd?: string; shell?: string; env?: Record<string, string>; autoRestart?: boolean }) => Promise<void>;
  update: (workspaceId: string, id: string, updates: Partial<QuickCommand>) => Promise<void>;
  remove: (workspaceId: string, id: string) => Promise<void>;
  run: (workspaceId: string, commandId: string) => Promise<void>;
  restart: (workspaceId: string, commandId: string) => Promise<void>;
  stop: (workspaceId: string, commandId: string) => Promise<void>;
  attachWS: (workspaceId: string) => void;
  isRunning: (commandId: string) => boolean;
}

export const useCommandStore = create<CommandStore>((set, get) => ({
  commands: [],
  runningMap: {},
  loaded: false,
  wsAttached: false,

  load: async (workspaceId: string) => {
    const [commands, processes] = await Promise.all([
      sdk.command.list(workspaceId),
      sdk.http.get<CommandProcess[]>(`/api/workspaces/${workspaceId}/commands/processes`),
    ]);
    const runningMap: Record<string, RunningState> = {};
    for (const p of processes) {
      runningMap[p.commandId] = { sessionId: p.sessionId, status: p.status };
    }
    set({ commands, runningMap, loaded: true });
    for (const p of processes) {
      const cmd = commands.find((c: QuickCommand) => c.id === p.commandId);
      if (cmd) useTerminalStore.getState().setSessionName(p.sessionId, cmd.name);
    }
    get().attachWS(workspaceId);
  },

  create: async (workspaceId, input) => {
    const cmd = await sdk.command.create(workspaceId, input);
    set(s => ({ commands: [...s.commands, cmd] }));
  },

  update: async (workspaceId, id, updates) => {
    const updated = await sdk.command.update(workspaceId, id, updates);
    set(s => ({
      commands: s.commands.map(c => c.id === id ? updated : c),
    }));
  },

  remove: async (workspaceId, id) => {
    await sdk.command.delete_(workspaceId, id);
    set(s => ({
      commands: s.commands.filter(c => c.id !== id),
      runningMap: Object.fromEntries(Object.entries(s.runningMap).filter(([k]) => k !== id)),
    }));
  },

  run: async (workspaceId, commandId) => {
    try {
      await sdk.http.post(`/api/workspaces/${workspaceId}/commands/${commandId}/run`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to run command');
      throw e;
    }
  },

  restart: async (workspaceId, commandId) => {
    try {
      await sdk.http.post(`/api/workspaces/${workspaceId}/commands/${commandId}/restart`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to restart command');
      throw e;
    }
  },

  stop: async (workspaceId, commandId) => {
    try {
      await sdk.command.stop(workspaceId, commandId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg || 'Failed to stop command');
      throw e;
    }
  },

  attachWS: (workspaceId: string) => {
    if (get().wsAttached) return;
    const ws = getWS(workspaceId);

    ws.on('command.started', (data) => {
      const { commandId, sessionId } = data as { commandId: string; sessionId: string };
      const cmd = get().commands.find(c => c.id === commandId);
      if (cmd) useTerminalStore.getState().setSessionName(sessionId, cmd.name);
      set(s => ({
        runningMap: { ...s.runningMap, [commandId]: { sessionId, status: 'running' } },
      }));
    });

    ws.on('command.stopped', (data) => {
      const { commandId } = data as { commandId: string };
      set(s => {
        const { [commandId]: _, ...rest } = s.runningMap;
        return { runningMap: rest };
      });
    });

    ws.on('command.restarted', (data) => {
      const { commandId, sessionId } = data as { commandId: string; sessionId: string };
      set(s => ({
        runningMap: { ...s.runningMap, [commandId]: { sessionId, status: 'running' } },
      }));
    });

    // User closes terminal tab manually -> clean up running state
    ws.on('terminal.closed', (data) => {
      const { sessionId } = data as { sessionId: string };
      set(s => {
        const newMap = Object.fromEntries(
          Object.entries(s.runningMap).filter(([_, v]) => v.sessionId !== sessionId)
        );
        if (Object.keys(newMap).length === Object.keys(s.runningMap).length) return s;
        return { runningMap: newMap };
      });
    });

    set({ wsAttached: true });
  },

  isRunning: (commandId: string) => {
    return !!get().runningMap[commandId];
  },
}));
