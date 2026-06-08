'use client';

import { useState } from 'react';
import { sdk } from '@/lib/sdk';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Code, FileText, Loader2 } from 'lucide-react';
import { nativeNavigate } from '@/lib/navigate';
import { useRouter } from 'next/navigation';

interface WorkflowsUiCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkflowsUiCreateDialog({ open, onOpenChange }: WorkflowsUiCreateDialogProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async (type: 'react' | 'html') => {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const project = await sdk.workflowUi.create({ name: trimmed, type });
      onOpenChange(false);
      setName('');
      nativeNavigate(router, `/workflows-ui/${project.id}`);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate('react');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Custom Page</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Page name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={creating}
          autoFocus
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleCreate('html')}
            disabled={!name.trim() || creating}
          >
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            HTML
          </Button>
          <Button
            onClick={() => handleCreate('react')}
            disabled={!name.trim() || creating}
          >
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Code className="h-4 w-4 mr-2" />}
            React
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
