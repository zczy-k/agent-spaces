"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";

export interface PromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  placeholder: string;
  onSubmit: (value: string) => void;
}

export function GitPromptDialog({ open, onOpenChange, title, label, placeholder, onSubmit }: PromptDialogProps) {
  const tc = useTranslations('common');
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">{label}</label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) handleSubmit(); }} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button disabled={!value.trim()} onClick={handleSubmit}>{tc('confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
