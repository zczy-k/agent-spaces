'use client';

import { useState, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  DialogHeader,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { AgentIcon } from '@/components/common/agent-icon';
import {
  Star,
  StarOff,
  Upload,
  Search,
  FileText,
  RefreshCw,
  Rocket,
  Trash2,
  MoreVertical,
  FolderOpen,
  FileArchive,
  Folder,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SkillImportPanel } from './skill-import-dialog';
import { SkillBindDialog } from './skill-bind-dialog';
import type { AgentCandidate, FilterMode, SkillInfo, ImportSkillItem } from './types';

interface SkillListProps {
  skills: SkillInfo[];
  agents: AgentCandidate[];
  loading: boolean;
  syncLoading: boolean;
  title: ReactNode;
  description: ReactNode;
  onToggleFavorite: (skill: SkillInfo) => void;
  onToggleEnabled: (skill: SkillInfo) => void;
  onToggleAllEnabled: (names: string[], enabled: boolean) => void;
  onDelete: (skill: SkillInfo) => void;
  onEdit: (skill: SkillInfo) => void;
  onBind: (skill: SkillInfo) => void;
  onImportBatch: (items: ImportSkillItem[]) => void;
  onSyncCheck: () => Promise<unknown>;
  onApplyAllToAgent: (agentId: string, skillNames: string[]) => Promise<void>;
}

export function SkillList({
  skills,
  agents,
  loading,
  syncLoading,
  title,
  description,
  onToggleFavorite,
  onToggleEnabled,
  onToggleAllEnabled,
  onDelete,
  onEdit,
  onBind,
  onImportBatch,
  onSyncCheck,
  onApplyAllToAgent,
}: SkillListProps) {
  const t = useTranslations('skills');
  const tc = useTranslations('common');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [filterAgentId, setFilterAgentId] = useState('');
  const [filterGroup, setFilterGroup] = useState('');

  const mdInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [importItems, setImportItems] = useState<ImportSkillItem[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importDefaultGroup, setImportDefaultGroup] = useState('');
  const [applyAllOpen, setApplyAllOpen] = useState(false);
  const [applyAllSelected, setApplyAllSelected] = useState<string[]>([]);
  const [applyAllLoading, setApplyAllLoading] = useState(false);

  // Extract unique groups
  const groups = Array.from(new Set(skills.map((s) => s.group).filter(Boolean)));

  const filtered = skills.filter((skill) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!skill.name.toLowerCase().includes(q) && !skill.content.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (filterMode === 'favorites' && !skill.favorited) return false;
    if (filterMode === 'agent' && filterAgentId) {
      if (!skill.boundAgents.some((a) => a.id === filterAgentId)) return false;
    }
    if (filterGroup) {
      if (filterGroup === '__none__') {
        if (skill.group) return false;
      } else if (skill.group !== filterGroup) return false;
    }
    return true;
  });

  const allEnabled = filtered.length > 0 && filtered.every((s) => s.enabled);

  const handleToggleAll = () => {
    onToggleAllEnabled(filtered.map((s) => s.name), !allEnabled);
  };

  // --- Import handlers ---

  const handleMdSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const items: ImportSkillItem[] = [];
    for (const file of Array.from(files)) {
      const content = await file.text();
      const name = file.name.replace(/\.md$/i, '');
      items.push({
        id: `md-${name}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        group: '',
        content,
        selected: true,
        sourceName: file.name,
      });
    }
    setImportItems(items);
    setImportDefaultGroup('');
    setImportDialogOpen(true);
    e.target.value = '';
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Group files by top-level folder
    const folderMap = new Map<string, File[]>();
    for (const file of Array.from(files)) {
      const parts = file.webkitRelativePath.split('/');
      const folderName = parts[0];
      if (!folderMap.has(folderName)) folderMap.set(folderName, []);
      folderMap.get(folderName)!.push(file);
    }

    const items: ImportSkillItem[] = [];
    for (const [folderName, folderFiles] of folderMap) {
      // Find SKILL.md or first .md file
      let skillFile = folderFiles.find((f) => f.name === 'SKILL.md');
      if (!skillFile) skillFile = folderFiles.find((f) => f.name.endsWith('.md'));
      if (!skillFile) continue;

      const content = await skillFile.text();
      const name = folderName;
      items.push({
        id: `folder-${name}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        group: '',
        content,
        selected: true,
        sourceName: folderName,
      });
    }
    setImportItems(items);
    setImportDefaultGroup('');
    setImportDialogOpen(true);
    e.target.value = '';
  };

  const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(file);
      const zipName = file.name.replace(/\.zip$/i, '');

      // Find skill entries: folders with SKILL.md or .md files
      const folderMap = new Map<string, { file: string; path: string }[]>();

      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;
        const fileName = relativePath.split('/').pop() || '';
        const folderPath = relativePath.substring(0, relativePath.lastIndexOf('/'));

        // Skip root-level files, only process files in subdirectories
        if (!folderPath) {
          // Root level .md file -> treat as its own folder
          if (fileName.endsWith('.md') && fileName !== 'SKILL.md') {
            const name = fileName.replace(/\.md$/i, '');
            if (!folderMap.has(name)) folderMap.set(name, []);
            folderMap.get(name)!.push({ file: fileName, path: relativePath });
          }
          return;
        }

        const topFolder = folderPath.split('/')[0];
        if (!folderMap.has(topFolder)) folderMap.set(topFolder, []);
        folderMap.get(topFolder)!.push({ file: fileName, path: relativePath });
      });

      const items: ImportSkillItem[] = [];
      for (const [folderName, entries] of folderMap) {
        // Find SKILL.md or first .md
        let skillEntry = entries.find((e) => e.file === 'SKILL.md');
        if (!skillEntry) skillEntry = entries.find((e) => e.file.endsWith('.md'));
        if (!skillEntry) continue;

        const content = await zip.file(skillEntry.path)!.async('string');
        items.push({
          id: `zip-${folderName}-${Math.random().toString(36).slice(2, 8)}`,
          name: folderName,
          group: zipName,
          content,
          selected: true,
          sourceName: folderName,
        });
      }

      setImportItems(items);
      setImportDefaultGroup(zipName);
      setImportDialogOpen(true);
    } catch (err) {
      console.error('Failed to extract ZIP:', err);
    }
    e.target.value = '';
  };

  const handleImportConfirm = (items: ImportSkillItem[]) => {
    onImportBatch(items);
    setImportDialogOpen(false);
    setImportItems([]);
  };

  const handleImportCancel = () => {
    setImportDialogOpen(false);
    setImportItems([]);
  };

  const handleApplyAllConfirm = async () => {
    if (applyAllSelected.length === 0) return;
    setApplyAllLoading(true);
    const skillNames = filtered.map((s) => s.name);
    for (const agentId of applyAllSelected) {
      await onApplyAllToAgent(agentId, skillNames);
    }
    setApplyAllLoading(false);
    setApplyAllOpen(false);
    setApplyAllSelected([]);
  };

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={mdInputRef}
        type="file"
        accept=".md"
        multiple
        className="hidden"
        onChange={handleMdSelect}
      />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        onChange={handleFolderSelect}
        // @ts-expect-error webkitdirectory is not in React types
        webkitdirectory=""
        directory=""
      />
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleZipSelect}
      />

      <DialogHeader>
        <div className="flex items-center justify-between pr-8">
          <div className="hidden md:block">
            {title}
            {description}
          </div>
          <div className="flex items-center gap-2 ml-auto shrink-0 pt-2">
            <Button variant="outline" size="sm" onClick={onSyncCheck} disabled={syncLoading}>
              <RefreshCw className={cn("size-3.5 mr-1", syncLoading && "animate-spin")} />
              {t('syncToAgents')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm">
                    <Upload className="size-3.5 mr-1" />
                    {t('import')}
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => mdInputRef.current?.click()}>
                  <FileText className="size-3.5 mr-1.5" />
                  {t('importFromMd')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => folderInputRef.current?.click()}>
                  <FolderOpen className="size-3.5 mr-1.5" />
                  {t('importFromFolder')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => zipInputRef.current?.click()}>
                  <FileArchive className="size-3.5 mr-1.5" />
                  {t('importFromZip')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </DialogHeader>

      {importDialogOpen ? (
        <SkillImportPanel
          items={importItems}
          onItemsChange={setImportItems}
          onConfirm={handleImportConfirm}
          onCancel={handleImportCancel}
          defaultGroup={importDefaultGroup}
        />
      ) : (
        <div className="flex flex-1 min-h-0 gap-4 pt-2">
        <ScrollArea className="hidden md:block w-44 shrink-0">
          <div className="flex flex-col gap-3 pr-2">
            <div className="space-y-1">
              <Button
                variant={filterMode === 'all' && !filterGroup ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => { setFilterMode('all'); setFilterAgentId(''); setFilterGroup(''); }}
              >
                <FileText className="size-3.5 mr-1.5" />
                {t('filterAll')}
              </Button>
              <Button
                variant={filterMode === 'favorites' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => { setFilterMode('favorites'); setFilterAgentId(''); setFilterGroup(''); }}
              >
                <Star className="size-3.5 mr-1.5" />
                {t('filterFavorites')}
              </Button>
            </div>

            {agents.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground px-2">{t('filterByAgent')}</p>
                {agents.map((agent) => (
                  <Button
                    key={agent.id}
                    variant={filterMode === 'agent' && filterAgentId === agent.id ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => { setFilterMode('agent'); setFilterAgentId(agent.id); setFilterGroup(''); }}
                  >
                    <AgentIcon agentId={agent.id} name={agent.name} avatarUrl={agent.avatarUrl} className="size-4 mr-1.5 rounded-full" />
                    <span className="truncate">{agent.name}</span>
                  </Button>
                ))}
              </div>
            )}

            {groups.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground px-2">{t('filterGroups')}</p>
                {groups.map((group) => (
                  <Button
                    key={group}
                    variant={filterGroup === group ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => { setFilterGroup(filterGroup === group ? '' : group); setFilterMode('all'); setFilterAgentId(''); }}
                  >
                    <Folder className="size-3.5 mr-1.5" />
                    <span className="truncate">{group}</span>
                  </Button>
                ))}
                {skills.some((s) => !s.group) && (
                  <Button
                    variant={filterGroup === '__none__' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => { setFilterGroup(filterGroup === '__none__' ? '' : '__none__'); setFilterMode('all'); setFilterAgentId(''); }}
                  >
                    <FileText className="size-3.5 mr-1.5" />
                    {t('filterNoGroup')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Right: Skill cards */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
          {/* Mobile: Top filters */}
          <div className="flex md:hidden flex-col gap-2">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search')}
                className="pl-8"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-input p-0.5">
                <button
                  type="button"
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    filterMode === 'all' && !filterGroup ? 'bg-muted' : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => { setFilterMode('all'); setFilterAgentId(''); setFilterGroup(''); }}
                >
                  {t('filterAll')}
                </button>
                <button
                  type="button"
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    filterMode === 'favorites' ? 'bg-muted' : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => { setFilterMode('favorites'); setFilterAgentId(''); setFilterGroup(''); }}
                >
                  <Star className="size-3 inline-block mr-0.5 -mt-px" />
                  {t('filterFavorites')}
                </button>
              </div>
            </div>
          </div>

          {/* Desktop: Search bar + toggle all */}
          <div className="hidden md:flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search')}
                className="pl-8"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <span>{t('toggleAll')}</span>
              <Switch
                size="sm"
                checked={allEnabled}
                onCheckedChange={handleToggleAll}
              />
              <span className="w-10 text-right">
                {filtered.filter((s) => s.enabled).length}/{filtered.length}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setApplyAllOpen(true); setApplyAllSelected([]); }}
              disabled={filtered.length === 0}
            >
              <Rocket className="size-3.5 mr-1" />
              {t('applyAllToAgent')}
            </Button>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                {tc('loading')}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                {t('empty')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 pr-2">
                {filtered.map((skill) => (
                  <div
                    key={skill.name}
                    className={cn(
                      "rounded-xl border border-border bg-background p-4 hover:bg-accent/30 transition-colors cursor-pointer",
                      !skill.enabled && "opacity-50",
                    )}
                    onClick={() => onEdit(skill)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm">{skill.name}</span>
                          {skill.group && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              {skill.group}
                            </span>
                          )}
                          <button
                            type="button"
                            className="flex items-center justify-center size-5 rounded hover:bg-accent"
                            onClick={(e) => { e.stopPropagation(); onToggleFavorite(skill); }}
                          >
                            {skill.favorited ? (
                              <Star className="size-3.5 text-yellow-500 fill-yellow-500" />
                            ) : (
                              <StarOff className="size-3.5 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {skill.description || skill.content.slice(0, 120).replace(/^#\s+/, '')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          size="sm"
                          checked={skill.enabled}
                          onCheckedChange={() => onToggleEnabled(skill)}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onBind(skill)}
                        >
                          <Rocket className="size-3.5 mr-1" />
                          {t('apply')}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon" className="size-7" />
                            }
                          >
                            <MoreVertical className="size-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => onDelete(skill)}
                            >
                              <Trash2 className="size-3.5 mr-1.5" />
                              {t('delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {skill.boundAgents.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border/50">
                        {skill.boundAgents.map((agent) => (
                          <AgentIcon
                            key={agent.id}
                            agentId={agent.id}
                            name={agent.name}
                            avatarUrl={agent.avatarUrl}
                            className="size-5 rounded-full"
                          />
                        ))}
                        <span className="text-xs text-muted-foreground ml-1">
                          {skill.boundAgents.length}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
      )}

      {/* Apply all to agent dialog */}
      <SkillBindDialog
        skill={applyAllOpen ? { name: t('applyAllToAgent'), description: '', filename: '', content: '', favorited: false, enabled: true, group: '', boundAgents: [] } as SkillInfo : null}
        agents={agents}
        selected={applyAllSelected}
        onToggle={(id) => setApplyAllSelected((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        )}
        onClose={() => { setApplyAllOpen(false); setApplyAllSelected([]); }}
        onConfirm={handleApplyAllConfirm}
      />
    </>
  );
}
