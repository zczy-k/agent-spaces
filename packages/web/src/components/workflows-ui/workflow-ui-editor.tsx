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
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pluginDialogOpen, setPluginDialogOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mount window.AgentSpacesUI
  useEffect(() => {
    (window as any).AgentSpacesUI = AgentSpacesUI;
    (window as any).AgentSpacesAPI = {
      executePluginTool: async (pluginId: string, toolName: string, args: Record<string, any>) => {
        const resp = await fetchWithAuth(`/api/plugins/${pluginId}/tools/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: toolName, args }),
        });
        return resp.json();
      },
    };
    return () => {
      delete (window as any).AgentSpacesUI;
      delete (window as any).AgentSpacesAPI;
    };
  }, []);

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
        if (tree.length > 0) {
          const mainFile = tree.includes(p.mainFile) ? p.mainFile : tree[0];
          setActiveFile(mainFile);
          const { content } = await sdk.workflowUi.readFile(projectId, mainFile);
          if (!cancelled) {
            setSourceCode(content);
            setPreviewCode(content);
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

  // Auto-refresh debounce
  useEffect(() => {
    if (!autoRefresh) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewCode(sourceCode);
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sourceCode, autoRefresh]);

  const handleSave = useCallback(async () => {
    if (!activeFile) return;
    try {
      await sdk.workflowUi.writeFile(projectId, activeFile, sourceCode);
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, [projectId, activeFile, sourceCode]);

  const handleManualRefresh = useCallback(() => {
    setPreviewCode(sourceCode);
  }, [sourceCode]);

  const handleFileSelect = useCallback(async (file: string) => {
    if (activeFile && sourceCode) {
      await sdk.workflowUi.writeFile(projectId, activeFile, sourceCode).catch(() => {});
    }
    try {
      const { content } = await sdk.workflowUi.readFile(projectId, file);
      setActiveFile(file);
      setSourceCode(content);
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
              onChange={(v) => setSourceCode(v || '')}
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
