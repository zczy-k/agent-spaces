'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, FolderOpen, ChevronRight, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import type { DocNode } from '@agent-spaces/shared';

interface Props {
  nodes: DocNode[];
  onSelectNode: (id: string) => void;
}

export default function QuickSearchContent({ nodes, onSelectNode }: Props) {
  const t = useTranslations('database');
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
      if (parent) { path.unshift(parent.title || t('untitled')); cur = parent; } else break;
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
      <div className="px-2 pb-3 shrink-0 border-b border-border">
        <div className="flex items-center gap-2 rounded-md bg-muted/50 border border-border focus-within:border-primary/50 transition-colors px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input ref={inputRef} type="text" placeholder={t('searchPlaceholder')} value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground/60 text-sm focus:outline-none" />
          {query && (
            <button onClick={() => { setQuery(''); setSelectedIdx(0); }} className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"><X className="w-3.5 h-3.5" /></button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {query ? `${t('matchResults')} (${results.length})` : t('recentEdits')}
        </div>
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center"><span className="text-2xl mb-2">🔍</span><p className="text-xs text-muted-foreground">{t('noResults')}</p></div>
        ) : (
          <div className="space-y-0.5">
            {results.map((item, i) => {
              const pathArr = getPath(item);
              return (
                <button key={item.id} onClick={() => onSelectNode(item.id)}
                  className={cn("w-full text-left p-2.5 rounded-md flex items-center gap-3 transition-all text-sm cursor-pointer",
                    i === selectedIdx ? "bg-accent text-accent-foreground border-l-2 border-primary" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")}>
                  <div className="text-base bg-muted p-1 rounded-md shrink-0 border border-border">{item.icon || '📝'}</div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground truncate block text-xs">{item.title || t('untitled')}</span>
                    {pathArr.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5 truncate">
                        <FolderOpen className="w-3 h-3 text-muted-foreground/70" />
                        {pathArr.map((p, idx) => <React.Fragment key={idx}><span>{p}</span><ChevronRight className="w-2.5 h-2.5 mx-0.5 text-muted-foreground/70" /></React.Fragment>)}
                      </div>
                    )}
                  </div>
                  {i === selectedIdx && <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded-md font-mono"><CornerDownLeft className="w-2.5 h-2.5" />Enter</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
