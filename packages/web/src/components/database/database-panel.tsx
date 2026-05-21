'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sidebar, Search, Plus, Trash, X, ChevronRight,
  Layers, BookOpen, Minimize2, Maximize2, Check,
  CheckCircle, FileCheck, Clock, Sparkles, SlidersHorizontal, MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { htmlToMarkdown, markdownToHtml } from '@/lib/converter';
import { useDatabaseStore } from '@/stores/database';
import { PRESET_COVERS } from '@agent-spaces/shared';
import type { DocNode } from '@agent-spaces/shared';

import TreeItem from './tree-item';
import NotionEditor from './notion-editor';
import MarkdownEditor from './markdown-editor';
import QuickSearchModal from './quick-search-modal';
import TrashBinModal from './trash-bin-modal';

interface Props {
  workspaceId: string;
}

export default function DatabasePanel({ workspaceId }: Props) {
  const {
    nodes, activeId, openTabs, recentIds, editorMode, theme, isFullWidth,
    openFolders, sidebarSearch, loading, loaded,
    load, setActiveId, createNode, updateContent, renameNode, updateIcon,
    updateCover, trashNode, restoreNode, deleteNode, moveNode,
    setEditorMode, setTheme, setIsFullWidth, toggleFolder, setSidebarSearch,
    closeTab,
  } = useDatabaseStore();

  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [draggedOverNodeId, setDraggedOverNodeId] = useState<string | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);
  const newDropdownRef = useRef<HTMLDivElement>(null);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!loaded) load(workspaceId); }, [loaded, load, workspaceId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setIsSearchOpen(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newDropdownRef.current && !newDropdownRef.current.contains(e.target as Node)) setNewDropdownOpen(false);
    };
    if (newDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [newDropdownOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(e.target as Node)) setSettingsDropdownOpen(false);
    };
    if (settingsDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingsDropdownOpen]);

  const triggerSave = () => { setShowSaveSuccess(true); setTimeout(() => setShowSaveSuccess(false), 1200); };

  const activeNode = nodes.find(n => n.id === activeId);
  const activeNodes = nodes.filter(n => !n.isTrash);
  const filteredNodes = activeNodes.filter(n => sidebarSearch ? (n.title || '').toLowerCase().includes(sidebarSearch.toLowerCase()) : true);
  const rootNodes = filteredNodes.filter(n => n.parentId === null);

  const handleAddChild = useCallback(async (parentId: string | null, type?: 'folder' | 'document') => {
    await createNode(workspaceId, parentId, type);
    triggerSave();
  }, [workspaceId, createNode]);

  const handleRename = useCallback((nodeId: string, title: string) => {
    let clean = title;
    const node = nodes.find(n => n.id === nodeId);
    if (node?.icon && clean.trim().startsWith(node.icon)) clean = clean.trim().substring(node.icon.length).trim();
    renameNode(workspaceId, nodeId, clean);
    triggerSave();
  }, [workspaceId, nodes, renameNode]);

  const handleModeToggle = useCallback((mode: 'notion' | 'markdown') => {
    if (!activeNode) return;
    if (mode === 'markdown' && editorMode === 'notion') {
      updateContent(workspaceId, activeNode.id, htmlToMarkdown(activeNode.content));
    } else if (mode === 'notion' && editorMode === 'markdown') {
      updateContent(workspaceId, activeNode.id, markdownToHtml(activeNode.content));
    }
    setEditorMode(mode);
  }, [activeNode, editorMode, workspaceId, updateContent, setEditorMode]);

  const isRecursiveChild = useCallback((parentId: string, targetId: string): boolean => {
    let cur = nodes.find(n => n.id === targetId);
    let limit = 0;
    while (cur?.parentId && limit < 20) {
      if (cur.parentId === parentId) return true;
      cur = nodes.find(n => n.id === cur!.parentId);
      limit++;
    }
    return false;
  }, [nodes]);

  const handleDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
    setDraggedNodeId(nodeId);
    e.dataTransfer.setData('text/plain', nodeId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, nodeId: string) => {
    e.preventDefault();
    if (!draggedNodeId || draggedNodeId === nodeId) return;
    if (isRecursiveChild(draggedNodeId, nodeId)) { e.dataTransfer.dropEffect = 'none'; return; }
    setDraggedOverNodeId(nodeId);
    e.dataTransfer.dropEffect = 'move';
  }, [draggedNodeId, isRecursiveChild]);

  const handleDragLeave = useCallback(() => setDraggedOverNodeId(null), []);

  const handleDrop = useCallback((e: React.DragEvent, targetNodeId: string) => {
    e.preventDefault();
    setDraggedOverNodeId(null);
    if (!draggedNodeId || draggedNodeId === targetNodeId) return;
    if (isRecursiveChild(draggedNodeId, targetNodeId)) return;
    moveNode(workspaceId, draggedNodeId, targetNodeId);
    setDraggedNodeId(null);
    triggerSave();
  }, [draggedNodeId, workspaceId, moveNode, isRecursiveChild]);

  const handleDropOnRoot = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedNodeId) return;
    moveNode(workspaceId, draggedNodeId, null);
    setDraggedNodeId(null);
    triggerSave();
  }, [draggedNodeId, workspaceId, moveNode]);

  const handleCloseTab = useCallback((e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  }, [closeTab]);

  const wordCount = activeNode ? (activeNode.content.replace(/<[^>]*>/g, '').trim().length || 0) : 0;

  if (loading && !loaded) {
    return <div className="flex items-center justify-center h-full text-zinc-500 text-sm">加载中...</div>;
  }

  return (
    <div className="flex w-full h-full overflow-hidden bg-[#09090B] font-sans text-[#FAFAFA] antialiased">

      {/* Sidebar */}
      <div className={cn(
        "h-full bg-[#18181B] border-r border-[#27272A] flex flex-col transition-all duration-300 z-30 relative shrink-0",
        sidebarExpanded ? "w-80 translate-x-0" : "w-0 -translate-x-full select-none pointer-events-none overflow-hidden"
      )}>
        {/* Sidebar header */}
        <div className="px-4 py-3 border-b border-[#27272A] bg-[#18181B]/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#27272A] to-[#3F3F46] flex items-center justify-center font-bold text-base text-zinc-100 border border-[#3F3F46]">📁</div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-zinc-100 tracking-tight">知识库</span>
              <span className="text-[10px] text-zinc-500 font-medium font-mono leading-none mt-0.5">Database</span>
            </div>
          </div>
        </div>

        {/* Tree content */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={handleDropOnRoot}>
          <div className="mb-6">
            <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 px-1 mb-2.5 uppercase tracking-wider">
              <span>知识目录树</span>
              <span>({activeNodes.length})</span>
            </div>

            <div className="px-1 mb-4 flex items-center gap-2 relative" ref={newDropdownRef}>
              <div className="relative flex-1">
                <input type="text" placeholder="过滤文档标题..." value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  className="w-full text-xs bg-[#09090B] border border-[#27272A] rounded-lg px-2.5 py-1.5 pr-7 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-700 placeholder:text-zinc-600" />
                {sidebarSearch ? (
                  <button onClick={() => setSidebarSearch('')} className="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300"><X className="w-3.5 h-3.5" /></button>
                ) : (
                  <SlidersHorizontal className="absolute right-2 top-2.5 w-3 h-3 text-zinc-600 pointer-events-none" />
                )}
              </div>
              <button onClick={() => setNewDropdownOpen(!newDropdownOpen)}
                className="h-8 w-8 rounded-lg bg-[#27272A] hover:bg-[#3F3F46] border border-[#3F3F46] hover:border-zinc-500 text-zinc-200 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0" title="新建">
                <Plus className="w-4 h-4" />
              </button>
              {newDropdownOpen && (
                <div className="absolute right-1 top-[calc(100%+4px)] w-36 bg-[#18181B] border border-[#27272A] rounded-lg shadow-2xl py-1 z-50">
                  <button onClick={() => { handleAddChild(null, 'folder'); setNewDropdownOpen(false); }}
                    className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272A]/80 transition-colors cursor-pointer">
                    <span className="text-sm">📂</span><span className="font-medium">新建文件夹</span>
                  </button>
                  <button onClick={() => { handleAddChild(null, 'document'); setNewDropdownOpen(false); }}
                    className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs text-zinc-300 hover:text-white hover:bg-[#27272A]/80 transition-colors cursor-pointer">
                    <span className="text-sm">📝</span><span className="font-medium">新建文档</span>
                  </button>
                </div>
              )}
            </div>

            {rootNodes.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-zinc-500 italic">{sidebarSearch ? '未匹配到任何项' : '没有任何页面，点击上方新建'}</div>
            ) : (
              <div className="space-y-0.5">
                {rootNodes.map((node) => (
                  <TreeItem key={node.id} node={node} nodes={nodes} level={0}
                    activeId={activeId} onSelect={setActiveId} onAddChild={handleAddChild}
                    onDelete={(id) => { trashNode(workspaceId, id); triggerSave(); }}
                    onRename={handleRename} onUpdateIcon={(id, icon) => { updateIcon(workspaceId, id, icon); triggerSave(); }}
                    expandedIds={openFolders} onToggleExpand={toggleFolder}
                    onDragStart={handleDragStart} onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave} onDrop={handleDrop} draggedOverId={draggedOverNodeId} />
                ))}
              </div>
            )}
          </div>

          {recentIds.length > 0 && (
            <div className="mb-6 pt-4 border-t border-[#27272A]">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 px-1 mb-2 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-zinc-500" /><span>最近编辑</span>
              </div>
              <div className="space-y-1">
                {recentIds.map(id => nodes.find(n => n.id === id && !n.isTrash)).filter((n): n is DocNode => !!n).map(node => (
                  <button key={node.id} onClick={() => setActiveId(node.id)}
                    className={cn("w-full text-left p-1.5 rounded-lg flex items-center gap-2 text-xs transition-colors",
                      activeId === node.id ? "bg-[#27272A] text-zinc-100 font-semibold" : "text-zinc-500 hover:bg-[#27272A]/50 hover:text-zinc-300")}>
                    <span className="text-sm shrink-0 select-none">{node.icon || '📝'}</span>
                    <span className="truncate flex-1">{node.title || '未命名文档'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar bottom */}
        <div className="p-3.5 border-t border-[#27272A] bg-[#18181B] flex items-center gap-3 shrink-0">
          <button onClick={() => setIsSearchOpen(true)}
            className="flex-1 flex items-center justify-between bg-[#09090B] hover:bg-[#27272A] border border-[#27272A] text-zinc-400 hover:text-zinc-200 transition-all h-11 px-4 rounded-full text-xs cursor-pointer shadow-sm">
            <div className="flex items-center gap-2"><Search className="w-4 h-4 text-zinc-500" /><span className="font-semibold text-zinc-300">全局搜索</span></div>
            <span className="bg-[#18181B] text-zinc-500 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border border-[#27272A] scale-90">⌘K</span>
          </button>
          <button onClick={() => setIsTrashOpen(true)}
            className="relative w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-[#09090B] hover:bg-[#27272A] text-zinc-400 hover:text-rose-400 border border-[#27272A] transition-all cursor-pointer shadow-sm group" title="回收站">
            <Trash className="w-4 h-4 text-rose-500 transition-transform group-hover:scale-110" />
            {nodes.filter(n => n.isTrash).length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-rose-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-semibold border border-[#18181B] shadow-sm">
                {nodes.filter(n => n.isTrash).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#09090B] relative">
        {showSaveSuccess && (
          <div className="absolute top-4 right-1/2 translate-x-1/2 bg-[#18181B] border border-[#27272A] text-zinc-100 text-xs font-semibold px-4 py-2 rounded-full flex items-center gap-2 shadow-2xl z-50">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /><span>内容已自动保存</span>
          </div>
        )}

        {/* Tabs bar */}
        <div className="flex items-center justify-between bg-[#141416] border-b border-[#27272A] px-4 min-h-[44px] select-none z-10 shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1 flex-1 pr-4">
            {openTabs.map((tabId) => {
              const tabNode = nodes.find(n => n.id === tabId);
              if (!tabNode) return null;
              return (
                <div key={tabId} onClick={() => setActiveId(tabId)}
                  className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-all shrink-0 group border",
                    activeId === tabId ? "bg-[#1f1f23] text-zinc-100 border-[#3F3F46] font-semibold" : "text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1a1e] border-transparent")}>
                  <span className="text-sm select-none shrink-0">{tabNode.icon || '📝'}</span>
                  <span className="truncate max-w-[120px]">{tabNode.title || '未命名文档'}</span>
                  <button onClick={(e) => handleCloseTab(e, tabId)}
                    className="p-0.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors ml-1 opacity-60 group-hover:opacity-100">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            <button onClick={() => handleAddChild(null)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-[#1f1f23] transition-colors ml-1 cursor-pointer shrink-0">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[10px] text-zinc-500 font-mono shrink-0 select-none">
            <span className="bg-[#18181B] px-2 py-0.5 rounded-md border border-[#27272A]">文档：{openTabs.length}</span>
          </div>
        </div>

        {/* Top nav bar */}
        <div className="h-14 px-6 border-b border-[#27272A] flex items-center justify-between bg-[#09090B]/80 backdrop-blur-md sticky top-0 z-10 select-none shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarExpanded(!sidebarExpanded)}
              className="p-1.5 rounded-lg hover:bg-[#27272A] text-zinc-400 hover:text-zinc-200 transition-colors mr-1 cursor-pointer">
              <Sidebar className="w-4 h-4" />
            </button>
            {activeNode ? (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                <span>知识库</span>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-700" />
                {activeNode.parentId && (
                  <>
                    <span onClick={() => activeNode.parentId && setActiveId(activeNode.parentId)}
                      className="hover:text-zinc-300 hover:underline cursor-pointer">
                      {nodes.find(n => n.id === activeNode.parentId)?.title || '母目录'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-700" />
                  </>
                )}
                <span className="text-zinc-200 font-semibold truncate max-w-[180px]">{activeNode.title || '当前文档'}</span>
              </div>
            ) : (
              <div className="text-xs text-zinc-500 font-medium">多层级知识树</div>
            )}
          </div>

          {activeNode && (
            <div className="flex items-center gap-4">
              <div className="flex bg-[#18181B] border border-[#27272A] p-1 rounded-xl shrink-0">
                <button onClick={() => handleModeToggle('notion')}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                    editorMode === 'notion' ? "bg-[#27272A] text-zinc-100 font-bold" : "text-zinc-500 hover:text-zinc-300")}>
                  <Layers className="w-3.5 h-3.5" /><span>Notion 编辑器</span>
                </button>
                <button onClick={() => handleModeToggle('markdown')}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                    editorMode === 'markdown' ? "bg-[#27272A] text-zinc-100 font-bold" : "text-zinc-500 hover:text-zinc-300")}>
                  <BookOpen className="w-3.5 h-3.5" /><span>Markdown 编辑器</span>
                </button>
              </div>
              <div className="w-[1px] h-5 bg-[#27272A]" />
              <div className="relative" ref={settingsDropdownRef}>
                <button onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                  className="w-9 h-9 rounded-xl border border-[#27272A] hover:border-zinc-500 bg-[#18181B] text-zinc-400 hover:text-white transition-all cursor-pointer flex items-center justify-center shrink-0">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {settingsDropdownOpen && (
                  <div className="absolute right-0 top-[calc(100%+6px)] w-56 bg-[#18181B] border border-[#27272A] rounded-xl shadow-2xl py-2 z-50 text-left">
                    <div className="px-3.5 py-1.5 border-b border-[#27272A] bg-[#09090B]/60 text-zinc-500 text-[10px] font-bold uppercase tracking-wider select-none mb-1">排版风格与字体</div>
                    {([
                      ['sans', '无衬线现代 (Sans)', 'font-sans'],
                      ['serif', '衬线优雅风格 (Serif)', 'font-serif'],
                      ['mono', '程序员等宽 (Mono)', 'font-mono'],
                    ] as const).map(([t, label, fontClass]) => (
                      <button key={t} onClick={() => { setTheme(t as 'sans' | 'serif' | 'mono'); setSettingsDropdownOpen(false); }}
                        className={cn("w-full text-left px-3.5 py-2 flex items-center justify-between text-xs transition-colors cursor-pointer",
                          theme === t ? "text-white font-semibold bg-[#27272A]/40" : "text-zinc-400 hover:text-white hover:bg-[#27272A]/20")}>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded border border-[#27272A] font-medium", fontClass)}>Ag</span>
                          <span className={fontClass}>{label}</span>
                        </div>
                        {theme === t && <Check className="w-3.5 h-3.5 text-zinc-300" />}
                      </button>
                    ))}
                    <div className="h-[1px] bg-[#27272A] my-1.5" />
                    <div className="px-3.5 py-1 bg-[#09090B]/30 text-zinc-500 text-[10px] font-bold uppercase tracking-wider select-none mb-1">页面宽度</div>
                    <button onClick={() => { setIsFullWidth(!isFullWidth); setSettingsDropdownOpen(false); }}
                      className={cn("w-full text-left px-3.5 py-2 flex items-center justify-between text-xs transition-colors cursor-pointer",
                        isFullWidth ? "text-white font-semibold bg-[#27272A]/40" : "text-zinc-400 hover:text-white hover:bg-[#27272A]/20")}>
                      <div className="flex items-center gap-2">
                        {isFullWidth ? <Minimize2 className="w-3.5 h-3.5 text-zinc-400" /> : <Maximize2 className="w-3.5 h-3.5 text-zinc-400" />}
                        <span>{isFullWidth ? "还原常规宽度" : "宽尺寸自适应"}</span>
                      </div>
                      {isFullWidth && <Check className="w-3.5 h-3.5 text-zinc-300" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        {activeNode ? (
          <div className="flex-1 overflow-y-auto w-full flex flex-col">
            <div className="w-full h-44 shrink-0 relative group border-b border-[#27272A]"
              style={{ background: activeNode.cover || 'linear-gradient(to right, #0284c7, #06b6d4)' }}>
              <div className="absolute bottom-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-[#18181B]/90 backdrop-blur-md rounded-xl p-1.5 border border-[#27272A] flex items-center gap-1 shadow-xl">
                <span className="text-[10px] text-zinc-400 font-bold px-2">封面：</span>
                {PRESET_COVERS.map((preset, idx) => (
                  <button key={idx} onClick={() => { updateCover(workspaceId, activeNode.id, preset); triggerSave(); }}
                    style={{ background: preset }}
                    className={cn("w-4 h-4 rounded-full border hover:scale-125 transition-transform cursor-pointer",
                      activeNode.cover === preset ? "border-white scale-110" : "border-transparent")} />
                ))}
              </div>
            </div>

            <div className={cn("flex-1 mx-auto px-6 md:px-12 py-8 flex flex-col w-full", isFullWidth ? "max-w-none" : "max-w-4xl")}>
              <div className="mb-6 relative group select-text">
                <span className="text-4xl absolute -top-16 left-0 select-none bg-[#18181B] p-2.5 rounded-2xl shadow-xl border border-[#27272A]">
                  {activeNode.icon || '📝'}
                </span>
                <div className="text-[11px] text-zinc-500 font-semibold mb-2 flex items-center gap-1 mt-4">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-600" /><span>自动保存已开启</span>
                </div>
                <input type="text" value={activeNode.title}
                  onChange={(e) => { renameNode(workspaceId, activeNode.id, e.target.value); triggerSave(); }}
                  placeholder="未命名文档"
                  className={cn("w-full text-3xl md:text-4xl font-extrabold text-[#FAFAFA] border-none outline-none focus:ring-0 p-0 tracking-tight bg-transparent placeholder-zinc-700 select-text",
                    theme === 'serif' && 'font-serif', theme === 'mono' && 'font-mono')} />
              </div>

              <div className="flex-1 min-h-0 select-text">
                {editorMode === 'notion' ? (
                  <NotionEditor content={activeNode.content} onChange={(html) => { updateContent(workspaceId, activeNode.id, html); triggerSave(); }} theme={theme} />
                ) : (
                  <MarkdownEditor contentMarkdown={activeNode.content} onChange={(md) => { updateContent(workspaceId, activeNode.id, md); triggerSave(); }} theme={theme} />
                )}
              </div>

              <div className="mt-8 border-t border-[#27272A] pt-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-500 font-medium gap-2">
                <div className="flex items-center gap-5">
                  <span>字数：<strong className="text-zinc-300">{wordCount}</strong></span>
                  <span className="hidden sm:inline">创建：{new Date(activeNode.createdAt).toLocaleDateString()}</span>
                  <span>修改：{new Date(activeNode.updatedAt).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-300 bg-[#18181B] border border-[#27272A] px-3 py-1 rounded-full font-semibold shrink-0">
                  <FileCheck className="w-3 h-3 text-emerald-500 animate-pulse" /><span>SAVED</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#09090B] select-none text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#18181B] to-[#27272A] border border-[#27272A] flex items-center justify-center text-4xl mb-6 shadow-md shadow-black/40 text-zinc-200 animate-bounce">📁</div>
            <h2 className="text-xl font-bold text-zinc-100 tracking-tight">知识编辑器</h2>
            <p className="text-xs text-zinc-500 mt-1.5 max-w-[340px] leading-relaxed">
              点击左侧目录树中的页面开始编辑，或点击上方按钮创建新文档。
            </p>
            <div className="mt-8 bg-[#18181B] border border-[#27272A] rounded-2xl p-4 shadow-xl max-w-sm w-full">
              <div className="text-[10px] font-bold text-zinc-500 mb-2.5 uppercase tracking-wider text-left">快捷键</div>
              <div className="space-y-1.5 font-medium text-xs text-zinc-400">
                <div className="flex items-center justify-between text-[11px]">
                  <span>全局搜索</span>
                  <div className="flex items-center gap-0.5">
                    <kbd className="bg-[#09090B] border border-[#27272A] rounded px-1.5 py-0.2 text-[9px] font-mono text-zinc-400">Ctrl</kbd>+<kbd className="bg-[#09090B] border border-[#27272A] rounded px-1.5 py-0.2 text-[9px] font-mono text-zinc-400">K</kbd>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>编辑器模式切换</span>
                  <span className="text-zinc-500">右上角标签</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>嵌套归档</span>
                  <span className="text-zinc-500">侧边栏拖拽</span>
                </div>
              </div>
            </div>
            <button onClick={() => handleAddChild(null)}
              className="mt-6 px-5 h-10 rounded-xl bg-[#27272A] border border-[#3F3F46] hover:bg-[#3F3F46] text-zinc-100 font-semibold text-xs cursor-pointer flex items-center gap-2">
              <Plus className="w-4 h-4" /><span>快速创建首篇文档</span>
            </button>
          </div>
        )}
      </div>

      <QuickSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} nodes={nodes}
        onSelectNode={(id) => { setActiveId(id); setIsSearchOpen(false); }} />
      <TrashBinModal isOpen={isTrashOpen} onClose={() => setIsTrashOpen(false)} nodes={nodes}
        onRestore={(id) => { restoreNode(workspaceId, id); triggerSave(); }}
        onDeletePermanent={(id) => { deleteNode(workspaceId, id); triggerSave(); }} />
    </div>
  );
}
