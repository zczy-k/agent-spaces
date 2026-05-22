'use client';

import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Keyboard, Power, Eraser, ClipboardPaste, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Edit3, Send } from 'lucide-react';
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
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const send = (data: string) => {
    if (activeId) sendInput(activeId, data);
  };

  const sendDraft = () => {
    if (!draft || !activeId) return;
    const data = /[\r\n]$/.test(draft) ? draft : `${draft}\n`;
    sendInput(activeId, data);
    setDraft('');
  };

  const toggleEdit = () => {
    if (editOpen) {
      setEditOpen(false);
      return;
    }
    flushSync(() => setEditOpen(true));
    inputRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className="flex flex-col gap-1 px-2 py-1 border-t border-border bg-muted/50 shrink-0">
      {editOpen && (
        <div className="relative">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-16 max-h-28 w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 pr-14 text-sm font-mono leading-5 outline-none focus:border-ring focus:ring-1 focus:ring-ring disabled:opacity-50"
            placeholder={t('mobileInputPlaceholder')}
            disabled={!activeId}
            rows={2}
          />
          <button
            onClick={sendDraft}
            disabled={!activeId || !draft}
            className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
            title={t('sendInput')}
          >
            <Send size={14} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 overflow-x-auto">
        {/* Cursor keys */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => send('\x1b[A')} className="p-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="↑ cursor-pointer">
            <ArrowUp size={14} />
          </button>
          <button onClick={() => send('\x1b[B')} className="p-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="↓ cursor-pointer">
            <ArrowDown size={14} />
          </button>
          <button onClick={() => send('\x1b[D')} className="p-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="← cursor-pointer">
            <ArrowLeft size={14} />
          </button>
          <button onClick={() => send('\x1b[C')} className="p-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" title="→ cursor-pointer">
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="w-px h-4 bg-border shrink-0" />

        <button
          onClick={toggleEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors data-[active=true]:bg-accent data-[active=true]:text-foreground cursor-pointer"
          data-active={editOpen}
          title={t('editInput')}
        >
          <Edit3 size={14} />
          <span className="hidden sm:inline">{t('editInput')}</span>
        </button>

        <Popover>
          <PopoverTrigger
            render={
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          title="Ctrl+C"
        >
          <Power size={14} />
          <span className="hidden sm:inline">{t('sendCtrlC')}</span>
        </button>

        <button
          onClick={() => send('clear\n')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          title={t('clearScreen')}
        >
          <Eraser size={14} />
          <span className="hidden sm:inline">{t('clearScreen')}</span>
        </button>

        <button
          onClick={onPaste}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          title={t('pasteCommand')}
        >
          <ClipboardPaste size={14} />
          <span className="hidden sm:inline">{t('pasteCommand')}</span>
        </button>
      </div>
    </div>
  );
}
