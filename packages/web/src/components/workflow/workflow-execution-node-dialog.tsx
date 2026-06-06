'use client';

import type { OutputField } from '@agent-spaces/shared';
import { ExecutionInputForm } from './workflow-execution-input-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Play } from 'lucide-react';

export function ExecutionNodeDialog({
  open, fields, nodeLabel, onOpenChange, onSubmit,
}: {
  open: boolean;
  fields: OutputField[];
  nodeLabel: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">节点测试 · {nodeLabel}</DialogTitle>
        </DialogHeader>
        <ExecutionInputForm
          fields={fields}
          onSubmit={async values => { await onSubmit(values); onOpenChange(false); }}
          submitLabel={<><Play className="h-3 w-3 mr-1" /> 开始测试</>}
        />
      </DialogContent>
    </Dialog>
  );
}
