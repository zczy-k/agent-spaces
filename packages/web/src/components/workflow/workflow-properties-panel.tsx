'use client';

import { useMemo, useCallback } from 'react';
import { getNodeDefinition } from '@/lib/workflow-nodes';
import { CONDITION_OPERATORS, NO_VALUE_OPERATORS } from '@/lib/workflow-nodes';
import type { WorkflowNode, NodeProperty } from '@agent-spaces/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus, GripVertical } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PropertiesPanelProps {
  node: WorkflowNode | null;
  onUpdateData: (nodeId: string, data: Record<string, unknown>) => void;
}

function PropertyField({
  prop, value, onChange,
}: {
  prop: NodeProperty; value: unknown; onChange: (v: unknown) => void;
}) {
  const strValue = value as string ?? '';

  switch (prop.type) {
    case 'text':
      return (
        <Input
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={prop.tooltip}
          className="h-7 text-xs"
        />
      );

    case 'textarea':
      return (
        <textarea
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={prop.tooltip}
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-2 py-1 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      );

    case 'number':
      return (
        <Input
          type="number"
          value={strValue}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-7 text-xs"
        />
      );

    case 'select':
      return (
        <Select value={strValue as string || prop.default as string} onValueChange={onChange}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {prop.options?.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'code':
      return (
        <textarea
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-2 py-1 text-xs font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      );

    case 'output_fields':
      return <OutputFieldsEditor value={value as string[]} onChange={(v) => onChange(v)} />;

    case 'conditions':
      return <ConditionsEditor value={value as Record<string, unknown>[]} onChange={(v) => onChange(v)} />;

    default:
      return (
        <Input
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 text-xs"
        />
      );
  }
}

function OutputFieldsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const fields = Array.isArray(value) ? value : [];

  return (
    <div className="space-y-1">
      {fields.map((field, i) => (
        <div key={i} className="flex items-center gap-1">
          <Input
            value={field}
            onChange={(e) => {
              const next = [...fields];
              next[i] = e.target.value;
              onChange(next);
            }}
            className="h-6 text-xs flex-1"
          />
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onChange(fields.filter((_, j) => j !== i))}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="h-6 text-xs w-full" onClick={() => onChange([...fields, ''])}>
        <Plus className="h-3 w-3 mr-1" /> 添加字段
      </Button>
    </div>
  );
}

function ConditionsEditor({ value, onChange }: { value: Record<string, unknown>[]; onChange: (v: Record<string, unknown>[]) => void }) {
  const conditions = Array.isArray(value) ? value : [];

  return (
    <div className="space-y-2">
      {conditions.map((cond, i) => (
        <div key={i} className="border rounded p-2 space-y-1">
          <div className="flex items-center gap-1">
            <Select
              value={(cond.operator as string) || 'equals'}
              onValueChange={(v) => {
                const next = [...conditions];
                next[i] = { ...cond, operator: v };
                onChange(next);
              }}
            >
              <SelectTrigger className="h-6 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_OPERATORS.map(op => (
                  <SelectItem key={op.value} value={op.value} className="text-xs">{op.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onChange(conditions.filter((_, j) => j !== i))}>
              <X className="h-3 w-3" />
            </Button>
          </div>
          <Input
            value={(cond.value as string) || ''}
            onChange={(e) => {
              const next = [...conditions];
              next[i] = { ...cond, value: e.target.value };
              onChange(next);
            }}
            placeholder="值"
            className="h-6 text-xs"
            disabled={NO_VALUE_OPERATORS.has((cond.operator as string) || 'equals')}
          />
        </div>
      ))}
      <Button variant="ghost" size="sm" className="h-6 text-xs w-full" onClick={() => onChange([...conditions, { operator: 'equals', value: '' }])}>
        <Plus className="h-3 w-3 mr-1" /> 添加条件
      </Button>
    </div>
  );
}

export function WorkflowPropertiesPanel({ node, onUpdateData }: PropertiesPanelProps) {
  const definition = useMemo(() => node ? getNodeDefinition(node.type) : null, [node]);

  const handleDataChange = useCallback((key: string, value: unknown) => {
    if (!node) return;
    onUpdateData(node.id, { ...node.data, [key]: value });
  }, [node, onUpdateData]);

  if (!node) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4">
        选择节点查看属性
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        {/* Node header */}
        <div className="space-y-1">
          <div className="text-xs font-medium">{definition?.label || node.type}</div>
          <div className="text-[10px] text-muted-foreground font-mono">{node.id}</div>
        </div>

        {/* Label */}
        <div className="space-y-1">
          <Label className="text-xs">标签</Label>
          <Input
            value={node.label || ''}
            onChange={(e) => handleDataChange('label', e.target.value)}
            className="h-7 text-xs"
          />
        </div>

        {/* Properties */}
        {definition?.properties?.map(prop => (
          <div key={prop.key} className="space-y-1">
            <div className="flex items-center gap-1">
              <Label className="text-xs">{prop.label}</Label>
              {prop.required && <span className="text-[10px] text-destructive">*</span>}
            </div>
            <PropertyField
              prop={prop}
              value={node.data?.[prop.key]}
              onChange={(v) => handleDataChange(prop.key, v)}
            />
            {prop.tooltip && (
              <p className="text-[10px] text-muted-foreground">{prop.tooltip}</p>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
