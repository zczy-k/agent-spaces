'use client';

import { useMemo, useCallback } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';

const BACKGROUND_OPTIONS = [
  { value: 'dots', label: '点阵', description: '默认点阵背景' },
  { value: 'lines', label: '线条', description: '网格线条背景' },
  { value: 'cross', label: '十字', description: '十字交叉背景' },
] as const;

const SNAP_OPTIONS = [
  { value: true, label: '开启', description: '节点自动吸附到网格' },
  { value: false, label: '关闭', description: '自由放置节点' },
] as const;

const LAYOUT_ENGINE_OPTIONS = [
  { value: 'dagre', label: 'Dagre', description: '经典有向图布局' },
  { value: 'elk', label: 'ELK', description: 'Eclipse Layout 引擎' },
] as const;

const HANDLE_POSITION_OPTIONS = [
  { value: 'top-bottom', label: '上 → 下', description: '从顶部出、底部入' },
  { value: 'left-right', label: '左 → 右', description: '从左侧出、右侧入' },
  { value: 'bottom-top', label: '下 → 上', description: '从底部出、顶部入' },
  { value: 'right-left', label: '右 → 左', description: '从右侧出、左侧入' },
] as const;

const EDGE_PATH_TYPE_OPTIONS = [
  { value: 'bezier', label: '贝塞尔', description: '平滑曲线' },
  { value: 'straight', label: '直线', description: '直连两点' },
  { value: 'step', label: '折线', description: '直角折线' },
  { value: 'smoothstep', label: '平滑折线', description: '圆角折线' },
] as const;

interface WorkflowCanvasStylePanelProps {
  canvasPrefs: Record<string, unknown>;
  onCanvasPreferencesChange: (prefs: Record<string, unknown>) => void;
  onAutoLayout?: (direction: 'LR' | 'TB', options?: { layoutEngine?: string }) => void;
  isCanvasLocked: boolean;
}

export function WorkflowCanvasStylePanel({
  canvasPrefs,
  onCanvasPreferencesChange,
  onAutoLayout,
  isCanvasLocked,
}: WorkflowCanvasStylePanelProps) {
  const bgVariantKey = (canvasPrefs.bgVariant as string) || 'dots';
  const snapEnabled = canvasPrefs.snapGrid !== false;
  const layoutEngine = (canvasPrefs.layoutEngine as string) || 'dagre';
  const handlePosition = (canvasPrefs.attributionPosition as string) || 'top-bottom';
  const floatingHandles = canvasPrefs.floatingHandles === true;

  const update = useCallback((patch: Record<string, unknown>) => {
    onCanvasPreferencesChange({ ...canvasPrefs, ...patch });
  }, [canvasPrefs, onCanvasPreferencesChange]);

  const handleLayoutEngineChange = useCallback((next: string) => {
    update({ layoutEngine: next });
    if (!isCanvasLocked) onAutoLayout?.('LR', { layoutEngine: next });
  }, [isCanvasLocked, onAutoLayout, update]);

  const sections: {
    title: string;
    value: string;
    options: readonly { value: string | boolean; label: string; description: string }[];
    onChange: (value: string) => void;
  }[] = useMemo(() => [
    {
      title: '背景样式',
      value: bgVariantKey,
      options: BACKGROUND_OPTIONS,
      onChange: (v) => update({ bgVariant: v }),
    },
    {
      title: '网格吸附',
      value: String(snapEnabled),
      options: SNAP_OPTIONS,
      onChange: (v) => update({ snapGrid: v === 'true' }),
    },
    {
      title: '布局引擎',
      value: layoutEngine,
      options: LAYOUT_ENGINE_OPTIONS,
      onChange: handleLayoutEngineChange,
    },
    {
      title: '连接点方向',
      value: HANDLE_POSITION_OPTIONS.some(o => o.value === handlePosition) ? handlePosition : 'top-bottom',
      options: HANDLE_POSITION_OPTIONS,
      onChange: (v) => update({ attributionPosition: v }),
    },
    {
      title: '连线样式',
      value: (canvasPrefs.edgePathType as string) || 'bezier',
      options: EDGE_PATH_TYPE_OPTIONS,
      onChange: (v) => update({ edgePathType: v }),
    },
  ], [bgVariantKey, snapEnabled, layoutEngine, handlePosition, canvasPrefs, update, handleLayoutEngineChange]);

  return (
    <div className="flex flex-col gap-6 p-4 overflow-y-auto h-full">
      {sections.map(section => (
        <div key={section.title} className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">{section.title}</h3>
          <RadioGroup
            value={section.value}
            onValueChange={section.onChange}
            className="flex flex-wrap gap-1.5"
          >
            {section.options.map(option => (
              <FieldLabel
                key={String(option.value)}
                htmlFor={`${section.title}-${option.value}`}
                className="flex items-center gap-1.5 cursor-pointer rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted has-[:checked]:bg-primary/10 has-[:checked]:border-primary"
              >
                <RadioGroupItem value={String(option.value)} id={`${section.title}-${option.value}`} />
                {option.label}
              </FieldLabel>
            ))}
          </RadioGroup>
        </div>
      ))}
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-muted-foreground">悬浮 Handle</h3>
        <FieldLabel
          htmlFor="floating-handles"
          className="flex items-center justify-between gap-3 rounded-md border px-2.5 py-2 text-sm"
        >
          <span>仅悬停时显示</span>
          <Switch
            id="floating-handles"
            checked={floatingHandles}
            onCheckedChange={(checked) => update({ floatingHandles: checked })}
          />
        </FieldLabel>
      </div>
    </div>
  );
}
