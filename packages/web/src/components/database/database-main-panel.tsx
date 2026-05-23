'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Plus, X, ChevronRight, Sidebar, Layers, BookOpen,
  Minimize2, Maximize2, Check, MoreHorizontal,
  CheckCircle, Sparkles, FileCheck, List, History,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { htmlToMarkdown, markdownToHtml } from '@/lib/converter';
import { useDatabaseStore } from '@/stores/database';
import { PRESET_COVERS, type DatabaseNodeVersion } from '@agent-spaces/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Markdown } from '@/components/ui/markdown';
import NotionEditor from './notion-editor';
import MarkdownEditor from './markdown-editor';
import { TableOfContents, extractTocFromHtml, extractTocFromMarkdown } from './table-of-contents';
import type { PanelImperativeHandle } from 'react-resizable-panels';

interface DatabaseMainPanelProps {
  workspaceId: string;
  sidebarPanelRef?: React.RefObject<PanelImperativeHandle | null>;
  showSaveSuccess?: boolean;
  onSave: () => void;
}

export function DatabaseMainPanel({
  workspaceId,
  sidebarPanelRef,
  showSaveSuccess,
  onSave,
}: DatabaseMainPanelProps) {
  const {
    nodes, activeId, openTabs, editorMode, theme, isFullWidth,
    setActiveId, createNode, updateContent, renameNode, updateCover,
    setEditorMode, setTheme, setIsFullWidth, closeTab, listNodeVersions,
  } = useDatabaseStore();
  const t = useTranslations('database');
  const tc = useTranslations('common');

  const [tocOpen, setTocOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<DatabaseNodeVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const activeNode = nodes.find(n => n.id === activeId);
  const wordCount = activeNode ? (activeNode.content.replace(/<[^>]*>/g, '').trim().length || 0) : 0;
  const tocHeadings = useMemo(() => {
    if (!activeNode) return [];
    return editorMode === 'notion'
      ? extractTocFromHtml(activeNode.content)
      : extractTocFromMarkdown(activeNode.content);
  }, [activeNode, editorMode]);

  const handleAddChild = useCallback(async (parentId: string | null) => {
    await createNode(workspaceId, parentId);
    onSave();
  }, [workspaceId, createNode, onSave]);

  const handleModeToggle = useCallback((mode: 'notion' | 'markdown') => {
    if (!activeNode) return;
    if (mode === 'markdown' && editorMode === 'notion') {
      updateContent(workspaceId, activeNode.id, htmlToMarkdown(activeNode.content));
    } else if (mode === 'notion' && editorMode === 'markdown') {
      updateContent(workspaceId, activeNode.id, markdownToHtml(activeNode.content));
    }
    setEditorMode(mode);
  }, [activeNode, editorMode, workspaceId, updateContent, setEditorMode]);

  const handleCloseTab = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  }, [closeTab]);

  const handleOpenHistory = useCallback(async () => {
    if (!activeNode) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const items = await listNodeVersions(workspaceId, activeNode.id);
      setVersions(items);
      setSelectedVersionId(items[0]?.id ?? null);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : t('loadHistoryFailed'));
      setVersions([]);
      setSelectedVersionId(null);
    } finally {
      setHistoryLoading(false);
    }
  }, [activeNode, listNodeVersions, workspaceId, t]);

  const themeOptions = useMemo(() => [
    { key: 'sans' as const, label: t('themeSans'), fontClass: 'font-sans' },
    { key: 'serif' as const, label: t('themeSerif'), fontClass: 'font-serif' },
    { key: 'mono' as const, label: t('themeMono'), fontClass: 'font-mono' },
  ], [t]);

  const selectedVersion = useMemo(
    () => versions.find((item) => item.id === selectedVersionId) ?? versions[0] ?? null,
    [selectedVersionId, versions],
  );

  return (
    <>
      {showSaveSuccess && (
        <div className="absolute top-4 right-1/2 translate-x-1/2 bg-card border border-border text-foreground text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2 shadow-2xl z-50">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /><span>{t('autoSaved')}</span>
        </div>
      )}

      {/* Tabs bar */}
      <div className="flex items-center justify-between bg-muted/50 border-b border-border px-4 min-h-[44px] select-none z-10 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1 flex-1 pr-4">
          {openTabs.map((tabId) => {
            const tabNode = nodes.find(n => n.id === tabId);
            if (!tabNode) return null;
            return (
              <div key={tabId} onClick={() => setActiveId(tabId)}
                className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all shrink-0 group border",
                  activeId === tabId ? "bg-card text-foreground border-border font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent")}>
                <span className="text-sm select-none shrink-0">{tabNode.icon || '📝'}</span>
                <span className="truncate max-w-[120px]">{tabNode.title || t('untitled')}</span>
                <button onClick={(e) => handleCloseTab(e, tabId)}
                  className="p-0.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1 opacity-60 group-hover:opacity-100 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          <button onClick={() => handleAddChild(null)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-1 cursor-pointer shrink-0">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Top nav bar */}
      <div className="h-14 px-6 border-b border-border flex items-center justify-between bg-background/80 backdrop-blur-md sticky top-0 z-10 select-none shrink-0">
        <div className="flex items-center gap-3">
          {sidebarPanelRef && (
            <button onClick={() => sidebarPanelRef.current?.isCollapsed() ? sidebarPanelRef.current?.expand() : sidebarPanelRef.current?.collapse()}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mr-1 cursor-pointer">
              <Sidebar className="w-4 h-4" />
            </button>
          )}
          {activeNode ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <span>{t('knowledgeBase')}</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
              {activeNode.parentId && (
                <>
                  <span onClick={() => activeNode.parentId && setActiveId(activeNode.parentId)}
                    className="hover:text-foreground hover:underline cursor-pointer">
                    {nodes.find(n => n.id === activeNode.parentId)?.title || t('parentDir')}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                </>
              )}
              <span className="text-foreground font-semibold truncate max-w-[180px]">{activeNode.title || t('currentDoc')}</span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground font-medium">{t('knowledgeTree')}</div>
          )}
        </div>

        {activeNode && (
          <div className="flex items-center gap-4">
            <div className="flex bg-card border border-border p-1 rounded-xl shrink-0">
              <button onClick={() => handleModeToggle('notion')}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                  editorMode === 'notion' ? "bg-muted text-foreground font-bold" : "text-muted-foreground hover:text-foreground")}>
                <Layers className="w-3.5 h-3.5" /><span>{t('notionEditor')}</span>
              </button>
              <button onClick={() => handleModeToggle('markdown')}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                  editorMode === 'markdown' ? "bg-muted text-foreground font-bold" : "text-muted-foreground hover:text-foreground")}>
                <BookOpen className="w-3.5 h-3.5" /><span>{t('markdownEditor')}</span>
              </button>
            </div>
            <div className="w-[1px] h-5 bg-border" />
            <button onClick={() => setTocOpen(!tocOpen)} title={tocOpen ? t('closeToc') : t('openToc')}
              className={cn("w-9 h-9 rounded-xl border border-border bg-card transition-all cursor-pointer flex items-center justify-center shrink-0",
                tocOpen ? "text-foreground border-muted-foreground/40" : "text-muted-foreground hover:text-foreground hover:border-muted-foreground/40")}>
              <List className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-5 bg-border" />
            <DropdownMenu>
              <DropdownMenuTrigger className="w-9 h-9 rounded-xl border border-border hover:border-muted-foreground/40 bg-card text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center justify-center shrink-0">
                <MoreHorizontal className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider">{t('typographyAndFont')}</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {themeOptions.map(({ key, label, fontClass }) => (
                  <DropdownMenuItem key={key} onClick={() => setTheme(key)}
                    className={cn("flex items-center justify-between text-xs", theme === key && "font-semibold")}>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs bg-muted text-foreground px-1.5 py-0.5 rounded border border-border font-medium", fontClass)}>Ag</span>
                      <span className={fontClass}>{label}</span>
                    </div>
                    {theme === key && <Check className="w-3.5 h-3.5" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleOpenHistory} className="text-xs">
                  <History className="w-3.5 h-3.5" />
                  <span>{t('viewHistory')}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider">{t('pageWidth')}</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsFullWidth(!isFullWidth)}
                  className={cn("flex items-center justify-between text-xs", isFullWidth && "font-semibold")}>
                  <div className="flex items-center gap-2">
                    {isFullWidth ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    <span>{isFullWidth ? t('restoreWidth') : t('fullWidth')}</span>
                  </div>
                  {isFullWidth && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Content */}
      {activeNode ? (
        <div className="flex-1 min-h-0 flex flex-col">
        <TableOfContents headings={tocHeadings} open={tocOpen} />
        <div className="flex-1 overflow-y-auto w-full flex flex-col" data-editor-content>
          <div className="w-full h-44 shrink-0 relative group border-b border-border"
            style={{ background: activeNode.cover || 'linear-gradient(to right, #0284c7, #06b6d4)' }}>
            <div className="absolute bottom-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-card/90 backdrop-blur-md rounded-xl p-1.5 border border-border flex items-center gap-1 shadow-xl">
              <span className="text-[10px] text-muted-foreground font-bold px-2">{t('cover')}</span>
              {PRESET_COVERS.map((preset, idx) => (
                <button key={idx} onClick={() => { updateCover(workspaceId, activeNode.id, preset); onSave(); }}
                  style={{ background: preset }}
                  className={cn("w-4 h-4 rounded-full border hover:scale-125 transition-transform cursor-pointer",
                    activeNode.cover === preset ? "border-white scale-110" : "border-transparent")} />
              ))}
            </div>
          </div>

          <div className={cn("flex-1 mx-auto px-6 md:px-12 py-8 flex flex-col w-full", isFullWidth ? "max-w-none" : "max-w-4xl")}>
            <div className="mb-6 relative group select-text">
              <span className="text-4xl absolute -top-16 left-0 select-none bg-card p-2.5 rounded-2xl shadow-xl border border-border">
                {activeNode.icon || '📝'}
              </span>
              <div className="text-[11px] text-muted-foreground font-semibold mb-2 flex items-center gap-1 mt-4">
                <Sparkles className="w-3.5 h-3.5 text-muted-foreground/60" /><span>{t('autoSaveEnabled')}</span>
              </div>
              <input type="text" value={activeNode.title}
                onChange={(e) => { renameNode(workspaceId, activeNode.id, e.target.value); onSave(); }}
                placeholder={t('untitled')}
                className={cn("w-full text-3xl md:text-4xl font-extrabold text-foreground border-none outline-none focus:ring-0 p-0 tracking-tight bg-transparent placeholder:text-muted-foreground/40 select-text",
                  theme === 'serif' && 'font-serif', theme === 'mono' && 'font-mono')} />
            </div>

            <div className="flex-1 min-h-0 select-text">
              {editorMode === 'notion' ? (
                <NotionEditor content={activeNode.content} onChange={(html) => { updateContent(workspaceId, activeNode.id, html); onSave(); }} theme={theme} />
              ) : (
                <MarkdownEditor contentMarkdown={activeNode.content} onChange={(md) => { updateContent(workspaceId, activeNode.id, md); onSave(); }} theme={theme} />
              )}
            </div>

            <div className="sticky bottom-0 bg-background border-t border-border py-3 px-6 md:px-12 flex flex-col sm:flex-row items-center justify-between text-[11px] text-muted-foreground font-medium gap-2">
              <div className="flex items-center gap-5">
                <span>{t('wordCount')}<strong className="text-foreground">{wordCount}</strong></span>
                <span className="hidden sm:inline">{t('createdAt')}{new Date(activeNode.createdAt).toLocaleDateString()}</span>
                <span>{t('modifiedAt')}{new Date(activeNode.updatedAt).toLocaleTimeString()}</span>
              </div>
              <div className="flex items-center gap-1.5 text-foreground bg-card border border-border px-3 py-1 rounded-full font-semibold shrink-0">
                <FileCheck className="w-3 h-3 text-emerald-500 animate-pulse" /><span>SAVED</span>
              </div>
            </div>
          </div>
        </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background select-none text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-muted to-muted/80 border border-border flex items-center justify-center text-4xl mb-6 shadow-md shadow-black/10 text-muted-foreground animate-bounce">📁</div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">{t('knowledgeEditor')}</h2>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-[340px] leading-relaxed">
            {t('emptyHint')}
          </p>
          <div className="mt-8 bg-card border border-border rounded-2xl p-4 shadow-xl max-w-sm w-full">
            <div className="text-[10px] font-bold text-muted-foreground mb-2.5 uppercase tracking-wider text-left">{t('shortcuts')}</div>
            <div className="space-y-1.5 font-medium text-xs text-muted-foreground">
              <div className="flex items-center justify-between text-[11px]">
                <span>{t('globalSearch')}</span>
                <div className="flex items-center gap-0.5">
                  <kbd className="bg-background border border-border rounded px-1.5 py-0.2 text-[9px] font-mono text-muted-foreground">Ctrl</kbd>+<kbd className="bg-background border border-border rounded px-1.5 py-0.2 text-[9px] font-mono text-muted-foreground">K</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>{t('editorModeSwitch')}</span>
                <span className="text-muted-foreground/60">{t('topRightTab')}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>{t('nestedArchive')}</span>
                <span className="text-muted-foreground/60">{t('sidebarDrag')}</span>
              </div>
            </div>
          </div>
          <button onClick={() => handleAddChild(null)}
            className="mt-6 px-5 h-10 rounded-xl bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold text-xs cursor-pointer flex items-center gap-2">
            <Plus className="w-4 h-4" /><span>{t('quickCreateFirst')}</span>
          </button>
        </div>
      )}

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="!flex !w-[min(1080px,calc(100vw-2rem))] !max-w-[min(1080px,calc(100vw-2rem))] h-[min(760px,calc(100vh-4rem))] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
            <DialogTitle className="text-sm">{t('historyVersions')}</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1">
            <div className="w-64 shrink-0 border-r border-border overflow-y-auto bg-muted/20">
              {historyLoading ? (
                <div className="p-4 text-xs text-muted-foreground">{tc('loading')}</div>
              ) : historyError ? (
                <div className="p-4 text-xs text-destructive">{historyError}</div>
              ) : versions.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground">{t('noHistory')}</div>
              ) : (
                versions.map((version) => (
                  <button
                    key={version.id}
                    onClick={() => setSelectedVersionId(version.id)}
                    className={cn(
                      "w-full border-b border-border px-4 py-3 text-left text-xs transition-colors",
                      selectedVersion?.id === version.id ? "bg-background text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <div className="truncate font-semibold">{version.title || activeNode?.title || t('untitled')}</div>
                    <div className="mt-1 text-[11px]">{new Date(version.createdAt).toLocaleString()}</div>
                    <div className="mt-1 text-[10px] font-mono">
                      -{version.patch.deleteText.length} +{version.patch.insertText.length}
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="min-w-0 flex-1 overflow-y-auto">
              {selectedVersion ? (
                <div className="grid min-h-full grid-rows-2">
                  <MarkdownVersionPane
                    title="Before"
                    content={selectedVersion.oldContent}
                    workspaceId={workspaceId}
                    tone="old"
                  />
                  <MarkdownVersionPane
                    title="After"
                    content={selectedVersion.newContent}
                    workspaceId={workspaceId}
                    tone="new"
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {t('selectVersionDiff')}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MarkdownVersionPane({
  title,
  content,
  workspaceId,
  tone,
}: {
  title: string;
  content: string;
  workspaceId: string;
  tone: 'old' | 'new';
}) {
  return (
    <section className="min-h-0 border-b border-border last:border-b-0">
      <div className={cn(
        "sticky top-0 z-10 flex items-center justify-between border-b border-border px-4 py-2 text-xs font-semibold",
        tone === 'old' ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      )}>
        <span>{title}</span>
        <span className="font-mono text-[10px] opacity-70">{content.length} chars</span>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none px-5 py-4 text-sm">
        <Markdown content={content || '_Empty content_'} workspaceId={workspaceId} />
      </div>
    </section>
  );
}
