'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, Edit2, Move } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DocNode } from '@agent-spaces/shared';

interface TreeItemProps {
  node: DocNode;
  nodes: DocNode[];
  level: number;
  activeId: string | null;
  onSelect: (nodeId: string) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (nodeId: string) => void;
  onRename: (nodeId: string, title: string) => void;
  onUpdateIcon: (nodeId: string, icon: string) => void;
  expandedIds: Record<string, boolean>;
  onToggleExpand: (nodeId: string) => void;
  onDragStart: (e: React.DragEvent, nodeId: string) => void;
  onDragOver: (e: React.DragEvent, nodeId: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, nodeId: string) => void;
  draggedOverId: string | null;
}

const EMOJIS = ['📂','📝','📚','🚀','💡','🌟','🎯','🎨','💻','💼','☘️','🔥','🔑','📅','🧠','✍️','✨','📎','🔒','🛠️'];

export default function TreeItem({
  node, nodes, level, activeId, onSelect, onAddChild, onDelete,
  onRename, onUpdateIcon, expandedIds, onToggleExpand,
  onDragStart, onDragOver, onDragLeave, onDrop, draggedOverId,
}: TreeItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(node.title);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setEditingTitle(node.title); }, [node.title]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false);
    };
    if (emojiOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [emojiOpen]);

  const childNodes = nodes.filter(n => n.parentId === node.id && !n.isTrash);
  const hasChildren = childNodes.length > 0;
  const isExpanded = !!expandedIds[node.id];
  const isActive = activeId === node.id;
  const isDraggedOver = draggedOverId === node.id;

  const submitRename = () => { onRename(node.id, editingTitle.trim() || '未命名文档'); setIsEditing(false); };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submitRename();
    else if (e.key === 'Escape') { setEditingTitle(node.title); setIsEditing(false); }
  };

  return (
    <div className="flex flex-col select-none">
      <div
        draggable
        onDragStart={(e) => onDragStart(e, node.id)}
        onDragOver={(e) => onDragOver(e, node.id)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, node.id)}
        style={{ paddingLeft: `${Math.max(4, level * 12)}px` }}
        className={cn(
          "group flex items-center h-9 justify-between pr-2 rounded-lg cursor-pointer transition-all gap-1.5 border border-transparent my-0.5",
          isActive ? "bg-[#27272A] text-zinc-100 font-medium" : "text-zinc-400 hover:bg-[#27272A]/50 hover:text-zinc-200",
          isDraggedOver && "border-2 border-dashed border-zinc-700 bg-zinc-800 scale-95"
        )}
      >
        <div className="flex items-center min-w-0 flex-1 h-full py-1">
          <button onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }}
            className={cn("p-1 rounded-sm text-zinc-500 hover:text-zinc-300 transition-colors shrink-0", !hasChildren && "opacity-0 cursor-default")}>
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          <div className="relative shrink-0" ref={emojiRef}>
            <button onClick={(e) => { e.stopPropagation(); setEmojiOpen(!emojiOpen); }}
              className="text-base p-1.5 rounded-md hover:bg-[#27272A] shrink-0 transition-all select-none">
              {node.icon || (hasChildren ? '📂' : '📝')}
            </button>
            {emojiOpen && (
              <div className="absolute left-1 top-7 bg-[#18181B] shadow-2xl rounded-xl border border-[#27272A] p-2 grid grid-cols-5 gap-1 w-44 z-50">
                {EMOJIS.map((emoji) => (
                  <button key={emoji} onClick={(e) => { e.stopPropagation(); onUpdateIcon(node.id, emoji); setEmojiOpen(false); }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#27272A] text-base cursor-pointer text-zinc-200">
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div onClick={() => onSelect(node.id)} className="flex-1 min-w-0 pr-1.5 h-full flex items-center">
            {isEditing ? (
              <input type="text" value={editingTitle} onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={submitRename} onKeyDown={handleKeyDown} onClick={(e) => e.stopPropagation()}
                className="w-full text-xs font-semibold bg-[#09090B] border border-[#27272A] rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-zinc-600 text-zinc-100" autoFocus />
            ) : (
              <span className="text-xs truncate font-medium text-zinc-300 select-none">{node.title || '未命名文档'}</span>
            )}
          </div>
        </div>
        {!isEditing && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="p-1 rounded hover:bg-[#27272A] text-zinc-500 hover:text-zinc-200 cursor-pointer" title="重命名">
              <Edit2 className="w-3 h-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }} className="p-1 rounded hover:bg-[#27272A] text-zinc-500 hover:text-zinc-200 cursor-pointer" title="建子页面">
              <Plus className="w-3 h-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); if (confirm(`要将 "${node.title || '未命名文档'}" 移动到回收站吗？`)) onDelete(node.id); }}
              className="p-1 rounded hover:bg-rose-950/60 text-zinc-500 hover:text-rose-400 cursor-pointer" title="删除">
              <Trash2 className="w-3 h-3" />
            </button>
            <div className="p-1 cursor-grab text-zinc-600 pointer-events-none"><Move className="w-3 h-3" /></div>
          </div>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="flex flex-col">
          {childNodes.map((child) => (
            <TreeItem key={child.id} node={child} nodes={nodes} level={level + 1}
              activeId={activeId} onSelect={onSelect} onAddChild={onAddChild} onDelete={onDelete}
              onRename={onRename} onUpdateIcon={onUpdateIcon} expandedIds={expandedIds}
              onToggleExpand={onToggleExpand} onDragStart={onDragStart} onDragOver={onDragOver}
              onDragLeave={onDragLeave} onDrop={onDrop} draggedOverId={draggedOverId} />
          ))}
        </div>
      )}
    </div>
  );
}
