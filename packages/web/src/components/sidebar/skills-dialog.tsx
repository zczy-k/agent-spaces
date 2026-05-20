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
import type { SkillInfo, SkillSyncItem, SkillsDialogProps } from './skills-dialog/types';
import { useSkillsData, useSkillActions } from './skills-dialog/use-skills-data';
import { SkillList } from './skills-dialog/skill-list';
import { SkillEditDialog } from './skills-dialog/skill-edit-dialog';
import { SkillBindDialog } from './skills-dialog/skill-bind-dialog';
import { SkillSyncDialog } from './skills-dialog/skill-sync-dialog';

export function SkillsDialog({ open, onOpenChange, standalone }: SkillsDialogProps) {
  const t = useTranslations('skills');

  const { skills, setSkills, agents, loading, fetchSkills } = useSkillsData(open, standalone);
  const actions = useSkillActions(skills, setSkills, fetchSkills);

  const [editSkill, setEditSkill] = useState<SkillInfo | null>(null);
  const [editContent, setEditContent] = useState('');
  const [bindDialogSkill, setBindDialogSkill] = useState<SkillInfo | null>(null);
  const [bindSelected, setBindSelected] = useState<string[]>([]);
  const [syncItems, setSyncItems] = useState<SkillSyncItem[]>([]);
  const [syncSelected, setSyncSelected] = useState<Set<string>>(new Set());
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

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
      enabled: true,
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

  const handleSyncCheck = async () => {
    setSyncLoading(true);
    const items = await actions.syncCheck();
    if (items.length > 0) {
      setSyncItems(items);
      setSyncSelected(new Set(items.map((item) => `${item.agentId}::${item.skillName}`)));
      setSyncOpen(true);
    }
    setSyncLoading(false);
  };

  const handleSyncConfirm = async () => {
    const items = syncItems.filter((item) => syncSelected.has(`${item.agentId}::${item.skillName}`));
    if (items.length === 0) return;
    const ok = await actions.syncConfirm(items);
    if (ok) setSyncOpen(false);
  };

  const toggleSyncItem = (agentId: string, skillName: string) => {
    const key = `${agentId}::${skillName}`;
    setSyncSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const showMainDialog = (standalone || open) && !bindDialogSkill && !editSkill;

  const mainBody = (
    <SkillList
      skills={skills}
      agents={agents}
      loading={loading}
      syncLoading={syncLoading}
      title={standalone ? <h2 className="text-base font-semibold">{t('title')}</h2> : <DialogTitle>{t('title')}</DialogTitle>}
      description={standalone ? <p className="text-xs text-muted-foreground">{t('description')}</p> : <DialogDescription>{t('description')}</DialogDescription>}
      onToggleFavorite={actions.toggleFavorite}
      onToggleEnabled={actions.toggleEnabled}
      onToggleAllEnabled={actions.toggleAllEnabled}
      onDelete={actions.deleteSkill}
      onEdit={openEditDialog}
      onBind={openBindDialog}
      onImportBatch={actions.importBatch}
      onImportFromGit={actions.importFromGit}
      onSyncCheck={handleSyncCheck}
      onBindAll={openBindAllDialog}
    />
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

      <SkillSyncDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        items={syncItems}
        selected={syncSelected}
        onToggle={toggleSyncItem}
        onConfirm={handleSyncConfirm}
      />
    </>
  );
}
