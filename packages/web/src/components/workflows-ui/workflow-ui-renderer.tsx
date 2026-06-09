/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useRef } from 'react';
import React from 'react';
import ReactDOM from 'react-dom/client';
import * as AgentSpacesUI from '@/lib/ui-exports';
import { cn } from '@/lib/utils';

export type WorkflowUiRenderType = 'react' | 'html';

interface WorkflowUiRendererProps {
  type: WorkflowUiRenderType;
  sourceCode: string;
  onError: (error: string | null) => void;
  componentProps?: Record<string, unknown>;
  className?: string;
}

let agentSpacesUiMountCount = 0;
let initialAgentSpacesUi: unknown;

function installAgentSpacesUiGlobals() {
  if (agentSpacesUiMountCount === 0) {
    initialAgentSpacesUi = (window as any).AgentSpacesUI;
  }
  agentSpacesUiMountCount++;

  const previous = (window as any).AgentSpacesUI;
  (window as any).AgentSpacesUI = {
    ...AgentSpacesUI,
    ...(previous && typeof previous === 'object' ? previous : {}),
  };

  return () => {
    agentSpacesUiMountCount = Math.max(0, agentSpacesUiMountCount - 1);
    if (agentSpacesUiMountCount > 0) return;
    if (initialAgentSpacesUi === undefined) delete (window as any).AgentSpacesUI;
    else (window as any).AgentSpacesUI = initialAgentSpacesUi;
    initialAgentSpacesUi = undefined;
  };
}

export function WorkflowUiRenderer({
  type,
  sourceCode,
  onError,
  componentProps,
  className,
}: WorkflowUiRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<ReactDOM.Root | null>(null);

  useEffect(() => installAgentSpacesUiGlobals(), []);

  const cleanupReactRoot = useCallback(() => {
    if (!rootRef.current) return;
    const oldRoot = rootRef.current;
    rootRef.current = null;
    queueMicrotask(() => { try { oldRoot.unmount(); } catch { /* ignore */ } });
  }, []);

  const renderReact = useCallback((code: string) => {
    if (!containerRef.current) return;

    cleanupReactRoot();
    containerRef.current.innerHTML = '';

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Babel = require('@babel/standalone');
      const compiled = Babel.transform(code, {
        presets: ['react'],
        plugins: ['transform-modules-commonjs'],
        filename: 'workflow-ui-renderer.jsx',
        sourceType: 'module',
      }).code;

      const moduleExports: Record<string, any> = {};
      const fn = new Function('React', 'ReactDOM', 'exports', 'require', compiled!);
      fn(React, ReactDOM, moduleExports, (id: string) => {
        if (id === 'react') return React;
        if (id === 'react-dom') return ReactDOM;
        return null;
      });

      const Component = moduleExports.default;
      if (!Component) {
        onError('React custom view must export a default component.');
        return;
      }

      rootRef.current = ReactDOM.createRoot(containerRef.current);
      rootRef.current.render(React.createElement(Component, componentProps));
      onError(null);
    } catch (err: any) {
      onError(err.message || String(err));
    }
  }, [cleanupReactRoot, componentProps, onError]);

  const renderHtml = useCallback((html: string) => {
    if (!containerRef.current) return;

    cleanupReactRoot();
    const container = containerRef.current;
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    const scripts: string[] = [];
    const cleanHtml = html.replace(scriptRegex, (_match, content) => {
      scripts.push(content);
      return '';
    });

    container.innerHTML = cleanHtml;

    for (const script of scripts) {
      try {
        const fn = new Function('container', 'props', 'AgentSpacesUI', 'AgentSpaces', 'AgentSpacesAPI', script);
        fn(
          container,
          componentProps || {},
          (window as any).AgentSpacesUI,
          (window as any).AgentSpaces,
          (window as any).AgentSpacesAPI,
        );
      } catch (err: any) {
        onError(`Script error: ${err.message}`);
        return;
      }
    }
    onError(null);
  }, [cleanupReactRoot, componentProps, onError]);

  useEffect(() => {
    if (!sourceCode) return;
    if (type === 'react') renderReact(sourceCode);
    else renderHtml(sourceCode);
  }, [sourceCode, type, renderReact, renderHtml]);

  useEffect(() => cleanupReactRoot, [cleanupReactRoot]);

  return <div ref={containerRef} className={cn('h-full w-full overflow-auto', className)} />;
}
