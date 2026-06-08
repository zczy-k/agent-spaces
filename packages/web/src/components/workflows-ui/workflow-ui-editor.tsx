"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Check, Pencil } from 'lucide-react';
import { sdk } from '@/lib/sdk';
import type { WorkflowUiProject } from '@agent-spaces/sdk';
import { WorkflowUiPreview } from './workflow-ui-preview';
import { WorkflowUiPreviewToolbar } from './workflow-ui-preview-toolbar';
import { useWorkflowUiHostApi } from './use-workflow-ui-host-api';
import { WorkflowUiChat } from './workflow-ui-chat';
import { WorkflowUiPluginToolsDialog } from './workflow-ui-plugin-tools-dialog';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import dynamic from 'next/dynamic';
import '@/lib/monaco-loader';

const FILE_POLL_INTERVAL_MS = 2000;

function areFileListsEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((file, index) => file === right[index]);
}

const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.default),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading editor...</div> },
);

interface WorkflowUiEditorProps {
  projectId: string;
}

export function WorkflowUiEditor({ projectId }: WorkflowUiEditorProps) {
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
    return <div className="p-4 text-muted-foreground">项目不存在</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Main content */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Left: file tree + editor */}
        <ResizablePanel id="workflow-ui-editor" defaultSize="30%" minSize="15%" className="flex flex-col">
          {/* File tree */}
          <div className="border-b border-border p-2 max-h-48 overflow-auto">
            <div className="text-xs font-medium text-muted-foreground mb-1">文件</div>
            {files.map((file) => (
              <button
                key={file}
                className={`w-full text-left px-2 py-1 text-xs rounded cursor-pointer ${
                  file === activeFile ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                }`}
                onClick={() => handleFileSelect(file)}
              >
                {file}
              </button>
            ))}
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
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right: preview */}
        <ResizablePanel id="workflow-ui-preview" defaultSize="70%" minSize="30%" className="flex flex-col">
           <WorkflowUiPreviewToolbar
            autoRefresh={autoRefresh}
            onAutoRefreshChange={setAutoRefresh}
            onRefresh={handleManualRefresh}
            onOpenPluginDialog={() => setPluginDialogOpen(true)}
          />
          <WorkflowUiPreview
            key={previewRefreshKey}
            type={project.type}
            sourceCode={previewCode}
            error={previewError}
            onError={setPreviewError}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Bottom status bar */}
      <div className="flex items-center gap-4 px-3 py-1 border-t border-border bg-muted/30 text-xs text-muted-foreground">
        <span>{project.name}</span>
        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
          {project.type === 'react' ? 'React' : 'HTML'}
        </span>
        <span>{files.length} 文件</span>
        <span className="ml-auto">{activeFile}</span>
        {saveStatus === 'modified' && (
          <span className="flex items-center gap-1 text-amber-500">
            <Pencil className="h-3 w-3" />
            已修改
          </span>
        )}
        {saveStatus === 'saving' && (
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            保存中...
          </span>
        )}
        {saveStatus === 'saved' && (
          <span className="flex items-center gap-1 text-emerald-500">
            <Check className="h-3 w-3" />
            已保存
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
