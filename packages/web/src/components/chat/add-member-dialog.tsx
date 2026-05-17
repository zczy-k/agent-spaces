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
import { UserPlus } from 'lucide-react';
import { MemberPicker } from '@/components/common/member-picker';

import type { MemberCandidate } from '@/components/common/member-picker';

export type { MemberCandidate as AddMemberCandidate };

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: MemberCandidate[];
  defaultSelected?: string[];
  onAdd: (members: string[]) => void;
  /** 过滤候选成员，默认只展示 agent 类型 */
  filter?: (candidate: MemberCandidate) => boolean;
}

export function AddMemberDialog({ open, onOpenChange, candidates, defaultSelected, onAdd, filter }: AddMemberDialogProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [dialogKey, setDialogKey] = useState(0);

  // Track whether we've initialized for this open cycle
  const [initialized, setInitialized] = useState(false);

  // When dialog opens, reset selected to defaultSelected
  if (open && !initialized) {
    setSelected(defaultSelected ?? []);
    setInitialized(true);
  }

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const handleConfirm = () => {
    if (selected.length === 0) return;
    onAdd(selected);
    handleClose(false);
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      setSelected([]);
      setInitialized(false);
      setDialogKey((k) => k + 1);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>管理成员</DialogTitle>
          <DialogDescription>选择或取消选择频道成员</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <MemberPicker
            key={dialogKey}
            candidates={candidates}
            filter={filter}
            selected={selected}
            onToggle={toggle}
            searchPlaceholder="搜索成员..."
            emptyText="无可用成员"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => handleClose(false)}>取消</Button>
            <Button onClick={handleConfirm} disabled={selected.length === 0}>
              <UserPlus className="size-3.5 mr-1" />确认 ({selected.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
