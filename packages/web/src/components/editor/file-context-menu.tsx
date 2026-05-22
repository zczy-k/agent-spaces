"use client"

import { Pencil, MoveRight, Copy, ExternalLink, Download, Link, Trash2 } from "lucide-react"
import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
import { useTranslations } from "next-intl"

interface FileContextMenuProps {
  filePath: string
  workspaceId: string
  boundDir?: string
  onRename?: () => void
  onMove?: () => void
  onCopyItem?: () => void
  onDelete?: () => void
}

export function FileContextMenu({ filePath, workspaceId, boundDir, onRename, onMove, onCopyItem, onDelete }: FileContextMenuProps) {
  const t = useTranslations('editor')

  const handleCopyPath = () => {
    const absPath = boundDir ? boundDir.replace(/\/+$/, '') + '/' + filePath : filePath
    navigator.clipboard.writeText(absPath)
  }

  const handleReveal = () => {
    fetch(`/api/workspaces/${workspaceId}/files/reveal?path=${encodeURIComponent(filePath)}`, { method: 'POST' })
  }

  const handleDownload = () => {
    const url = `/api/workspaces/${workspaceId}/files/download?path=${encodeURIComponent(filePath)}`
    const a = document.createElement('a')
    a.href = url
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleCopyDownloadUrl = () => {
    const url = `${window.location.origin}/api/workspaces/${workspaceId}/files/download?path=${encodeURIComponent(filePath)}`
    navigator.clipboard.writeText(url)
  }

  return (
    <ContextMenuContent>
      {onRename && (
        <ContextMenuItem onClick={onRename}>
          <Pencil className="size-4" />
          {t('rename')}
        </ContextMenuItem>
      )}
      {onMove && (
        <ContextMenuItem onClick={onMove}>
          <MoveRight className="size-4" />
          {t('move')}
        </ContextMenuItem>
      )}
      {onCopyItem && (
        <ContextMenuItem onClick={onCopyItem}>
          <Copy className="size-4" />
          {t('copyFile')}
        </ContextMenuItem>
      )}
      <ContextMenuItem onClick={handleCopyPath}>
        <Copy className="size-4" />
        {t('copyPath')}
      </ContextMenuItem>
      <ContextMenuItem onClick={handleReveal}>
        <ExternalLink className="size-4" />
        {t('revealInFinder')}
      </ContextMenuItem>
      {onDelete && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="size-4" />
            {t('deleteFileTitle')}
          </ContextMenuItem>
        </>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem onClick={handleDownload}>
        <Download className="size-4" />
        {t('download')}
      </ContextMenuItem>
      <ContextMenuItem onClick={handleCopyDownloadUrl}>
        <Link className="size-4" />
        {t('copyDownloadUrl')}
      </ContextMenuItem>
    </ContextMenuContent>
  )
}
