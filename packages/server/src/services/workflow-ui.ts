import { existsSync, mkdirSync, writeFileSync, createWriteStream, rmSync, readdirSync, readFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import yauzl from 'yauzl';
import { v4 as uuid } from 'uuid';
import * as store from '../storage/workflow-ui-store.js';
import type { WorkflowUiProject } from '../storage/workflow-ui-store.js';

export { store };
export type { WorkflowUiProject };

// ---- CRUD ----

export function listProjects(): WorkflowUiProject[] {
  return store.listProjects();
}

export function getProject(projectId: string): WorkflowUiProject {
  const project = store.getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  return project;
}

export function createProject(input: {
  name: string;
  description?: string;
  type: 'react' | 'html';
  tags?: string[];
}): WorkflowUiProject {
  const mainFile = input.type === 'react' ? 'index.jsx' : 'index.html';
  const defaultFiles: Record<string, string> = input.type === 'react'
    ? {
        'index.jsx': `const { Button, Card, CardContent } = window.AgentSpacesUI;

function App() {
  return (
    <Card>
      <CardContent>
        <Button>Hello World</Button>
      </CardContent>
    </Card>
  );
}

export default App;
`,
      }
    : {
        'index.html': `<!DOCTYPE html>
<html>
<head><title>${input.name}</title></head>
<body>
  <h1>Hello World</h1>
  <script>
    console.log('loaded');
  </script>
</body>
</html>`,
      };

  return store.createProject({
    ...input,
    mainFile,
    files: defaultFiles,
  });
}

export function updateProject(
  projectId: string,
  updates: Partial<Pick<WorkflowUiProject, 'name' | 'description' | 'tags' | 'enabledPlugins' | 'agentConfigId' | 'mainFile' | 'icon'>>,
): WorkflowUiProject {
  return store.updateProject(projectId, updates);
}

export function deleteProject(projectId: string): void {
  store.deleteProject(projectId);
}

// ---- Files ----

export function getFileTree(projectId: string): string[] {
  return store.getFileTree(projectId);
}

export function readFile(projectId: string, filePath: string): string {
  const content = store.readFile(projectId, filePath);
  if (content === null) throw new Error(`File not found: ${filePath}`);
  return content;
}

export function writeFile(projectId: string, filePath: string, content: string): void {
  store.writeFile(projectId, filePath, content);
}

export function readConfig(projectId: string, filePath: string): unknown | null {
  return store.readConfig(projectId, filePath);
}

export function writeConfig(projectId: string, filePath: string, value: unknown): void {
  store.writeConfig(projectId, filePath, value);
}

export function writeDataFile(projectId: string, filePath: string, content: Buffer | string): number {
  return store.writeDataFile(projectId, filePath, content);
}

// ---- ZIP Export ----

export async function exportZip(projectId: string): Promise<Buffer> {
  const project = store.getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const archiver = (await import('archiver')).default;
  const archive = archiver('zip', { zlib: { level: 6 } });
  const chunks: Buffer[] = [];

  archive.on('data', (chunk: Buffer) => chunks.push(chunk));

  // Add manifest (strip internal fields)
  const { id, createdAt, updatedAt, ...manifest } = project;
  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

  // Add source files
  for (const filePath of store.getFileTree(projectId)) {
    const content = store.readFile(projectId, filePath);
    if (content !== null) {
      archive.append(content, { name: `src/${filePath}` });
    }
  }

  // Add icon file if exists
  if (manifest.icon) {
    const iconPath = join(store.getProjectDir(projectId), manifest.icon);
    if (existsSync(iconPath)) {
      archive.file(iconPath, { name: manifest.icon });
    }
  }

  await archive.finalize();
  return Buffer.concat(chunks);
}

// ---- ZIP Import ----

export async function importZip(
  zipBuffer: Buffer,
  manifest: { name?: string; type?: 'react' | 'html'; description?: string },
): Promise<WorkflowUiProject> {
  const extractDir = join(tmpdir(), `wui-import-${uuid()}`);
  mkdirSync(extractDir, { recursive: true });

  try {
    const zipPath = join(extractDir, 'upload.zip');
    writeFileSync(zipPath, zipBuffer);

    // Extract using yauzl (cross-platform, no PowerShell)
    await extractZip(zipPath, join(extractDir, 'content'));

    // Find manifest
    const contentDir = join(extractDir, 'content');
    const manifestFile = findFile(contentDir, 'manifest.json') ?? findFile(contentDir, 'plugin.json');

    let projectManifest: Record<string, any> = {};
    if (manifestFile) {
      try {
        projectManifest = JSON.parse(readFileSync(manifestFile, 'utf-8'));
      } catch { /* ignore invalid manifest */ }
    }

    // Determine type
    const type =
      manifest.type ??
      projectManifest.type ??
      (findFile(contentDir, 'index.jsx') || findFile(contentDir, 'index.tsx') ? 'react' : 'html');
    const mainFile = type === 'react' ? 'index.jsx' : 'index.html';
    const name = manifest.name ?? projectManifest.name ?? 'Imported Project';

    // Source directory: prefer src/ subdirectory
    const srcBase = existsSync(join(contentDir, 'src')) ? join(contentDir, 'src') : contentDir;

    const project = store.importFromDir(srcBase, {
      name,
      type: type as 'react' | 'html',
      description: manifest.description ?? projectManifest.description,
      mainFile,
      tags: projectManifest.tags,
      enabledPlugins: projectManifest.enabledPlugins,
      icon: projectManifest.icon,
    });

    // Copy icon file if present
    if (projectManifest.icon && typeof projectManifest.icon === 'string') {
      const iconSrc = join(contentDir, projectManifest.icon);
      if (existsSync(iconSrc)) {
        copyFileSync(iconSrc, join(store.getProjectDir(project.id), projectManifest.icon));
      }
    }

    return project;
  } finally {
    try { rmSync(extractDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

function findFile(dir: string, name: string): string | null {
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === name) return join(dir, name);
    if (entry.isDirectory()) {
      const found = findFile(join(dir, entry.name), name);
      if (found) return found;
    }
  }
  return null;
}

function extractZip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirSync(destDir, { recursive: true });
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      if (!zipfile) return reject(new Error('Failed to open zip'));

      zipfile.readEntry();
      zipfile.on('entry', (entry: yauzl.Entry) => {
        // Validate path safety
        const entryPath = entry.fileName;
        if (entryPath.includes('..') || entryPath.startsWith('/') || /^[a-zA-Z]:/.test(entryPath)) {
          zipfile.readEntry();
          return;
        }

        const fullPath = join(destDir, entryPath);

        if (/\/$/.test(entryPath)) {
          // Directory entry
          mkdirSync(fullPath, { recursive: true });
          zipfile.readEntry();
        } else {
          // File entry
          mkdirSync(dirname(fullPath), { recursive: true });
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err);
            const writeStream = createWriteStream(fullPath);
            writeStream.on('close', () => zipfile.readEntry());
            writeStream.on('error', reject);
            readStream.on('error', reject);
            readStream.pipe(writeStream);
          });
        }
      });

      zipfile.on('end', resolve);
      zipfile.on('error', reject);
    });
  });
}
