'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Upload, FileText, FolderOpen, FileArchive, GitBranch } from 'lucide-react';
import { SkillImportPanel } from './skill-import-dialog';
import { SkillFilterSidebar } from './skill-filter-sidebar';
import { SkillCardGrid } from './skill-card-grid';
import { SkillGitImportDialog } from './skill-git-import-dialog';
import { useSkillImport } from './use-skill-import';
import type { AgentCandidate, FilterMode, SkillInfo, ImportSkillItem } from './types';

interface SkillListProps {
  skills: SkillInfo[];
  agents: AgentCandidate[];
  loading: boolean;
  onToggleFavorite: (skill: SkillInfo) => void;
  onDelete: (skill: SkillInfo) => void;
  onEdit: (skill: SkillInfo) => void;
  onBind: (skill: SkillInfo) => void;
  onImportBatch: (items: ImportSkillItem[]) => void;
  onImportFromGit: (url: string) => Promise<ImportSkillItem[] | null>;
  onBindAll: () => void;
}

export function SkillList({
  skills,
  agents,
  loading,
  onToggleFavorite,
  onDelete,
  onEdit,
  onBind,
  onImportBatch,
  onImportFromGit,
  onBindAll,
}: SkillListProps) {
  const t = useTranslations('skills');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [filterAgentId, setFilterAgentId] = useState('');
  const [filterGroup, setFilterGroup] = useState('');

  const importState = useSkillImport(onImportBatch, onImportFromGit);

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

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={importState.mdInputRef}
        type="file"
        accept=".md"
        multiple
        className="hidden"
        onChange={importState.handleMdSelect}
      />
      <input
        ref={importState.folderInputRef}
        type="file"
        className="hidden"
        onChange={importState.handleFolderSelect}
        // @ts-expect-error webkitdirectory is not in React types
        webkitdirectory=""
        directory=""
      />
      <input
        ref={importState.zipInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={importState.handleZipSelect}
      />

      <div className="flex items-center gap-2 ml-auto shrink-0 pt-2">
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
            <DropdownMenuItem onClick={() => importState.mdInputRef.current?.click()}>
              <FileText className="size-3.5 mr-1.5" />
              {t('importFromMd')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => importState.folderInputRef.current?.click()}>
              <FolderOpen className="size-3.5 mr-1.5" />
              {t('importFromFolder')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => importState.zipInputRef.current?.click()}>
              <FileArchive className="size-3.5 mr-1.5" />
              {t('importFromZip')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => importState.setGitDialogOpen(true)} disabled={importState.gitLoading}>
              <GitBranch className="size-3.5 mr-1.5" />
              {t('importFromGit')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {importState.importDialogOpen ? (
        <SkillImportPanel
          items={importState.importItems}
          onItemsChange={importState.setImportItems}
          onConfirm={importState.handleImportConfirm}
          onCancel={importState.handleImportCancel}
          defaultGroup={importState.importDefaultGroup}
        />
      ) : (
        <div className="flex flex-1 min-h-0 gap-4 pt-2">
          <SkillFilterSidebar
            agents={agents}
            groups={groups}
            hasUngrouped={skills.some((s) => !s.group)}
            filterMode={filterMode}
            filterAgentId={filterAgentId}
            filterGroup={filterGroup}
            onFilterChange={(mode, agentId, group) => {
              setFilterMode(mode);
              setFilterAgentId(agentId);
              setFilterGroup(group);
            }}
          />

          <SkillCardGrid
            skills={filtered}
            loading={loading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterMode={filterMode}
            filterGroup={filterGroup}
            onFilterModeChange={(mode, group) => {
              setFilterMode(mode);
              setFilterAgentId('');
              setFilterGroup(group);
            }}
            onToggleFavorite={onToggleFavorite}
            onDelete={onDelete}
            onEdit={onEdit}
            onBind={onBind}
            onBindAll={onBindAll}
          />
        </div>
      )}

      <SkillGitImportDialog
        open={importState.gitDialogOpen}
        onOpenChange={importState.setGitDialogOpen}
        gitUrl={importState.gitUrl}
        onGitUrlChange={importState.setGitUrl}
        loading={importState.gitLoading}
        onImport={importState.handleGitImport}
      />
    </>
  );
}
