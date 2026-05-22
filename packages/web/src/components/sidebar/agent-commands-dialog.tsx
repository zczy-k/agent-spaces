'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileUpload, type FileUploadFile } from '@/components/ui/file-upload';
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
  Save,
  Plus,
  Terminal,
  Upload,
  ChevronDown,
} from 'lucide-react';

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.default),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading editor...</div> },
);

interface AgentInfo {
  agentId: string;
  agentName: string;
  commandCount: number;
}

interface CommandItem {
  name: string;
  content: string;
  agentId: string;
  agentName?: string;
}

interface AgentCommandsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentCommandsDialog({ open, onOpenChange }: AgentCommandsDialogProps) {
  const t = useTranslations('agentCommands');
  const tc = useTranslations('common');

  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [importOpen, setImportOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<FileUploadFile[]>([]);

  const [editCommand, setEditCommand] = useState<CommandItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  const [agentPickerOpen, setAgentPickerOpen] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agent-commands/agents');
      if (res.ok) {
        const data: AgentInfo[] = await res.json();
        setAgents(data);
        if (data.length > 0 && !selectedAgentId) {
          setSelectedAgentId(data[0].agentId);
        }
      }
    } catch { /* ignore */ }
  }, [selectedAgentId]);

  const fetchCommands = useCallback(async () => {
    if (!selectedAgentId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/agent-commands/${selectedAgentId}`);
      if (res.ok) setCommands(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, [selectedAgentId]);

  useEffect(() => {
    if (open) fetchAgents();
  }, [open, fetchAgents]);

  useEffect(() => {
    if (open && selectedAgentId) fetchCommands();
  }, [open, selectedAgentId, fetchCommands]);

  const selectedAgent = agents.find((a) => a.agentId === selectedAgentId);

  const handleImport = async () => {
    if (uploadFiles.length === 0 || !selectedAgentId) return;

    if (uploadFiles.length === 1) {
      const content = await uploadFiles[0].file.text();
      const name = uploadFiles[0].file.name.replace(/\.(md|txt|markdown)$/i, '');
      setUploadFiles([]);
      setImportOpen(false);
      setEditCommand(null);
      setIsCreating(true);
      setEditName(name);
      setEditContent(content);
      return;
    }

    for (const item of uploadFiles) {
      const content = await item.file.text();
      const name = item.file.name.replace(/\.(md|txt|markdown)$/i, '');
      await fetch(`/api/agent-commands/${selectedAgentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content }),
      });
    }
    setUploadFiles([]);
    setImportOpen(false);
    fetchCommands();
  };

  const handleCreate = () => {
    setEditCommand(null);
    setIsCreating(true);
    setEditName('');
    setEditContent('');
  };

  const handleEdit = (cmd: CommandItem) => {
    setEditCommand(cmd);
    setIsCreating(false);
    setEditName(cmd.name);
    setEditContent(cmd.content);
  };

  const closeEditDialog = () => {
    setEditCommand(null);
    setIsCreating(false);
    setEditName('');
    setEditContent('');
  };

  const handleSave = async () => {
    if (!editName.trim() || !editContent.trim() || !selectedAgentId) return;
    setSaving(true);
    try {
      if (editCommand) {
        const res = await fetch(`/api/agent-commands/${selectedAgentId}/${editCommand.name}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editContent }),
        });
        if (res.ok) {
          const updated = await res.json();
          setCommands((prev) => prev.map((c) => c.name === updated.name ? updated : c));
          closeEditDialog();
        }
      } else {
        const res = await fetch(`/api/agent-commands/${selectedAgentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editName, content: editContent }),
        });
        if (res.ok) {
          const created = await res.json();
          setCommands((prev) => [...prev, created]);
          closeEditDialog();
        }
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (cmd: CommandItem) => {
    if (!selectedAgentId) return;
    try {
      const res = await fetch(`/api/agent-commands/${selectedAgentId}/${cmd.name}`, { method: 'DELETE' });
      if (res.ok) setCommands((prev) => prev.filter((c) => c.name !== cmd.name));
    } catch { /* ignore */ }
  };

  const filtered = commands.filter((cmd) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return cmd.name.toLowerCase().includes(q) || cmd.content.toLowerCase().includes(q);
  });

  const showMainView = open && !editCommand && !isCreating;

  const mainBody = (
    <>
      <DialogHeader>
        <div className="flex items-center justify-between pr-8">
          <div className="hidden md:block">
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="flex flex-1 min-h-0 gap-4 pt-2">
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search')}
                className="pl-8"
              />
            </div>

            <Popover open={agentPickerOpen} onOpenChange={setAgentPickerOpen}>
              <PopoverTrigger render={
                <Button variant="outline" size="sm" className="shrink-0 gap-1">
                  <Terminal className="size-3.5" />
                  <span className="max-w-[120px] truncate">{selectedAgent?.agentName || t('selectAgent')}</span>
                  <ChevronDown className="size-3" />
                </Button>
              } />
              <PopoverContent className="w-64 p-1" align="end">
                <ScrollArea className="max-h-60">
                  {agents.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">{t('noAgents')}</div>
                  ) : (
                    agents.map((agent) => (
                      <button
                        key={agent.agentId}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors ${
                          agent.agentId === selectedAgentId ? 'bg-accent' : ''
                        }`}
                        onClick={() => {
                          setSelectedAgentId(agent.agentId);
                          setAgentPickerOpen(false);
                        }}
                      >
                        <Terminal className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{agent.agentName}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{agent.commandCount}</span>
                      </button>
                    ))
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            <Popover open={importOpen} onOpenChange={setImportOpen}>
              <PopoverTrigger render={
                <Button variant="outline" size="sm">
                  <Upload className="size-3.5 mr-1" />
                  {t('import')}
                </Button>
              } />
              <PopoverContent className="w-80" align="end">
                <div className="space-y-3">
                  <p className="text-sm font-medium">{t('importTitle')}</p>
                  <FileUpload
                    value={uploadFiles}
                    onChange={setUploadFiles}
                    accept={{ 'text/markdown': ['.md', '.txt'], '': ['.md', '.txt'] }}
                    placeholder={t('importPlaceholder')}
                    maxFiles={10}
                  />
                  <Button
                    size="sm"
                    onClick={handleImport}
                    disabled={uploadFiles.length === 0 || !selectedAgentId}
                    className="w-full"
                  >
                    {t('importConfirm')}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={handleCreate} disabled={!selectedAgentId}>
              <Plus className="size-3.5 mr-1" />
              {t('create')}
            </Button>
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
                {filtered.map((cmd) => (
                  <div
                    key={cmd.name}
                    className="rounded-xl border border-border bg-background p-4 hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => handleEdit(cmd)}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Terminal className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm truncate">{cmd.name}</span>
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
                                onClick={() => handleDelete(cmd)}
                              >
                                <Trash2 className="size-3 mr-1.5" />
                                {t('delete')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {cmd.content.slice(0, 200).replace(/^#\s+/, '')}
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
      <Dialog open={showMainView} onOpenChange={onOpenChange}>
        <DialogContent className="!w-[80vw] !max-w-[80vw] !h-[80vh] flex flex-col">
          {mainBody}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editCommand || isCreating} onOpenChange={(v) => { if (!v) closeEditDialog(); }}>
        <DialogContent className="!w-[80vw] !max-w-[80vw] !h-[80vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between pr-8">
              <div>
                <DialogTitle>
                  {editCommand ? t('editTitle', { name: editCommand.name }) : t('createTitle')}
                </DialogTitle>
                <DialogDescription>{t('editDescription')}</DialogDescription>
              </div>
              <Button size="sm" onClick={handleSave} disabled={saving || !editName.trim() || !editContent.trim()}>
                <Save className="size-3.5 mr-1" />
                {tc('save')}
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-3 pb-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder={t('namePlaceholder')}
              disabled={!!editCommand}
            />
          </div>
          <div className="flex-1 min-h-0">
            <MonacoEditor
              height="100%"
              language="markdown"
              value={editContent}
              onChange={(value) => setEditContent(value || '')}
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
    </>
  );
}
