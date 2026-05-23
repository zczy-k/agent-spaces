'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Store,
  FileText,
  Download,
  Folder,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { SkillInfo, SkillsDialogProps, StoreSkillItem } from './skills-dialog/types';
import { useSkillsData, useSkillActions } from './skills-dialog/use-skills-data';
import { SkillList } from './skills-dialog/skill-list';
import { SkillEditDialog } from './skills-dialog/skill-edit-dialog';
import { SkillBindDialog } from './skills-dialog/skill-bind-dialog';

type TabType = 'local' | 'store';

export function SkillsDialog({ open, onOpenChange, standalone }: SkillsDialogProps) {
  const t = useTranslations('skills');
  const tc = useTranslations('common');

  const [activeTab, setActiveTab] = useState<TabType>('local');

  const { skills, setSkills, agents, loading, fetchSkills, storeSkills, storeLoading, importingPaths, importFromStore } = useSkillsData(open, standalone);
  const actions = useSkillActions(skills, setSkills, fetchSkills);

  const [editSkill, setEditSkill] = useState<SkillInfo | null>(null);
  const [editContent, setEditContent] = useState('');
  const [bindDialogSkill, setBindDialogSkill] = useState<SkillInfo | null>(null);
  const [bindSelected, setBindSelected] = useState<string[]>([]);

  // Store state
  const [storeGroupFilter, setStoreGroupFilter] = useState('');
  const [storeSearch, setStoreSearch] = useState('');

  const openEditDialog = (skill: SkillInfo) => {
    setEditSkill(skill);
    setEditContent(skill.content);
  };

  const openBindDialog = (skill: SkillInfo) => {
    setBindDialogSkill(skill);
    setBindSelected(skill.boundAgents.map((a) => a.id));
  };

  const BIND_ALL_KEY = '__bind_all__';
  const isBindAllMode = bindDialogSkill?.name === BIND_ALL_KEY;

  const openBindAllDialog = () => {
    setBindDialogSkill({
      name: BIND_ALL_KEY,
      description: '',
      filename: '',
      content: '',
      favorited: false,
      group: '',
      boundAgents: [],
    });
    setBindSelected([]);
  };

  const handleSaveEdit = async () => {
    if (!editSkill) return;
    const ok = await actions.saveEdit(editSkill.name, editContent);
    if (ok) setEditSkill(null);
  };

  const handleBindConfirm = async () => {
    if (!bindDialogSkill) return;
    if (isBindAllMode) {
      const skillNames = skills.map((s) => s.name);
      for (const agentId of bindSelected) {
        await actions.applyAllToAgent(agentId, skillNames);
      }
    } else {
      await actions.bindConfirm(bindDialogSkill, bindSelected, agents);
    }
    setBindDialogSkill(null);
  };

  const showMainDialog = (standalone || open) && !bindDialogSkill && !editSkill;

  // Store groups
  const storeGroups = Array.from(new Set(storeSkills.map((s) => s.group).filter(Boolean)));
  const localSkillNames = new Set(skills.map((s) => s.name));

  const filteredStoreSkills = storeSkills.filter((s) => {
    if (storeGroupFilter && s.group !== storeGroupFilter) return false;
    if (storeSearch) {
      const q = storeSearch.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q) && !s.group.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleStoreImport = async (skill: StoreSkillItem) => {
    await importFromStore(skill);
  };

  const tabs = (
    <div className="flex items-center gap-1 border-b border-border px-1">
      {([['local', FileText, t('tabLocal')], ['store', Store, t('tabStore')]] as const).map(([key, Icon, label]) => (
        <button
          key={key}
          onClick={() => setActiveTab(key)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === key
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  );

  const storeView = (
    <div className="flex flex-1 min-h-0 gap-4 pt-2">
      {storeGroups.length > 0 && (
        <ScrollArea className="hidden md:block w-44 shrink-0">
          <div className="flex flex-col gap-1 pr-2">
            <Button
              variant={!storeGroupFilter ? 'secondary' : 'ghost'}
              size="sm"
              className="w-full justify-start"
              onClick={() => setStoreGroupFilter('')}
            >
              <FileText className="size-3.5 mr-1.5" />
              {t('filterAll')}
            </Button>
            {storeGroups.map((group) => (
              <Button
                key={group}
                variant={storeGroupFilter === group ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start"
                onClick={() => setStoreGroupFilter(storeGroupFilter === group ? '' : group)}
              >
                <Folder className="size-3.5 mr-1.5" />
                <span className="truncate">{group}</span>
              </Button>
            ))}
          </div>
        </ScrollArea>
      )}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="relative mb-3">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={storeSearch}
            onChange={(e) => setStoreSearch(e.target.value)}
            placeholder={t('search')}
            className="pl-8"
          />
        </div>
        <ScrollArea className="flex-1">
          {storeLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              {tc('loading')}
            </div>
          ) : filteredStoreSkills.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              {t('storeEmpty')}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 pr-2">
              {filteredStoreSkills.map((skill) => {
                const isImported = localSkillNames.has(skill.id);
                const isImporting = importingPaths.has(skill.path);
                return (
                  <div
                    key={skill.path}
                    className="rounded-xl border border-border bg-background p-4 hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Store className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm">{skill.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {skill.group}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{skill.id}</p>
                      </div>
                      <Button
                        variant={isImported ? 'ghost' : 'outline'}
                        size="sm"
                        className="shrink-0"
                        disabled={isImported || isImporting}
                        onClick={() => handleStoreImport(skill)}
                      >
                        {isImported ? (
                          t('imported')
                        ) : isImporting ? (
                          t('importing')
                        ) : (
                          <>
                            <Download className="size-3.5 mr-1" />
                            {t('importTo')}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );

  const mainBody = (
    <>
      <DialogHeader>
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
      </DialogHeader>

      {tabs}

      <div className="flex flex-1 min-h-0 flex-col">
      {activeTab === 'local' ? (
        <SkillList
          skills={skills}
          agents={agents}
          loading={loading}
          onToggleFavorite={actions.toggleFavorite}
          onDelete={actions.deleteSkill}
          onEdit={openEditDialog}
          onBind={openBindDialog}
          onImportBatch={actions.importBatch}
          onImportFromGit={actions.importFromGit}
          onBindAll={openBindAllDialog}
        />
      ) : (
        storeView
      )}
      </div>
    </>
  );

  return (
    <>
      {standalone && showMainDialog && (
        <div className="h-full flex flex-col">
          {mainBody}
        </div>
      )}
      {!standalone && (
        <Dialog open={showMainDialog} onOpenChange={onOpenChange}>
          <DialogContent className="!w-[80vw] !max-w-[80vw] !h-[80vh] flex flex-col overflow-hidden">
            {mainBody}
          </DialogContent>
        </Dialog>
      )}

      <SkillEditDialog
        skill={editSkill}
        content={editContent}
        onContentChange={setEditContent}
        onClose={() => setEditSkill(null)}
        onSave={handleSaveEdit}
      />

      <SkillBindDialog
        skill={bindDialogSkill}
        titleOverride={isBindAllMode ? t('applyAllToAgent') : undefined}
        descriptionOverride={isBindAllMode ? t('applyAllToAgentDescription') : undefined}
        agents={agents}
        selected={bindSelected}
        onToggle={(id) => setBindSelected((prev) =>
          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        )}
        onClose={() => setBindDialogSkill(null)}
        onConfirm={handleBindConfirm}
      />
    </>
  );
}
