'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { getWS } from '@/lib/ws';

interface TerminalInstanceProps {
  sessionId: string;
  workspaceId: string;
}

export function TerminalInstance({ sessionId, workspaceId }: TerminalInstanceProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  const handleOutput = useCallback((data: unknown) => {
    const { sessionId: sid, data: output } = data as { sessionId: string; data: string };
    if (sid === sessionId && xtermRef.current) {
      xtermRef.current.write(output);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!termRef.current) return;

    const xterm = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc',
      },
    });

    const fit = new FitAddon();
    xterm.loadAddon(fit);
    xterm.loadAddon(new WebLinksAddon());
    xterm.open(termRef.current);

    requestAnimationFrame(() => fit.fit());

    xtermRef.current = xterm;
    fitRef.current = fit;

    const ws = getWS(workspaceId);

    // Send terminal input to server
    const inputDisposable = xterm.onData((data) => {
      ws.send('terminal.input', { sessionId, data });
    });

    // Listen for output
    ws.on('terminal.output', handleOutput);

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
    resizeObserver.observe(termRef.current);

    return () => {
      resizeObserver.disconnect();
      inputDisposable.dispose();
      ws.off('terminal.output', handleOutput);
      xterm.dispose();
    };
  }, [sessionId, workspaceId, handleOutput]);

  return <div ref={termRef} className="h-full w-full" />;
}
