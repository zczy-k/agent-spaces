"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useCallback } from "react";
import "@/lib/monaco-loader";
import { useEditorStore } from "@/stores/editor";
import { EditorTabs } from "./editor-tabs";
import { useTheme } from "@/components/theme-provider";
import { useTranslations } from 'next-intl';
import {
  getOrCreateModel,
  preloadDirectory,
  setupLanguageDefaults,
} from "@/lib/monaco-models";
import type * as Monaco from 'monaco-editor';

if (typeof window !== "undefined" && !navigator.clipboard?.write) {
  Object.defineProperty(navigator, "clipboard", {
    value: {
      ...navigator.clipboard,
      writeText: navigator.clipboard?.writeText ?? ((text: string) => Promise.resolve()),
      write: (items: ClipboardItem[]) => {
        const textItem = items[0]?.getType("text/plain");
        return textItem
          ? textItem.then((blob) => blob.text()).then((text) => navigator.clipboard.writeText(text))
          : Promise.resolve();
      },
    },
    writable: true,
    configurable: true,
  });
}

function EditorLoadingFallback() {
  const t = useTranslations('editor');
  return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">{t('loadingEditor')}</div>;
}

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.default),
  { ssr: false, loading: () => <EditorLoadingFallback /> }
);

interface CodeEditorProps {
  workspaceId: string;
}

export function CodeEditor({ workspaceId }: CodeEditorProps) {
  const { openFiles, activeFilePath, updateContent, saveFile, pendingJump, clearPendingJump } = useEditorStore();
  const { resolvedTheme } = useTheme();
  const t = useTranslations('editor');
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  const handleSave = useCallback(() => {
    if (activeFilePath) {
      saveFile(workspaceId, activeFilePath);
    }
  }, [activeFilePath, saveFile, workspaceId]);

  const handleMount = useCallback((editor: Monaco.editor.IStandaloneCodeEditor, _monaco: typeof Monaco) => {
    editorRef.current = editor;
    setupLanguageDefaults();

    editor.addCommand(
      2048 | 49, // KeyMod.CtrlCmd | KeyCode.KeyS
      () => handleSave()
    );
  }, [handleSave]);

  // Register model + preload directory when active file changes
  useEffect(() => {
    if (!activeFile || !activeFilePath) return;

    getOrCreateModel(workspaceId, activeFilePath, activeFile.content);
    preloadDirectory(workspaceId, activeFilePath);
  }, [activeFilePath, workspaceId, activeFile]);

  // Handle pending jump from search results
  useEffect(() => {
    if (!pendingJump || !editorRef.current) return;

    const { line, column } = pendingJump;
    const editor = editorRef.current;

    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: column || 1 });
    editor.focus();
    clearPendingJump();
  }, [pendingJump, clearPendingJump]);

  const modelPath = activeFilePath
    ? `/${workspaceId}/${activeFilePath}`
    : undefined;

  return (
    <div className="flex flex-col h-full">
      <EditorTabs workspaceId={workspaceId} />
      <div className="flex-1 min-h-0">
        {activeFile ? (
          <MonacoEditor
            height="100%"
            language={getLanguage(activeFile.path)}
            value={activeFile.content}
            path={modelPath}
            onChange={(value) => updateContent(activeFile.path, value || "")}
            onMount={handleMount}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              padding: { top: 8 },
              renderLineHighlight: "gutter",
            }}
            theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {t('openFileToEdit')}
          </div>
        )}
      </div>
    </div>
  );
}

function getLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
    yaml: "yaml",
    yml: "yaml",
    py: "python",
    rs: "rust",
    go: "go",
    sql: "sql",
    sh: "shell",
    bash: "shell",
  };
  return map[ext || ""] || "plaintext";
}
