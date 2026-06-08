'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  url: string;
}

export function ShareDialog({ open, onOpenChange, title, url }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share &ldquo;{title}&rdquo;</DialogTitle>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <InputGroup>
            <InputGroupInput readOnly value={url} onClick={(e) => (e.target as HTMLInputElement).select()} />
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="xs" onClick={handleCopy}>
                {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : 'Copy'}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </DialogContent>
    </Dialog>
  );
}
