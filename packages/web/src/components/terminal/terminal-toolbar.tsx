'use client';

import { Keyboard, Power, Eraser, ClipboardPaste, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { VirtualKeyboard } from './virtual-keyboard';
import { useTranslations } from 'next-intl';

interface TerminalToolbarProps {
  activeId: string | null;
  sendInput: (sessionId: string, data: string) => void;
  onPaste: () => void;
}

export function TerminalToolbar({ activeId, sendInput, onPaste }: TerminalToolbarProps) {
  const t = useTranslations('terminal');

  const send = (data: string) => {
    if (activeId) sendInput(activeId, data);
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-t border-border bg-muted/50 shrink-0">
      {/* Cursor keys */}
      <div className="flex items-center gap-0.5">
        <button onClick={() => send('\x1b[A')} className="p-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="↑">
          <ArrowUp size={14} />
        </button>
        <button onClick={() => send('\x1b[B')} className="p-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="↓">
          <ArrowDown size={14} />
        </button>
        <button onClick={() => send('\x1b[D')} className="p-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="←">
          <ArrowLeft size={14} />
        </button>
        <button onClick={() => send('\x1b[C')} className="p-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="→">
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="w-px h-4 bg-border" />

      <Popover>
        <PopoverTrigger
          render={
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title={t('virtualKeyboard')}
            >
              <Keyboard size={14} />
              <span className="hidden sm:inline">{t('virtualKeyboard')}</span>
            </button>
          }
        />
        <PopoverContent align="start" side="top" sideOffset={4} className="p-0 max-w-[800px] w-[calc(100vw-16px)]">
          <VirtualKeyboard onKey={(data) => send(data)} />
        </PopoverContent>
      </Popover>

      <button
        onClick={() => send('\x03')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Ctrl+C"
      >
        <Power size={14} />
        <span className="hidden sm:inline">{t('sendCtrlC')}</span>
      </button>

      <button
        onClick={() => send('clear\n')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title={t('clearScreen')}
      >
        <Eraser size={14} />
        <span className="hidden sm:inline">{t('clearScreen')}</span>
      </button>

      <button
        onClick={onPaste}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title={t('pasteCommand')}
      >
        <ClipboardPaste size={14} />
        <span className="hidden sm:inline">{t('pasteCommand')}</span>
      </button>
    </div>
  );
}
