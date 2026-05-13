import { FileIcon, FileCode } from 'lucide-react';
import type { SearchCommandProvider } from './types';
import { useEditorStore } from '../editor';
import { useChannelStore } from '../channel';

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h',
  'css', 'scss', 'html', 'json', 'yaml', 'yml', 'md', 'sql', 'sh',
]);

function getFileIcon(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return CODE_EXTENSIONS.has(ext) ? FileCode : FileIcon;
}

function flattenTree(nodes: { name: string; path: string; children?: any[] }[]): { name: string; path: string }[] {
  const result: { name: string; path: string }[] = [];
  for (const node of nodes) {
    if (node.children) {
      result.push(...flattenTree(node.children));
    } else {
      result.push({ name: node.name, path: node.path });
    }
  }
  return result;
}

export const fileSearch: SearchCommandProvider = {
  prefix: 'file',
  aliases: ['f', 'open'],
  label: 'File',
  icon: FileIcon,
  search: (keyword) => {
    const { tree, openFile } = useEditorStore.getState();
    const { workspaceId } = useChannelStore.getState();
    if (!workspaceId) return [];

    const lower = keyword.toLowerCase();
    const files = flattenTree(tree as any);
    return files
      .filter((f) => f.path.toLowerCase().includes(lower) || f.name.toLowerCase().includes(lower))
      .map((f) => ({
        id: f.path,
        label: f.name,
        description: f.path,
        icon: getFileIcon(f.path),
        action: () => openFile(workspaceId, f.path),
      }));
  },
};
