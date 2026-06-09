'use client';

import React from 'react';
import type { Workflow } from '@agent-spaces/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  EyeOff, LayoutGrid, Map as MapIcon, RotateCcw, RotateCw,
} from 'lucide-react';

function CanvasToolbarButton({
  tooltip,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { tooltip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="sm" className="h-7 w-7 p-0" {...props} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function CanvasToolbar({
  workflow,
  isPreview,
  canUndo,
  canRedo,
  minimapVisible,
  onUndo,
  onRedo,
  onExitPreview,
  onAutoLayout,
  onToggleMinimap,
}: {
  workflow: Workflow;
  isPreview: boolean;
  canUndo: boolean;
  canRedo: boolean;
  minimapVisible: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onExitPreview?: () => void;
  onAutoLayout?: (direction: 'LR' | 'TB') => void;
  onToggleMinimap: () => void;
}) {
  const hasNodes = workflow.nodes.length > 0;

  return (
    <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-background/90 px-2 py-1 shadow-sm backdrop-blur-sm">
      <TooltipProvider delay={400}>
        {isPreview && onExitPreview ? (
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-orange-500 hover:text-orange-600" onClick={onExitPreview} />}>
              <EyeOff className="h-3.5 w-3.5" />
              <span className="text-xs">退出预览</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">退出执行记录预览</TooltipContent>
          </Tooltip>
        ) : null}

        <CanvasToolbarButton tooltip="撤销 (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
          <RotateCcw className="h-3.5 w-3.5" />
        </CanvasToolbarButton>
        <CanvasToolbarButton tooltip="重做 (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo}>
          <RotateCw className="h-3.5 w-3.5" />
        </CanvasToolbarButton>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!hasNodes || !onAutoLayout} />}>
            <LayoutGrid className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top">
            <DropdownMenuItem onClick={() => onAutoLayout?.('LR')}>横向布局</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAutoLayout?.('TB')}>垂直布局</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <CanvasToolbarButton
          tooltip={minimapVisible ? '隐藏小地图' : '显示小地图'}
          className={`h-7 w-7 p-0 ${minimapVisible ? 'text-blue-500' : ''}`}
          onClick={onToggleMinimap}
        >
          <MapIcon className="h-3.5 w-3.5" />
        </CanvasToolbarButton>

      </TooltipProvider>
    </div>
  );
}
