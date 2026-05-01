export interface WSEvent<T = unknown> {
  event: string;
  workspaceId: string;
  timestamp: string;
  data: T;
}

// ---- Terminal Events ----

export interface TerminalCreatePayload {
  sessionId: string;
  cwd?: string;
}

export interface TerminalInputPayload {
  sessionId: string;
  data: string;
}

export interface TerminalResizePayload {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface TerminalClosePayload {
  sessionId: string;
}

export interface TerminalOutputPayload {
  sessionId: string;
  data: string;
}

export interface TerminalClosedPayload {
  sessionId: string;
  exitCode?: number;
}

// ---- Client → Server Event Map ----

export type ClientEventMap = {
  'terminal.create': TerminalCreatePayload;
  'terminal.input': TerminalInputPayload;
  'terminal.resize': TerminalResizePayload;
  'terminal.close': TerminalClosePayload;
};

// ---- Server → Client Event Map ----

export type ServerEventMap = {
  'connected': { workspaceId: string };
  'terminal.created': TerminalCreatePayload;
  'terminal.output': TerminalOutputPayload;
  'terminal.closed': TerminalClosedPayload;
};

export type ClientEventName = keyof ClientEventMap;
export type ServerEventName = keyof ServerEventMap;
