"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export type DiscardConfirm = { type: 'single'; path: string } | { type: 'all' } | null;

interface Props {
  confirm: Exclude<DiscardConfirm, null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function GitDiscardDialog({ confirm, open, onOpenChange, onConfirm }: Props) {
  const tc = useTranslations('common');
  const tChanges = useTranslations('git.changes');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{confirm.type === 'all' ? tChanges('discardAll') : tChanges('discard')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {confirm.type === 'all'
            ? tChanges('confirmDiscardAll')
            : tChanges('confirmDiscardFile', { file: confirm.path })}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc('cancel')}</Button>
          <Button variant="destructive" onClick={onConfirm}>{tChanges('discard')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
