'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronRight, Variable, Search } from 'lucide-react';
import type { WorkflowNode } from '@agent-spaces/shared';
import { getNodeDefinition } from '@/lib/workflow-nodes';

// ---- Variable source types ----

interface VariableEntry {
  path: string;
  label: string;
  source: 'context' | 'node' | 'loop';
  nodeId?: string;
  nodeLabel?: string;
}

interface VariablePickerProps {
  nodes: WorkflowNode[];
  currentOutputs: { key: string; type: string }[];
  onSelect: (path: string) => void;
  children?: React.ReactNode;
}

function buildVariableTree(nodes: WorkflowNode[]): VariableEntry[] {
  const entries: VariableEntry[] = [];

  // Context variables
  entries.push(
    { path: '__data__', label: '输入数据', source: 'context' },
    { path: '__inputs__', label: '节点输入', source: 'context' },
    { path: '__loop__', label: '循环变量', source: 'loop' },
    { path: 'context', label: '上下文', source: 'context' },
  );

  // Per-node outputs
  for (const node of nodes) {
    const def = getNodeDefinition(node.type);
    if (!def?.outputs?.length) continue;
    for (const output of def.outputs) {
      entries.push({
        path: `__data__.${node.id}.${output.key}`,
        label: output.key,
        source: 'node',
        nodeId: node.id,
        nodeLabel: node.label || def.label || node.type,
      });
    }
  }

  return entries;
}

function VariableItem({
  entry, depth, onSelect,
}: {
  entry: VariableEntry;
  depth: number;
  onSelect: (path: string) => void;
}) {
  return (
    <button
      className="w-full text-left px-2 py-1 hover:bg-accent text-xs transition-colors flex items-center gap-1.5"
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
      onClick={() => onSelect(entry.path)}
    >
      <Variable className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="truncate flex-1">{entry.label}</span>
      <span className="text-[9px] text-muted-foreground font-mono shrink-0">{entry.path}</span>
    </button>
  );
}

export function WorkflowVariablePicker({ nodes, currentOutputs, onSelect, children }: VariablePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const variables = useMemo(() => buildVariableTree(nodes), [nodes]);

  const filtered = useMemo(() => {
    if (!search) return variables;
    const q = search.toLowerCase();
    return variables.filter(v =>
      v.label.toLowerCase().includes(q) ||
      v.path.toLowerCase().includes(q) ||
      (v.nodeLabel && v.nodeLabel.toLowerCase().includes(q))
    );
  }, [variables, search]);

  const handleSelect = useCallback((path: string) => {
    onSelect(path);
    setOpen(false);
    setSearch('');
  }, [onSelect]);

  // Group variables by source
  const grouped = useMemo(() => {
    const groups: Record<string, VariableEntry[]> = {};
    for (const v of filtered) {
      const key = v.source === 'node' && v.nodeLabel ? v.nodeLabel : '全局变量';
      if (!groups[key]) groups[key] = [];
      groups[key].push(v);
    }
    return groups;
  }, [filtered]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        {children || (
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
            <Variable className="h-3 w-3" />
            变量
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" side="bottom">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索变量..."
              className="h-7 text-xs pl-7"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="max-h-[240px]">
          {Object.keys(grouped).length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">无匹配变量</div>
          ) : (
            Object.entries(grouped).map(([group, entries]) => (
              <div key={group}>
                <div className="text-[10px] font-medium text-muted-foreground px-2 py-1 border-b bg-muted/30">
                  {group}
                </div>
                {entries.map((entry, i) => (
                  <VariableItem
                    key={`${entry.path}-${i}`}
                    entry={entry}
                    depth={0}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// ---- Inline variable reference display ----

export function VariableReference({ path }: { path: string }) {
  return (
    <code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono text-blue-600 dark:text-blue-400">
      {path}
    </code>
  );
}
