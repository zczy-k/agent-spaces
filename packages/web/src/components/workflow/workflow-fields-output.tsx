'use client';

import { useState } from 'react';
import type { OutputField } from '@agent-spaces/shared';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { JsonViewer, type JsonValue } from '@/components/viewers/json-viewer';
import {
  FIELD_TYPES,
  getOutputFields,
  isFileOutputFieldType,
  parseArrayOutputFieldValue,
  stringifyOutputFieldValue,
} from './workflow-properties-utils';
import { WorkflowVariablePicker, type WorkflowVariableContext } from './workflow-variable-picker';

export function JsonPreview({ value }: { value: unknown }) {
  return (
    <JsonViewer
      data={value as JsonValue}
      rootName="output"
      defaultExpanded={2}
    />
  );
}

export function OutputFieldsEditor({
  value,
  onChange,
  variableContext,
  depth = 0,
}: {
  value: OutputField[];
  onChange: (v: OutputField[]) => void;
  variableContext?: WorkflowVariableContext;
  depth?: number;
}) {
  const fields = getOutputFields(value);
  const [expandedFields, setExpandedFields] = useState<Set<number>>(() => new Set());
  const indent = depth * 16;

  const updateField = (index: number, patch: Partial<OutputField>) => {
    const next = [...fields];
    next[index] = { ...next[index], ...patch };
    if (patch.type && patch.type !== 'object') {
      next[index].children = undefined;
    }
    if (patch.type && !isFileOutputFieldType(patch.type)) {
      next[index].fileNameFilter = undefined;
    }
    if (patch.type === 'object' && !next[index].children) {
      next[index].children = [];
      next[index].value = undefined;
    }
    onChange(next);
  };

  const toggleExpand = (index: number) => {
    setExpandedFields((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const insertVariable = (index: number, variablePath: string) => {
    updateField(index, { value: `${stringifyOutputFieldValue(fields[index]?.value)}${variablePath}` });
  };

  return (
    <div className="space-y-1">
      {depth === 0 && (
        <div className="grid grid-cols-[1fr_80px] gap-1 text-[10px] font-medium text-muted-foreground">
          <span>名称</span>
          <span>类型</span>
        </div>
      )}
      {fields.map((field, index) => (
        <div key={index} className="space-y-0.5">
          <div className="group/field flex items-center gap-1" style={{ paddingLeft: `${indent}px` }}>
            <Button
              variant="ghost"
              size="icon"
              className={`h-5 w-5 shrink-0 ${expandedFields.has(index) ? '' : '-rotate-90'}`}
              onClick={() => toggleExpand(index)}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Checkbox
              checked={Boolean(field.required) || false}
              onCheckedChange={(checked) => updateField(index, { required: checked === true || undefined })}
              className="h-3.5 w-3.5"
              title="必填"
            />
            <Input
              value={field.key ?? ''}
              onChange={(e) => updateField(index, { key: e.target.value })}
              placeholder="字段名"
              className="h-6 min-w-0 flex-1 text-[11px]"
            />
            <Select
              value={field.type ?? 'string'}
              onValueChange={(type) => updateField(index, { type: type as OutputField['type'] })}
            >
              <SelectTrigger size="sm" className="h-6 w-20 shrink-0 px-2 py-0 text-[11px] [&_svg]:size-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(type => (
                  <SelectItem key={type} value={type} className="text-[11px]">{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/field:opacity-100"
              onClick={() => onChange(fields.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-2.5 w-2.5" />
            </Button>
          </div>
          {expandedFields.has(index) && field.type !== 'object' && (
            <div className="space-y-0.5" style={{ paddingLeft: `${indent + 20}px` }}>
              {isFileOutputFieldType(field.type) ? (
                <Input
                  value={field.fileNameFilter ?? ''}
                  onChange={(e) => updateField(index, { fileNameFilter: e.target.value || undefined })}
                  placeholder="File name filter, e.g. *.pdf, .png"
                  className="h-6 text-[11px]"
                />
              ) : (
                <InputGroup className="h-6 min-h-0 rounded-md">
                <InputGroupInput
                  value={stringifyOutputFieldValue(field.value)}
                  onChange={(e) => updateField(index, { value: parseArrayOutputFieldValue(field.type, e.target.value) })}
                  placeholder="默认值"
                  className="h-6 text-[11px]"
                />
                {variableContext?.currentNodeId && (
                  <InputGroupAddon align="inline-end" className="py-0 pr-0.5">
                    <WorkflowVariablePicker
                      {...variableContext}
                      onSelect={(path) => insertVariable(index, path)}
                    />
                  </InputGroupAddon>
                )}
                </InputGroup>
              )}
              <Input
                value={field.description ?? ''}
                onChange={(e) => updateField(index, { description: e.target.value || undefined })}
                placeholder="描述（可选）"
                className="h-6 text-[11px]"
              />
            </div>
          )}
          {field.type === 'object' && depth < 3 && (
            <div>
              <OutputFieldsEditor
                value={getOutputFields(field.children)}
                onChange={(children) => updateField(index, { children })}
                variableContext={variableContext}
                depth={depth + 1}
              />
            </div>
          )}
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-full gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        style={{ paddingLeft: `${indent}px` }}
        onClick={() => onChange([...fields, { key: '', type: 'string', value: '' }])}
      >
        <Plus className="h-2.5 w-2.5" />
        添加字段
      </Button>
    </div>
  );
}
