"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";

interface GitRemoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, url: string) => Promise<void>;
}

export function GitRemoteDialog({ open, onOpenChange, onSubmit }: GitRemoteDialogProps) {
  const t = useTranslations('git.remote');
  const tc = useTranslations('common');
  const [name, setName] = useState("origin");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !url.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(name.trim(), url.trim());
      setUrl("");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('bindTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t('nameLabel')}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePlaceholder')} className="h-8 text-xs" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t('urlLabel')}</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('urlPlaceholder')}
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" />}>{tc('cancel')}</DialogClose>
          <Button size="sm" onClick={handleSubmit} disabled={!name.trim() || !url.trim() || submitting}>
            {submitting ? t('adding') : t('addRemote')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
