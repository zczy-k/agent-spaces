"use client"

import { useEffect, useState } from 'react'
import { useRouter } from "next/navigation"
import { FolderOpen, MoreHorizontal, Pencil, Trash2, FolderSearch } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { WorkspaceDialog } from '@/components/workspace/workspace-dialog'
import { useWorkspaceStore } from '@/stores/workspace'
import type { Workspace } from '@agent-spaces/shared'
import { tauriNavigate } from '@/lib/navigate'

export function WorkspacesPage({ initialWorkspaces }: { initialWorkspaces: Workspace[] }) {
  const t = useTranslations('workspaces')
  const tc = useTranslations('common')
  const router = useRouter()
  const workspaces = useWorkspaceStore((store) => store.workspaces)
  const setWorkspaces = useWorkspaceStore((store) => store.setWorkspaces)
  const upsertWorkspace = useWorkspaceStore((store) => store.upsertWorkspace)
  const removeWorkspace = useWorkspaceStore((store) => store.removeWorkspace)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingWs, setEditingWs] = useState<Workspace | null>(null)

  useEffect(() => {
    setWorkspaces(initialWorkspaces)
  }, [initialWorkspaces, setWorkspaces])

  const handleWsSubmit = async (data: { name: string; boundDirs: string[] }) => {
    if (editingWs) {
      const res = await fetch(`/api/workspaces/${editingWs.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const ws = await res.json()
      upsertWorkspace(ws)
    } else {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const ws = await res.json()
      upsertWorkspace(ws)
    }
  }

  const handleDelete = async (ws: Workspace) => {
    if (!confirm(t('deleteConfirm', { name: ws.name }))) return
    await fetch(`/api/workspaces/${ws.id}`, { method: 'DELETE' })
    removeWorkspace(ws.id)
  }

  const handleReveal = async (ws: Workspace) => {
    await fetch(`/api/workspaces/${ws.id}/reveal`, { method: 'POST' })
  }

  const openEditDialog = (ws: Workspace) => {
    setEditingWs(ws)
    setDialogOpen(true)
  }

  return (
    <div className='flex min-h-dvh w-full flex-col'>
      <main className='mx-auto size-full max-w-7xl flex-1 px-4 py-6 sm:px-6'>
        <div className='mb-6 flex items-center justify-between'>
          <h1 className='text-2xl font-semibold'>{t('title')}</h1>
          <Button onClick={() => { setEditingWs(null); setDialogOpen(true) }} size='sm' className='rounded-full px-4'>
            <Plus className='size-3.5' />
            {t('newWorkspace')}
          </Button>
        </div>
        {workspaces.length === 0 ? (
          <div className='rounded-2xl border border-dashed border-border p-16 text-center'>
            <FolderOpen className='size-10 mx-auto text-muted-foreground/40 mb-4' />
            <p className='text-muted-foreground text-sm'>
              {t('emptyMessage')}
            </p>
          </div>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => tauriNavigate(router, `/workspace/${ws.id}`)}
                className='group relative rounded-2xl border border-border bg-card p-5 hover:shadow-card-hover transition-all duration-200 block'
              >
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className='absolute right-3 top-3 flex items-center justify-center rounded-md p-1 opacity-0 group-hover:opacity-100 hover:bg-accent transition-opacity cursor-pointer'
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className='size-4 text-muted-foreground' />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(ws) }}>
                      <Pencil className='size-3.5' />
                      {t('edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleReveal(ws) }}>
                      <FolderSearch className='size-3.5' />
                      {t('reveal')}
                    </DropdownMenuItem>
                    <DropdownMenuItem variant='destructive' onClick={(e) => { e.stopPropagation(); handleDelete(ws) }}>
                      <Trash2 className='size-3.5' />
                      {t('delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center'>
                    <FolderOpen className='size-5 text-primary' />
                  </div>
                  <h3 className='font-heading text-lg font-semibold truncate'>{ws.name}</h3>
                </div>
                <p className='text-sm text-muted-foreground mt-1 truncate'>
                  {ws.boundDirs.join(', ')}
                </p>
              </button>
            ))}
          </div>
        )}
      </main>

      <WorkspaceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workspace={editingWs}
        onSubmit={handleWsSubmit}
      />
    </div>
  )
}
