"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { sdk } from '@/lib/sdk';
import { fetchWithAuth } from '@/lib/auth';
import type { WorkflowUiProject } from '@agent-spaces/sdk';
import * as AgentSpacesUI from '@/lib/ui-exports';
import { WorkflowUiPreview } from './workflow-ui-preview';
import { WorkflowUiPreviewToolbar } from './workflow-ui-preview-toolbar';
import { WorkflowUiChat } from './workflow-ui-chat';
import { WorkflowUiPluginToolsDialog } from './workflow-ui-plugin-tools-dialog';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import dynamic from 'next/dynamic';
import '@/lib/monaco-loader';

const FILE_POLL_INTERVAL_MS = 2000;
const LAST_SELECTION_CONFIG = 'last-selection.json';

function areFileListsEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((file, index) => file === right[index]);
}

function normalizeRelativePath(filePath: string, fallback: string) {
  const normalized = (filePath || fallback).trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0') || normalized.split('/').includes('..')) {
    throw new Error(`Invalid file path: ${filePath}`);
  }
  return normalized;
}

function inferDownloadFileName(url: string) {
  try {
    const parsed = new URL(url, window.location.href);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
    return lastSegment ? decodeURIComponent(lastSegment) : 'download.bin';
  } catch {
    return 'download.bin';
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
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

  // Mount host APIs used by Workflow UI preview code.
  useEffect(() => {
    const executePluginTool = async (pluginId: string, toolName: string, args: Record<string, any>) => {
      const resp = await fetchWithAuth(`/api/plugins/${pluginId}/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: toolName, args }),
      });
      const payload = await resp.json();
      if (!resp.ok) return payload;
      return Object.prototype.hasOwnProperty.call(payload, 'result') ? payload.result : payload;
    };

    const readConfigJson = async <T,>(filePath = LAST_SELECTION_CONFIG): Promise<T | null> => {
      const path = normalizeRelativePath(filePath, LAST_SELECTION_CONFIG);
      const resp = await fetchWithAuth(`/api/workflows-ui/${projectId}/configs/content?path=${encodeURIComponent(path)}`);
      if (!resp.ok) throw new Error(`Failed to read config: ${resp.status} ${resp.statusText}`);
      const { value } = await resp.json();
      return value;
    };

    const writeConfigJson = async (filePath: string, value: unknown) => {
      const path = normalizeRelativePath(filePath, LAST_SELECTION_CONFIG);
      const resp = await fetchWithAuth(`/api/workflows-ui/${projectId}/configs/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, value }),
      });
      if (!resp.ok) throw new Error(`Failed to write config: ${resp.status} ${resp.statusText}`);
      return { ok: true, path: `configs/${path}` };
    };

    const readLastSelection = <T,>() => readConfigJson<T>(LAST_SELECTION_CONFIG);
    const writeLastSelection = (value: unknown) => writeConfigJson(LAST_SELECTION_CONFIG, value);

    const saveDataFile = async (filePath: string, content: string | Blob | ArrayBuffer | Uint8Array) => {
      const path = normalizeRelativePath(filePath, 'download.bin');
      if (typeof content === 'string') {
        const resp = await fetchWithAuth(`/api/workflows-ui/${projectId}/data/content`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, content }),
        });
        if (!resp.ok) throw new Error(`Failed to save data file: ${resp.status} ${resp.statusText}`);
        return resp.json();
      }

      const blob = content instanceof Blob ? content : new Blob([content]);
      const base64 = await blobToBase64(blob);
      const resp = await fetchWithAuth(`/api/workflows-ui/${projectId}/data/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content: base64, encoding: 'base64' }),
      });
      if (!resp.ok) throw new Error(`Failed to save data file: ${resp.status} ${resp.statusText}`);
      return resp.json();
    };

    const downloadFile = async (url: string, filePath?: string, init?: RequestInit) => {
      const response = await fetch(url, init);
      if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      const path = normalizeRelativePath(filePath ?? inferDownloadFileName(url), 'download.bin');
      const base64 = await blobToBase64(await response.blob());
      const resp = await fetchWithAuth(`/api/workflows-ui/${projectId}/data/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content: base64, encoding: 'base64' }),
      });
      if (!resp.ok) throw new Error(`Failed to save downloaded file: ${resp.status} ${resp.statusText}`);
      return resp.json();
    };

    const hostUi = {
      ...AgentSpacesUI,
      readConfigJson,
      writeConfigJson,
      readLastSelection,
      writeLastSelection,
      saveDataFile,
      downloadFile,
    };

    (window as any).AgentSpacesUI = hostUi;
    (window as any).AgentSpaces = {
      callPluginTool: executePluginTool,
      executePluginTool,
      readConfigJson,
      writeConfigJson,
      readLastSelection,
      writeLastSelection,
      saveDataFile,
      downloadFile,
    };
    (window as any).AgentSpacesAPI = {
      callPluginTool: executePluginTool,
      executePluginTool,
      readConfigJson,
      writeConfigJson,
      readLastSelection,
      writeLastSelection,
      saveDataFile,
      downloadFile,
    };
    return () => {
      delete (window as any).AgentSpacesUI;
      delete (window as any).AgentSpaces;
      delete (window as any).AgentSpacesAPI;
    };
  }, [projectId]);

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
      await sdk.workflowUi.writeFile(projectId, activeFile, sourceCode);
      loadedFileContentRef.current = sourceCode;
      localDirtyRef.current = false;
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, [projectId, activeFile, sourceCode]);

  const handleManualRefresh = useCallback(async () => {
    await refreshFileTree();
    await refreshActiveFile({ force: true, syncPreview: true });
  }, [refreshActiveFile, refreshFileTree]);

  const handleFileSelect = useCallback(async (file: string) => {
    if (activeFile && sourceCode) {
      await sdk.workflowUi.writeFile(projectId, activeFile, sourceCode).catch(() => {});
      loadedFileContentRef.current = sourceCode;
      localDirtyRef.current = false;
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
                localDirtyRef.current = nextCode !== loadedFileContentRef.current;
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
                  () => handleSave(),
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
