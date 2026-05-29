'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface SkillGitImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gitUrl: string;
  onGitUrlChange: (url: string) => void;
  loading: boolean;
  onImport: () => void;
}

export function SkillGitImportDialog({
  open,
  onOpenChange,
  gitUrl,
  onGitUrlChange,
  loading,
  onImport,
}: SkillGitImportDialogProps) {
  const t = useTranslations('skills');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('importFromGit')}</DialogTitle>
          <DialogDescription>{t('importFromGitDesc')}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input
            value={gitUrl}
            onChange={(e) => onGitUrlChange(e.target.value)}
            placeholder="https://github.com/user/skills-repo.git"
            onKeyDown={(e) => { if (e.key === 'Enter') onImport(); }}
            disabled={loading}
            autoFocus
          />
          <Button onClick={onImport} disabled={loading || !gitUrl.trim()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : t('import')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
