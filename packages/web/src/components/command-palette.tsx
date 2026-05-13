'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { useCommandPalette } from '@/stores/command-palette';
import { matchProvider, searchProviders, type SearchResult } from '@/stores/search-commands';
import { useTranslations } from 'next-intl';

export function CommandPalette() {
  const t = useTranslations('commandPalette');
  const { open, setOpen, toggle, commands } = useCommandPalette();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggle]);

  // Reset search when closing
  useEffect(() => {
    if (!open) {
      setQuery('');
      const input = document.querySelector('[cmdk-input]') as HTMLInputElement | null;
      if (input) input.value = '';
    }
  }, [open]);

  const match = useMemo(() => matchProvider(query), [query]);
  const searchResults = useMemo(() => match?.provider.search(match.keyword) ?? [], [match]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof commands>();
    for (const cmd of commands) {
      const list = map.get(cmd.group) ?? [];
      list.push(cmd);
      map.set(cmd.group, list);
    }
    return map;
  }, [commands]);

  const prefixHints = useMemo(() => {
    return searchProviders.map((p) => ({
      id: `hint:${p.prefix}`,
      label: `${p.prefix} [keyword]`,
      description: [...p.aliases].join(', '),
      icon: p.icon,
    }));
  }, []);

  const showSearch = match && match.keyword.length > 0;
  const showHints = match && match.keyword.length === 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title={t('title')} description={t('description')}>
      <Command shouldFilter={!match}>
        <CommandInput
          placeholder={t('placeholder')}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>{t('empty')}</CommandEmpty>

          {showSearch && (
            <CommandGroup heading={match.provider.label}>
              {searchResults.length === 0 ? (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  {t('noResults')}
                </div>
              ) : (
                searchResults.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.label}
                    onSelect={() => {
                      setOpen(false);
                      item.action();
                    }}
                  >
                    {item.icon && <item.icon className="size-4" />}
                    <span>{item.label}</span>
                    {item.description && (
                      <span className="ml-auto text-xs text-muted-foreground truncate max-w-[200px]">
                        {item.description}
                      </span>
                    )}
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          )}

          {showHints && (
            <CommandGroup heading={match.provider.label}>
              <div className="px-2 py-3 text-sm text-muted-foreground">
                {t('typeKeyword')}
              </div>
            </CommandGroup>
          )}

          {!match && (
            <>
              <CommandGroup heading="Search">
                {prefixHints.map((hint) => (
                  <CommandItem key={hint.id} value={hint.label} onSelect={() => setQuery(hint.label + ' ')}>
                    {hint.icon && <hint.icon className="size-4" />}
                    <span>{hint.label}</span>
                    {hint.description && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {hint.description}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              {[...grouped.entries()].map(([group, items]) => (
                <CommandGroup key={group} heading={group}>
                  {items.map((cmd) => (
                    <CommandItem
                      key={cmd.id}
                      value={cmd.label}
                      onSelect={() => {
                        setOpen(false);
                        cmd.action();
                      }}
                    >
                      {cmd.icon && <cmd.icon className="size-4" />}
                      <span>{cmd.label}</span>
                      {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
