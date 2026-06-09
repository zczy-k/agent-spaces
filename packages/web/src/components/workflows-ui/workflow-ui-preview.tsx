/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import React from 'react';
import ReactDOM from 'react-dom/client';
import type { WorkflowUiProject } from '@agent-spaces/sdk';
import { sdk } from '@/lib/sdk';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PanelRightOpen, Loader2, Search } from 'lucide-react';

interface WorkflowUiPreviewProps {
  type: 'react' | 'html';
  sourceCode: string;
  error: string | null;
  onError: (error: string | null) => void;
  projectId?: string;
  projectName?: string;
}

export function WorkflowUiPreview({ type, sourceCode, error, onError, projectId, projectName }: WorkflowUiPreviewProps) {
  const t = useTranslations('workflows-ui');
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<ReactDOM.Root | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [projects, setProjects] = useState<WorkflowUiProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [search, setSearch] = useState('');

  // React mode: Babel compile + render
  const renderReact = useCallback((code: string) => {
    if (!containerRef.current) return;

    // Cleanup previous render
    if (rootRef.current) {
      const oldRoot = rootRef.current;
      rootRef.current = null;
      queueMicrotask(() => { try { oldRoot.unmount(); } catch { /* ignore */ } });
    }
    containerRef.current.innerHTML = '';

    try {
      // Dynamic import of @babel/standalone
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Babel = require('@babel/standalone');
      const compiled = Babel.transform(code, {
        presets: ['react'],
        plugins: ['transform-modules-commonjs'],
        filename: 'preview.jsx',
        sourceType: 'module',
      }).code;

      // Execute with new Function, inject React and UI components
      const moduleExports: Record<string, any> = {};
      const fn = new Function(
        'React', 'ReactDOM', 'exports', 'require',
        compiled!
      );
      fn(React, ReactDOM, moduleExports, (id: string) => {
        if (id === 'react') return React;
        if (id === 'react-dom') return ReactDOM;
        return null;
      });

      const Component = moduleExports.default;
      if (!Component) {
        onError(t('preview.entryExportError'));
        return;
      }

      rootRef.current = ReactDOM.createRoot(containerRef.current);
      rootRef.current.render(React.createElement(Component));
      onError(null);
    } catch (err: any) {
      onError(err.message || String(err));
    }
  }, [onError, t]);

  // HTML mode: direct render + eval script
  const renderHtml = useCallback((html: string) => {
    if (!containerRef.current) return;

    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    const scripts: string[] = [];
    const cleanHtml = html.replace(scriptRegex, (_match, content) => {
      scripts.push(content);
      return '';
    });

    containerRef.current.innerHTML = cleanHtml;

    for (const script of scripts) {
      try {
        // eslint-disable-next-line react-hooks/unsupported-syntax
        eval(script);
      } catch (err: any) {
        onError(`Script error: ${err.message}`);
        return;
      }
    }
    onError(null);
  }, [onError]);

  // Load projects when drawer opens
  const handleDrawerOpen = useCallback((open: boolean) => {
    setDrawerOpen(open);
    if (open && projects.length === 0) {
      setProjectsLoading(true);
      sdk.workflowUi.list().then((list) => {
        setProjects(list);
        setProjectsLoading(false);
      }).catch(() => setProjectsLoading(false));
    }
  }, [projects.length]);

  const handleProjectSwitch = useCallback((id: string) => {
    setDrawerOpen(false);
    router.push(`/workflows-ui-preview/${id}`);
  }, [router]);

  // Re-render on source change
  useEffect(() => {
    if (!sourceCode) return;
    if (type === 'react') {
      renderReact(sourceCode);
    } else {
      renderHtml(sourceCode);
    }
  }, [sourceCode, type, renderReact, renderHtml]);

  // Cleanup — defer unmount to avoid "synchronously unmounting a root during React render"
  useEffect(() => {
    return () => {
      if (rootRef.current) {
        const root = rootRef.current;
        rootRef.current = null;
        queueMicrotask(() => { try { root.unmount(); } catch { /* ignore */ } });
      }
    };
  }, []);

  const showToolbar = !!projectId;

  return (
    <div className="relative flex flex-col h-full">
      {showToolbar && (
        <div className="flex items-center shrink-0 px-3 py-1.5 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex-1" />
          <span className="text-sm font-medium truncate max-w-[60%] text-center">
            {projectName}
          </span>
          <div className="flex-1 flex justify-end">
            <Sheet open={drawerOpen} onOpenChange={handleDrawerOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <PanelRightOpen className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0">
                <SheetHeader className="px-4 pt-4 pb-2">
                  <SheetTitle className="text-sm">{t('preview.switchProject')}</SheetTitle>
                </SheetHeader>
                <div className="px-3 pb-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder={t('page.searchPlaceholder')}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-8 text-xs pl-8"
                    />
                  </div>
                </div>
                <ScrollArea className="h-[calc(100%-100px)]">
                  <div className="px-3 pb-3 space-y-1">
                    {projectsLoading && (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {!projectsLoading && projects
                      .filter((p) => {
                        if (!search) return true;
                        const q = search.toLowerCase();
                        return p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
                      })
                      .map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleProjectSwitch(p.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors hover:bg-accent ${
                          p.id === projectId ? 'bg-accent' : ''
                        }`}
                      >
                        <span className="truncate flex-1">{p.name}</span>
                        <Badge variant={p.type === 'react' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                          {p.type === 'react' ? 'React' : 'HTML'}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      )}
      {error && (
        <div className="shrink-0 bg-destructive/10 border-b border-destructive/30 p-2 text-xs text-destructive font-mono whitespace-pre-wrap max-h-32 overflow-auto">
          {error}
        </div>
      )}
      <div ref={containerRef} className="flex-1 overflow-auto p-4" />
    </div>
  );
}
