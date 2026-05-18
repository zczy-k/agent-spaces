import { useEditorStore } from "@/stores/editor";
import {
  getFilePathFromModelUri,
  inferWorkspaceRootFromModelUri,
  getImportSpecifierAtLine,
  resolveImportSpecifierPath,
  readWorkspaceFile,
  findExportedSymbolPosition,
} from "./code-editor-utils";
import type * as Monaco from 'monaco-editor';

interface NavigationParams {
  activeFilePath: string | null | undefined;
  workspaceId: string;
  workspaceRoot: string | undefined;
  jumpToPosition: (workspaceId: string, path: string, line: number, column?: number, endLine?: number, endColumn?: number) => Promise<void>;
}

export function registerNavigationActions(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  disposables: Monaco.IDisposable[],
  params: NavigationParams,
) {
  for (const disposable of disposables) {
    disposable.dispose();
  }
  disposables.length = 0;

  const { activeFilePath, workspaceId, workspaceRoot, jumpToPosition } = params;

  disposables.push(
    editor.onContextMenu((event) => {
      const position = event.target.position;
      if (!position) return;
      const sel = editor.getSelection();
      const inSelection = sel && !sel.isEmpty() && sel.containsPosition(position);
      if (!inSelection) {
        editor.setPosition(position);
      }
      console.info('[monaco-navigation] context menu position', {
        uri: editor.getModel()?.uri.toString(),
        lineNumber: position.lineNumber,
        column: position.column,
        word: editor.getModel()?.getWordAtPosition(position)?.word,
      });
    }),
    monaco.editor.registerEditorOpener({
      openCodeEditor: async (source, resource, selectionOrPosition) => {
        const inferredRoot = inferWorkspaceRootFromModelUri(source.getModel()?.uri, activeFilePath ?? null);
        const targetPath = getFilePathFromModelUri(resource, workspaceId, workspaceRoot, inferredRoot);
        if (!targetPath) {
          console.warn('[monaco-navigation] failed to map target uri', {
            uri: resource.toString(),
            workspaceRoot,
            inferredRoot,
            activeFilePath,
          });
          return false;
        }

        const sourcePath = getFilePathFromModelUri(source.getModel()?.uri, workspaceId, workspaceRoot, inferredRoot);
        const line = selectionOrPosition && 'lineNumber' in selectionOrPosition
          ? selectionOrPosition.lineNumber
          : selectionOrPosition?.startLineNumber;
        const column = selectionOrPosition && 'column' in selectionOrPosition
          ? selectionOrPosition.column
          : selectionOrPosition?.startColumn;

        console.info('[monaco-navigation] open target', {
          uri: resource.toString(),
          targetPath,
          sourcePath,
          line,
          column,
        });

        if (sourcePath === targetPath && line) {
          const model = source.getModel();
          const specifier = model ? getImportSpecifierAtLine(model, line) : null;
          const resolvedPath = specifier
            ? await resolveImportSpecifierPath(workspaceId, sourcePath, specifier)
            : null;

          if (resolvedPath && resolvedPath !== sourcePath) {
            const symbolName = model?.getWordAtPosition(source.getPosition() ?? { lineNumber: line, column: column || 1 })?.word;
            const targetContent = symbolName ? await readWorkspaceFile(workspaceId, resolvedPath) : null;
            const symbolPosition = targetContent && symbolName
              ? findExportedSymbolPosition(targetContent, symbolName)
              : null;
            console.info('[monaco-navigation] resolved import target', {
              specifier,
              sourcePath,
              resolvedPath,
              symbolName,
              symbolPosition,
            });
            window.setTimeout(() => {
              void jumpToPosition(
                workspaceId,
                resolvedPath,
                symbolPosition?.line ?? 1,
                symbolPosition?.column ?? 1,
                symbolPosition?.line,
                symbolPosition?.endColumn,
              ).then(() => {
                console.info('[monaco-navigation] jumped to resolved import target', {
                  resolvedPath,
                });
              });
            }, 0);
            return true;
          }
        }

        if (!line) {
          await useEditorStore.getState().openFile(workspaceId, targetPath);
          return true;
        }

        if (sourcePath === targetPath) {
          source.setPosition({ lineNumber: line, column: column || 1 });
          source.revealLineInCenter(line);
          return true;
        }

        window.setTimeout(() => {
          void jumpToPosition(workspaceId, targetPath, line, column);
        }, 0);
        return true;
      },
    }),
    editor.addAction({
      id: 'agentSpaces.showDefinition',
      label: 'Show Definition',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.11,
      run: (currentEditor) => currentEditor.getAction('editor.action.peekDefinition')?.run(),
    }),
    editor.addAction({
      id: 'agentSpaces.showReferences',
      label: 'Show References',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.46,
      run: (currentEditor) => currentEditor.getAction('editor.action.referenceSearch.trigger')?.run(),
    }),
    editor.addAction({
      id: 'agentSpaces.find',
      label: 'Find',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF],
      run: (currentEditor) => currentEditor.getAction('actions.find')?.run(),
    }),
    editor.addAction({
      id: 'agentSpaces.replace',
      label: 'Replace',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyH],
      run: (currentEditor) => currentEditor.getAction('editor.action.startFindReplaceAction')?.run(),
    }),
    editor.addAction({
      id: 'agentSpaces.findInFiles',
      label: 'Find in Files',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      run: () => {
        useEditorStore.getState().setRevealPath('__search_panel__');
      },
    }),
    editor.addAction({
      id: 'agentSpaces.goToLine',
      label: 'Go to Line...',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG],
      run: (currentEditor) => currentEditor.getAction('editor.action.gotoLine')?.run(),
    }),
    editor.addAction({
      id: 'agentSpaces.formatDocument',
      label: 'Format Document',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyI],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: (currentEditor) => currentEditor.getAction('editor.action.formatDocument')?.run(),
    }),
  );
}
