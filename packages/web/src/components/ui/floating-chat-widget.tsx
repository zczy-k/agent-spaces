'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Markdown } from '@/components/ui/markdown';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { MessageSquare, Send, X, ChevronDown, ChevronRight, Brain, Square, Copy, Trash2 } from 'lucide-react';
import { useId, useRef, useEffect, useState } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

export interface ChatAgentInfo {
  name: string;
  role?: string;
  avatar?: string;
  status?: 'online' | 'busy' | 'offline';
}

export interface FloatingChatPanelProps {
  /** Panel control */
  isOpen: boolean;
  onClose: () => void;
  onToggle?: () => void;

  /** Agent info displayed in header */
  agent: ChatAgentInfo;

  /** Messages */
  messages: ChatMessage[];
  /** Show typing indicator */
  sending?: boolean;

  /** Input */
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  inputPlaceholder?: string;

  /** Whether to render agent messages as Markdown */
  markdown?: boolean;
  /** workspaceId passed to Markdown component */
  workspaceId?: string;

  /** Extra header actions (settings, etc.) */
  headerActions?: React.ReactNode;
  /** Optional custom renderer for message body */
  renderMessageContent?: (message: ChatMessage) => React.ReactNode;
  /** Optional custom renderer for content below each message bubble */
  renderMessageExtras?: (message: ChatMessage) => React.ReactNode;
  /** Optional delete handler. When provided, each message shows a delete action on hover. */
  onDeleteMessage?: (messageId: string) => void;
  /** Optional custom serializer for copy action. Defaults to `message.content`. */
  serializeForCopy?: (message: ChatMessage) => string;

  /** Panel size */
  width?: number;
  height?: number;
}

const containerVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
    transformOrigin: 'bottom right',
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      damping: 25,
      stiffness: 300,
      staggerChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    y: 20,
    scale: 0.95,
    transition: { duration: 0.2 },
  },
};

const messageVariants: Variants = {
  hidden: { opacity: 0, y: 10, x: -10 },
  visible: {
    opacity: 1,
    y: 0,
    x: 0,
    transition: { type: 'spring' as const, stiffness: 500, damping: 30 },
  },
};

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function extractThinkingContent(content: string): { thinking: string | null; message: string } {
  const match = content.match(/^<think\s*>([\s\S]*?)<\/think>\s*([\s\S]*)$/);
  if (match) {
    return { thinking: match[1].trim(), message: match[2].trim() };
  }
  return { thinking: null, message: content };
}

function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors"
      >
        <Brain className="h-3 w-3" />
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>思考过程</span>
      </button>
      {expanded && (
        <div className="mt-1 text-xs text-muted-foreground/70 border-l-2 border-muted-foreground/20 pl-3 whitespace-pre-wrap break-words">
          {content}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status?: string }) {
  return (
    <span
      className={cn(
        'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background',
        status === 'online' ? 'bg-emerald-500' : status === 'busy' ? 'bg-amber-500' : 'bg-slate-400'
      )}
    />
  );
}

