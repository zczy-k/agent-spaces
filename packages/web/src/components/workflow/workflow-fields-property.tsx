'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NodeProperty } from '@agent-spaces/shared';
import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MonacoCodeEditor as MonacoEditor } from '@/components/editor/monaco-code-editor';
import { getOutputFields } from './workflow-properties-utils';
import type { WorkflowVariableContext } from './workflow-variable-picker';
import { WorkflowVariableInput } from './workflow-variable-input';
import { OutputFieldsEditor } from './workflow-fields-output';
import { ConditionsEditor } from './workflow-fields-conditions';
import { ArrayFieldEditor } from './workflow-fields-array';
import { WorkflowCodeFullscreenDialog } from './workflow-code-fullscreen-dialog';

const TEXT_COMMIT_DELAY_MS = 250;

function useDebouncedDraft(
  value: string,
  onCommit: (value: string) => void,
) {
  const [draft, setDraft] = useState(value);
  const onCommitRef = useRef(onCommit);
  const draftRef = useRef(value);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  useEffect(() => {
    setDraft(value);
    draftRef.current = value;
    dirtyRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [value]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    onCommitRef.current(draftRef.current);
  }, []);

  const updateDraft = useCallback((nextValue: string) => {
    setDraft(nextValue);
    draftRef.current = nextValue;
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, TEXT_COMMIT_DELAY_MS);
  }, [flush]);

  useEffect(() => () => flush(), [flush]);

  return { draft, updateDraft, flush };
}

function DebouncedTextInput({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { draft, updateDraft, flush } = useDebouncedDraft(value, onChange);

  return (
    <Input
      value={draft}
      onChange={(e) => updateDraft(e.target.value)}
      onBlur={flush}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
}

function DebouncedTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { draft, updateDraft, flush } = useDebouncedDraft(value, onChange);

  return (
    <Textarea
      value={draft}
      onChange={(e) => updateDraft(e.target.value)}
      onBlur={flush}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
}

function DebouncedNumberInput({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { draft, updateDraft, flush } = useDebouncedDraft(value, onChange);

  return (
    <Input
      type="number"
      value={draft}
      onChange={(e) => updateDraft(e.target.value)}
      onBlur={flush}
      disabled={disabled}
      className={className}
    />
  );
}

export function PropertyField({
  prop,
  value,
  onChange,
  onPreviewChange,
  previewMode = false,
  variableContext,
  variableMode = false,
  variableValue = '',
  onInsertVariable,
}: {
  prop: NodeProperty;
  value: unknown;
  onChange: (v: unknown) => void;
  onPreviewChange?: (v: unknown) => void;
  previewMode?: boolean;
  variableContext?: WorkflowVariableContext;
  variableMode?: boolean;
  variableValue?: string | number;
  onInsertVariable?: (path: string) => void;
}) {
  const disabled = Boolean(prop.readonly);

  if (variableMode) {
    return (
      <WorkflowVariableInput
        value={variableValue}
        readOnly={disabled}
        placeholder={prop.label}
        variableContext={variableContext}
        onChange={(nextValue) => onChange(nextValue)}
        onSelectVariable={onInsertVariable}
      />
    );
  }

  switch (prop.type) {
    case 'text':
      return (
        <DebouncedTextInput
          value={String(value ?? '')}
          onChange={onChange}
          placeholder={prop.tooltip}
          disabled={disabled}
          className="h-7 text-xs"
        />
      );

    case 'textarea':
      return (
        <DebouncedTextarea
          value={String(value ?? '')}
          onChange={onChange}
          placeholder={prop.tooltip}
          disabled={disabled}
          className="min-h-[72px] text-xs"
        />
      );

    case 'number':
      return (
        <DebouncedNumberInput
          value={String(value ?? '')}
          onChange={(nextValue) => onChange(nextValue === '' ? undefined : Number(nextValue))}
          disabled={disabled}
          className="h-7 text-xs"
        />
      );

    case 'select':
      return (
        <Select
          value={String(value ?? prop.default ?? '')}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger className="h-7 text-xs w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {prop.options?.map(option => (
              <SelectItem key={option.value} value={option.value} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'checkbox':
      return (
        <Switch
          size="sm"
          checked={Boolean(value)}
          disabled={disabled}
          onCheckedChange={onChange}
        />
      );

    case 'code':
      return (
        <CodePropertyEditor
          label={prop.label}
          language={(prop as unknown as Record<string, unknown>).language as string || 'javascript'}
          value={String(value ?? '')}
          disabled={disabled}
          onChange={(nextValue) => onChange(nextValue)}
        />
      );

    case 'output_fields':
      return <OutputFieldsEditor value={getOutputFields(value)} onChange={onChange} variableContext={variableContext} />;

    case 'conditions':
      return <ConditionsEditor value={value} onChange={onChange} variableContext={variableContext} />;

    case 'array':
      return <ArrayFieldEditor prop={prop} value={value} onChange={onChange} variableContext={variableContext} />;

    default:
      return (
        <DebouncedTextInput
          value={String(value ?? '')}
          onChange={onChange}
          disabled={disabled}
          className="h-7 text-xs"
        />
      );
  }
}

function CodePropertyEditor({
  label,
  language,
  value,
  disabled,
  onChange,
}: {
  label: string;
  language: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  return (
    <>
      <div className="relative overflow-hidden rounded-md border">
        <MonacoEditor
          height="160px"
          language={language}
          theme="vs-dark"
          value={value}
          options={getCodeEditorOptions(true)}
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute bottom-2 right-2 z-10 h-7 w-7 bg-background/90 shadow-sm"
          title="全屏编辑"
          onClick={() => setFullscreenOpen(true)}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <WorkflowCodeFullscreenDialog
        open={fullscreenOpen}
        onOpenChange={setFullscreenOpen}
        label={label}
        language={language}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </>
  );
}

function getCodeEditorOptions(readOnly: boolean) {
  return {
    readOnly,
    minimap: { enabled: false },
    fontSize: 12,
    lineNumbers: 'on' as const,
    scrollBeyondLastLine: false,
    wordWrap: 'on' as const,
    folding: false,
    glyphMargin: false,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    overviewRulerLanes: 0,
    renderLineHighlight: 'none' as const,
    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
    padding: { top: 4, bottom: 4 },
  };
}
