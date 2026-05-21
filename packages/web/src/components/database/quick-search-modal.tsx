'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, FolderOpen, ChevronRight, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocNode } from '@agent-spaces/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nodes: DocNode[];
  onSelectNode: (id: string) => void;
}

export default function QuickSearchModal({ isOpen, onClose, nodes, onSelectNode }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (isOpen) setTimeout(() => { inputRef.current?.focus(); setQuery(''); }, 50); }, [isOpen]);

  const getPath = (node: DocNode): string[] => {
    const path: string[] = [];
    let cur: DocNode | undefined = node;
    let depth = 0;
    while (cur?.parentId && depth < 10) {
      const parent = nodes.find(n => n.id === cur!.parentId);
      if (parent) { path.unshift(parent.title || '未命名'); cur = parent; } else break;
      depth++;
    }
    return path;
  };

  const results = useMemo(() => {
    if (!query) return nodes.filter(n => !n.isTrash).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
    const t = query.toLowerCase().trim();
    return nodes.filter(n => !n.isTrash && ((n.title || '').toLowerCase().includes(t) || (n.content || '').toLowerCase().includes(t)));
  }, [query, nodes]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(p => (p + 1) % Math.max(1, results.length)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(p => (p - 1 + results.length) % Math.max(1, results.length)); }
      else if (e.key === 'Enter' && results[selectedIdx]) { e.preventDefault(); onSelectNode(results[selectedIdx].id); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, results, selectedIdx, onClose, onSelectNode]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose(); };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-start justify-center pt-[15vh] px-4 z-50">
      <div ref={modalRef} className="w-full max-w-2xl bg-card rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden max-h-[500px]">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border shrink-0">
          <Search className="w-5 h-5 text-muted-foreground" />
          <input ref={inputRef} type="text" placeholder="搜索文档..." value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm focus:outline-none" />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {query ? `匹配结果 (${results.length})` : '最近编辑'}
          </div>
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center"><span className="text-3xl mb-2">🔍</span><p className="text-sm text-muted-foreground">没有找到相关文档</p></div>
          ) : (
            <div className="space-y-0.5">
              {results.map((item, i) => {
                const pathArr = getPath(item);
                return (
                  <button key={item.id} onClick={() => { onSelectNode(item.id); onClose(); }}
                    className={cn("w-full text-left p-3 rounded-xl flex items-center gap-3.5 transition-all text-sm cursor-pointer",
                      i === selectedIdx ? "bg-accent text-foreground border-l-2 border-foreground" : "text-muted-foreground hover:bg-muted")}>
                    <div className="text-lg bg-muted p-1.5 rounded-lg shrink-0 border border-border">{item.icon || '📝'}</div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground truncate block">{item.title || '未命名'}</span>
                      {pathArr.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1 truncate">
                          <FolderOpen className="w-3 h-3 text-muted-foreground/60" />
                          {pathArr.map((p, idx) => <React.Fragment key={idx}><span>{p}</span><ChevronRight className="w-2.5 h-2.5 mx-0.5 text-muted-foreground/40" /></React.Fragment>)}
                        </div>
                      )}
                    </div>
                    {i === selectedIdx && <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-md font-mono"><CornerDownLeft className="w-2.5 h-2.5" />Enter</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
