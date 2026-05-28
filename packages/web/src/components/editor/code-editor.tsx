"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useCallback, useState } from "react";
import "@/lib/monaco-loader";
import "@/lib/monaco-builtin-actions";
import "@/components/editor/code-editor-clipboard";
import { applyRegisteredActions } from "@/lib/monaco-action-registry";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEditorStore, isCommitDiffPath, getCommitHashFromPath, getMediaType } from "@/stores/editor";
import type { OpenFile } from "@/stores/editor";
import { EditorTabs } from "./editor-tabs";
import { EditorMenuBar } from "./code-editor-menu-bar";
import { useTheme } from "@/components/theme-provider";
import { useTranslations } from 'next-intl';
import { CommitDiffViewer } from "@/components/git/commit-diff-viewer";
import { useWorkspaceStore } from "@/stores/workspace";
import { useCodeFavoritesStore } from "@/stores/code-favorites";
import { Code, Eye, FileText, AlignLeft, Binary } from "lucide-react";
import {
  getModelUri,
  getOrCreateModel,
} from "@/lib/monaco-models";
import { startTypeScriptLanguageClient, stopTypeScriptLanguageClient } from "@/lib/monaco-language-client";
import {
  getFilePathFromModelUri,
  getLanguage,
} from "./code-editor-utils";
import { registerNavigationActions } from "./code-editor-navigation";
import { collapseEditorSelection } from "./code-editor-mobile";
import { useMobileReadonlyOverlay } from "./useMobileReadonlyOverlay";
import { MobileReadonlyOverlay } from "./code-editor-mobile-overlay";
import type * as Monaco from 'monaco-editor';

function EditorLoadingFallback() {
  const t = useTranslations('editor');
  return <div className="flex items-center justify-center h-full text-muted-foreground text-sm">{t('loadingEditor')}</div>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detectEncoding(content: string): string {
  // Content from API is UTF-8 string; non-ASCII chars present → UTF-8, else ASCII (subset of UTF-8)
  if (/^[\x00-\x7F]*$/.test(content)) return 'ASCII';
  return 'UTF-8';
}

function EditorStatusBar({ file, content, t }: {
  file: OpenFile;
  content: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const lines = content ? content.split('\n').length : 0;
  const sizeBytes = new Blob([content]).size;
  const encoding = detectEncoding(content);

  return (
    <div className="flex items-center px-3 py-1 text-[11px] text-muted-foreground border-t bg-muted/30 select-none shrink-0 overflow-hidden">
      <span className="truncate flex items-center gap-1" title={file.path}>
        <FileText size={11} className="shrink-0" />
        {file.path}
      </span>
      <div className="ml-auto flex items-center gap-3 shrink-0">
        <span className="flex items-center gap-0.5">
          <Binary size={11} />
          {formatFileSize(sizeBytes)}
        </span>
        <span className="flex items-center gap-0.5">
          <AlignLeft size={11} />
          {lines} {t('lines')}
        </span>
        <span>{encoding}</span>
      </div>
    </div>
  );
}

import { Markdown } from '@/components/ui/markdown';
import { MermaidPreview } from '@/components/ui/mermaid-preview';


const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.default),
  { ssr: false, loading: () => <EditorLoadingFallback /> }
);

interface CodeEditorProps {
  workspaceId: string;
}

let _monacoCanceledHandlerRegistered = false;
function suppressMonacoCanceled() {
  if (_monacoCanceledHandlerRegistered || typeof window === 'undefined') return;
  _monacoCanceledHandlerRegistered = true;
  window.addEventListener('unhandledrejection', (e) => {
    if (e.reason?.name === 'Canceled' || String(e.reason) === 'Canceled') {
      e.preventDefault();
    }
  });
}

