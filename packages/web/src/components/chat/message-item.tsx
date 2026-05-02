'use client';

import type { Message } from '@agent-spaces/shared';

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.senderId === 'user';
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex gap-2 px-3 py-1.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex flex-col max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-medium text-foreground">
            {isUser ? 'You' : message.senderId}
          </span>
          {message.senderRole && (
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
              {message.senderRole}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{time}</span>
        </div>
        <div className={`text-sm rounded-lg px-3 py-2 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
          {renderContent(message.content, message.type)}
        </div>
      </div>
    </div>
  );
}

function renderContent(content: string, type?: Message['type']) {
  if (isHTML(content)) {
    return <span className="tiptap tiptap-message" dangerouslySetInnerHTML={{ __html: content }} />;
  }
  return <span className="whitespace-pre-wrap break-words">{content}</span>;
}

function isHTML(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}
