#!/usr/bin/env node
import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const agentsDir = fileURLToPath(new URL('.', import.meta.url));

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

function scanMcpStore() {
  const dir = join(agentsDir, 'mcps');
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json');
  const index = files.map((filename) => {
    const id = basename(filename, '.json');
    const raw = readFileSync(join(dir, filename), 'utf-8');
    const data = JSON.parse(raw);
    const servers = data.mcpServers || data;
    const serverName = Object.keys(servers)[0] || id;
    const config = servers[serverName] || {};
    const envKeys = config.env ? Object.keys(config.env).filter((k) => !config.env[k]) : [];
    return {
      id,
      name: serverName,
      description: config.command ? `${config.command} ${(config.args || []).join(' ')}` : '',
      filename,
      needsEnv: envKeys.length > 0 ? envKeys : undefined,
    };
  });
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[mcps] ${index.length} templates`);
}
function scanAgentStore() {
  const dir = join(agentsDir, 'agents');
  if (!existsSync(dir)) return;
  const index = [];
  for (const groupEntry of readdirSync(dir, { withFileTypes: true })) {
    if (!groupEntry.isDirectory()) continue;
    const group = groupEntry.name;
    const groupDir = join(dir, group);
    for (const file of readdirSync(groupDir)) {
      if (!file.endsWith('.md')) continue;
      const id = basename(file, '.md');
      const content = readFileSync(join(groupDir, file), 'utf-8');
      const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      let name = id.replace(/[-_]/g, ' ');
      let description = '';
      let emoji = '';
      if (fm) {
        for (const line of fm[1].split(/\r?\n/)) {
          const m = line.match(/^\s*(\w+)\s*:\s*(.+)/);
          if (!m) continue;
          const [, key, val] = m;
          if (key === 'name') name = val.trim();
          else if (key === 'description') description = val.trim();
          else if (key === 'emoji') emoji = val.trim();
        }
      }
      index.push({ id, name, group, path: `${group}/${id}`, description, emoji });
    }
  }
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[agents] ${index.length} agents`);
}

function scanPluginStore() {
  const dir = join(agentsDir, 'plugins');
  if (!existsSync(dir)) return;
  const remoteIndexPath = join(dir, 'plugins.json');
  const remoteItems = existsSync(remoteIndexPath)
    ? JSON.parse(readFileSync(remoteIndexPath, 'utf-8'))
    : [];
  const remoteByDir = new Map(
    (Array.isArray(remoteItems) ? remoteItems : [])
      .filter(item => item && typeof item === 'object')
      .map(item => {
        const manifestPath = typeof item.manifestUrl === 'string' ? item.manifestUrl.split('/')[0] : '';
        const downloadPath = typeof item.downloadUrl === 'string' ? item.downloadUrl.replace(/\.zip$/i, '') : '';
        return [manifestPath || downloadPath || item.id, item];
      }),
  );
  const index = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pluginDir = join(dir, entry.name);
    const manifestFile = ['plugin.json', 'manifest.json', 'info.json', 'web-plugin.json', 'package.json']
      .find(filename => existsSync(join(pluginDir, filename)));
    const localManifest = manifestFile ? JSON.parse(readFileSync(join(pluginDir, manifestFile), 'utf-8')) : {};
    const remoteManifest = remoteByDir.get(entry.name) || {};
    const data = { ...remoteManifest, ...localManifest };
    const id = data.id || entry.name;
    index.push({
      id,
      name: data.name || id,
      version: data.version || '0.0.0',
      description: data.description || '',
      author: data.author || { name: 'Unknown' },
      tags: Array.isArray(data.tags) ? data.tags : [],
      type: data.type,
      hasView: Boolean(data.hasView),
      hasWorkflow: Boolean(data.hasWorkflow || data.workflowNodes || data.entries?.workflow),
      path: entry.name,
      iconUrl: data.iconUrl || data.iconPath || (data.icon ? `plugins/${entry.name}/${data.icon}` : undefined),
    });
  }
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[plugins] ${index.length} plugins`);
}

scanAgentStore();

function scanChatStore() {
  const dir = join(agentsDir, 'chat');
  if (!existsSync(dir)) return;
  const index = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const id = basename(file, '.md');
    const content = readFileSync(join(dir, file), 'utf-8');
    const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    let name = id.replace(/[-_]/g, ' ');
    let description = '';
    let emoji = '';
    if (fm) {
      for (const line of fm[1].split(/\r?\n/)) {
        const m = line.match(/^\s*(\w+)\s*:\s*(.+)/);
        if (!m) continue;
        const [, key, val] = m;
        if (key === 'name') name = val.trim();
        else if (key === 'description') description = val.trim();
        else if (key === 'emoji') emoji = val.trim();
      }
    }
    index.push({ id, name, group: 'chat', path: id, description, emoji });
  }
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[chat] ${index.length} agents`);
}
scanChatStore();

scanMcpStore();
scanPluginStore();

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

function scanWorkflowUiStore() {
  const dir = join(agentsDir, 'workflow-ui');
  if (!existsSync(dir)) return;
  const index = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const templateDir = join(dir, entry.name);
    const manifestFile = join(templateDir, 'manifest.json');
    let name = entry.name.replace(/[-_]/g, ' ');
    let icon;
    if (existsSync(manifestFile)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestFile, 'utf-8'));
        name = manifest.name || name;
        icon = manifest.icon;
      } catch { /* ignore */ }
    }
    const zipFilename = `${entry.name}.zip`;
    const zipPath = join(dir, zipFilename);
    // (Re)generate zip from directory
    if (existsSync(zipPath)) unlinkSync(zipPath);
    try {
      execSync(`cd "${templateDir}" && zip -r "${zipPath}" .`, { stdio: 'pipe' });
    } catch { /* ignore zip errors */ }
    index.push({ id: entry.name, name, filename: zipFilename, icon });
  }
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[workflow-ui] ${index.length} templates`);
}
scanWorkflowUiStore();
