"use client"

import { LogViewerTerminal } from "@/components/log-viewer"
import { getActivityLogStore } from "@/stores/activity-log"

interface ActivityLogPanelProps {
  workspaceId: string
}

export function ActivityLogPanel({ workspaceId }: ActivityLogPanelProps) {
  const store = getActivityLogStore(workspaceId)
  const entries = store((s) => s.entries)
  const clear = store((s) => s.clear)

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
