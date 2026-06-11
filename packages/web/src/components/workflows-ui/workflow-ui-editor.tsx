"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Check, Pencil, Share2, Puzzle, FolderOpen, Copy } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileTree, FileTreeFile, FileTreeFolder } from '@/components/editor/file-tree';
import { FileIconImg, FolderIconImg } from '@/components/editor/file-icon';
import { MonacoCodeEditor as MonacoEditor } from '@/components/editor/monaco-code-editor';

const FILE_POLL_INTERVAL_MS = 2000;

/** Convert flat file paths into a nested tree structure */
interface TreeNode {
    name: string;
    path: string;
    children: TreeNode[];
    isFile: boolean;
}

function buildFileTree(files: string[]): TreeNode[] {
    const root: TreeNode[] = [];
    for (const filePath of files) {
        const parts = filePath.split('/');
        let current = root;
        let currentPath = '';
        for (let i = 0; i < parts.length; i++) {
            currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
            const isFile = i === parts.length - 1;
            let node = current.find((n) => n.name === parts[i]);
            if (!node) {
                node = { name: parts[i], path: currentPath, children: [], isFile };
                current.push(node);
            }
            current = node.children;
        }
    }
    // Sort: folders first, then files; alphabetical within each group
    const sortNodes = (nodes: TreeNode[]) =>
        nodes.sort((a, b) => {
            if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
            return a.name.localeCompare(b.name);
        });
    const sortRecursive = (nodes: TreeNode[]) => {
        sortNodes(nodes);
        nodes.forEach((n) => sortRecursive(n.children));
    };
    sortRecursive(root);
    return root;
}

/** Collect all folder paths for default-expanded state */
function collectFolderPaths(nodes: TreeNode[]): string[] {
    const paths: string[] = [];
    for (const node of nodes) {
        if (!node.isFile) {
            paths.push(node.path);
            paths.push(...collectFolderPaths(node.children));
        }
    }
    return paths;
}

/** Recursively render tree nodes with folder/file icons */
function renderTreeNodes(nodes: TreeNode[]) {
    return nodes.map((node) =>
        node.isFile ? (
            <FileTreeFile key={node.path} path={node.path} name={node.name} icon={<FileIconImg name={node.name} />} />
        ) : (
            <FileTreeFolder key={node.path} path={node.path} name={node.name} folderIcon={(isOpen) => <FolderIconImg name={node.name} isOpen={isOpen} />}>
                {renderTreeNodes(node.children)}
            </FileTreeFolder>
        ),
    );
}

function areFileListsEqual(left: string[], right: string[]) {
    return left.length === right.length && left.every((file, index) => file === right[index]);
}

/** Build preview payload: merge cached files with current editor content */
function buildPreviewSnapshot(
    cache: Record<string, string>,
    activeFile: string,
    activeContent: string,
): Record<string, string> {
    return { ...cache, [activeFile]: activeContent };
}

