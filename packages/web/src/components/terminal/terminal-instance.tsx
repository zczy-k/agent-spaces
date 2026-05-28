'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useTheme } from '@/components/theme-provider';
import { getWS } from '@/lib/ws';
import { useTerminalStore, consumeSessionBuffer } from '@/stores/terminal';

// Global registry to persist xterm instances across mount/unmount cycles.
// xterm itself is a singleton per session, so its WS input/output bindings must
// also be singleton per session. Otherwise duplicate mounts write output twice.
const terminalRegistry = new Map<string, {
  xterm: Terminal;
  fit: FitAddon;
  inputDisposable?: { dispose: () => void };
  outputHandler?: (data: unknown) => void;
}>();

function disableXtermMobileKeyboard(xterm: Terminal) {
  const textarea = xterm.textarea;
  if (!textarea) return;
  textarea.inputMode = 'none';
  textarea.setAttribute('inputmode', 'none');
}

export function disposeTerminalSession(sessionId: string) {
  const cached = terminalRegistry.get(sessionId);
  if (cached) {
    const ws = useTerminalStore.getState().ws;
    if (cached.outputHandler) {
      ws?.off('terminal.output', cached.outputHandler);
    }
    cached.inputDisposable?.dispose();
    cached.xterm.dispose();
    terminalRegistry.delete(sessionId);
  }
}

const TERM_THEMES = {
  light: {
    background: '#ffffff',
    foreground: '#222222',
    cursor: '#1456f0',
    cursorAccent: '#ffffff',
    selectionBackground: 'rgba(20, 86, 240, 0.2)',
    black: '#222222',
    red: '#ef4444',
    green: '#16a34a',
    yellow: '#ca8a04',
    blue: '#1456f0',
    magenta: '#ea5ec1',
    cyan: '#0891b2',
    white: '#e5e7eb',
    brightBlack: '#45515e',
    brightRed: '#f87171',
    brightGreen: '#22c55e',
    brightYellow: '#eab308',
    brightBlue: '#3b82f6',
    brightMagenta: '#f472b6',
    brightCyan: '#06b6d4',
    brightWhite: '#f9fafb',
  },
  dark: {
    background: '#0f1117',
    foreground: '#e5e7eb',
    cursor: '#3b82f6',
    cursorAccent: '#0f1117',
    selectionBackground: 'rgba(59, 130, 246, 0.25)',
    black: '#0f1117',
    red: '#ef4444',
    green: '#22c55e',
    yellow: '#eab308',
    blue: '#3b82f6',
    magenta: '#ea5ec1',
    cyan: '#06b6d4',
    white: '#e5e7eb',
    brightBlack: '#8b8fa3',
    brightRed: '#f87171',
    brightGreen: '#4ade80',
    brightYellow: '#facc15',
    brightBlue: '#60a5fa',
    brightMagenta: '#f472b6',
    brightCyan: '#22d3ee',
    brightWhite: '#f9fafb',
  },
};

interface TerminalInstanceProps {
  sessionId: string;
  workspaceId: string;
  active: boolean;
}

