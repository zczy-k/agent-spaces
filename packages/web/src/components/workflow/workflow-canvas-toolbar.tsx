'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { Workflow } from '@agent-spaces/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  EyeOff, LassoSelect, LayoutGrid, Map as MapIcon, RotateCcw, RotateCw, SquareDashedMousePointer,
  PanelBottomClose, PanelBottomOpen,
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
  rectangleDrawActive,
  lassoSelectionActive,
  minimapVisible,
  onUndo,
  onRedo,
  onExitPreview,
  onAutoLayout,
  layoutEngine,
  onToggleRectangleDraw,
  onToggleLassoSelection,
  onToggleMinimap,
  logsCollapsed,
  onToggleLogsCollapsed,
}: {
  workflow: Workflow;
  isPreview: boolean;
  canUndo: boolean;
  canRedo: boolean;
  rectangleDrawActive: boolean;
  lassoSelectionActive: boolean;
  minimapVisible: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onExitPreview?: () => void;
  onAutoLayout?: (direction: 'LR' | 'TB', options?: { layoutEngine?: string }) => void;
  layoutEngine?: string;
  onToggleRectangleDraw?: () => void;
  onToggleLassoSelection?: () => void;
  onToggleMinimap: () => void;
  logsCollapsed: boolean;
  onToggleLogsCollapsed: () => void;
}) {
  const t = useTranslations("workflows");
  const hasNodes = workflow.nodes.length > 0;
  const autoLayoutOptions = layoutEngine ? { layoutEngine } : undefined;

  return (
    <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-background/90 px-2 py-1 shadow-sm backdrop-blur-sm">
      <TooltipProvider delay={400}>
        {isPreview && onExitPreview ? (
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-orange-500 hover:text-orange-600" onClick={onExitPreview} />}>
              <EyeOff className="h-3.5 w-3.5" />
              <span className="text-xs">{t('canvasToolbar.exitPreview')}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">{t('canvasToolbar.exitPreviewTooltip')}</TooltipContent>
          </Tooltip>
        ) : null}

        {isPreview && (
          <CanvasToolbarButton
            tooltip={logsCollapsed ? t('canvasToolbar.expandLogs') : t('canvasToolbar.collapseLogs')}
            className={`h-7 w-7 p-0 ${!logsCollapsed ? 'text-blue-500' : ''}`}
            onClick={onToggleLogsCollapsed}
          >
            {logsCollapsed ? <PanelBottomOpen className="h-3.5 w-3.5" /> : <PanelBottomClose className="h-3.5 w-3.5" />}
          </CanvasToolbarButton>
        )}
        <CanvasToolbarButton tooltip={t('canvasToolbar.undo')} disabled={!canUndo} onClick={onUndo}>
          <RotateCcw className="h-3.5 w-3.5" />
        </CanvasToolbarButton>
        <CanvasToolbarButton tooltip={t('canvasToolbar.redo')} disabled={!canRedo} onClick={onRedo}>
          <RotateCw className="h-3.5 w-3.5" />
        </CanvasToolbarButton>

        <CanvasToolbarButton
          tooltip={t('canvasToolbar.drawAreaAddNode')}
          disabled={isPreview || !onToggleRectangleDraw}
          className={`h-7 w-7 p-0 ${rectangleDrawActive ? 'text-blue-500' : ''}`}
          onClick={onToggleRectangleDraw}
        >
          <SquareDashedMousePointer className="h-3.5 w-3.5" />
        </CanvasToolbarButton>

        <CanvasToolbarButton
          tooltip={t('canvasToolbar.drawAreaSelectNode')}
          disabled={isPreview || !onToggleLassoSelection}
          className={`h-7 w-7 p-0 ${lassoSelectionActive ? 'text-blue-500' : ''}`}
          onClick={onToggleLassoSelection}
        >
          <LassoSelect className="h-3.5 w-3.5" />
        </CanvasToolbarButton>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={!hasNodes || !onAutoLayout} />}>
            <LayoutGrid className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top">
            <DropdownMenuItem onClick={() => onAutoLayout?.('LR', autoLayoutOptions)}>{t('canvasToolbar.horizontalLayout')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAutoLayout?.('TB', autoLayoutOptions)}>{t('canvasToolbar.verticalLayout')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <CanvasToolbarButton
          tooltip={minimapVisible ? t('canvasToolbar.hideMinimap') : t('canvasToolbar.showMinimap')}
          className={`h-7 w-7 p-0 ${minimapVisible ? 'text-blue-500' : ''}`}
          onClick={onToggleMinimap}
        >
          <MapIcon className="h-3.5 w-3.5" />
        </CanvasToolbarButton>

      </TooltipProvider>
    </div>
  );
}
