"use client";

import { useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import React from 'react';
import ReactDOM from 'react-dom/client';

interface WorkflowUiPreviewProps {
  type: 'react' | 'html';
  sourceCode: string;
  error: string | null;
  onError: (error: string | null) => void;
}

export function WorkflowUiPreview({ type, sourceCode, error, onError }: WorkflowUiPreviewProps) {
  const t = useTranslations('workflows-ui');
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<ReactDOM.Root | null>(null);

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
        // eslint-disable-next-line no-eval
        eval(script);
      } catch (err: any) {
        onError(`Script error: ${err.message}`);
        return;
      }
    }
    onError(null);
  }, [onError]);

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

  return (
    <div className="relative h-full">
      {error && (
        <div className="absolute inset-x-0 top-0 z-10 bg-destructive/10 border-b border-destructive/30 p-2 text-xs text-destructive font-mono whitespace-pre-wrap max-h-32 overflow-auto">
          {error}
        </div>
      )}
      <div ref={containerRef} className="h-full overflow-auto p-4" />
    </div>
  );
}
