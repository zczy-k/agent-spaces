'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  MoreVertical,
  Trash2,
  Plus,
  Pencil,
} from 'lucide-react';

interface OutputStyleTemplate {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface OutputStylesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  standalone?: boolean;
}

export function OutputStylesDialog({ open, onOpenChange, standalone }: OutputStylesDialogProps) {
  const t = useTranslations('outputStyles');
  const tc = useTranslations('common');

  const [templates, setTemplates] = useState<OutputStyleTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Create/Edit state
  const [editTemplate, setEditTemplate] = useState<OutputStyleTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/output-styles');
      if (res.ok) setTemplates(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open || standalone) fetchTemplates();
  }, [open, standalone, fetchTemplates]);

  const handleCreate = () => {
    setEditTemplate(null);
    setIsCreating(true);
    setEditName('');
    setEditContent('');
  };

  const handleEdit = (tmpl: OutputStyleTemplate) => {
    setEditTemplate(tmpl);
    setIsCreating(false);
    setEditName(tmpl.name);
    setEditContent(tmpl.content);
  };

  const closeEdit = () => {
    setEditTemplate(null);
    setIsCreating(false);
    setEditName('');
    setEditContent('');
  };

  const handleSave = async () => {
    if (!editName.trim() || !editContent.trim()) return;
    setSaving(true);
    try {
      const url = editTemplate ? `/api/output-styles/${editTemplate.id}` : '/api/output-styles';
      const method = editTemplate ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, content: editContent }),
      });
      if (res.ok) {
        const saved = await res.json();
        setTemplates((prev) =>
          editTemplate
            ? prev.map((t) => (t.id === saved.id ? saved : t))
            : [...prev, saved]
        );
        closeEdit();
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (tmpl: OutputStyleTemplate) => {
    try {
      const res = await fetch(`/api/output-styles/${tmpl.id}`, { method: 'DELETE' });
      if (res.ok) setTemplates((prev) => prev.filter((t) => t.id !== tmpl.id));
    } catch { /* ignore */ }
  };

  const filtered = templates.filter((tmpl) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return tmpl.name.toLowerCase().includes(q) || tmpl.content.toLowerCase().includes(q);
  });

  const showMainView = (standalone || open) && !editTemplate && !isCreating;

  const mainBody = (
    <>
      <DialogHeader>
        <div className="flex items-center justify-between pr-8">
          <div className="hidden md:block">
            {standalone
              ? <h2 className="text-base font-semibold">{t('title')}</h2>
              : <DialogTitle>{t('title')}</DialogTitle>
            }
            {standalone
              ? <p className="text-xs text-muted-foreground">{t('description')}</p>
              : <DialogDescription>{t('description')}</DialogDescription>
            }
          </div>
          <div className="flex items-center gap-2 ml-auto shrink-0 pt-2">
            <Button variant="outline" size="sm" onClick={handleCreate}>
              <Plus className="size-3.5 mr-1" />
              {t('create')}
            </Button>
          </div>
        </div>
      </DialogHeader>

      <div className="flex flex-1 min-h-0 gap-4 pt-2">
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search')}
              className="pl-8"
            />
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                {tc('loading')}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                {t('empty')}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pr-2">
                {filtered.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="rounded-xl border border-border bg-background p-4 hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => handleEdit(tmpl)}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Pencil className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate">{tmpl.name}</span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="icon" className="size-6" />}
                            >
                              <MoreVertical className="size-3" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDelete(tmpl)}
                              >
                                <Trash2 className="size-3 mr-1.5" />
                                {t('delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {tmpl.content.slice(0, 200)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Main view */}
      {standalone && showMainView && (
        <div className="h-full flex flex-col">
          {mainBody}
        </div>
      )}
      {!standalone && (
        <Dialog open={showMainView} onOpenChange={onOpenChange}>
          <DialogContent className="!w-[80vw] !max-w-[80vw] !h-[80vh] flex flex-col">
            {mainBody}
          </DialogContent>
        </Dialog>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={!!editTemplate || isCreating} onOpenChange={(v) => { if (!v) closeEdit(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editTemplate ? t('editTitle', { name: editTemplate.name }) : t('createTitle')}
            </DialogTitle>
            <DialogDescription>{t('editDescription')}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 space-y-3 overflow-y-auto">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder={t('namePlaceholder')}
            />
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder={t('contentPlaceholder')}
              className="min-h-48 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeEdit} disabled={saving}>
              {tc('cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving || !editName.trim() || !editContent.trim()}>
              {saving ? tc('saving') : tc('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
