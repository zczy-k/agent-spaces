'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AgentCandidate, ImportSkillItem, SkillInfo, SkillSyncItem, StoreSkillItem } from './types';

export function useSkillsData(open: boolean, standalone?: boolean) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [agents, setAgents] = useState<AgentCandidate[]>([]);
  const [loading, setLoading] = useState(false);

  // Store state
  const [storeSkills, setStoreSkills] = useState<StoreSkillItem[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [importingPaths, setImportingPaths] = useState<Set<string>>(new Set());

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/skills');
      if (res.ok) {
        setSkills(await res.json());
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/presets');
      if (res.ok) {
        const data = await res.json();
        setAgents(data.map((a: AgentCandidate) => ({
          id: a.id,
          name: a.name,
          avatarUrl: a.avatarUrl,
          description: a.description,
        })));
      }
    } catch { /* ignore */ }
  }, []);

  const fetchStoreSkills = useCallback(async () => {
    setStoreLoading(true);
    try {
      const res = await fetch('/public/skills/index.json');
      if (res.ok) setStoreSkills(await res.json());
    } catch { /* ignore */ }
    setStoreLoading(false);
  }, []);

  useEffect(() => {
    if (open || standalone) {
      fetchSkills();
      fetchAgents();
      fetchStoreSkills();
    }
  }, [open, standalone, fetchSkills, fetchAgents, fetchStoreSkills]);

  // Local skill names for dedup
  const localSkillNames = new Set(skills.map((s) => s.name));

  const importFromStore = async (storeSkill: StoreSkillItem) => {
    if (localSkillNames.has(storeSkill.id) || importingPaths.has(storeSkill.path)) return false;
    setImportingPaths((prev) => new Set(prev).add(storeSkill.path));
    try {
      const res = await fetch('/api/skills/import-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: storeSkill.path, group: storeSkill.group }),
      });
      if (res.ok) {
        await fetchSkills();
        return true;
      }
    } catch { /* ignore */ }
    setImportingPaths((prev) => {
      const next = new Set(prev);
      next.delete(storeSkill.path);
      return next;
    });
    return false;
  };

  return { skills, setSkills, agents, loading, fetchSkills, storeSkills, storeLoading, importingPaths, importFromStore };
}

export function useSkillActions(skills: SkillInfo[], setSkills: (fn: (prev: SkillInfo[]) => SkillInfo[]) => void, fetchSkills: () => Promise<void>) {
  const toggleFavorite = async (skill: SkillInfo) => {
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skill.name)}/favorite`, { method: 'POST' });
      if (res.ok) {
        const { favorited } = await res.json();
        setSkills((prev) =>
          prev.map((s) => s.name === skill.name ? { ...s, favorited } : s),
        );
      }
    } catch { /* ignore */ }
  };

  const toggleEnabled = async (skill: SkillInfo) => {
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skill.name)}/toggle`, { method: 'POST' });
      if (res.ok) {
        const { enabled } = await res.json();
        setSkills((prev) =>
          prev.map((s) => s.name === skill.name ? { ...s, enabled } : s),
        );
      }
    } catch { /* ignore */ }
  };

  const toggleAllEnabled = async (names: string[], enabled: boolean) => {
    try {
      const res = await fetch('/api/skills/toggle-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names, enabled }),
      });
      if (res.ok) {
        setSkills((prev) =>
          prev.map((s) => names.includes(s.name) ? { ...s, enabled } : s),
        );
      }
    } catch { /* ignore */ }
  };

  const deleteSkill = async (skill: SkillInfo) => {
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skill.name)}`, { method: 'DELETE' });
      if (res.ok) {
        setSkills((prev) => prev.filter((s) => s.name !== skill.name));
      }
    } catch { /* ignore */ }
  };

  const saveEdit = async (name: string, content: string) => {
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setSkills((prev) =>
          prev.map((s) => s.name === name ? { ...s, content } : s),
        );
        return true;
      }
    } catch { /* ignore */ }
    return false;
  };

  const importBatch = async (items: ImportSkillItem[]) => {
    const batchItems = items.map((item) => ({
      name: item.name,
      content: item.content,
      group: item.group,
    }));
    try {
      const res = await fetch('/api/skills/import-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batchItems }),
      });
      if (res.ok) {
        fetchSkills();
      }
    } catch { /* ignore */ }
  };

  const importFromGit = async (url: string): Promise<ImportSkillItem[] | null> => {
    try {
      const res = await fetch('/api/skills/import-git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) return null;
      const skills: Array<{ name: string; content: string }> = await res.json();
      return skills.map((s) => ({
        id: `git-${s.name}-${Math.random().toString(36).slice(2, 8)}`,
        name: s.name,
        group: '',
        content: s.content,
        selected: true,
        sourceName: s.name,
      }));
    } catch { /* ignore */ }
    return null;
  };

  const bindConfirm = async (skill: SkillInfo, bindSelected: string[], agents: { id: string }[]) => {
    for (const agent of agents) {
      const wasBound = skill.boundAgents.some((a) => a.id === agent.id);
      const shouldBeBound = bindSelected.includes(agent.id);

      if (wasBound && !shouldBeBound) {
        const res = await fetch(`/api/agents/presets/${agent.id}`);
        if (!res.ok) continue;
        const preset = await res.json();
        const updatedSkills = (preset.skills || []).filter(
          (s: string) => s.replace(/\.md$/i, '') !== skill.name,
        );
        await fetch(`/api/agents/presets/${agent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...preset, skills: updatedSkills }),
        });
      } else if (!wasBound && shouldBeBound) {
        const res = await fetch(`/api/agents/presets/${agent.id}`);
        if (!res.ok) continue;
        const preset = await res.json();
        const existing = (preset.skills || []).map((s: string) => s.replace(/\.md$/i, ''));
        if (!existing.includes(skill.name)) {
          const updatedSkills = [...(preset.skills || []), skill.name];
          await fetch(`/api/agents/presets/${agent.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...preset, skills: updatedSkills }),
          });
        }
      }
    }
    fetchSkills();
  };

  const syncCheck = async (): Promise<SkillSyncItem[]> => {
    const res = await fetch('/api/skills/sync-check');
    if (res.ok) return res.json();
    return [];
  };

  const syncConfirm = async (items: SkillSyncItem[]) => {
    const res = await fetch('/api/skills/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map((i) => ({ agentId: i.agentId, skillName: i.skillName })) }),
    });
    if (res.ok) fetchSkills();
    return res.ok;
  };

  const applyAllToAgent = async (agentId: string, skillNames: string[]) => {
    try {
      const res = await fetch(`/api/agents/presets/${agentId}`);
      if (!res.ok) return;
      const preset = await res.json();
      const existing = new Set((preset.skills || []).map((s: string) => s.replace(/\.md$/i, '')));
      const updatedSkills = [...(preset.skills || [])];
      for (const name of skillNames) {
        if (!existing.has(name)) {
          updatedSkills.push(name);
        }
      }
      await fetch(`/api/agents/presets/${agentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...preset, skills: updatedSkills }),
      });
      fetchSkills();
    } catch { /* ignore */ }
  };

  return { toggleFavorite, toggleEnabled, toggleAllEnabled, deleteSkill, saveEdit, importBatch, importFromGit, bindConfirm, applyAllToAgent, syncCheck, syncConfirm };
}
