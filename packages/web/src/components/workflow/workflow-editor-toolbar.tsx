'use client';

import { useState } from 'react';
import {
  Save, ArrowLeft, Play, Square, Pause,
  Download, Upload, Undo2, Redo2, PackagePlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { WorkflowInfoDialog } from './workflow-info-dialog';
import type { Workflow } from '@agent-spaces/shared';

interface EditorToolbarProps {
  workflow: Workflow | null;
  isDirty: boolean;
  isPreview: boolean;
  executionStatus: string;
  canUndo: boolean;
  canRedo: boolean;
  onBack: () => void;
  onSave: () => void;
  onExecute: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAutoLayout: () => void;
  onExport: () => void;
  onImport: () => void;
  onOpenPluginManager: () => void;
  onWorkflowInfoChange: (updates: Partial<Workflow>) => void;
}

function ToolBtn({ tooltip, children, ...props }: React.ComponentProps<typeof Button> & { tooltip: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<div />}>
          <Button {...props}>{children}</Button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function WorkflowEditorToolbar({
  workflow, isDirty, isPreview, executionStatus,
  canUndo, canRedo,
  onBack, onSave, onExecute, onPause, onResume, onStop,
  onUndo, onRedo, onAutoLayout, onExport, onImport,
  onOpenPluginManager, onWorkflowInfoChange,
}: EditorToolbarProps) {
  const isRunning = executionStatus === 'running';
  const isPaused = executionStatus === 'paused';
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-background rounded-xl shrink-0">
      <ToolBtn tooltip="返回列表" variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
      </ToolBtn>

      <div className="w-px h-5 bg-border mx-1" />

      <ToolBtn tooltip="插件管理" variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenPluginManager} disabled={!workflow}>
        <PackagePlus className="h-4 w-4" />
      </ToolBtn>

      <div className="w-px h-5 bg-border mx-1" />

      {workflow && (
        <button
          className="h-7 px-2 text-sm font-medium hover:bg-muted/50 rounded cursor-pointer flex items-center gap-1.5"
          onClick={() => setInfoOpen(true)}
        >
          {workflow.icon ? (
            <span className="text-base leading-none">{workflow.icon}</span>
          ) : (
            <span className="w-4 h-4 rounded bg-primary/10 text-[10px] font-bold flex items-center justify-center text-primary">
              {(workflow.name || '未').charAt(0).toUpperCase()}
            </span>
          )}
          {workflow.name || '未命名'}
          {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
        </button>
      )}

      <WorkflowInfoDialog
        open={infoOpen}
        onOpenChange={setInfoOpen}
        workflow={workflow}
        onSave={onWorkflowInfoChange}
      />

      <div className="flex-1" />

      <ToolBtn tooltip="撤销" variant="ghost" size="icon" className="h-7 w-7" onClick={onUndo} disabled={!canUndo}>
        <Undo2 className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn tooltip="重做" variant="ghost" size="icon" className="h-7 w-7" onClick={onRedo} disabled={!canRedo}>
        <Redo2 className="h-4 w-4" />
      </ToolBtn>

      <div className="w-px h-5 bg-border mx-1" />

      {workflow && !isPreview && (
        <>
          {isRunning && !isPaused ? (
            <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={onPause}>
              <Pause className="h-3.5 w-3.5" /> 暂停
            </Button>
          ) : isPaused ? (
            <>
              <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={onResume}>
                <Play className="h-3.5 w-3.5" /> 继续
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-destructive" onClick={onStop}>
                <Square className="h-3.5 w-3.5" /> 停止
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={onExecute}>
              <Play className="h-3.5 w-3.5" /> 执行
            </Button>
          )}
        </>
      )}

      {isPreview && (
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-blue-500" onClick={onBack}>
          退出预览
        </Button>
      )}

      <div className="w-px h-5 bg-border mx-1" />

      <ToolBtn tooltip="保存 (Ctrl+S)" variant="ghost" size="icon" className="h-7 w-7" onClick={onSave} disabled={!isDirty}>
        <Save className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn tooltip="导出" variant="ghost" size="icon" className="h-7 w-7" onClick={onExport}>
        <Download className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn tooltip="导入" variant="ghost" size="icon" className="h-7 w-7" onClick={onImport}>
        <Upload className="h-4 w-4" />
      </ToolBtn>
    </div>
  );
}
