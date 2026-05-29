import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('createPreset copies global folder skills into the agent template', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'agent-spaces-data-'));
  const previousDataDir = process.env.AGENT_SPACES_DATA_DIR;
  process.env.AGENT_SPACES_DATA_DIR = dataDir;

  try {
    mkdirSync(join(dataDir, 'skills', 'brainstorming'), { recursive: true });
    writeFileSync(
      join(dataDir, 'skills', 'brainstorming', 'SKILL.md'),
      '---\nname: brainstorming\ndescription: Brainstorm first.\n---\n\nSkill body.',
      'utf-8',
    );

    const agentService = await import(`../src/services/agent.ts?case=${Date.now()}`);
    const preset = agentService.createPreset('workspace-id', {
      name: 'test',
      skills: ['brainstorming'],
    });

    assert.ok(preset);
    const copied = readFileSync(
      join(dataDir, 'agent-templates', preset.id, 'skills', 'brainstorming', 'SKILL.md'),
      'utf-8',
    );
    assert.match(copied, /Skill body\./);
  } finally {
    if (previousDataDir === undefined) delete process.env.AGENT_SPACES_DATA_DIR;
    else process.env.AGENT_SPACES_DATA_DIR = previousDataDir;
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('getAvailableSkillNames falls back to global skills when agent copy is empty', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'agent-spaces-data-'));
  const agentDir = mkdtempSync(join(tmpdir(), 'agent-dir-'));
  const previousDataDir = process.env.AGENT_SPACES_DATA_DIR;
  process.env.AGENT_SPACES_DATA_DIR = dataDir;

  try {
    mkdirSync(join(dataDir, 'skills', 'brainstorming'), { recursive: true });
    writeFileSync(join(dataDir, 'skills', 'brainstorming', 'SKILL.md'), 'Skill body.', 'utf-8');
    mkdirSync(join(agentDir, 'skills'), { recursive: true });
    writeFileSync(join(agentDir, 'skills', 'brainstorming.md'), '', 'utf-8');

    const agentService = await import(`../src/services/agent.ts?case=${Date.now()}-fallback`);

    assert.deepEqual(agentService.getAvailableSkillNames(agentDir, ['brainstorming']), ['brainstorming']);
  } finally {
    if (previousDataDir === undefined) delete process.env.AGENT_SPACES_DATA_DIR;
    else process.env.AGENT_SPACES_DATA_DIR = previousDataDir;
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(agentDir, { recursive: true, force: true });
  }
});
