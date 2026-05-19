'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import '@/lib/monaco-loader';
import type { SkillInfo } from './types';

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.default),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading editor...</div> },
);

interface SkillEditDialogProps {
  skill: SkillInfo | null;
  content: string;
  onContentChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function SkillEditDialog({ skill, content, onContentChange, onClose, onSave }: SkillEditDialogProps) {
  const t = useTranslations('skills');
  const tc = useTranslations('common');

  return (
    <Dialog open={!!skill} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="!w-[80vw] !max-w-[80vw] !h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div>
              <DialogTitle>{t('editTitle', { name: skill?.name || '' })}</DialogTitle>
              <DialogDescription>{t('editDescription')}</DialogDescription>
            </div>
            <Button size="sm" onClick={onSave}>
              <Save className="size-3.5 mr-1" />
              {tc('save')}
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 pt-2">
          <MonacoEditor
            height="100%"
            language="markdown"
            value={content}
            onChange={(value) => onContentChange(value || '')}
            theme="vs-dark"
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 8 },
              renderLineHighlight: 'gutter',
              wordWrap: 'on',
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
