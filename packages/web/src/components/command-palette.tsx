'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CommandPalette as CommandPaletteUI,
  type PaletteGroup,
  type SearchProviderHint,
} from '@/components/ui/command-palette';
import { useCommandPalette } from '@/stores/command-palette';
import { useKeyboardShortcuts } from '@/stores/keyboard-shortcuts';
import { matchProvider, searchProviders, type SearchResult } from '@/stores/search-commands';
import { useTranslations } from 'next-intl';

export function CommandPalette() {
  const t = useTranslations('commandPalette');
  const { open, setOpen, toggle, commands } = useCommandPalette();
  const { matchesEvent } = useKeyboardShortcuts();
  const [query, setQuery] = useState('');

  // Ctrl+Shift+P to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (matchesEvent('commandPalette', e)) {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggle, matchesEvent]);

  // Reset on close
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  // Determine search mode
  const match = useMemo(() => matchProvider(query), [query]);

  // Search results
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const m = matchProvider(query);
    if (!m) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    const result = m.provider.search(m.keyword);
    if (result instanceof Promise) {
      setSearchLoading(true);
      let stale = false;
      result
        .then((r) => { if (!stale) setSearchResults(r); })
        .finally(() => { if (!stale) setSearchLoading(false); });
      return () => { stale = true; };
    } else {
      setSearchResults(result);
      setSearchLoading(false);
    }
  }, [query]);

  // Group registered commands
  const groups: PaletteGroup[] = useMemo(() => {
    const map = new Map<string, typeof commands>();
    for (const cmd of commands) {
      const list = map.get(cmd.group) ?? [];
      list.push(cmd);
      map.set(cmd.group, list);
    }
    return [...map.entries()].map(([key, items]) => ({
      key,
      label: key,
      items: items.map((cmd) => ({
        id: cmd.id,
        label: cmd.label,
        icon: cmd.icon ? <cmd.icon className="size-3" /> : undefined,
        shortcut: cmd.shortcut,
        action: cmd.action,
      })),
    }));
  }, [commands]);

  // Search provider hints
  const searchHints: SearchProviderHint[] = useMemo(() => {
    return searchProviders.map((p) => ({
      prefix: p.prefix,
      description: [...p.aliases].join(', '),
      icon: <p.icon className="size-3" />,
    }));
  }, []);

  // Map search results
  const mappedSearchResults = useMemo(() => {
    return searchResults.slice(0, 10).map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
      icon: item.icon ? <item.icon className="size-3" /> : undefined,
      action: item.action,
    }));
  }, [searchResults]);

  return (
    <CommandPaletteUI
      open={open}
      onOpenChange={setOpen}
      groups={groups}
      query={query}
      onQueryChange={setQuery}
      searchResults={mappedSearchResults}
      searchLoading={searchLoading}
      searchProviderLabel={match?.provider.label}
      searchProviderHints={searchHints}
      showSearch={!!match}
      placeholder={t('placeholder')}
      emptyText={t('empty')}
      noResultsText={t('noResults')}
    />
  );
}