export function CodeEditor({ workspaceId }: CodeEditorProps) {
  suppressMonacoCanceled();
  const { openFiles, modifiedFileContents, activeFilePath, updateContent, saveFile, refreshFile, jumpToPosition, pendingJump, clearPendingJump, commitDiffs } = useEditorStore();
  const { resolvedTheme } = useTheme();
  const t = useTranslations('editor');
  const isMobile = useIsMobile();
  const workspaceRoot = useWorkspaceStore((s) => s.workspaces.find((w) => w.id === workspaceId)?.boundDirs?.[0]);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const navigationDisposablesRef = useRef<Monaco.IDisposable[]>([]);
  const actionRegistryDisposablesRef = useRef<Monaco.IDisposable[]>([]);
  const favoriteDecorationsRef = useRef<string[]>([]);
  const wheelZoomCleanupRef = useRef<(() => void) | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wordWrap, setWordWrap] = useState(() => localStorage.getItem('editor-word-wrap') === 'true');
  const [minimap, setMinimap] = useState(() => localStorage.getItem('editor-minimap') === 'true');
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('editor-font-size');
    return saved ? parseInt(saved, 10) : 13;
  });
  const [editorReadyTick, setEditorReadyTick] = useState(0);
  const [jumpRetryTick, setJumpRetryTick] = useState(0);
  const [showPreview, setShowPreview] = useState(true);

  const activeFile = openFiles.find((f) => f.path === activeFilePath);
  const activeContent = activeFile ? modifiedFileContents[activeFile.path] ?? activeFile.content : "";
  const isCommitDiff = activeFilePath ? isCommitDiffPath(activeFilePath) : false;
  const commitDiffData = isCommitDiff && activeFilePath ? commitDiffs[getCommitHashFromPath(activeFilePath)] : null;
  const mediaType = activeFile?.mediaType ?? (activeFilePath ? getMediaType(activeFilePath) : null);
  const isPreviewable = mediaType === 'image' || mediaType === 'video' || mediaType === 'audio' || mediaType === 'svg' || mediaType === 'markdown' || mediaType === 'mermaid';
  const isCodePreviewToggle = mediaType === 'svg' || mediaType === 'markdown' || mediaType === 'mermaid';
  const mediaUrl = activeFilePath && mediaType
    ? `/api/workspaces/${workspaceId}/files/content?path=${encodeURIComponent(activeFilePath)}&raw=true`
    : null;

  // Reset preview state when file changes
  useEffect(() => { setShowPreview(true); }, [activeFilePath]);

  const mobile = useMobileReadonlyOverlay({
    editorRef,
    monacoRef,
    activeContent,
    workspaceId,
    workspaceRoot,
    isMobile,
    isReadOnly,
    isCommitDiff,
    hasActiveFile: Boolean(activeFile),
    editorReadyTick,
    wordWrap,
  });

  const handleSave = useCallback(() => {
    if (activeFilePath) {
      saveFile(workspaceId, activeFilePath);
    }
  }, [activeFilePath, saveFile, workspaceId]);
  const handleSaveRef = useRef(handleSave);
  useEffect(() => { handleSaveRef.current = handleSave; }, [handleSave]);

  const syncReadOnly = useCallback((editor: Monaco.editor.IStandaloneCodeEditor, readOnly: boolean) => {
    editor.updateOptions({ readOnly });
  }, []);

  const registerNavigation = useCallback((editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
    registerNavigationActions(editor, monaco, navigationDisposablesRef.current, {
      activeFilePath,
      workspaceId,
      workspaceRoot,
      jumpToPosition,
    });
  }, [activeFilePath, jumpToPosition, workspaceId, workspaceRoot]);

  const attachWheelZoom = useCallback((editor: Monaco.editor.IStandaloneCodeEditor) => {
    wheelZoomCleanupRef.current?.();

    const node = editor.getDomNode();
    if (!node) return;

    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      setFontSize((prev) => {
        const next = prev + (e.deltaY < 0 ? 1 : -1);
        const clamped = Math.min(Math.max(next, 8), 40);
        localStorage.setItem('editor-font-size', String(clamped));
        return clamped;
      });
    };

    node.addEventListener('wheel', handler, { passive: false, capture: true });
    wheelZoomCleanupRef.current = () => {
      node.removeEventListener('wheel', handler, true);
    };
  }, []);

  const handleMount = useCallback((editor: Monaco.editor.IStandaloneCodeEditor, _monaco: typeof Monaco) => {
    editorRef.current = editor;
    monacoRef.current = _monaco;
    if (workspaceRoot) {
      startTypeScriptLanguageClient(workspaceId, workspaceRoot);
    }
    syncReadOnly(editor, isReadOnly);
    editor.updateOptions({ fontSize });
    registerNavigation(editor, _monaco);
    attachWheelZoom(editor);

    for (const d of actionRegistryDisposablesRef.current) d.dispose();
    actionRegistryDisposablesRef.current = applyRegisteredActions(editor, { workspaceId, workspaceRoot });

    setEditorReadyTick((tick) => tick + 1);

    editor.addAction({
      id: 'agentSpaces.saveFile',
      label: 'Save File',
      keybindings: [2048 | 49], // KeyMod.CtrlCmd | KeyCode.KeyS
      run: () => handleSaveRef.current(),
    });
  }, [attachWheelZoom, isReadOnly, registerNavigation, syncReadOnly, workspaceId, workspaceRoot, fontSize]);

  useEffect(() => {
    if (!editorRef.current || !workspaceRoot) return;
    startTypeScriptLanguageClient(workspaceId, workspaceRoot);
  }, [workspaceId, workspaceRoot]);

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    registerNavigation(editorRef.current, monacoRef.current);
  }, [registerNavigation]);

  useEffect(() => {
    return () => stopTypeScriptLanguageClient(workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    return () => {
      wheelZoomCleanupRef.current?.();
      wheelZoomCleanupRef.current = null;
      for (const disposable of navigationDisposablesRef.current) {
        disposable.dispose();
      }
      navigationDisposablesRef.current = [];
      for (const d of actionRegistryDisposablesRef.current) d.dispose();
      actionRegistryDisposablesRef.current = [];
      favoriteDecorationsRef.current = [];
    };
  }, []);

  // Apply favorite decorations for current file
  const favorites = useCodeFavoritesStore((s) => s.favorites);
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !activeFilePath) {
      if (editor) favoriteDecorationsRef.current = editor.deltaDecorations(favoriteDecorationsRef.current, []);
      return;
    }
    const matched = favorites.filter(
      (f) => f.path === activeFilePath && f.workspaceId === workspaceId,
    );
    if (matched.length === 0) {
      favoriteDecorationsRef.current = editor.deltaDecorations(favoriteDecorationsRef.current, []);
      return;
    }
    const decorations = matched.map((f) => ({
      range: new monaco.Range(f.line, 1, f.endLine || f.line, 1),
      options: {
        isWholeLine: true,
        glyphMarginClassName: 'favorite-glyph',
        glyphMarginHoverMessage: { value: f.label || `${f.path}:${f.line}` },
        className: 'favorite-line-bg',
      },
    }));
    favoriteDecorationsRef.current = editor.deltaDecorations(favoriteDecorationsRef.current, decorations);
  }, [activeFilePath, favorites, workspaceId, editorReadyTick]);

  // Poll for external file changes (skip if user has unsaved edits)
  useEffect(() => {
    if (!activeFilePath || !activeFile || activeFile.modified || isCommitDiff) return;
    const timer = setInterval(() => {
      refreshFile(workspaceId, activeFilePath);
    }, 3000);
    return () => clearInterval(timer);
  }, [activeFile, activeFilePath, activeFile?.modified, isCommitDiff, workspaceId, refreshFile]);

  // Sync readOnly state with Monaco editor
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    syncReadOnly(editor, isReadOnly);
  }, [isReadOnly, syncReadOnly]);

  useEffect(() => {
    if (!mobile.pendingNavigationSelectionCleanup.current) return;
    window.setTimeout(() => {
      if (!mobile.pendingNavigationSelectionCleanup.current) return;
      collapseEditorSelection(editorRef.current);
      mobile.closeMobileSelectionMode();
    }, 0);
  }, [activeFilePath, editorReadyTick, mobile]);

  // Sync wordWrap with Monaco editor
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.updateOptions({ wordWrap: wordWrap ? 'on' : 'off' });
  }, [wordWrap]);

  // Sync minimap with Monaco editor
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.updateOptions({ minimap: { enabled: minimap } });
  }, [minimap]);

  // Sync fontSize with Monaco editor
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.updateOptions({ fontSize });
  }, [fontSize]);

  // Register model when active file changes
  useEffect(() => {
    if (!activeFile || !activeFilePath) return;

    getOrCreateModel(workspaceId, activeFilePath, activeContent, workspaceRoot);
  }, [activeFile, activeFilePath, activeContent, workspaceId, workspaceRoot]);

  // Handle pending jump from search results
  useEffect(() => {
    if (!pendingJump || !activeFilePath || pendingJump.path !== activeFilePath || !editorRef.current) return;

    const { line, column, endLine, endColumn, path } = pendingJump;
    const editor = editorRef.current;
    const model = editor.getModel();
    const expectedModelPath = getModelUri(workspaceId, path, workspaceRoot).path;
    if (!model || model.uri.path !== expectedModelPath) {
      const retryTimer = window.setTimeout(() => {
        setJumpRetryTick((tick) => tick + 1);
      }, 30);
      return () => window.clearTimeout(retryTimer);
    }

    const lineNumber = Math.min(Math.max(1, line), model.getLineCount());
    const maxColumn = model.getLineMaxColumn(lineNumber);
    const columnNumber = Math.min(Math.max(1, column || 1), maxColumn);

    const endLineNumber = endLine ? Math.min(Math.max(1, endLine), model.getLineCount()) : lineNumber;
    const endColumnNumber = endColumn
      ? Math.min(Math.max(1, endColumn), model.getLineMaxColumn(endLineNumber))
      : columnNumber;
    const selection = {
      startLineNumber: lineNumber,
      startColumn: columnNumber,
      endLineNumber,
      endColumn: endColumnNumber,
    };

    editor.setSelection(selection);
    editor.setPosition({ lineNumber, column: columnNumber });
    editor.revealLineInCenter(lineNumber);
    const highlights = editor.createDecorationsCollection([{
      range: selection,
      options: {
        className: 'symbolHighlight',
        stickiness: 1,
      },
    }]);
    window.setTimeout(() => highlights.clear(), 700);
    if (!isReadOnly) {
      editor.focus();
    }
    clearPendingJump();
  }, [pendingJump, activeFilePath, workspaceId, workspaceRoot, editorReadyTick, jumpRetryTick, clearPendingJump, isReadOnly]);

  const modelPath = activeFilePath
    ? getModelUri(workspaceId, activeFilePath, workspaceRoot).toString()
    : undefined;

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      <EditorTabs workspaceId={workspaceId} />
      <EditorMenuBar editorRef={editorRef} workspaceId={workspaceId} isReadOnly={isReadOnly} onToggleReadOnly={() => setIsReadOnly(r => !r)} isFullscreen={isFullscreen} onToggleFullscreen={() => setIsFullscreen(f => !f)} wordWrap={wordWrap} onToggleWordWrap={() => { const v = !wordWrap; setWordWrap(v); localStorage.setItem('editor-word-wrap', String(v)); }} minimap={minimap} onToggleMinimap={() => { const v = !minimap; setMinimap(v); localStorage.setItem('editor-minimap', String(v)); }} fontSize={fontSize} onZoomIn={() => setFontSize(s => { const n = Math.min(s + 1, 40); localStorage.setItem('editor-font-size', String(n)); return n; })} onZoomOut={() => setFontSize(s => { const n = Math.max(s - 1, 8); localStorage.setItem('editor-font-size', String(n)); return n; })} onZoomReset={() => { setFontSize(13); localStorage.setItem('editor-font-size', '13'); }} />
      <div
        className="relative flex-1 min-h-0"
        {...mobile.containerProps}
      >
        {isCommitDiff && commitDiffData ? (
          <CommitDiffViewer diffs={commitDiffData.diffs} message={commitDiffData.message} />
        ) : isPreviewable && showPreview && (mediaUrl || mediaType === 'markdown' || mediaType === 'mermaid') ? (
          <div className="relative flex justify-center h-full bg-muted/20 overflow-auto">
            {isCodePreviewToggle && (
              <button
                onClick={() => setShowPreview(false)}
                className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background/90 border text-xs text-muted-foreground hover:text-foreground hover:bg-background shadow-sm transition-colors cursor-pointer"
                title={t('switchToCode')}
              >
                <Code size={14} />
                {t('code')}
              </button>
            )}
            {mediaType === 'image' && (
              <img src={mediaUrl!} alt={activeFile?.name} className="max-w-full max-h-full object-contain" />
            )}
            {mediaType === 'video' && (
              <video src={mediaUrl!} controls className="max-w-full max-h-full" />
            )}
            {mediaType === 'audio' && (
              <div className="flex flex-col items-center gap-4">
                <div className="text-muted-foreground text-sm">{activeFile?.name}</div>
                <audio src={mediaUrl!} controls />
              </div>
            )}
            {mediaType === 'svg' && (
              <img src={mediaUrl!} alt={activeFile?.name} className="max-w-full max-h-full object-contain" />
            )}
            {mediaType === 'markdown' && activeContent && (
              <div className="prose prose-sm dark:prose-invert max-w-none w-full max-w-4xl mx-auto">
                <Markdown content={activeContent} workspaceId={workspaceId} />
              </div>
            )}
            {mediaType === 'mermaid' && activeContent && (
              <div className="w-full mx-auto">
                <MermaidPreview chart={activeContent} theme={resolvedTheme} />
              </div>
            )}
          </div>
        ) : activeFile && isCodePreviewToggle && !showPreview ? (
          <div className="relative flex flex-col h-full">
            <button
              onClick={() => setShowPreview(true)}
              className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background/90 border text-xs text-muted-foreground hover:text-foreground hover:bg-background shadow-sm transition-colors cursor-pointer"
              title={t('switchToPreview')}
            >
              <Eye size={14} />
              {t('preview')}
            </button>
            <MonacoEditor
              height="100%"
              language={getLanguage(activeFile.path)}
              value={activeContent}
              path={modelPath}
              onChange={(value, event) => {
                if (event.isFlush) return;
                const v = value || "";
                const modelFilePath = getFilePathFromModelUri(
                  editorRef.current?.getModel()?.uri,
                  workspaceId,
                  workspaceRoot,
                );
                if (!modelFilePath || modelFilePath !== activeFile.path) return;
                updateContent(modelFilePath, v);
              }}
              onMount={handleMount}
              options={{
                fontSize,
                minimap: { enabled: minimap },
                scrollBeyondLastLine: false,
                glyphMargin: true,
                lineNumbersMinChars: 3,
                padding: { top: 8 },
                renderLineHighlight: "gutter",
                readOnly: isReadOnly,
                wordWrap: wordWrap ? 'on' : 'off',
              }}
              theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
            />
          </div>
        ) : activeFile ? (
          <>
            <MonacoEditor
              height="100%"
              language={getLanguage(activeFile.path)}
              value={activeContent}
              path={modelPath}
              onChange={(value, event) => {
                if (event.isFlush) return;
                const v = value || "";
                const modelFilePath = getFilePathFromModelUri(
                  editorRef.current?.getModel()?.uri,
                  workspaceId,
                  workspaceRoot,
                );
                if (!modelFilePath || modelFilePath !== activeFile.path) return;
                updateContent(modelFilePath, v);
              }}
              onMount={handleMount}
              options={{
                fontSize,
                minimap: { enabled: minimap },
                scrollBeyondLastLine: false,
                glyphMargin: true,
                lineNumbersMinChars: 3,
                padding: { top: 8 },
                renderLineHighlight: "gutter",
                readOnly: isReadOnly,
                wordWrap: wordWrap ? 'on' : 'off',
                gotoLocation: {
                  multipleDefinitions: 'goto',
                  multipleTypeDefinitions: 'goto',
                  multipleDeclarations: 'goto',
                  multipleImplementations: 'goto',
                  multipleReferences: 'goto',
                },
              }}
              theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
            />
            {mobile.showMobileReadonlyOverlay ? (
              <MobileReadonlyOverlay
                activeContent={activeContent}
                wordWrap={wordWrap}
                mobileSelectionMode={mobile.mobileSelectionMode}
                mobileReadonlyMenu={mobile.mobileReadonlyMenu}
                mobileSelectionPreMetrics={mobile.mobileSelectionPreMetrics}
                mobileSelectionPreRef={mobile.mobileSelectionPreRef}
                mobileReadonlyMenuRef={mobile.mobileReadonlyMenuRef}
                onContextMenu={mobile.handleMobileSelectionContextMenu}
                onEnterSelectionMode={mobile.enterMobileSelectionMode}
                onCloseSelectionMode={mobile.closeMobileSelectionMode}
                onCopySelection={mobile.copyMobileSelection}
                onRunEditorAction={mobile.runMobileEditorAction}
                onRunBuiltinAction={mobile.runMobileBuiltinAction}
              />
            ) : null}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {t('openFileToEdit')}
          </div>
        )}
      </div>
      {activeFile && !isCommitDiff && (
        <EditorStatusBar file={activeFile} content={activeContent} t={t} />
      )}
    </div>
  );
}
