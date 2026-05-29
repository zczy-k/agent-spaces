import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { clearSkills, getSkill } from '@codeany/open-agent-sdk';
import { registerConfiguredSkills } from '../src/adapters/open-agent-sdk-runtime.js';

test('registerConfiguredSkills loads folder skills from agent config', async () => {
  clearSkills();
  const agentDir = mkdtempSync(join(tmpdir(), 'agent-skills-'));
  try {
    mkdirSync(join(agentDir, 'skills', 'brainstorming'), { recursive: true });
    writeFileSync(
      join(agentDir, 'skills', 'brainstorming', 'SKILL.md'),
      [
        '---',
        'name: brainstorming',
        'description: Explore requirements before implementation.',
        '---',
        '',
        'Ask clarifying questions and produce a design.',
      ].join('\n'),
      'utf-8',
    );

    const registered = registerConfiguredSkills(agentDir, ['brainstorming']);
    const skill = getSkill('brainstorming');

    assert.deepEqual(registered, ['brainstorming']);
    assert.ok(skill);
    assert.equal(skill.description, 'Explore requirements before implementation.');
    assert.deepEqual(await skill.getPrompt('', {} as never), [
      { type: 'text', text: 'Ask clarifying questions and produce a design.' },
    ]);
  } finally {
    rmSync(agentDir, { recursive: true, force: true });
    clearSkills();
  }
});
