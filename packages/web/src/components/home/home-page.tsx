"use client"

import { useEffect, useState } from 'react'

import { UsageDashboard } from '@/components/home/usage-dashboard'
import { WorkspaceDialog } from '@/components/workspace/workspace-dialog'
import { useWorkspaceStore } from '@/stores/workspace'
import type { Workspace } from '@agent-spaces/shared'

export function HomePage({ initialWorkspaces }: { initialWorkspaces: Workspace[] }) {
  const setWorkspaces = useWorkspaceStore((store) => store.setWorkspaces)
  const upsertWorkspace = useWorkspaceStore((store) => store.upsertWorkspace)
  const createDialogOpen = useWorkspaceStore((s) => s.createDialogOpen)
  const setCreateDialogOpen = useWorkspaceStore((s) => s.setCreateDialogOpen)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    setWorkspaces(initialWorkspaces)
  }, [initialWorkspaces, setWorkspaces])

  const handleWsSubmit = async (data: { name: string; boundDirs: string[] }) => {
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const ws = await res.json()
    upsertWorkspace(ws)
  }

  return (
    <div className='flex h-full w-full flex-col overflow-auto'>
      <main className='w-full flex-1 px-4 py-6 sm:px-6'>
        <UsageDashboard />
      </main>

      <WorkspaceDialog
        open={dialogOpen || createDialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setCreateDialogOpen(false)
        }}
        onSubmit={handleWsSubmit}
      />
    </div>
  )
}
