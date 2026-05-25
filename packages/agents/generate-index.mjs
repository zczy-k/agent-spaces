#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const agentsDir = new URL('.', import.meta.url).pathname;

function scanPromptStore() {
  const dir = join(agentsDir, 'prompt');
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  const index = files.map((filename) => {
    const id = basename(filename, '.md');
    const content = readFileSync(join(dir, filename), 'utf-8');
    const firstHeading = content.split('\n').find((l) => /^#\s+/.test(l));
    const name = firstHeading ? firstHeading.replace(/^#\s+/, '').trim() : id.replace(/[-_]/g, ' ');
    return { id, name, filename };
  });
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[prompt] ${index.length} templates`);
}

function scanOutputStyleStore() {
  const dir = join(agentsDir, 'output-styles');
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  const index = files.map((filename) => {
    const id = basename(filename, '.md');
    const content = readFileSync(join(dir, filename), 'utf-8');
    const firstHeading = content.split('\n').find((l) => /^#\s+/.test(l));
    const name = firstHeading ? firstHeading.replace(/^#\s+/, '').trim() : id.replace(/[-_]/g, ' ');
    return { id, name, filename };
  });
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[output-styles] ${index.length} templates`);
}

function scanSkillStore() {
  const dir = join(agentsDir, 'skills');
  if (!existsSync(dir)) return;
  const index = [];
  for (const groupEntry of readdirSync(dir, { withFileTypes: true })) {
    if (!groupEntry.isDirectory()) continue;
    const group = groupEntry.name;
    const groupDir = join(dir, group);
    for (const skillEntry of readdirSync(groupDir, { withFileTypes: true })) {
      if (!skillEntry.isDirectory()) continue;
      const skillName = skillEntry.name;
      const skillFile = join(groupDir, skillName, 'SKILL.md');
      if (!existsSync(skillFile)) continue;
      const content = readFileSync(skillFile, 'utf-8');
      const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      let name = skillName;
      if (fm) {
        const nameLine = fm[1].split(/\r?\n/).find((l) => /^\s*name\s*:/i.test(l));
        if (nameLine) name = nameLine.split(':', 2)[1].trim() || skillName;
      }
      index.push({ id: skillName, name, group, path: `${group}/${skillName}` });
    }
  }
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[skills] ${index.length} skills`);
}

scanPromptStore();
scanOutputStyleStore();
scanSkillStore();

function scanWorkflowStore() {
  const dir = join(agentsDir, 'workflows');
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json');
  const index = files.map((filename) => {
    const raw = readFileSync(join(dir, filename), 'utf-8');
    const data = JSON.parse(raw);
    return {
      id: data.id || basename(filename, '.json'),
      name: data.name || basename(filename, '.json'),
      description: data.description || '',
      filename,
      nodeCount: data.data?.nodes?.length || 0,
      agentCount: data.data?.agents ? Object.keys(data.data.agents).length : 0,
    };
  });
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[workflows] ${index.length} templates`);
}
scanWorkflowStore();
