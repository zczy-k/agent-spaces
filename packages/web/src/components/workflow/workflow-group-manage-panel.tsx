'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Lock, Pencil, Trash2, Unlock, X } from 'lucide-react';
import type { WorkflowGroup } from '@agent-spaces/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

type WorkflowGroupManagePanelProps = {
  groups: WorkflowGroup[];
  isReadOnly?: boolean;
  onRenameGroup: (groupId: string, name: string) => void;
  onUngroup: (groupId: string) => void;
  onBatchUngroup: (groupIds: string[]) => void;
  onFocusGroup: (groupId: string) => void;
};

export function WorkflowGroupManagePanel({
  groups,
  isReadOnly = false,
  onRenameGroup,
  onUngroup,
  onBatchUngroup,
  onFocusGroup,
}: WorkflowGroupManagePanelProps) {
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const selectedGroups = useMemo(
    () => groups.filter(group => selectedGroupIds.includes(group.id)),
    [groups, selectedGroupIds],
  );
  const removableSelectedGroupIds = selectedGroups
    .filter(group => !group.locked)
    .map(group => group.id);

  useEffect(() => {
    const existingIds = new Set(groups.map(group => group.id));
    setSelectedGroupIds(ids => ids.filter(id => existingIds.has(id)));
    if (editingGroupId && !existingIds.has(editingGroupId)) {
      setEditingGroupId(null);
    }
  }, [editingGroupId, groups]);

  const startEdit = (group: WorkflowGroup) => {
    if (isReadOnly) return;
    setEditingGroupId(group.id);
    setEditName(group.name);
  };

  const commitEdit = () => {
    if (!editingGroupId) return;
    const trimmed = editName.trim();
    if (trimmed) onRenameGroup(editingGroupId, trimmed);
    setEditingGroupId(null);
  };

  const cancelEdit = () => {
    setEditingGroupId(null);
    setEditName('');
  };

  const toggleSelect = (groupId: string) => {
    setSelectedGroupIds(ids => (
      ids.includes(groupId)
        ? ids.filter(id => id !== groupId)
        : [...ids, groupId]
    ));
  };

  const batchUngroup = () => {
    if (removableSelectedGroupIds.length === 0) return;
    onBatchUngroup(removableSelectedGroupIds);
    setSelectedGroupIds([]);
  };

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between border-b pb-2">
        <span className="text-xs text-muted-foreground">{groups.length} 个分组</span>
        {selectedGroupIds.length > 0 && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-6 px-2 text-xs"
            disabled={isReadOnly || removableSelectedGroupIds.length === 0}
            onClick={batchUngroup}
          >
            <Trash2 className="h-3 w-3" />
            删除选中 ({selectedGroupIds.length})
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-auto">
        {groups.map(group => (
          <div
            key={group.id}
            className="group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent/50"
            onClick={() => onFocusGroup(group.id)}
          >
            <Checkbox
              checked={selectedGroupIds.includes(group.id)}
              onCheckedChange={() => toggleSelect(group.id)}
              onClick={(event) => event.stopPropagation()}
            />
            {group.locked
              ? <Lock className="h-3 w-3 shrink-0 opacity-50" />
              : <Unlock className="h-3 w-3 shrink-0 opacity-30" />
            }

            {editingGroupId === group.id ? (
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <Input
                  value={editName}
                  className="h-6 px-1 text-xs"
                  onChange={(event) => setEditName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitEdit();
                    if (event.key === 'Escape') cancelEdit();
                  }}
                  onClick={(event) => event.stopPropagation()}
                  autoFocus
                />
                <button type="button" className="p-0.5 hover:text-foreground" onClick={(event) => { event.stopPropagation(); commitEdit(); }}>
                  <Check className="h-3 w-3" />
                </button>
                <button type="button" className="p-0.5 hover:text-foreground" onClick={(event) => { event.stopPropagation(); cancelEdit(); }}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <span className="min-w-0 flex-1 truncate text-xs">
                {group.name}
                <span className="text-muted-foreground"> ({group.childNodeIds.length})</span>
              </span>
            )}

            {!isReadOnly && editingGroupId !== group.id && (
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="重命名"
                  onClick={(event) => { event.stopPropagation(); startEdit(group); }}
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="rounded p-1 text-destructive hover:bg-accent"
                  title="删除分组（保留节点）"
                  disabled={group.locked}
                  onClick={(event) => { event.stopPropagation(); onUngroup(group.id); }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        ))}

        {groups.length === 0 && (
          <div className="py-8 text-center text-xs text-muted-foreground">暂无分组</div>
        )}
      </div>
    </div>
  );
}
