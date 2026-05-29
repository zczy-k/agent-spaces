'use client';

import { useState, useRef } from 'react';
import type { ImportSkillItem } from './types';

export function useSkillImport(onImportBatch: (items: ImportSkillItem[]) => void, onImportFromGit: (url: string) => Promise<ImportSkillItem[] | null>) {
  const mdInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const [importItems, setImportItems] = useState<ImportSkillItem[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importDefaultGroup, setImportDefaultGroup] = useState('');
  const [gitUrl, setGitUrl] = useState('');
  const [gitLoading, setGitLoading] = useState(false);
  const [gitDialogOpen, setGitDialogOpen] = useState(false);

  const handleMdSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const items: ImportSkillItem[] = [];
    for (const file of Array.from(files)) {
      const content = await file.text();
      const name = file.name.replace(/\.md$/i, '');
      items.push({
        id: `md-${name}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        group: '',
        content,
        selected: true,
        sourceName: file.name,
      });
    }
    setImportItems(items);
    setImportDefaultGroup('');
    setImportDialogOpen(true);
    e.target.value = '';
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const folderMap = new Map<string, File[]>();
    for (const file of Array.from(files)) {
      const parts = file.webkitRelativePath.split('/');
      const folderName = parts[0];
      if (!folderMap.has(folderName)) folderMap.set(folderName, []);
      folderMap.get(folderName)!.push(file);
    }

    const items: ImportSkillItem[] = [];
    for (const [folderName, folderFiles] of folderMap) {
      let skillFile = folderFiles.find((f) => f.name === 'SKILL.md');
      if (!skillFile) skillFile = folderFiles.find((f) => f.name.endsWith('.md'));
      if (!skillFile) continue;

      const content = await skillFile.text();
      items.push({
        id: `folder-${folderName}-${Math.random().toString(36).slice(2, 8)}`,
        name: folderName,
        group: '',
        content,
        selected: true,
        sourceName: folderName,
      });
    }
    setImportItems(items);
    setImportDefaultGroup('');
    setImportDialogOpen(true);
    e.target.value = '';
  };

  const handleZipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(file);
      const zipName = file.name.replace(/\.zip$/i, '');

      const folderMap = new Map<string, { file: string; path: string }[]>();

      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;
        const fileName = relativePath.split('/').pop() || '';
        const folderPath = relativePath.substring(0, relativePath.lastIndexOf('/'));

        if (!folderPath) {
          if (fileName.endsWith('.md') && fileName !== 'SKILL.md') {
            const name = fileName.replace(/\.md$/i, '');
            if (!folderMap.has(name)) folderMap.set(name, []);
            folderMap.get(name)!.push({ file: fileName, path: relativePath });
          }
          return;
        }

        const topFolder = folderPath.split('/')[0];
        if (!folderMap.has(topFolder)) folderMap.set(topFolder, []);
        folderMap.get(topFolder)!.push({ file: fileName, path: relativePath });
      });

      const items: ImportSkillItem[] = [];
      for (const [folderName, entries] of folderMap) {
        let skillEntry = entries.find((e) => e.file === 'SKILL.md');
        if (!skillEntry) skillEntry = entries.find((e) => e.file.endsWith('.md'));
        if (!skillEntry) continue;

        const content = await zip.file(skillEntry.path)!.async('string');
        items.push({
          id: `zip-${folderName}-${Math.random().toString(36).slice(2, 8)}`,
          name: folderName,
          group: '',
          content,
          selected: true,
          sourceName: folderName,
        });
      }

      setImportItems(items);
      setImportDefaultGroup(zipName);
      setImportDialogOpen(true);
    } catch (err) {
      console.error('Failed to extract ZIP:', err);
    }
    e.target.value = '';
  };

  const handleImportConfirm = (items: ImportSkillItem[]) => {
    onImportBatch(items);
    setImportDialogOpen(false);
    setImportItems([]);
  };

  const handleImportCancel = () => {
    setImportDialogOpen(false);
    setImportItems([]);
  };

  const handleGitImport = async () => {
    const url = gitUrl.trim();
    if (!url) return;
    setGitLoading(true);
    const items = await onImportFromGit(url);
    setGitLoading(false);
    if (items && items.length > 0) {
      const repoName = url.split('/').pop()?.replace(/\.git$/i, '') || '';
      setImportItems(items);
      setImportDefaultGroup(repoName);
      setImportDialogOpen(true);
      setGitDialogOpen(false);
    }
    setGitUrl('');
  };

  return {
    mdInputRef,
    folderInputRef,
    zipInputRef,
    importItems,
    setImportItems,
    importDialogOpen,
    importDefaultGroup,
    gitUrl,
    setGitUrl,
    gitLoading,
    gitDialogOpen,
    setGitDialogOpen,
    handleMdSelect,
    handleFolderSelect,
    handleZipSelect,
    handleImportConfirm,
    handleImportCancel,
    handleGitImport,
  };
}
