'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { User, MessageSquare } from 'lucide-react';

interface MemberInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  channels?: string[];
}

export function MemberInfoDialog({ open, onOpenChange, memberName, channels = [] }: MemberInfoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>成员信息</DialogTitle>
          <DialogDescription />
        </DialogHeader>
        <div className="flex items-center gap-3 pt-2">
          <div className="flex items-center justify-center size-12 rounded-full bg-muted text-lg font-medium">
            {memberName[0]?.toUpperCase() || <User className="size-5 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{memberName}</p>
            <p className="text-xs text-muted-foreground">成员</p>
          </div>
        </div>
        {channels.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-muted-foreground">所在频道</p>
            <div className="flex flex-wrap gap-1.5">
              {channels.map((ch) => (
                <span key={ch} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs">
                  <MessageSquare className="size-3" />{ch}
                </span>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
