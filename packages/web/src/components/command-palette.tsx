'use client';

import { useEffect, useMemo } from 'react';
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
import { useTranslations } from 'next-intl';

export function CommandPalette() {
  const t = useTranslations('commandPalette');
  const { open, setOpen, toggle, commands } = useCommandPalette();

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
    if (!open) return;
    const input = document.querySelector('[cmdk-input]') as HTMLInputElement | null;
    if (input) input.value = '';
  }, [open]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof commands>();
    for (const cmd of commands) {
      const list = map.get(cmd.group) ?? [];
      list.push(cmd);
      map.set(cmd.group, list);
    }
    return map;
  }, [commands]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title={t('title')} description={t('description')}>
      <Command>
        <CommandInput placeholder={t('placeholder')} />
        <CommandList>
          <CommandEmpty>{t('empty')}</CommandEmpty>
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
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
