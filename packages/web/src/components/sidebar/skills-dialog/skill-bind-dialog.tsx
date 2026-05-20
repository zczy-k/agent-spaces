'use client';

import { useTranslations } from 'next-intl';
import { AgentPickerDialog } from '@/components/common/agent-picker-dialog';
import type { AgentCandidate, SkillInfo } from './types';

interface SkillBindDialogProps {
  skill: SkillInfo | null;
  titleOverride?: string;
  descriptionOverride?: string;
  agents: AgentCandidate[];
  selected: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function SkillBindDialog({ skill, titleOverride, descriptionOverride, agents, selected, onToggle, onClose, onConfirm }: SkillBindDialogProps) {
  const t = useTranslations('skills');
  const tc = useTranslations('common');

  return (
    <AgentPickerDialog
      open={!!skill}
      onClose={onClose}
      onConfirm={onConfirm}
      title={titleOverride || t('bindTitle', { name: skill?.name || '' })}
      description={descriptionOverride || t('bindDescription')}
      agents={agents}
      selected={selected}
      onToggle={onToggle}
      cancelText={tc('cancel')}
      confirmText={tc('confirm')}
    />
  );
}
