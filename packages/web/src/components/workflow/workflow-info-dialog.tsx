'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { AvatarUploader } from '@/components/common/avatar-uploader';
import type { Workflow } from '@agent-spaces/shared';

interface WorkflowInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow: Workflow | null;
  onSave: (updates: Partial<Workflow>) => void;
}

export function WorkflowInfoDialog({ open, onOpenChange, workflow, onSave }: WorkflowInfoDialogProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (workflow) {
      setName(workflow.name || '');
      setIcon(workflow.icon || '');
      setAvatarUrl('');
      setDescription(workflow.description || '');
      setTags(workflow.tags || []);
    }
  }, [workflow, open]);

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSave = () => {
    onSave({
      name: name.trim() || '未命名',
      icon: icon || undefined,
      description: description.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>工作流信息</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex justify-center">
            <AvatarUploader
              name={name}
              avatarUrl={avatarUrl}
              icon={icon}
              onAvatarUrlChange={setAvatarUrl}
              onIconChange={setIcon}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">标题</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入工作流标题"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">注释</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述工作流的用途..."
              className="text-sm min-h-[60px] resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">标签</label>
            <div className="flex gap-1.5">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="输入标签后回车"
                className="h-8 text-sm flex-1"
              />
              <Button variant="outline" size="sm" className="h-8" onClick={handleAddTag} disabled={!tagInput.trim()}>
                添加
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs gap-1 pr-1">
                    {tag}
                    <button className="hover:text-destructive cursor-pointer" onClick={() => handleRemoveTag(tag)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave}>保存</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
