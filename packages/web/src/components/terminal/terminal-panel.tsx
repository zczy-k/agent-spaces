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
    <div className="flex flex-col h-full bg-[#1e1e2e]">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-1 py-0.5 bg-[#181825] border-b border-[#313244] overflow-x-auto">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => setActive(session.id)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-t transition-colors shrink-0 ${
              activeId === session.id
                ? 'bg-[#1e1e2e] text-[#cdd6f4]'
                : 'text-[#6c7086] hover:text-[#cdd6f4] hover:bg-[#1e1e2e]/50'
            }`}
          >
            <span className="font-mono">$</span>
            <span>Terminal {sessions.indexOf(session) + 1}</span>
            <span
              onClick={(e) => { e.stopPropagation(); removeSession(session.id); }}
              className="ml-1 hover:text-[#f38ba8] cursor-pointer"
            >
              <X size={12} />
            </span>
          </button>
        ))}
        <button
          onClick={createSession}
          className="flex items-center justify-center w-6 h-6 text-[#6c7086] hover:text-[#cdd6f4] transition-colors"
          title="New Terminal"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Terminal content */}
      <div className="flex-1 overflow-hidden">
        {activeSession ? (
          <TerminalInstance
            key={activeSession.id}
            sessionId={activeSession.id}
            workspaceId={workspaceId}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-[#6c7086] text-sm">
            No terminal session
          </div>
        )}
      </div>
    </div>
  );
}
