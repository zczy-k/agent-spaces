"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Check, Pencil, Share2 } from 'lucide-react';
import { sdk } from '@/lib/sdk';
import type { WorkflowUiProject } from '@agent-spaces/sdk';
import { WorkflowUiPreview } from './workflow-ui-preview';
import { WorkflowUiPreviewToolbar } from './workflow-ui-preview-toolbar';
import { useWorkflowUiHostApi } from './use-workflow-ui-host-api';
import { WorkflowUiChat } from './workflow-ui-chat';
import { WorkflowUiPluginToolsDialog } from './workflow-ui-plugin-tools-dialog';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { BackButton } from '@/components/common/back-button';
import { ShareDialog } from '@/components/common/share-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MonacoCodeEditor as MonacoEditor } from '@/components/editor/monaco-code-editor';

const FILE_POLL_INTERVAL_MS = 2000;

function areFileListsEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((file, index) => file === right[index]);
}

interface WorkflowUiEditorProps {
  projectId: string;
}

export function WorkflowUiEditor({ projectId }: WorkflowUiEditorProps) {
  const t = useTranslations('workflows-ui');
  const [project, setProject] = useState<WorkflowUiProject | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string>('');
  const [sourceCode, setSourceCode] = useState('');
  const [previewCode, setPreviewCode] = useState('');
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pluginDialogOpen, setPluginDialogOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/workflows-ui-preview/${projectId}`
    : '';
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localDirtyRef = useRef(false);
  const loadedFileContentRef = useRef('');
  const filesRef = useRef<string[]>([]);
  const previewCodeRef = useRef('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'modified' | 'saving'>('saved');
  const handleSaveRef = useRef<() => Promise<void>>(async () => {});

  // Mount host APIs used by Workflow UI preview code.
  useWorkflowUiHostApi(projectId);

  // Load project
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const p = await sdk.workflowUi.get(projectId);
        const tree = await sdk.workflowUi.getFileTree(projectId);
        if (cancelled) return;
        setProject(p);
        setFiles(tree);
        filesRef.current = tree;
        if (tree.length > 0) {
          const mainFile = tree.includes(p.mainFile) ? p.mainFile : tree[0];
          setActiveFile(mainFile);
          const { content } = await sdk.workflowUi.readFile(projectId, mainFile);
          if (!cancelled) {
            setSourceCode(content);
            setPreviewCode(content);
            previewCodeRef.current = content;
            loadedFileContentRef.current = content;
            localDirtyRef.current = false;
            setSaveStatus('saved');
          }
        }
      } catch (error) {
        console.error('Failed to load project:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  const refreshFileTree = useCallback(async () => {
    try {
      const tree = await sdk.workflowUi.getFileTree(projectId);
      if (!areFileListsEqual(filesRef.current, tree)) {
        filesRef.current = tree;
        setFiles(tree);
      }
      return tree;
    } catch (error) {
      console.error('Failed to refresh file tree:', error);
      return null;
    }
  }, [projectId]);

  const refreshActiveFile = useCallback(async (options?: { force?: boolean; syncPreview?: boolean }) => {
    if (!activeFile) return;

    try {
      const { content } = await sdk.workflowUi.readFile(projectId, activeFile);
      const fileChanged = content !== loadedFileContentRef.current;
      if (!fileChanged && !options?.force) return;

      const shouldUpdateEditor = options?.force || !localDirtyRef.current;

      if (shouldUpdateEditor) {
        loadedFileContentRef.current = content;
        localDirtyRef.current = false;
        setSaveStatus('saved');
        setSourceCode(content);
      }

      if (options?.syncPreview && shouldUpdateEditor) {
        if (content !== previewCodeRef.current || options.force) {
          previewCodeRef.current = content;
          setPreviewCode(content);
          setPreviewRefreshKey((key) => key + 1);
        }
      }
    } catch (error) {
      console.error('Failed to refresh file:', error);
    }
  }, [projectId, activeFile]);

  // Poll latest files written outside this editor, for example by workflow UI agents.
  useEffect(() => {
    if (!activeFile) return;

    const interval = setInterval(() => {
      refreshFileTree();
      refreshActiveFile({ syncPreview: autoRefresh });
    }, FILE_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [activeFile, autoRefresh, refreshActiveFile, refreshFileTree]);

  // Auto-refresh debounce
  useEffect(() => {
    if (!autoRefresh) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (sourceCode !== previewCodeRef.current) {
        previewCodeRef.current = sourceCode;
        setPreviewCode(sourceCode);
        setPreviewRefreshKey((key) => key + 1);
      }
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sourceCode, autoRefresh]);

  const handleSave = useCallback(async () => {
    if (!activeFile) return;
    try {
      setSaveStatus('saving');
      await sdk.workflowUi.writeFile(projectId, activeFile, sourceCode);
      loadedFileContentRef.current = sourceCode;
      localDirtyRef.current = false;
      setSaveStatus('saved');
    } catch (error) {
      console.error('Failed to save file:', error);
      setSaveStatus(localDirtyRef.current ? 'modified' : 'saved');
    }
  }, [projectId, activeFile, sourceCode]);

  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  const handleManualRefresh = useCallback(async () => {
    await refreshFileTree();
    await refreshActiveFile({ force: true, syncPreview: true });
  }, [refreshActiveFile, refreshFileTree]);

  const handleFileSelect = useCallback(async (file: string) => {
    if (activeFile && sourceCode) {
      await sdk.workflowUi.writeFile(projectId, activeFile, sourceCode).catch(() => {});
      loadedFileContentRef.current = sourceCode;
      localDirtyRef.current = false;
      setSaveStatus('saved');
    }
    try {
      const { content } = await sdk.workflowUi.readFile(projectId, file);
      setActiveFile(file);
      setSourceCode(content);
      setPreviewCode(content);
      previewCodeRef.current = content;
      setPreviewRefreshKey((key) => key + 1);
      loadedFileContentRef.current = content;
      localDirtyRef.current = false;
      setSaveStatus('saved');
    } catch (error) {
      console.error('Failed to load file:', error);
    }
  }, [projectId, activeFile, sourceCode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return <div className="p-4 text-muted-foreground">{t('editor.notFound')}</div>;
  }

  return (
    <div className="flex flex-col h-full gap-2 p-2">
      {/* Top toolbar */}
      <div className="flex items-center gap-2 px-2 py-1 rounded-xl bg-muted/30 border border-border">
        <BackButton />
        <div className="flex-1">
          <WorkflowUiPreviewToolbar
            autoRefresh={autoRefresh}
            onAutoRefreshChange={setAutoRefresh}
            onRefresh={handleManualRefresh}
            onOpenPluginDialog={() => setPluginDialogOpen(true)}
          />
        </div>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setShareOpen(true)}>
          <Share2 className="size-4" />
        </Button>
      </div>

      {/* Main content */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
        {/* Left: file tree + editor */}
        <ResizablePanel id="workflow-ui-editor" defaultSize="30%" minSize="15%" className="flex flex-col">
          <div className="flex flex-col h-full rounded-xl border border-border bg-background overflow-hidden">
          {/* File tree */}
          <div className="border-b border-border p-2 max-h-48 overflow-auto">
            <div className="text-xs font-medium text-muted-foreground mb-1">{t('editor.files')}</div>
            <div className="flex flex-wrap gap-1">
            {files.map((file) => (
              <Badge
                key={file}
                variant={file === activeFile ? 'default' : 'secondary'}
                className="cursor-pointer text-xs"
                onClick={() => handleFileSelect(file)}
              >
                {file}
              </Badge>
            ))}
            </div>
          </div>
          {/* Code editor */}
          <div className="flex-1 min-h-0">
            <MonacoEditor
              height="100%"
              language="typescript"
              theme="vs-dark"
              value={sourceCode}
              onChange={(v) => {
                const nextCode = v || '';
                const dirty = nextCode !== loadedFileContentRef.current;
                localDirtyRef.current = dirty;
                setSaveStatus(dirty ? 'modified' : 'saved');
                setSourceCode(nextCode);
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 8 },
                overviewRulerBorder: false,
                hideCursorInOverviewRuler: true,
                scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
                "semanticHighlighting.enabled": false,
                renderWhitespace: 'none',
                wordBasedSuggestions: 'off',
              }}
              onMount={(editor, monaco) => {
                monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                  noSemanticValidation: true,
                  noSyntaxValidation: true,
                });
                editor.addCommand(
                  // eslint-disable-next-line no-bitwise
                  monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
                  () => handleSaveRef.current(),
                );
              }}
            />
          </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: preview */}
        <ResizablePanel id="workflow-ui-preview" defaultSize="70%" minSize="30%" className="flex flex-col">
          <div className="flex flex-col h-full rounded-xl border border-border bg-background overflow-hidden">
          <WorkflowUiPreview
            key={previewRefreshKey}
            type={project.type}
            sourceCode={previewCode}
            error={previewError}
            onError={setPreviewError}
          />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Bottom status bar */}
      <div className="flex items-center gap-4 px-3 py-1 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground">
        <span>{project.name}</span>
        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
          {project.type === 'react' ? 'React' : 'HTML'}
        </span>
        <span>{t('editor.fileCount', { count: files.length })}</span>
        <span className="ml-auto">{activeFile}</span>
        {saveStatus === 'modified' && (
          <span className="flex items-center gap-1 text-amber-500">
            <Pencil className="h-3 w-3" />
            {t('editor.modified')}
          </span>
        )}
        {saveStatus === 'saving' && (
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t('editor.saving')}
          </span>
        )}
        {saveStatus === 'saved' && (
          <span className="flex items-center gap-1 text-emerald-500">
            <Check className="h-3 w-3" />
            {t('editor.saved')}
          </span>
        )}
      </div>

      <WorkflowUiChat
        project={project}
        activeFilePath={activeFile}
        fileContent={sourceCode}
        onUpdateProject={(updates) => {
          if (project) {
            sdk.workflowUi.update(project.id, updates);
            setProject({ ...project, ...updates });
          }
        }}
      />

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} title={project.name} url={shareUrl} />

      <WorkflowUiPluginToolsDialog
        open={pluginDialogOpen}
        onOpenChange={setPluginDialogOpen}
        projectId={project.id}
        enabledPlugins={project.enabledPlugins ?? []}
        onEnabledPluginsChange={(plugins) => {
          if (project) setProject({ ...project, enabledPlugins: plugins });
        }}
      />
    </div>
  );
}
