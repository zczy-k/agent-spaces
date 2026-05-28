"use client"

import { useEffect } from "react"
import { LogViewerTerminal } from "@/components/log-viewer"
import { getActivityLogStore, startActivityLogListeners } from "@/stores/activity-log"

interface ActivityLogPanelProps {
  workspaceId: string
}

export function ActivityLogPanel({ workspaceId }: ActivityLogPanelProps) {
  const store = getActivityLogStore(workspaceId)
  const entries = store((s) => s.entries)
  const clear = store((s) => s.clear)

  useEffect(() => {
    startActivityLogListeners(workspaceId)
  }, [workspaceId])

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
