'use client';

import { useState } from 'react';
import type { OutputField } from '@agent-spaces/shared';
import { Button } from '@/components/ui/button';
import { FileUpload, type FileUploadFile } from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Play } from 'lucide-react';

type InputFormValue = string | FileUploadFile[];

export function parseInputValue(field: OutputField, raw: string): unknown {
  if (field.type === 'file') return null;
  if (field.type === 'number') return raw === '' ? 0 : Number(raw);
  if (field.type === 'boolean') return raw === 'true';
  if (field.type === 'object' || field.type === 'any') {
    if (!raw.trim()) return field.type === 'object' ? {} : '';
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

export interface ExecutionInputFormProps {
  fields: OutputField[];
  onSubmit: (values: Record<string, unknown>) => void;
  submitLabel?: React.ReactNode;
}

export function ExecutionInputForm({ fields, onSubmit, submitLabel }: ExecutionInputFormProps) {
  const [values, setValues] = useState<Record<string, InputFormValue>>({});

  const setField = (key: string, value: InputFormValue) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const submit = () => {
    const parsed: Record<string, unknown> = {};
    for (const field of fields) {
      if (!field.key) continue;
      if (field.type === 'file') {
        const files = values[field.key];
        parsed[field.key] = Array.isArray(files) ? files[0]?.file ?? null : null;
        continue;
      }
      parsed[field.key] = parseInputValue(field, getStringValue(values[field.key], field.value));
    }
    onSubmit(parsed);
  };

  return (
    <>
      <ScrollArea className="min-h-0 flex-1 pr-2">
        <div className="space-y-3 py-1">
          {fields.map(field => (
            <label key={field.key} className="block space-y-1.5">
              <span className="text-xs font-medium">
                {field.required && <span className="text-destructive mr-0.5">*</span>}
                {field.key}
                <span className="text-muted-foreground font-normal ml-1">({field.type})</span>
              </span>
              {field.description && (
                <span className="block text-[10px] text-muted-foreground">{field.description}</span>
              )}
              {field.type === 'file' ? (
                <FileUpload
                  className="text-xs"
                  maxFiles={1}
                  value={getFileValue(values[field.key])}
                  onChange={files => setField(field.key, files)}
                  placeholder={field.key}
                  fileNameFilter={field.fileNameFilter}
                />
              ) : (
                <Input
                  className="h-8 text-xs"
                  type={field.type === 'number' ? 'number' : 'text'}
                  placeholder={field.type === 'boolean' ? 'true / false' : field.key}
                  value={getStringValue(values[field.key], field.value)}
                  onChange={event => setField(field.key, event.target.value)}
                />
              )}
            </label>
          ))}
        </div>
      </ScrollArea>
      {submitLabel && (
        <DialogFooter>
          <Button size="sm" onClick={submit}>
            {submitLabel}
          </Button>
        </DialogFooter>
      )}
    </>
  );
}

function getStringValue(value: InputFormValue | undefined, fallback?: string): string {
  return typeof value === 'string' ? value : fallback ?? '';
}

function getFileValue(value: InputFormValue | undefined): FileUploadFile[] {
  return Array.isArray(value) ? value : [];
}

export function ExecutionInputDialog({
  open, fields, startNodeLabel, onOpenChange, onSubmit,
}: {
  open: boolean;
  fields: OutputField[];
  startNodeLabel: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: Record<string, unknown>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">工作流输入 · {startNodeLabel}</DialogTitle>
        </DialogHeader>
        <ExecutionInputForm
          fields={fields}
          onSubmit={values => { onSubmit(values); onOpenChange(false); }}
          submitLabel={<><Play className="h-3 w-3 mr-1" /> 开始执行</>}
        />
      </DialogContent>
    </Dialog>
  );
}
