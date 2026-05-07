'use client';

import { useState } from 'react';
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
import { workflowTemplates } from './workflow-templates';

interface WorkflowTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: typeof workflowTemplates[number]['data']) => void;
}

export function WorkflowTemplatesDialog({ open, onOpenChange, onImport }: WorkflowTemplatesDialogProps) {
  const [importing, setImporting] = useState<string | null>(null);

  const handleImport = async (template: typeof workflowTemplates[number]) => {
    setImporting(template.id);
    try {
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
          {workflowTemplates.map((template) => {
            const agentCount = Object.keys(template.data.agents).length;
            return (
              <Card key={template.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{template.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {agentCount} 个 Agent
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {template.data.nodes.map((node) => (
                          <Badge key={node.id} variant="outline" className="text-xs">
                            {node.data.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={importing !== null}
                      onClick={() => handleImport(template)}
                    >
                      {importing === template.id ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Download className="h-3.5 w-3.5 mr-1" />
                      )}
                      导入
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
