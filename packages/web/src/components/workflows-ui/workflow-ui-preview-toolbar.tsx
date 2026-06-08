"use client";

import { RefreshCw, Settings, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface WorkflowUiPreviewToolbarProps {
  autoRefresh: boolean;
  onAutoRefreshChange: (auto: boolean) => void;
  onRefresh: () => void;
  onOpenPluginDialog?: () => void;
}

export function WorkflowUiPreviewToolbar({
  autoRefresh,
  onAutoRefreshChange,
  onRefresh,
  onOpenPluginDialog,
}: WorkflowUiPreviewToolbarProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5">
      <div className="flex items-center gap-2">
        <Switch
          id="auto-refresh"
          checked={autoRefresh}
          onCheckedChange={onAutoRefreshChange}
          className="scale-75"
        />
        <Label htmlFor="auto-refresh" className="text-xs text-muted-foreground cursor-pointer">
          <Zap className="h-3 w-3 inline mr-1" />
          自动预览
        </Label>
      </div>
      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onRefresh}>
        <RefreshCw className="h-3 w-3 mr-1" /> 刷新
      </Button>
      {onOpenPluginDialog && (
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onOpenPluginDialog}>
          <Settings className="h-3 w-3 mr-1" /> 插件
        </Button>
      )}
    </div>
  );
}
