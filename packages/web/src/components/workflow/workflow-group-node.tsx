'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, Lock, Unlock, Trash2 } from 'lucide-react';
import type { WorkflowGroup } from '@agent-spaces/shared';

/**
 * GroupNode — visual container overlay for grouping nodes on the canvas.
 * Rendered as an absolute-positioned div behind child nodes.
 */

interface GroupOverlayProps {
  group: WorkflowGroup;
  childNodes: Array<{ id: string; position: { x: number; y: number }; width?: number; height?: number }>;
  isSelected: boolean;
  isPreview: boolean;
  onSelect: (groupId: string) => void;
  onDelete: (groupId: string) => void;
  onUpdate: (groupId: string, updates: Partial<WorkflowGroup>) => void;
}

const GROUP_COLORS = [
  { name: '蓝色', bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.3)', header: 'rgba(59,130,246,0.1)' },
  { name: '绿色', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.3)', header: 'rgba(16,185,129,0.1)' },
  { name: '紫色', bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.3)', header: 'rgba(139,92,246,0.1)' },
  { name: '橙色', bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.3)', header: 'rgba(249,115,22,0.1)' },
  { name: '粉色', bg: 'rgba(236,72,153,0.06)', border: 'rgba(236,72,153,0.3)', header: 'rgba(236,72,153,0.1)' },
];

function getGroupColor(color?: string) {
  if (!color) return GROUP_COLORS[0];
  return GROUP_COLORS.find(c => c.name === color) || GROUP_COLORS[0];
}

export function WorkflowGroupOverlay({
  group, childNodes, isSelected, isPreview,
  onSelect, onDelete, onUpdate,
}: GroupOverlayProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const colors = getGroupColor(group.color);

  const bounds = useMemo(() => {
    if (childNodes.length === 0) {
      return { x: group.x ?? 50, y: group.y ?? 50, width: group.width ?? 300, height: group.height ?? 200 };
    }
    const padding = 30;
    const headerHeight = 28;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of childNodes) {
      minX = Math.min(minX, node.position.x - padding);
      minY = Math.min(minY, node.position.y - headerHeight - padding);
      maxX = Math.max(maxX, node.position.x + (node.width || 200) + padding);
      maxY = Math.max(maxY, node.position.y + (node.height || 100) + padding);
    }
    return {
      x: minX,
      y: minY,
      width: Math.max(200, maxX - minX),
      height: collapsed ? headerHeight + padding : Math.max(100, maxY - minY),
    };
  }, [childNodes, collapsed, group.x, group.y, group.width, group.height]);

  const handleToggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed(prev => !prev);
  }, []);

  const handleToggleLock = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate(group.id, { locked: !group.locked });
  }, [group.id, group.locked, onUpdate]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(group.name);
    setIsEditing(true);
  }, [group.name]);

  const finishEdit = useCallback(() => {
    setIsEditing(false);
    if (editName !== group.name) {
      onUpdate(group.id, { name: editName });
    }
  }, [editName, group.name, group.id, onUpdate]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(group.id);
  }, [group.id, onDelete]);

  if (isPreview && collapsed) return null;

  return (
    <div
      className={`absolute cursor-pointer transition-shadow ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}`}
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        backgroundColor: colors.bg,
        border: `1.5px solid ${isSelected ? 'var(--primary)' : colors.border}`,
        borderRadius: 8,
        overflow: 'hidden',
        zIndex: -1,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(group.id); }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="flex items-center gap-1 px-2 h-7 select-none"
        style={{ backgroundColor: colors.header }}
      >
        <button className="p-0 hover:bg-black/5 rounded" onClick={handleToggleCollapse}>
          {collapsed
            ? <ChevronRight className="h-3 w-3 text-muted-foreground" />
            : <ChevronDown className="h-3 w-3 text-muted-foreground" />
          }
        </button>

        {isEditing ? (
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={finishEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') finishEdit(); }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-[10px] bg-transparent outline-none border-b border-primary min-w-0"
            autoFocus
          />
        ) : (
          <span
            className="text-[10px] font-medium truncate flex-1"
            onDoubleClick={handleDoubleClick}
          >
            {group.name || '未命名分组'}
          </span>
        )}

        {isHovered && !isPreview && (
          <div className="flex gap-0.5">
            <button className="p-0.5 hover:bg-black/10 rounded" onClick={handleToggleLock}>
              {group.locked
                ? <Lock className="h-2.5 w-2.5 text-orange-500" />
                : <Unlock className="h-2.5 w-2.5 text-muted-foreground" />
              }
            </button>
            <button className="p-0.5 hover:bg-black/10 rounded" onClick={handleDelete}>
              <Trash2 className="h-2.5 w-2.5 text-destructive" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Group management hook ----

export function useGroupManagement() {
  const [groups, setGroups] = useState<WorkflowGroup[]>([]);

  const addGroup = useCallback((name: string, color?: string, childNodeIds?: string[]) => {
    const group: WorkflowGroup = {
      id: `group_${Date.now()}`,
      name,
      color: color || '蓝色',
      childNodeIds: childNodeIds || [],
      childGroupIds: [],
      locked: false,
      disabled: false,
      savedNodeStates: {},
    };
    setGroups(prev => [...prev, group]);
    return group;
  }, []);

  const updateGroup = useCallback((id: string, updates: Partial<WorkflowGroup>) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
  }, []);

  const addNodeToGroup = useCallback((groupId: string, nodeId: string) => {
    setGroups(prev => prev.map(g =>
      g.id === groupId && !g.childNodeIds.includes(nodeId)
        ? { ...g, childNodeIds: [...g.childNodeIds, nodeId] }
        : g
    ));
  }, []);

  const removeNodeFromGroup = useCallback((nodeId: string) => {
    setGroups(prev => prev.map(g =>
      g.childNodeIds.includes(nodeId)
        ? { ...g, childNodeIds: g.childNodeIds.filter(id => id !== nodeId) }
        : g
    ));
  }, []);

  return { groups, setGroups, addGroup, updateGroup, deleteGroup, addNodeToGroup, removeNodeFromGroup };
}
