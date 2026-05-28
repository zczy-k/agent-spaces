"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { LogViewerTerminal, type LogEntry } from "@/components/log-viewer"
import { getWS } from "@/lib/ws"
import { useAgentStore } from "@/stores/agent"
import type {
  AgentStatusChangedPayload,
  AgentCompletedPayload,
  IssueStatusChangedPayload,
  TaskStatusChangedPayload,
} from "@agent-spaces/shared"

const MAX_ENTRIES = 2000

interface ActivityLogPanelProps {
  workspaceId: string
}

export function ActivityLogPanel({ workspaceId }: ActivityLogPanelProps) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const agents = useAgentStore((s) => s.agents)

  const agentName = useCallback(
    (agentId: string) => {
      const a = agents.find((ag) => ag.id === agentId)
      return a?.name ?? agentId.slice(0, 8)
    },
    [agents],
  )

  const append = useCallback((entry: LogEntry) => {
    setEntries((prev) => {
      const next = [...prev, entry]
      return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next
    })
  }, [])

  const clear = useCallback(() => setEntries([]), [])

  // track latest agents ref to avoid stale closure
  const agentsRef = useRef(agents)
  agentsRef.current = agents

  useEffect(() => {
    const ws = getWS(workspaceId)
    const ts = () => new Date().toISOString()

    const unsubs = [
      ws.on("agent.started", (data) => {
        const s = data as { agentId: string; role?: string }
        append({ level: "info", timestamp: ts(), message: `Agent "${agentName(s.agentId)}" started (role: ${s.role ?? "agent"})` })
      }),

      ws.on("agent.status_changed", (data) => {
        const { agentId, from, to } = data as AgentStatusChangedPayload
        const level = to === "crashed" ? "error" : to === "blocked" ? "warn" : "info"
        append({ level, timestamp: ts(), message: `Agent "${agentName(agentId)}" status: ${from} → ${to}` })
      }),

      ws.on("agent.completed", (data) => {
        const { agentId, error } = data as AgentCompletedPayload
        if (error) {
          append({ level: "error", timestamp: ts(), message: `Agent "${agentName(agentId)}" completed with error: ${error}` })
        } else {
          append({ level: "info", timestamp: ts(), message: `Agent "${agentName(agentId)}" completed` })
        }
      }),

      ws.on("agent.error", (data) => {
        const { agentId, error } = data as { agentId: string; error: string }
        append({ level: "error", timestamp: ts(), message: `Agent "${agentName(agentId)}" error: ${error}` })
      }),

      ws.on("issue.created", (data) => {
        const i = data as { id: string; title?: string }
        append({ level: "info", timestamp: ts(), message: `Issue created: ${i.title ?? i.id}` })
      }),

      ws.on("issue.status_changed", (data) => {
        const { from, to } = data as IssueStatusChangedPayload
        append({ level: "info", timestamp: ts(), message: `Issue status: ${from} → ${to}` })
      }),

      ws.on("task.created", (data) => {
        const t = data as { id: string; title?: string }
        append({ level: "info", timestamp: ts(), message: `Task created: ${t.title ?? t.id}` })
      }),

      ws.on("task.status_changed", (data) => {
        const { from, to } = data as TaskStatusChangedPayload
        const level = to === "failed" ? "error" : "info"
        append({ level, timestamp: ts(), message: `Task status: ${from} → ${to}` })
      }),
    ]

    return () => unsubs.forEach((u) => u())
  }, [workspaceId, append, agentName])

  return (
    <div className="h-full">
      <LogViewerTerminal
        entries={entries}
        title="Activity Log"
        maxHeight={Infinity}
        autoScroll
        onClear={clear}
      />
    </div>
  )
}
