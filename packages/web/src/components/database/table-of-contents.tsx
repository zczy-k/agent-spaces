'use client';

import React, { useEffect, useMemo, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TocHeading {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  headings: TocHeading[];
  open: boolean;
}

export function extractTocFromHtml(html: string): TocHeading[] {
  const re = /<h([1-3])[^>]*>(.*?)<\/h\1>/gi;
  const headings: TocHeading[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const level = parseInt(m[1]);
    const text = m[2].replace(/<[^>]*>/g, '').trim();
    if (!text) continue;
    headings.push({ id: `toc-h-${headings.length}`, text, level });
  }
  return headings;
}

export function extractTocFromMarkdown(md: string): TocHeading[] {
  const headings: TocHeading[] = [];
  let idx = 0;
  for (const line of md.split('\n')) {
    const m = line.match(/^(#{1,3})\s+(.+)$/);
    if (m) {
      headings.push({ id: `toc-h-${idx++}`, text: m[2].trim(), level: m[1].length });
    }
  }
  return headings;
}

export function TableOfContents({ headings, open }: TableOfContentsProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const minLevel = useMemo(() => {
    if (headings.length === 0) return 1;
    return Math.min(...headings.map(h => h.level));
  }, [headings]);

  const scrollTo = useCallback((id: string) => {
    const panel = document.querySelector('[data-editor-content]') as HTMLElement | null;
    if (!panel) return;
    const allHeadings = panel.querySelectorAll('h1, h2, h3');
    const idx = parseInt(id.replace('toc-h-', ''));
    if (allHeadings[idx]) {
      allHeadings[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  }, []);

  useEffect(() => {
    if (!open || headings.length === 0) return;
    const panel = document.querySelector('[data-editor-content]') as HTMLElement | null;
    if (!panel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const tag = entry.target.tagName.toLowerCase();
            const level = parseInt(tag.replace('h', ''));
            const allOfLevel = panel.querySelectorAll(tag);
            const idx = Array.from(allOfLevel).indexOf(entry.target as HTMLElement);
            const globalIdx = headings.findIndex(h => h.level === level);
            if (globalIdx >= 0) {
              setActiveId(`toc-h-${globalIdx + idx}`);
            }
          }
        }
      },
      { root: panel, rootMargin: '0px 0px -80% 0px', threshold: 0.1 }
    );

    const els = panel.querySelectorAll('h1, h2, h3');
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [headings, open]);

  if (!open || headings.length === 0) return null;

  return (
    <div className="fixed right-4 z-30 w-52 max-h-[50vh] bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden" style={{ top: 200 }}>
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border shrink-0 text-xs font-semibold text-muted-foreground">
        <span>目录</span>
        <span className="text-[10px] text-muted-foreground/60">{headings.length}</span>
      </div>
      <div className="overflow-y-auto py-1.5 px-1 flex-1">
        {headings.map((h) => {
          const indent = h.level - minLevel;
          const isActive = activeId === h.id;
          return (
            <button
              key={h.id}
              onClick={() => scrollTo(h.id)}
              className={cn(
                'w-full text-left px-2 py-1 rounded-md text-xs transition-all cursor-pointer flex items-center gap-1',
                isActive
                  ? 'text-foreground font-semibold bg-accent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
              style={{ paddingLeft: `${8 + indent * 12}px` }}
            >
              {indent > 0 && <ChevronRight className="w-2.5 h-2.5 shrink-0 opacity-40" />}
              <span className="truncate">{h.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
