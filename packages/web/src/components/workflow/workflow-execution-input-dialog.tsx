'use client';

import { useState } from 'react';
import type { OutputField } from '@agent-spaces/shared';
import { Button } from '@/components/ui/button';
import { FileUpload, type FileUploadFile } from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sdk } from '@/lib/sdk';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Play } from 'lucide-react';
import {
  isArrayOutputFieldType,
  isFileOutputFieldType,
  stringifyOutputFieldValue,
} from './workflow-properties-utils';

type InputFormValue = string | FileUploadFile[];

export function parseInputValue(field: OutputField, raw: string): unknown {
  if (field.type === 'file' || field.type === 'file[]') return field.type === 'file[]' ? [] : null;
  if (field.type === 'number') return raw === '' ? 0 : Number(raw);
  if (field.type === 'boolean') return raw === 'true';
  if (field.type === 'object' || field.type === 'any' || isArrayOutputFieldType(field.type)) {
    if (!raw.trim()) return field.type === 'object' ? {} : isArrayOutputFieldType(field.type) ? [] : '';
    try {
      const parsed = JSON.parse(raw);
      return isArrayOutputFieldType(field.type) && !Array.isArray(parsed) ? raw : parsed;
    } catch {
      return raw;
    }
  }
  return raw;
}

export interface ExecutionInputFormProps {
  fields: OutputField[];
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  submitLabel?: React.ReactNode;
  initialValues?: Record<string, string>;
  disabled?: boolean;
  footer?: (submit: () => void) => React.ReactNode;
}

export function ExecutionInputForm({ fields, onSubmit, submitLabel, initialValues, disabled, footer }: ExecutionInputFormProps) {
  const [values, setValues] = useState<Record<string, InputFormValue>>(() => {
    if (!initialValues) return {};
    const map: Record<string, InputFormValue> = {};
    for (const field of fields) {
      if (!field.key) continue;
      const init = initialValues[field.key];
      if (init !== undefined) map[field.key] = init;
    }
    return map;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = (key: string, value: InputFormValue) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    if (isSubmitting || disabled) return;
    setIsSubmitting(true);
    const parsed: Record<string, unknown> = {};
    try {
      for (const field of fields) {
        if (!field.key) continue;
        if (isFileOutputFieldType(field.type)) {
          const files = values[field.key];
          parsed[field.key] = Array.isArray(files)
            ? field.type === 'file[]'
              ? await Promise.all(files.map(file => resolveWorkflowFileInput(file.file)))
              : await resolveWorkflowFileInput(files[0]?.file)
            : field.type === 'file[]' ? [] : null;
          continue;
        }
        parsed[field.key] = parseInputValue(field, getStringValue(values[field.key], field.value));
      }
      await onSubmit(parsed);
    } finally {
      setIsSubmitting(false);
    }
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
              {isFileOutputFieldType(field.type) ? (
                <FileUpload
                  className="text-xs"
                  maxFiles={field.type === 'file[]' ? undefined : 1}
                  value={getFileValue(values[field.key])}
                  onChange={files => setField(field.key, files)}
                  placeholder={field.key}
                  fileNameFilter={field.fileNameFilter}
                  disabled={disabled}
                />
              ) : (
                <Input
                  className="h-8 text-xs"
                  type={field.type === 'number' ? 'number' : 'text'}
                  placeholder={field.type === 'boolean' ? 'true / false' : field.key}
                  value={getStringValue(values[field.key], field.value)}
                  onChange={event => setField(field.key, event.target.value)}
                  disabled={disabled}
                />
              )}
            </label>
          ))}
        </div>
      </ScrollArea>
      {footer ? footer(submit) : submitLabel ? (
        <DialogFooter>
          <Button size="sm" onClick={submit} disabled={isSubmitting || disabled}>
            {submitLabel}
          </Button>
        </DialogFooter>
      ) : null}
    </>
  );
}

function getStringValue(value: InputFormValue | undefined, fallback?: unknown): string {
  return typeof value === 'string' ? value : stringifyOutputFieldValue(fallback);
}

function getFileValue(value: InputFormValue | undefined): FileUploadFile[] {
  return Array.isArray(value) ? value : [];
}

type WorkflowFileInput = {
  path: string;
  relativePath: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  httpPath?: string;
};

type UploadedWorkflowFile = {
  name: string;
  path: string;
  size: number;
  type: string;
  url: string;
  httpPath?: string;
};

async function resolveWorkflowFileInput(file?: File): Promise<WorkflowFileInput | null> {
  if (!file) return null;

  const relativePath = getFileRelativePath(file);
  const localPath = getElectronFilePath(file);
  if (isElectronEnvironment() && localPath) {
    return {
      path: localPath,
      relativePath,
      name: file.name,
      size: file.size,
      type: file.type,
    };
  }

  const formData = new FormData();
  formData.append('file', file);
  const uploaded = await sdk.http.upload<UploadedWorkflowFile>('/api/upload', formData);

  return {
    path: uploaded.path,
    relativePath,
    name: uploaded.name || file.name,
    size: uploaded.size || file.size,
    type: uploaded.type || file.type,
    url: uploaded.url,
    httpPath: uploaded.httpPath,
  };
}

function getFileRelativePath(file: File): string {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return relativePath || file.name;
}

function getElectronFilePath(file: File): string | null {
  const path = (file as File & { path?: string }).path;
  return typeof path === 'string' && path.trim() ? path : null;
}

function isElectronEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const maybeWindow = window as Window & {
    electron?: unknown;
    electronAPI?: unknown;
    require?: unknown;
  };
  const userAgent = navigator.userAgent.toLowerCase();
  return Boolean(maybeWindow.electron || maybeWindow.electronAPI || userAgent.includes('electron'));
}

export function ExecutionInputDialog({
  open, fields, startNodeLabel, onOpenChange, onSubmit,
}: {
  open: boolean;
  fields: OutputField[];
  startNodeLabel: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">工作流输入 · {startNodeLabel}</DialogTitle>
        </DialogHeader>
        <ExecutionInputForm
          fields={fields}
          onSubmit={async values => { await onSubmit(values); onOpenChange(false); }}
          submitLabel={<><Play className="h-3 w-3 mr-1" /> 开始执行</>}
        />
      </DialogContent>
    </Dialog>
  );
}
