'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import { fetchStoreIndex } from '@/lib/agent-store';
import type { WorkflowTemplatePreset } from './workflow-templates';

interface WorkflowTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: WorkflowTemplatePreset['data']) => void;
}

interface WorkflowIndexItem {
  id: string;
  name: string;
  description: string;
  filename: string;
  nodeCount: number;
  agentCount: number;
}

export function WorkflowTemplatesDialog({ open, onOpenChange, onImport }: WorkflowTemplatesDialogProps) {
  const [importing, setImporting] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WorkflowIndexItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const index = await fetchStoreIndex<WorkflowIndexItem>('workflows/index.json');
      setTemplates(index);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchTemplates();
  }, [open, fetchTemplates]);

  const handleImport = async (item: WorkflowIndexItem) => {
    setImporting(item.id);
    try {
      const base = localStorage.getItem('agent-spaces:store-api-base') || '';
      const url = base
        ? `${base.replace(/\/+$/, '')}/workflows/${item.filename}`
        : `/agents-store/workflows/${item.filename}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const template: WorkflowTemplatePreset = await res.json();
      await onImport(template.data);
      onOpenChange(false);
    } finally {
      setImporting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>工作流模板</DialogTitle>
          <DialogDescription>选择一个模板快速创建工作流</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {loading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">加载中...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">暂无模板</div>
          ) : (
            templates.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{item.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {item.agentCount} 个 Agent
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={importing !== null}
                      onClick={() => handleImport(item)}
                    >
                      {importing === item.id ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Download className="h-3.5 w-3.5 mr-1" />
                      )}
                      导入
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
