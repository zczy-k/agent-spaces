import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const webOut = resolve(root, 'packages/web/out');
const serverWeb = resolve(root, 'packages/server/web');
const serverDistWeb = resolve(root, 'packages/server/dist/web');

if (!existsSync(webOut)) {
  console.error('[copy-web] packages/web/out not found. Run `pnpm build` first.');
  process.exit(1);
}

if (existsSync(serverWeb)) {
  rmSync(serverWeb, { recursive: true, force: true });
}

cpSync(webOut, serverWeb, { recursive: true });
if (existsSync(serverDistWeb)) {
  rmSync(serverDistWeb, { recursive: true, force: true });
}
cpSync(webOut, serverDistWeb, { recursive: true });

const tauriWeb = resolve(root, 'packages/tauri/web');
if (existsSync(tauriWeb)) {
  rmSync(tauriWeb, { recursive: true, force: true });
}
cpSync(webOut, tauriWeb, { recursive: true });

const flutterWeb = resolve(root, 'packages/flutter/assets/web');
if (existsSync(flutterWeb)) {
  rmSync(flutterWeb, { recursive: true, force: true });
}
cpSync(webOut, flutterWeb, { recursive: true });

const flutterPubspec = resolve(root, 'packages/flutter/pubspec.yaml');
const webAssetDirs = listAssetDirs(flutterWeb, 'assets/web');
updateFlutterAssets(flutterPubspec, webAssetDirs);

console.log('[copy-web] packages/web/out -> packages/server/web + packages/server/dist/web + packages/tauri/web + packages/flutter/assets/web');
console.log(`[copy-web] updated packages/flutter/pubspec.yaml with ${webAssetDirs.length} web asset directories`);

function listAssetDirs(absDir, assetPath) {
  const dirs = [`${assetPath}/`];
  const entries = readdirSync(absDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    dirs.push(...listAssetDirs(resolve(absDir, entry.name), `${assetPath}/${entry.name}`));
  }

  return dirs;
}

function updateFlutterAssets(pubspecPath, assetDirs) {
  const startMarker = '    # BEGIN GENERATED WEB ASSETS';
  const endMarker = '    # END GENERATED WEB ASSETS';
  const generatedBlock = [
    startMarker,
    ...assetDirs.map((assetDir) => `    - ${assetDir}`),
    endMarker,
  ].join('\n');

  const pubspec = readFileSync(pubspecPath, 'utf8');

  if (pubspec.includes(startMarker) && pubspec.includes(endMarker)) {
    const updated = pubspec.replace(
      new RegExp(`${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`),
      generatedBlock,
    );
    writeFileSync(pubspecPath, updated);
    return;
  }

  const updated = pubspec.replace(
    /(^flutter:\n(?:  .*\n)*?  assets:\n)(?:    - assets\/web\/\n)?/m,
    `$1${generatedBlock}\n`,
  );

  if (updated === pubspec) {
    throw new Error('[copy-web] Could not find flutter.assets in packages/flutter/pubspec.yaml');
  }

  writeFileSync(pubspecPath, updated);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
