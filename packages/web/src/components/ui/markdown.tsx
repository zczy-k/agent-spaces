'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { useEditorStore } from '@/stores/editor';
import { useCallback } from 'react';

function looksLikeFilePath(href: string): boolean {
  if (!href.startsWith('/')) return false;
  if (href.startsWith('//')) return false;
  if (href.startsWith('/api/')) return false;
  return true;
}

function parseFileRef(href: string): { path: string; line?: number; column?: number } {
  const m = href.match(/^(.+?)(?::(\d+))?(?::(\d+))?$/);
  if (!m) return { path: href };
  return { path: m[1], line: m[2] ? parseInt(m[2]) : undefined, column: m[3] ? parseInt(m[3]) : undefined };
}

const staticComponents: Components = {
  pre: ({ children }) => (
    <pre className="bg-background/50 rounded-md p-3 overflow-x-auto text-xs my-2">{children}</pre>
  ),
  code: ({ className, children, ...props }) => {
    const isInline = !className;
    return isInline ? (
      <code className="bg-background/50 px-1 py-0.5 rounded text-xs font-mono" {...props}>
        {children}
      </code>
    ) : (
      <code className={className} {...props}>{children}</code>
    );
  },
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="text-sm">{children}</li>,
  h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-muted-foreground/30 pl-3 my-2 text-muted-foreground">{children}</blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-muted px-2 py-1 bg-muted/50 font-semibold text-left">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-muted px-2 py-1">{children}</td>
  ),
};

interface MarkdownProps {
  content: string;
  workspaceId?: string;
}

export function Markdown({ content, workspaceId }: MarkdownProps) {
  const openFile = useEditorStore((s) => s.openFile);
  const jumpToPosition = useEditorStore((s) => s.jumpToPosition);

  const handleFileClick = useCallback(async (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    if (!workspaceId) return;
    const { path, line, column } = parseFileRef(href);
    await openFile(workspaceId, path);
    if (line) await jumpToPosition(workspaceId, path, line, column);
  }, [workspaceId, openFile, jumpToPosition]);

  const components: Components = {
    ...staticComponents,
    a: ({ href, children }) => {
      if (href && workspaceId && looksLikeFilePath(href)) {
        return (
          <a
            href={href}
            onClick={(e) => handleFileClick(e, href)}
            className="text-primary underline hover:no-underline cursor-pointer"
          >
            {children}
          </a>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
          {children}
        </a>
      );
    },
  };

  return (
    <div className="break-all">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