export function TerminalInstance({ sessionId, workspaceId, active }: TerminalInstanceProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const { resolvedTheme } = useTheme();
  // Capture theme for terminal creation without adding it to the creation effect deps.
  // A separate effect below syncs the theme on existing terminals.
  const themeForCreateRef = useRef(resolvedTheme);
  useEffect(() => { themeForCreateRef.current = resolvedTheme; }, [resolvedTheme]);

  const fitAndResize = useCallback(() => {
    const xterm = xtermRef.current;
    const fit = fitRef.current;
    const container = termRef.current;
    if (!xterm || !fit || !container || container.clientWidth === 0 || container.clientHeight === 0) return;

    const ws = getWS(workspaceId);
    try { fit.fit(); } catch { /* ignore */ }
    ws.send('terminal.resize', {
      sessionId,
      cols: xterm.cols,
      rows: xterm.rows,
    });
  }, [sessionId, workspaceId]);

  useEffect(() => {
    if (!termRef.current) return;

    const ws = getWS(workspaceId);
    let xterm: Terminal;
    let fit: FitAddon;

    const cached = terminalRegistry.get(sessionId);
    if (cached) {
      // Reuse existing terminal — move DOM element to new container
      xterm = cached.xterm;
      fit = cached.fit;
      if (xterm.element) {
        termRef.current.appendChild(xterm.element);
      }
      requestAnimationFrame(() => fit.fit());
    } else {
      // Create new terminal instance
      xterm = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        rightClickSelectsWord: true,
        macOptionClickForcesSelection: true,
        theme: themeForCreateRef.current === 'dark' ? TERM_THEMES.dark : TERM_THEMES.light,
      });

      fit = new FitAddon();
      xterm.loadAddon(fit);
      xterm.loadAddon(new WebLinksAddon((_e: MouseEvent, uri: string) => {
        window.open(uri);
      }));
      xterm.open(termRef.current);
      xterm.attachCustomKeyEventHandler((event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && xterm.hasSelection()) {
          void navigator.clipboard?.writeText(xterm.getSelection());
          return false;
        }
        return true;
      });

      requestAnimationFrame(() => fit.fit());

      terminalRegistry.set(sessionId, { xterm, fit });
    }
    disableXtermMobileKeyboard(xterm);

    // Restore buffered output supplied by the server for reconnected sessions.
    const buffer = consumeSessionBuffer(sessionId);
    if (buffer) {
      if (cached) xterm.clear();
      xterm.write(buffer);
    }

    xtermRef.current = xterm;
    fitRef.current = fit;

    const registryEntry = terminalRegistry.get(sessionId);
    if (registryEntry && !registryEntry.outputHandler) {
      registryEntry.inputDisposable = xterm.onData((data) => {
        ws.send('terminal.input', { sessionId, data });
      });

      registryEntry.outputHandler = (data: unknown) => {
        const { sessionId: sid, data: output } = data as { sessionId: string; data: string };
        if (sid === sessionId) {
          xterm.write(output);
        }
      };
      ws.on('terminal.output', registryEntry.outputHandler);
    }

    // Send initial size
    ws.send('terminal.resize', {
      sessionId,
      cols: xterm.cols,
      rows: xterm.rows,
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      try { fit.fit(); } catch { /* ignore */ }
      ws.send('terminal.resize', {
        sessionId,
        cols: xterm.cols,
        rows: xterm.rows,
      });
    });
    const terminalElement = termRef.current;
    resizeObserver.observe(terminalElement);

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (!xterm.hasSelection()) return;
      void navigator.clipboard?.writeText(xterm.getSelection());
    };
    terminalElement.addEventListener('contextmenu', handleContextMenu, { capture: true });

    return () => {
      resizeObserver.disconnect();
      terminalElement.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      // If session was removed from store (user/server closed it), dispose terminal
      const { sessions } = useTerminalStore.getState();
      if (!sessions.some(s => s.id === sessionId)) {
        disposeTerminalSession(sessionId);
      }
    };
  }, [sessionId, workspaceId]);

  useEffect(() => {
    if (!active) return;

    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(fitAndResize);
    });

    return () => cancelAnimationFrame(frame);
  }, [active, fitAndResize]);

  // Sync theme without recreating terminal
  useEffect(() => {
    if (!xtermRef.current || !resolvedTheme) return;
    xtermRef.current.options.theme = resolvedTheme === 'dark' ? TERM_THEMES.dark : TERM_THEMES.light;
  }, [resolvedTheme]);

  return (
    <div
      ref={termRef}
      className="h-full w-full select-text touch-pan-x touch-pan-y"
      style={{ WebkitTouchCallout: 'none' }}
    />
  );
}