export function FloatingChatPanel({
  isOpen,
  onClose,
  onToggle,
  agent,
  messages,
  sending = false,
  input,
  onInputChange,
  onSend,
  onStop,
  inputPlaceholder,
  markdown = true,
  workspaceId,
  headerActions,
  renderMessageContent,
  renderMessageExtras,
  onDeleteMessage,
  serializeForCopy,
  width = 400,
  height = 360,
}: FloatingChatPanelProps) {
  const widgetId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSend();
    }
  };

  const handleCopyMessage = async (message: ChatMessage) => {
    const text = serializeForCopy
      ? serializeForCopy(message)
      : extractThinkingContent(message.content).message || message.content;
    await navigator.clipboard.writeText(text);
    setCopiedMessageId(message.id);
    window.setTimeout(() => {
      setCopiedMessageId((current) => current === message.id ? null : current);
    }, 1200);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key={`chat-panel-${widgetId}`}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="overflow-hidden rounded-2xl border border-border/40 bg-background/60 shadow-2xl backdrop-blur-xl ring-1 ring-white/10"
            style={{ width, maxHeight: height + 220 }}
          >
            {/* Header */}
            <div className="relative border-b border-border/40 bg-muted/30 p-4 overflow-hidden">
              <div className="relative flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                      {agent.avatar && <AvatarImage src={agent.avatar} alt={agent.name} />}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {agent.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <StatusDot status={agent.status} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">
                        {agent.role || (sending ? 'typing…' : 'online')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {headerActions}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full hover:bg-background/50"
                    onClick={onClose}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={listRef}
              className="flex flex-col gap-3 overflow-y-auto p-4 bg-gradient-to-b from-background/20 to-background/40"
              style={{ height }}
            >
              {messages.length === 0 && !sending && (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  暂无消息
                </div>
              )}

              {messages.map((msg) => {
                const { thinking, message } = msg.role === 'agent'
                  ? extractThinkingContent(msg.content)
                  : { thinking: null, message: msg.content };
                const hasMessageBody = msg.role === 'user' || thinking !== null || message.trim().length > 0;
                if (!hasMessageBody && !renderMessageExtras) return null;
                return (
                  <motion.div
                    key={msg.id}
                    variants={messageVariants}
                    className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse self-end' : '')}
                  >
                    <div
                      className={cn(
                        'group/message flex max-w-[85%] flex-col gap-1',
                        msg.role === 'user' ? 'items-end' : ''
                      )}
                    >
                      {hasMessageBody ? (
                        <div
                          className={cn(
                            'px-4 py-2.5 text-sm leading-relaxed shadow-sm border border-border/20',
                            msg.role === 'user'
                              ? 'rounded-2xl rounded-tr-none bg-primary text-primary-foreground'
                              : 'rounded-2xl rounded-tl-none bg-muted/50 backdrop-blur-sm'
                          )}
                        >
                          {msg.role === 'user' ? (
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          ) : (
                            <>
                              {thinking !== null && <ThinkingBlock content={thinking} />}
                              {message.trim().length > 0 ? (
                                renderMessageContent ? (
                                  renderMessageContent({ ...msg, content: message })
                                ) : markdown ? (
                                  <Markdown content={message} workspaceId={workspaceId} />
                                ) : (
                                  <p className="whitespace-pre-wrap break-words">{message}</p>
                                )
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : null}
                      {renderMessageExtras?.(msg)}
                      <div className={cn('flex items-center gap-1', msg.role === 'user' ? 'flex-row-reverse' : '')}>
                        <span
                          className={cn(
                            'text-[10px] font-mono',
                            msg.role === 'user' ? 'text-primary-foreground/50' : 'text-muted-foreground/60'
                          )}
                        >
                          {formatTime(msg.timestamp)}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/message:opacity-100">
                          <button
                            type="button"
                            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => void handleCopyMessage(msg)}
                            title={copiedMessageId === msg.id ? '已复制' : '复制消息'}
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          {onDeleteMessage ? (
                            <button
                              type="button"
                              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => onDeleteMessage(msg.id)}
                              title="删除消息"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              {/* Typing indicator */}
              {sending && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                  aria-label="AI is typing"
                >
                  <div className="flex flex-col gap-1">
                    <div className="rounded-2xl rounded-tl-none bg-muted/50 px-4 py-3 shadow-sm backdrop-blur-sm border border-border/20 w-16 flex items-center justify-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce" />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border/40 bg-background/60 p-3 backdrop-blur-md">
              <form
                className="relative flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (sending) {
                    onStop?.();
                    return;
                  }
                  onSend();
                }}
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => onInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={inputPlaceholder || `Message ${agent.name}...`}
                  className="flex-1 rounded-full border border-border/40 bg-background/50 px-4 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/10"
                />
                <Button
                  type="submit"
                  size={sending ? 'sm' : 'icon'}
                  className={cn(
                    'h-10 rounded-full text-primary-foreground shadow-lg transition-transform hover:scale-105 cursor-pointer',
                    sending
                      ? 'w-auto gap-1.5 bg-destructive px-4 hover:bg-destructive/90'
                      : 'w-10 bg-primary hover:shadow-primary/25'
                  )}
                  disabled={!sending && !input.trim()}
                >
                  {sending ? (
                    <>
                      <Square className="h-3.5 w-3.5 fill-current" />
                      <span className="text-xs font-medium">停止</span>
                    </>
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating toggle button */}
      {onToggle && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onToggle}
          className={cn(
            'cursor-pointer group relative flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300',
            isOpen
              ? 'bg-destructive text-destructive-foreground rotate-90'
              : 'bg-primary text-primary-foreground hover:shadow-primary/25'
          )}
        >
          <span className="absolute inset-0 -z-10 rounded-full bg-inherit opacity-20 blur-xl transition-opacity duration-300 group-hover:opacity-40" />
          {isOpen ? <X className="h-6 w-6 text-white" /> : <MessageSquare className="h-6 w-6" />}
        </motion.button>
      )}
    </div>
  );
}
