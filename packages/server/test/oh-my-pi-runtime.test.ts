import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { OhMyPiRuntime } from '../src/adapters/oh-my-pi-runtime.js';

test('OhMyPiRuntime copies configured skills into the isolated OMP agent dir', async () => {
  const root = mkdtempSync(join(tmpdir(), 'omp-runtime-'));
  const binDir = join(root, 'bin');
  const configDir = join(root, 'agent-config');
  const previousPath = process.env.PATH;

  try {
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, 'omp'), '#!/bin/sh\nprintf "ok\\n"\n', 'utf-8');
    chmodSync(join(binDir, 'omp'), 0o755);
    process.env.PATH = `${binDir}:${previousPath ?? ''}`;

    mkdirSync(join(configDir, 'skills', 'brainstorming'), { recursive: true });
    writeFileSync(join(configDir, 'skills', 'brainstorming', 'SKILL.md'), 'Brainstorm skill body.', 'utf-8');
    writeFileSync(join(configDir, 'skills', 'legacy.md'), 'Legacy skill body.', 'utf-8');

    const runtime = new OhMyPiRuntime();
    const result = await runtime.execute('hello', root, {
      configDir,
      skills: ['brainstorming', 'legacy'],
    });

    assert.equal(result.success, true);
    assert.equal(
      readFileSync(join(configDir, 'omp-home', '.omp', 'agent', 'skills', 'brainstorming', 'SKILL.md'), 'utf-8'),
      'Brainstorm skill body.',
    );
    assert.equal(
      readFileSync(join(configDir, 'omp-home', '.omp', 'agent', 'skills', 'legacy', 'SKILL.md'), 'utf-8'),
      'Legacy skill body.',
    );
    assert.equal(existsSync(join(configDir, 'omp-home', '.omp', 'agent', 'skills', 'legacy.md')), true);
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    rmSync(root, { recursive: true, force: true });
  }
});

test('OhMyPiRuntime falls back from empty agent skill placeholders to built-in skill store', async () => {
  const root = mkdtempSync(join(tmpdir(), 'omp-runtime-'));
  const binDir = join(root, 'bin');
  const configDir = join(root, 'agent-config');
  const envFile = join(root, 'env.txt');
  const previousPath = process.env.PATH;

  try {
    mkdirSync(binDir, { recursive: true });
    writeFileSync(
      join(binDir, 'omp'),
      `#!/bin/sh\nprintf "%s\\n" "$PI_CODING_AGENT_DIR" > ${JSON.stringify(envFile)}\nprintf "ok\\n"\n`,
      'utf-8',
    );
    chmodSync(join(binDir, 'omp'), 0o755);
    process.env.PATH = `${binDir}:${previousPath ?? ''}`;

    mkdirSync(join(configDir, 'skills'), { recursive: true });
    writeFileSync(join(configDir, 'skills', 'brainstorming.md'), '', 'utf-8');

    const runtime = new OhMyPiRuntime();
    const result = await runtime.execute('hello', root, {
      configDir,
      skills: ['brainstorming'],
    });

    const copied = readFileSync(
      join(configDir, 'omp-home', '.omp', 'agent', 'skills', 'brainstorming', 'SKILL.md'),
      'utf-8',
    );

    assert.equal(result.success, true);
    assert.match(copied, /name: brainstorming/);
    assert.match(copied, /# Brainstorming Ideas Into Designs/);
    assert.equal(readFileSync(envFile, 'utf-8').trim(), join(configDir, 'omp-home', '.omp', 'agent'));
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    rmSync(root, { recursive: true, force: true });
  }
});
