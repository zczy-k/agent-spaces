import { Router } from 'express';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import * as llmStore from '../storage/llm-store.js';
import { importSkillsBatch } from '../services/skill.js';

const router = Router();

const CC_SWITCH_DIR = join(homedir(), '.cc-switch');
const CONFIG_FILE = join(CC_SWITCH_DIR, 'config.json.migrated');
const SKILLS_DIR = join(CC_SWITCH_DIR, 'skills');

interface CcSwitchProvider {
  id: string;
  name: string;
  settingsConfig: {
    env?: Record<string, string>;
  };
  websiteUrl?: string;
  category?: string;
}

interface CcSwitchConfig {
  claude?: { providers?: Record<string, CcSwitchProvider>; current?: string };
  codex?: { providers?: Record<string, CcSwitchProvider>; current?: string };
  gemini?: { providers?: Record<string, CcSwitchProvider>; current?: string };
}

interface PreviewProvider {
  sourceId: string;
  name: string;
  apiBase: string;
  apiKey: string;
  source: string; // claude | codex | gemini
  websiteUrl?: string;
  category?: string;
}

interface PreviewSkill {
  name: string;
  path: string;
  description: string;
}

function parseProviders(config: CcSwitchConfig): PreviewProvider[] {
  const results: PreviewProvider[] = [];

  const sections = ['claude', 'codex', 'gemini'] as const;
  const envMappings: Record<string, { base: string; key: string }> = {
    claude: { base: 'ANTHROPIC_BASE_URL', key: 'ANTHROPIC_AUTH_TOKEN' },
    codex: { base: 'CODEX_BASE_URL', key: 'OPENAI_API_KEY' },
    gemini: { base: 'GOOGLE_GEMINI_BASE_URL', key: 'GEMINI_API_KEY' },
  };

  for (const section of sections) {
    const providers = config[section]?.providers;
    if (!providers) continue;
    const { base: baseKey, key: apiKeyKey } = envMappings[section];

    for (const [id, p] of Object.entries(providers)) {
      const env = p.settingsConfig?.env || {};
      // codex uses config string, extract base_url from toml-like config
      let apiBase = env[baseKey] || '';
      let apiKey = env[apiKeyKey] || '';

      // codex: fallback to auth.OPENAI_API_KEY and parse base_url from config
      if (section === 'codex') {
        apiKey = apiKey || (p.settingsConfig as Record<string, Record<string, string>>)?.auth?.OPENAI_API_KEY || '';
        if (!apiBase) {
          const configStr = (p.settingsConfig as Record<string, string>)?.config || '';
          const match = configStr.match(/base_url\s*=\s*"([^"]+)"/);
          if (match) apiBase = match[1];
        }
      }

      // claude: also check ANTHROPIC_API_KEY
      if (section === 'claude') {
        apiKey = apiKey || env.ANTHROPIC_API_KEY || '';
      }

      if (!apiKey && !apiBase) continue; // skip providers with no credentials

      results.push({
        sourceId: id,
        name: p.name || id,
        apiBase,
        apiKey,
        source: section,
        websiteUrl: p.websiteUrl,
        category: p.category,
      });
    }
  }

  return results;
}

function parseSkills(): PreviewSkill[] {
  if (!existsSync(SKILLS_DIR)) return [];

  const results: PreviewSkill[] = [];
  const folders = readdirSync(SKILLS_DIR).filter(f => {
    const p = join(SKILLS_DIR, f);
    return statSync(p).isDirectory() && !f.startsWith('_');
  });

  for (const folder of folders) {
    const skillFile = join(SKILLS_DIR, folder, 'SKILL.md');
    if (!existsSync(skillFile)) continue;

    const content = readFileSync(skillFile, 'utf-8');
    // extract description from frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    let description = '';
    if (fmMatch) {
      const descMatch = fmMatch[1].match(/description:\s*["']?(.+?)["']?\s*$/m);
      if (descMatch) description = descMatch[1];
    }

    results.push({
      name: folder,
      path: skillFile,
      description,
    });
  }

  return results;
}

// GET /api/import/cc-switch/preview
router.get('/cc-switch/preview', (_req, res) => {
  if (!existsSync(CONFIG_FILE)) {
    res.json({ providers: [], skills: [], error: 'cc-switch config not found' });
    return;
  }

  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    const config: CcSwitchConfig = JSON.parse(raw);
    const providers = parseProviders(config);
    const skills = parseSkills();

    res.json({ providers, skills });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/import/cc-switch/execute
router.post('/cc-switch/execute', (req, res) => {
  const { providers: selectedProviders, skills: selectedSkills } = req.body as {
    providers?: PreviewProvider[];
    skills?: PreviewSkill[];
  };

  const results = { providers: [] as string[], skills: [] as string[] };

  // Import providers
  if (selectedProviders?.length) {
    for (const p of selectedProviders) {
      if (!p.name) continue;
      // skip if provider with same name already exists
      const existing = llmStore.listProviders().find(ep => ep.name === p.name);
      if (existing) {
        results.providers.push(`${p.name} (skipped: already exists)`);
        continue;
      }
      llmStore.createProvider({
        name: p.name,
        apiBase: p.apiBase || '',
        apiKey: p.apiKey || '',
      });
      results.providers.push(p.name);
    }
  }

  // Import skills
  if (selectedSkills?.length) {
    const items: Array<{ name: string; content: string }> = [];
    for (const s of selectedSkills) {
      const skillDir = join(SKILLS_DIR, s.name);
      // read SKILL.md
      const skillFile = join(skillDir, 'SKILL.md');
      if (!existsSync(skillFile)) continue;
      const content = readFileSync(skillFile, 'utf-8');
      items.push({ name: s.name, content });
    }
    if (items.length) {
      const imported = importSkillsBatch(items);
      results.skills = imported.map(s => s.name);
    }
  }

  res.json(results);
});

export default router;