async function readProjectFiles(projectId: string, tree: string[]): Promise<Record<string, string>> {
    const contents: Record<string, string> = {};
    for (const file of tree) {
        try {
            const { content } = await sdk.workflowUi.readFile(projectId, file);
            contents[file] = content;
        } catch { /* skip unreadable files */ }
    }
    return contents;
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
    const [previewFiles, setPreviewFiles] = useState<Record<string, string>>({});
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
    const filesContentRef = useRef<Record<string, string>>({});
    const mainFileRef = useRef<string>('index.jsx');
    const sourceCodeRef = useRef('');
    const [saveStatus, setSaveStatus] = useState<'saved' | 'modified' | 'saving'>('saved');
    const handleSaveRef = useRef<() => Promise<void>>(async () => { });

    // Helper: trigger preview refresh with the main file as entry point
    const triggerPreview = useCallback((snapshot: Record<string, string>, mainFile: string) => {
        const mainContent = snapshot[mainFile] || '';
        previewCodeRef.current = mainContent;
        setPreviewCode(mainContent);
        setPreviewFiles(snapshot);
        setPreviewRefreshKey((key) => key + 1);
    }, []);

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
                mainFileRef.current = p.mainFile || 'index.jsx';

                // Load ALL file contents for multi-file import resolution
                const contents = await readProjectFiles(projectId, tree);
                filesContentRef.current = contents;

                if (tree.length > 0) {
                    const mainFile = tree.includes(p.mainFile) ? p.mainFile : tree[0];
                    setActiveFile(mainFile);
                    const mainContent = contents[mainFile] || '';
                    if (!cancelled) {
                        setSourceCode(mainContent);
                        sourceCodeRef.current = mainContent;
                        triggerPreview(contents, mainFile);
                        loadedFileContentRef.current = mainContent;
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
    }, [projectId, triggerPreview]);

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

    const refreshProjectFiles = useCallback(async (
        tree: string[],
        options?: { force?: boolean; syncPreview?: boolean },
    ) => {
        if (!activeFile) return;

        try {
            const contents = await readProjectFiles(projectId, tree);
            const content = contents[activeFile];
            if (content === undefined) {
                filesContentRef.current = contents;
                if (options?.syncPreview) {
                    triggerPreview(contents, mainFileRef.current);
                }
                return;
            }

            const fileChanged = content !== loadedFileContentRef.current;
            const cacheChanged = Object.keys(contents).length !== Object.keys(filesContentRef.current).length
                || Object.entries(contents).some(([file, nextContent]) => filesContentRef.current[file] !== nextContent);

            const shouldUpdateEditor = options?.force || !localDirtyRef.current;

            if (shouldUpdateEditor) {
                loadedFileContentRef.current = content;
                localDirtyRef.current = false;
                setSaveStatus('saved');
                setSourceCode(content);
                sourceCodeRef.current = content;
            }

            const snapshot = shouldUpdateEditor
                ? contents
                : buildPreviewSnapshot(contents, activeFile, sourceCodeRef.current);
            filesContentRef.current = snapshot;

            if (options?.syncPreview && (cacheChanged || fileChanged || options?.force || localDirtyRef.current)) {
                triggerPreview(snapshot, mainFileRef.current);
            }
        } catch (error) {
            console.error('Failed to refresh workflow UI files:', error);
        }
    }, [projectId, activeFile, triggerPreview]);

    // Poll latest files written outside this editor, for example by workflow UI agents.
    useEffect(() => {
        if (!activeFile) return;

        const interval = setInterval(() => {
            refreshFileTree().then((tree) => {
                if (tree) refreshProjectFiles(tree, { syncPreview: autoRefresh });
            });
        }, FILE_POLL_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [activeFile, autoRefresh, refreshFileTree, refreshProjectFiles]);

    // Auto-refresh debounce — update files map, preview main entry point
    useEffect(() => {
        if (!autoRefresh) return;
        if (!localDirtyRef.current) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            // mainFile via ref (avoids React Compiler dep issue)
            const snapshot = buildPreviewSnapshot(filesContentRef.current, activeFile, sourceCode);
            filesContentRef.current = snapshot;
            triggerPreview(snapshot, mainFileRef.current);
        }, 800);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [sourceCode, autoRefresh, activeFile, triggerPreview]);

    const handleSave = useCallback(async () => {
        if (!activeFile) return;
        try {
            setSaveStatus('saving');
            await sdk.workflowUi.writeFile(projectId, activeFile, sourceCode);
            loadedFileContentRef.current = sourceCode;
            sourceCodeRef.current = sourceCode;
            filesContentRef.current[activeFile] = sourceCode;
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
        const tree = await refreshFileTree();
        if (tree) await refreshProjectFiles(tree, { force: true, syncPreview: true });
    }, [refreshFileTree, refreshProjectFiles]);

    const handleFileSelect = useCallback(async (file: string) => {
        // Save current file and update cache
        if (activeFile && sourceCode) {
            await sdk.workflowUi.writeFile(projectId, activeFile, sourceCode).catch(() => { });
            filesContentRef.current[activeFile] = sourceCode;
            loadedFileContentRef.current = sourceCode;
            localDirtyRef.current = false;
            setSaveStatus('saved');
        }
        try {
            const { content } = await sdk.workflowUi.readFile(projectId, file);
            setActiveFile(file);
            setSourceCode(content);
            sourceCodeRef.current = content;
            filesContentRef.current[file] = content;
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
                <span className="text-sm font-medium truncate max-w-40">{project.name}</span>
                <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                    {project.type === 'react' ? 'React' : 'HTML'}
                </span>
                <div className="flex-1" />
                {saveStatus === 'modified' && (
                    <span className="flex items-center gap-1 text-xs text-amber-500">
                        <Pencil className="h-3 w-3" />
                        {t('editor.modified')}
                    </span>
                )}
                {saveStatus === 'saving' && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t('editor.saving')}
                    </span>
                )}
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setPluginDialogOpen(true)}>
                    <Puzzle className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setShareOpen(true)}>
                    <Share2 className="size-4" />
                </Button>
            </div>

            {/* Main content */}
            <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
                {/* Left: file tree + editor */}
                <ResizablePanel id="workflow-ui-editor" defaultSize="30%" minSize="15%" className="flex flex-col">
                    <div className="flex flex-col h-full rounded-xl border border-border bg-background overflow-hidden">
                        {/* Toolbar with file picker */}
                        <div className="flex items-center justify-between px-2 py-1 border-b border-border">
                            <div className="flex items-center gap-0.5 min-w-0 flex-1">
                                <span className="text-xs text-muted-foreground truncate max-w-[60%]" title={activeFile}>{activeFile}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-5 shrink-0"
                                    onClick={() => navigator.clipboard.writeText(activeFile)}
                                >
                                    <Copy className="size-3" />
                                </Button>
                            </div>
                            <Popover>
                                <PopoverTrigger
                                    render={<Button variant="ghost" size="icon" className="size-6" />}
                                >
                                    <FolderOpen className="size-3.5" />
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-56 p-0 max-h-64 overflow-auto">
                                    <FileTree
                                        defaultExpanded={new Set(collectFolderPaths(buildFileTree(files)))}
                                        selectedPath={activeFile}
                                        onFileSelect={(path) => { handleFileSelect(path); }}
                                    >
                                        {renderTreeNodes(buildFileTree(files))}
                                    </FileTree>
                                </PopoverContent>
                            </Popover>
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
                                    sourceCodeRef.current = nextCode;
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
                        <div className="flex items-center justify-between px-2 py-1 border-b border-border">
                            <WorkflowUiPreviewToolbar
                                autoRefresh={autoRefresh}
                                onAutoRefreshChange={setAutoRefresh}
                                onRefresh={handleManualRefresh}
                            />
                        </div>
                        <WorkflowUiPreview
                            key={previewRefreshKey}
                            type={project.type}
                            sourceCode={previewCode}
                            error={previewError}
                            onError={setPreviewError}
                            projectId={project.id}
                            projectName={project.name}
                            hideHeader={true}
                            files={previewFiles}
                            mainFile={project.mainFile}
                        />
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>

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
