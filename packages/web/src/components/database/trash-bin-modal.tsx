'use client';

import React, { useState } from 'react';
import { Trash2, RotateCcw, X, Search, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocNode } from '@agent-spaces/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nodes: DocNode[];
  onRestore: (id: string) => void;
  onDeletePermanent: (id: string) => void;
}

export default function TrashBinModal({ isOpen, onClose, nodes, onRestore, onDeletePermanent }: Props) {
  const [filter, setFilter] = useState('');
  const trashed = nodes.filter(n => n.isTrash);
  const filtered = trashed.filter(n => (n.title || '').toLowerCase().includes(filter.toLowerCase()));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-start justify-center pt-[15vh] px-4 z-50">
      <div className="w-full max-w-lg bg-card rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden max-h-[500px]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold text-foreground">回收站</h3>
            <span className="bg-red-950/40 text-red-400 border border-red-900/30 text-[10px] px-1.5 py-0.5 rounded-full font-bold">{trashed.length}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        {trashed.length > 0 && (
          <div className="px-4 py-2 border-b border-border flex items-center gap-2 bg-muted/40">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input type="text" placeholder="搜索回收站..." value={filter} onChange={(e) => setFilter(e.target.value)}
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none" />
            {filter && <button onClick={() => setFilter('')} className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer">清除</button>}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-3">
          {trashed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center"><span className="text-3xl mb-1.5">🍃</span><p className="text-sm text-muted-foreground">回收站是空的</p></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground italic">未匹配到 &ldquo;{filter}&rdquo;</div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] text-amber-500 bg-amber-950/20 py-1.5 px-3 rounded-lg mb-2 border border-amber-900/30">
                <Info className="w-3.5 h-3.5 shrink-0" /><span>永久删除不可逆，子文件也会被清除。</span>
              </div>
              {filtered.map((node) => (
                <div key={node.id} className="group hover:bg-muted/40 p-2.5 rounded-xl border border-transparent hover:border-border flex items-center justify-between gap-3 transition-all">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg bg-muted border border-border p-1 rounded-md shrink-0">{node.icon || '📝'}</span>
                    <span className="text-xs font-medium text-foreground truncate">{node.title || '未命名'}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => onRestore(node.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-emerald-400 cursor-pointer" title="恢复"><RotateCcw className="w-4 h-4" /></button>
                    <button onClick={() => { if (confirm(`永久删除 "${node.title}"？`)) onDeletePermanent(node.id); }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-red-400 cursor-pointer" title="永久删除"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-muted border-t border-border px-5 py-3 text-xs text-muted-foreground flex items-center gap-2 shrink-0"><AlertTriangle className="w-4 h-4 text-muted-foreground/60" />点击按钮恢复或永久删除</div>
      </div>
    </div>
  );
}
