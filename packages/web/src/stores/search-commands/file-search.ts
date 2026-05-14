import { FileIcon, FileCode } from 'lucide-react';
import type { SearchCommandProvider } from './types';
import { useEditorStore } from '../editor';
import { useChannelStore } from '../channel';
import { fetchWithAuth } from '@/lib/auth';

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h',
  'css', 'scss', 'html', 'json', 'yaml', 'yml', 'md', 'sql', 'sh',
]);

function getFileIcon(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return CODE_EXTENSIONS.has(ext) ? FileCode : FileIcon;
}

export const fileSearch: SearchCommandProvider = {
  prefix: 'file',
  aliases: ['f', 'open'],
  label: 'File',
  icon: FileIcon,
  search: async (keyword) => {
    const { openFile } = useEditorStore.getState();
    const { workspaceId } = useChannelStore.getState();
    if (!workspaceId) return [];

    const res = await fetchWithAuth(`/api/workspaces/${workspaceId}/search/files?q=${encodeURIComponent(keyword)}`);
    if (!res.ok) return [];

    const data = await res.json();
    return (data.results ?? []).map((f: { path: string; name: string }) => ({
      id: f.path,
      label: f.name,
      description: f.path,
      icon: getFileIcon(f.path),
      action: () => openFile(workspaceId, f.path),
    }));
  },
};
