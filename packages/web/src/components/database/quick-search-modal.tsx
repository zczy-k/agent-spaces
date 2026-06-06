'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, FolderOpen, ChevronRight, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocNode } from '@agent-spaces/shared';

interface Props {
  nodes: DocNode[];
  onSelectNode: (id: string) => void;
}

export default function QuickSearchContent({ nodes, onSelectNode }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

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
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(p => (p + 1) % Math.max(1, results.length)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(p => (p - 1 + results.length) % Math.max(1, results.length)); }
      else if (e.key === 'Enter' && results[selectedIdx]) { e.preventDefault(); onSelectNode(results[selectedIdx].id); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [results, selectedIdx, onSelectNode]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-2 pb-3 shrink-0">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input ref={inputRef} type="text" placeholder="搜索文档..." value={query}
          onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
          className="flex-1 bg-transparent text-white placeholder:text-gray-500 text-sm focus:outline-none" />
        {query && (
          <button onClick={() => { setQuery(''); setSelectedIdx(0); }} className="p-1 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white cursor-pointer"><X className="w-3.5 h-3.5" /></button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="px-2 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          {query ? `匹配结果 (${results.length})` : '最近编辑'}
        </div>
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center"><span className="text-2xl mb-2">🔍</span><p className="text-xs text-gray-500">没有找到相关文档</p></div>
        ) : (
          <div className="space-y-0.5">
            {results.map((item, i) => {
              const pathArr = getPath(item);
              return (
                <button key={item.id} onClick={() => onSelectNode(item.id)}
                  className={cn("w-full text-left p-2.5 rounded-lg flex items-center gap-3 transition-all text-sm cursor-pointer",
                    i === selectedIdx ? "bg-white/10 text-white border-l-2 border-white" : "text-gray-400 hover:bg-white/5 hover:text-gray-200")}>
                  <div className="text-base bg-white/5 p-1 rounded-md shrink-0 border border-white/10">{item.icon || '📝'}</div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-200 truncate block text-xs">{item.title || '未命名'}</span>
                    {pathArr.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5 truncate">
                        <FolderOpen className="w-3 h-3 text-gray-600" />
                        {pathArr.map((p, idx) => <React.Fragment key={idx}><span>{p}</span><ChevronRight className="w-2.5 h-2.5 mx-0.5 text-gray-600" /></React.Fragment>)}
                      </div>
                    )}
                  </div>
                  {i === selectedIdx && <span className="flex items-center gap-1 text-[10px] text-gray-500 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md font-mono"><CornerDownLeft className="w-2.5 h-2.5" />Enter</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
