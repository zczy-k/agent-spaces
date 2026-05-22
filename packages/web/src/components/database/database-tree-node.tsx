'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Edit2, Plus, Trash2, Move } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocNode } from '@agent-spaces/shared';
import type { NestedTreeRenderState, NestedTreeRowProps } from '@/components/editor/file-tree';
import { EMOJIS } from './database-constants';

interface DatabaseTreeNodeProps {
  node: DocNode;
  state: NestedTreeRenderState;
  rowProps: NestedTreeRowProps;
  onSelect: (nodeId: string) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (nodeId: string) => void;
  onRename: (nodeId: string, title: string) => void;
  onUpdateIcon: (nodeId: string, icon: string) => void;
  onToggleExpand: (nodeId: string) => void;
  children: React.ReactNode;
}

export function DatabaseTreeNode({
  node,
  state,
  rowProps,
  onSelect,
  onAddChild,
  onDelete,
  onRename,
  onUpdateIcon,
  onToggleExpand,
  children,
}: DatabaseTreeNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(node.title);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setEditingTitle(node.title); }, [node.title]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) setEmojiOpen(false);
    };
    if (emojiOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [emojiOpen]);

  const submitRename = () => {
    onRename(node.id, editingTitle.trim() || '未命名文档');
    setIsEditing(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') submitRename();
    if (event.key === 'Escape') {
      setEditingTitle(node.title);
      setIsEditing(false);
    }
  };

  return (
    <div className="flex flex-col select-none">
      <div
        {...rowProps}
        className={cn(
          "group flex items-center h-9 justify-between pr-2 rounded-lg cursor-pointer transition-all gap-1.5 border border-transparent my-0.5",
          state.isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground",
          state.isDraggedOver && "border-2 border-dashed border-primary/40 bg-primary/5 scale-95",
          rowProps.className,
        )}
      >
        <div className="flex items-center min-w-0 flex-1 h-full py-1">
          <button
            onClick={(event) => { event.stopPropagation(); onToggleExpand(node.id); }}
            className={cn("p-1 rounded-sm text-muted-foreground hover:text-foreground transition-colors shrink-0", !state.hasChildren && "opacity-0 cursor-default", "cursor-pointer")}
          >
            {state.isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          <div className="relative shrink-0" ref={emojiRef}>
            <button
              onClick={(event) => { event.stopPropagation(); setEmojiOpen(!emojiOpen); }}
              className="text-base p-1.5 rounded-md hover:bg-accent shrink-0 transition-all select-none cursor-pointer"
            >
              {node.icon || (state.hasChildren ? '📁' : '📄')}
            </button>
            {emojiOpen && (
              <div className="absolute left-1 top-7 bg-popover shadow-2xl rounded-xl border border-border p-2 grid grid-cols-5 gap-1 w-44 z-50">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={(event) => { event.stopPropagation(); onUpdateIcon(node.id, emoji); setEmojiOpen(false); }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent text-base cursor-pointer text-foreground"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div onClick={() => onSelect(node.id)} className="flex-1 min-w-0 pr-1.5 h-full flex items-center">
            {isEditing ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(event) => setEditingTitle(event.target.value)}
                onBlur={submitRename}
                onKeyDown={handleKeyDown}
                onClick={(event) => event.stopPropagation()}
                className="w-full text-xs font-semibold bg-background border border-border rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                autoFocus
              />
            ) : (
              <span className={cn("text-xs truncate font-medium select-none", state.isActive ? "text-primary" : "text-foreground/80")}>
                {node.title || '未命名文档'}
              </span>
            )}
          </div>
        </div>
        {!isEditing && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
            <button onClick={(event) => { event.stopPropagation(); setIsEditing(true); }} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer" title="重命名">
              <Edit2 className="w-3 h-3" />
            </button>
            <button onClick={(event) => { event.stopPropagation(); onAddChild(node.id); }} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer" title="新建子页面">
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                if (confirm(`要将 "${node.title || '未命名文档'}" 移动到回收站吗？`)) onDelete(node.id);
              }}
              className="p-1 rounded hover:bg-rose-950/60 text-muted-foreground hover:text-rose-400 cursor-pointer"
              title="删除"
            >
              <Trash2 className="w-3 h-3" />
            </button>
            <div className="p-1 cursor-grab text-muted-foreground/40 pointer-events-none">
              <Move className="w-3 h-3" />
            </div>
          </div>
        )}
      </div>
      {children && <div className="flex flex-col">{children}</div>}
    </div>
  );
}
