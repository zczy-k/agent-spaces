'use client';

import { useState, type ReactNode } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileUpload, type FileUploadFile } from '@/components/ui/file-upload';
import { SearchSelect } from '@/components/ui/search-select';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentCandidate, FilterMode, SkillInfo } from './types';

interface SkillListProps {
  skills: SkillInfo[];
  agents: AgentCandidate[];
  loading: boolean;
  syncLoading: boolean;
  title: ReactNode;
  description: ReactNode;
  onToggleFavorite: (skill: SkillInfo) => void;
  onDelete: (skill: SkillInfo) => void;
  onEdit: (skill: SkillInfo) => void;
  onBind: (skill: SkillInfo) => void;
  onImport: (files: { file: File }[], done: () => void) => void;
  onSyncCheck: () => Promise<unknown>;
}

export function SkillList({
  skills,
  agents,
  loading,
  syncLoading,
  title,
  description,
  onToggleFavorite,
  onDelete,
  onEdit,
  onBind,
  onImport,
  onSyncCheck,
}: SkillListProps) {
  const t = useTranslations('skills');
  const tc = useTranslations('common');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [filterAgentId, setFilterAgentId] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<FileUploadFile[]>([]);

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
    return true;
  });

  const handleImport = () => {
    onImport(uploadFiles, () => {
      setUploadFiles([]);
      setImportOpen(false);
    });
  };

  return (
    <>
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
                    accept={{ 'text/markdown': ['.md'], '': ['.md'] }}
                    placeholder={t('importPlaceholder')}
                    maxFiles={10}
                  />
                  <Button
                    size="sm"
                    onClick={handleImport}
                    disabled={uploadFiles.length === 0}
                    className="w-full"
                  >
                    {t('importConfirm')}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </DialogHeader>

      <div className="flex flex-1 min-h-0 gap-4 pt-2">
        {/* Desktop: Left sidebar filters */}
        <div className="hidden md:flex w-44 shrink-0 flex-col gap-3">
          <div className="space-y-1">
            <Button
              variant={filterMode === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              className="w-full justify-start"
              onClick={() => { setFilterMode('all'); setFilterAgentId(''); }}
            >
              <FileText className="size-3.5 mr-1.5" />
              {t('filterAll')}
            </Button>
            <Button
              variant={filterMode === 'favorites' ? 'secondary' : 'ghost'}
              size="sm"
              className="w-full justify-start"
              onClick={() => { setFilterMode('favorites'); setFilterAgentId(''); }}
            >
              <Star className="size-3.5 mr-1.5" />
              {t('filterFavorites')}
            </Button>
          </div>

          {agents.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground px-2">{t('filterByAgent')}</p>
              <ScrollArea className="max-h-48">
                {agents.map((agent) => (
                  <Button
                    key={agent.id}
                    variant={filterMode === 'agent' && filterAgentId === agent.id ? 'secondary' : 'ghost'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => { setFilterMode('agent'); setFilterAgentId(agent.id); }}
                  >
                    <AgentIcon agentId={agent.id} name={agent.name} avatarUrl={agent.avatarUrl} className="size-4 mr-1.5 rounded-full" />
                    <span className="truncate">{agent.name}</span>
                  </Button>
                ))}
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Right: Skill cards */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
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
                    filterMode === 'all' ? 'bg-muted' : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => { setFilterMode('all'); setFilterAgentId(''); }}
                >
                  {t('filterAll')}
                </button>
                <button
                  type="button"
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    filterMode === 'favorites' ? 'bg-muted' : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => { setFilterMode('favorites'); setFilterAgentId(''); }}
                >
                  <Star className="size-3 inline-block mr-0.5 -mt-px" />
                  {t('filterFavorites')}
                </button>
              </div>
              {agents.length > 0 && (
                <SearchSelect
                  value={filterMode === 'agent' ? filterAgentId : ''}
                  onChange={(v) => {
                    if (v) { setFilterMode('agent'); setFilterAgentId(v); }
                    else { setFilterMode('all'); setFilterAgentId(''); }
                  }}
                  options={agents.map((a) => ({ value: a.id, label: a.name }))}
                  placeholder={t('filterByAgent')}
                  allowCustom={false}
                  className="flex-1 min-w-0"
                />
              )}
            </div>
          </div>

          {/* Desktop: Search bar */}
          <div className="hidden md:block relative">
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
              <div className="grid grid-cols-1 gap-3 pr-2">
                {filtered.map((skill) => (
                  <div
                    key={skill.name}
                    className="rounded-xl border border-border bg-background p-4 hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => onEdit(skill)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm">{skill.name}</span>
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
    </>
  );
}
