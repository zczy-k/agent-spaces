'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Plus, X, ChevronRight, Sidebar, Layers, BookOpen,
  Minimize2, Maximize2, Check, MoreHorizontal,
  CheckCircle, Sparkles, FileCheck, List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { htmlToMarkdown, markdownToHtml } from '@/lib/converter';
import { useDatabaseStore } from '@/stores/database';
import { PRESET_COVERS } from '@agent-spaces/shared';
import NotionEditor from './notion-editor';
import MarkdownEditor from './markdown-editor';
import { TableOfContents, extractTocFromHtml, extractTocFromMarkdown } from './table-of-contents';
import type { PanelImperativeHandle } from 'react-resizable-panels';

interface DatabaseMainPanelProps {
  workspaceId: string;
  sidebarPanelRef: React.RefObject<PanelImperativeHandle | null>;
  showSaveSuccess: boolean;
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
    setEditorMode, setTheme, setIsFullWidth, closeTab,
  } = useDatabaseStore();

  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(true);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target as Node)) setSettingsDropdownOpen(false);
    };
    if (settingsDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingsDropdownOpen]);

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

  return (
    <>
      {showSaveSuccess && (
        <div className="absolute top-4 right-1/2 translate-x-1/2 bg-card border border-border text-foreground text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2 shadow-2xl z-50">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /><span>内容已自动保存</span>
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
                <span className="truncate max-w-[120px]">{tabNode.title || '未命名文档'}</span>
                <button onClick={(e) => handleCloseTab(e, tabId)}
                  className="p-0.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1 opacity-60 group-hover:opacity-100">
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
          <button onClick={() => sidebarPanelRef.current?.isCollapsed() ? sidebarPanelRef.current?.expand() : sidebarPanelRef.current?.collapse()}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mr-1 cursor-pointer">
            <Sidebar className="w-4 h-4" />
          </button>
          {activeNode ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <span>知识库</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
              {activeNode.parentId && (
                <>
                  <span onClick={() => activeNode.parentId && setActiveId(activeNode.parentId)}
                    className="hover:text-foreground hover:underline cursor-pointer">
                    {nodes.find(n => n.id === activeNode.parentId)?.title || '母目录'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                </>
              )}
              <span className="text-foreground font-semibold truncate max-w-[180px]">{activeNode.title || '当前文档'}</span>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground font-medium">多层级知识树</div>
          )}
        </div>

        {activeNode && (
          <div className="flex items-center gap-4">
            <div className="flex bg-card border border-border p-1 rounded-xl shrink-0">
              <button onClick={() => handleModeToggle('notion')}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                  editorMode === 'notion' ? "bg-muted text-foreground font-bold" : "text-muted-foreground hover:text-foreground")}>
                <Layers className="w-3.5 h-3.5" /><span>Notion 编辑器</span>
              </button>
              <button onClick={() => handleModeToggle('markdown')}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                  editorMode === 'markdown' ? "bg-muted text-foreground font-bold" : "text-muted-foreground hover:text-foreground")}>
                <BookOpen className="w-3.5 h-3.5" /><span>Markdown 编辑器</span>
              </button>
            </div>
            <div className="w-[1px] h-5 bg-border" />
            <button onClick={() => setTocOpen(!tocOpen)} title={tocOpen ? '关闭目录' : '打开目录'}
              className={cn("w-9 h-9 rounded-xl border border-border bg-card transition-all cursor-pointer flex items-center justify-center shrink-0",
                tocOpen ? "text-foreground border-muted-foreground/40" : "text-muted-foreground hover:text-foreground hover:border-muted-foreground/40")}>
              <List className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-5 bg-border" />
            <div className="relative" ref={settingsDropdownRef}>
              <button onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                className="w-9 h-9 rounded-xl border border-border hover:border-muted-foreground/40 bg-card text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center justify-center shrink-0">
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {settingsDropdownOpen && (
                <div className="absolute right-0 top-[calc(100%+6px)] w-56 bg-popover border border-border rounded-xl shadow-2xl py-2 z-50 text-left">
                  <div className="px-3.5 py-1.5 border-b border-border bg-muted/50 text-muted-foreground text-[10px] font-bold uppercase tracking-wider select-none mb-1">排版风格与字体</div>
                  {([
                    ['sans', '无衬线现代 (Sans)', 'font-sans'],
                    ['serif', '衬线优雅风格 (Serif)', 'font-serif'],
                    ['mono', '程序员等宽 (Mono)', 'font-mono'],
                  ] as const).map(([t, label, fontClass]) => (
                    <button key={t} onClick={() => { setTheme(t as 'sans' | 'serif' | 'mono'); setSettingsDropdownOpen(false); }}
                      className={cn("w-full text-left px-3.5 py-2 flex items-center justify-between text-xs transition-colors cursor-pointer",
                        theme === t ? "text-foreground font-semibold bg-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent/50")}>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs bg-muted text-foreground px-1.5 py-0.5 rounded border border-border font-medium", fontClass)}>Ag</span>
                        <span className={fontClass}>{label}</span>
                      </div>
                      {theme === t && <Check className="w-3.5 h-3.5 text-foreground" />}
                    </button>
                  ))}
                  <div className="h-[1px] bg-border my-1.5" />
                  <div className="px-3.5 py-1 bg-muted/30 text-muted-foreground text-[10px] font-bold uppercase tracking-wider select-none mb-1">页面宽度</div>
                  <button onClick={() => { setIsFullWidth(!isFullWidth); setSettingsDropdownOpen(false); }}
                    className={cn("w-full text-left px-3.5 py-2 flex items-center justify-between text-xs transition-colors cursor-pointer",
                      isFullWidth ? "text-foreground font-semibold bg-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent/50")}>
                    <div className="flex items-center gap-2">
                      {isFullWidth ? <Minimize2 className="w-3.5 h-3.5 text-muted-foreground" /> : <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />}
                      <span>{isFullWidth ? "还原常规宽度" : "宽尺寸自适应"}</span>
                    </div>
                    {isFullWidth && <Check className="w-3.5 h-3.5 text-foreground" />}
                  </button>
                </div>
              )}
            </div>
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
              <span className="text-[10px] text-muted-foreground font-bold px-2">封面：</span>
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
                <Sparkles className="w-3.5 h-3.5 text-muted-foreground/60" /><span>自动保存已开启</span>
              </div>
              <input type="text" value={activeNode.title}
                onChange={(e) => { renameNode(workspaceId, activeNode.id, e.target.value); onSave(); }}
                placeholder="未命名文档"
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
                <span>字数：<strong className="text-foreground">{wordCount}</strong></span>
                <span className="hidden sm:inline">创建：{new Date(activeNode.createdAt).toLocaleDateString()}</span>
                <span>修改：{new Date(activeNode.updatedAt).toLocaleTimeString()}</span>
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
          <h2 className="text-xl font-bold text-foreground tracking-tight">知识编辑器</h2>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-[340px] leading-relaxed">
            点击左侧目录树中的页面开始编辑，或点击上方按钮创建新文档。
          </p>
          <div className="mt-8 bg-card border border-border rounded-2xl p-4 shadow-xl max-w-sm w-full">
            <div className="text-[10px] font-bold text-muted-foreground mb-2.5 uppercase tracking-wider text-left">快捷键</div>
            <div className="space-y-1.5 font-medium text-xs text-muted-foreground">
              <div className="flex items-center justify-between text-[11px]">
                <span>全局搜索</span>
                <div className="flex items-center gap-0.5">
                  <kbd className="bg-background border border-border rounded px-1.5 py-0.2 text-[9px] font-mono text-muted-foreground">Ctrl</kbd>+<kbd className="bg-background border border-border rounded px-1.5 py-0.2 text-[9px] font-mono text-muted-foreground">K</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>编辑器模式切换</span>
                <span className="text-muted-foreground/60">右上角标签</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>嵌套归档</span>
                <span className="text-muted-foreground/60">侧边栏拖拽</span>
              </div>
            </div>
          </div>
          <button onClick={() => handleAddChild(null)}
            className="mt-6 px-5 h-10 rounded-xl bg-muted hover:bg-muted/80 border border-border text-foreground font-semibold text-xs cursor-pointer flex items-center gap-2">
            <Plus className="w-4 h-4" /><span>快速创建首篇文档</span>
          </button>
        </div>
      )}
    </>
  );
}
