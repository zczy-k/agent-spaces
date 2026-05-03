'use client';

import { useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { useTerminalStore } from '@/stores/terminal';
import { getWS } from '@/lib/ws';
import { TerminalInstance } from './terminal-instance';

interface TerminalPanelProps {
  workspaceId: string;
}

export function TerminalPanel({ workspaceId }: TerminalPanelProps) {
  const { sessions, activeId, init, createSession, setActive, removeSession } = useTerminalStore();

  useEffect(() => {
    const ws = getWS(workspaceId);
    init(ws);
    // Auto-create first terminal
    if (sessions.length === 0) {
      createSession();
    }
  }, [workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSession = sessions.find((s) => s.id === activeId);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-1 py-0.5 bg-muted border-b border-border overflow-x-auto">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => setActive(session.id)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-t transition-colors shrink-0 ${
              activeId === session.id
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
          >
            <span className="font-mono">$</span>
            <span>Terminal {sessions.indexOf(session) + 1}</span>
            <span
              onClick={(e) => { e.stopPropagation(); removeSession(session.id); }}
              className="ml-1 hover:text-destructive cursor-pointer"
            >
              <X size={12} />
            </span>
          </button>
        ))}
        <button
          onClick={createSession}
          className="flex items-center justify-center w-6 h-6 text-muted-foreground hover:text-foreground transition-colors"
          title="New Terminal"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Terminal content */}
      <div className="flex-1 overflow-hidden relative">
        {sessions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No terminal session
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="absolute inset-0"
              style={{ display: activeId === session.id ? 'block' : 'none' }}
            >
              <TerminalInstance
                sessionId={session.id}
                workspaceId={workspaceId}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
