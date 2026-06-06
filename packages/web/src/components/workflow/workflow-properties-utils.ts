import type { OutputField, NodeProperty } from '@agent-spaces/shared';

export type DebugResult = {
  status?: 'completed' | 'error';
  output?: unknown;
  error?: string;
  duration?: number;
};

export type JsonPreset = {
  id: string;
  name: string;
  data: Record<string, unknown>;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
};

export const JSON_PRESETS_KEY = '__jsonPresets';
export const SELECTED_JSON_PRESET_KEY = '__selectedJsonPresetId';

export const FIELD_TYPES: OutputField['type'][] = [
  'string',
  'number',
  'boolean',
  'object',
  'file',
  'any',
  'string[]',
  'number[]',
  'file[]',
  'any[]',
];

export function isArrayOutputFieldType(type: OutputField['type'] | undefined) {
  return type === 'string[]' || type === 'number[]' || type === 'file[]' || type === 'any[]';
}

export function isFileOutputFieldType(type: OutputField['type'] | undefined) {
  return type === 'file' || type === 'file[]';
}

export function stringifyOutputFieldValue(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value);
  return typeof value === 'string' ? value : '';
}

export function parseArrayOutputFieldValue(type: OutputField['type'] | undefined, raw: string): unknown {
  if (!isArrayOutputFieldType(type)) return raw;
  const value = raw.trim();
  if (!value) return [];
  if (!value.startsWith('[') || !value.endsWith(']')) return raw;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : raw;
  } catch {
    return raw;
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function inferType(value: unknown): OutputField['type'] {
  if (value === null || value === undefined) return 'any';
  if (Array.isArray(value)) {
    if (value.every(item => typeof item === 'string')) return 'string[]';
    if (value.every(item => typeof item === 'number')) return 'number[]';
    return 'any[]';
  }
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'object') return 'object';
  return 'any';
}

export function toOutputFields(value: unknown): OutputField[] {
  if (!isPlainObject(value)) return [];
  return Object.entries(value).map(([key, fieldValue]) => {
    const type = inferType(fieldValue);
    return {
      key,
      type,
      ...(type === 'object' ? { children: toOutputFields(fieldValue) } : {}),
    };
  });
}

export function getOutputFields(value: unknown): OutputField[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainObject).map(item => ({
    key: typeof item.key === 'string' ? item.key : '',
    type: FIELD_TYPES.includes(item.type as OutputField['type']) ? item.type as OutputField['type'] : 'any',
    value: item.value,
    fileNameFilter: typeof item.fileNameFilter === 'string' ? item.fileNameFilter : undefined,
    description: typeof item.description === 'string' ? item.description : undefined,
    required: typeof item.required === 'boolean' ? item.required : undefined,
    children: getOutputFields(item.children),
  }));
}

export function getJsonPresets(value: unknown): JsonPreset[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainObject).map(item => ({
    id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
    name: typeof item.name === 'string' ? item.name : '未命名预设',
    data: isPlainObject(item.data) ? item.data : {},
    inputs: isPlainObject(item.inputs) ? item.inputs : {},
    outputs: isPlainObject(item.outputs) ? item.outputs : {},
  }));
}

export function getPropertyValue(prop: NodeProperty, data: Record<string, unknown>) {
  return data[prop.key] ?? prop.default;
}

export function isVisible(prop: NodeProperty, data: Record<string, unknown>) {
  if (!prop.visibleWhen) return true;
  const actual = data[prop.visibleWhen.key];
  if ('equals' in prop.visibleWhen) return actual === prop.visibleWhen.equals;
  if (prop.visibleWhen.in) return prop.visibleWhen.in.includes(actual);
  return true;
}
