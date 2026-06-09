'use client';

import { useState } from 'react';
import {
  Save, ArrowLeft,
  Download, Upload, Undo2, Redo2, PackagePlus, MoreVertical, FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WorkflowInfoDialog } from './workflow-info-dialog';
import type { Workflow } from '@agent-spaces/shared';

interface EditorToolbarProps {
  workflow: Workflow | null;
  isDirty: boolean;
  isPreview: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onBack: () => void;
  onExitPreview: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onImport: () => void;
  onOpenPluginManager: () => void;
  onOpenWorkflowLocation: () => void;
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
  workflow, isDirty, isPreview,
  canUndo, canRedo,
  onBack, onExitPreview, onSave,
  onUndo, onRedo, onExport, onImport,
  onOpenPluginManager, onOpenWorkflowLocation, onWorkflowInfoChange,
}: EditorToolbarProps) {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-background border rounded-xl shrink-0">
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

      {isPreview && (
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-blue-500" onClick={onExitPreview}>
          退出预览
        </Button>
      )}

      <ToolBtn tooltip="保存 (Ctrl+S)" variant="ghost" size="icon" className="h-7 w-7" onClick={onSave} disabled={!isDirty}>
        <Save className="h-4 w-4" />
      </ToolBtn>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7" />}>
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            导出
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onImport}>
            <Upload className="h-4 w-4 mr-2" />
            导入
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenWorkflowLocation} disabled={!workflow}>
            <FolderOpen className="h-4 w-4 mr-2" />
            打开工作流位置
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
