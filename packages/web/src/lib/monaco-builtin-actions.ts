import { registerMonacoAction, toRelativePath } from './monaco-action-registry';
import type { MonacoActionContext } from './monaco-action-registry';
import { useCodeFavoritesStore } from '@/stores/code-favorites';
import { toast } from 'sonner';

registerMonacoAction({
  id: 'copyPosition',
  label: '复制代码位置',
  contextMenuGroupId: '9_cutcopypaste',
  contextMenuOrder: 10,
  run: (editor, ctx) => {
    const model = editor.getModel();
    const sel = editor.getSelection();
    if (!model || !sel) return;
    const relPath = toRelativePath(model.uri.path, ctx);
    const base = `${relPath || model.uri.path}:${sel.startLineNumber}:${sel.startColumn}`;
    const pos = sel.endLineNumber > sel.startLineNumber ? `${base}-${sel.endLineNumber}` : base;
    navigator.clipboard.writeText(pos).then(() => {
      toast.success(`已复制: ${pos}`);
    });
  },
});

registerMonacoAction({
  id: 'addToFavorites',
  label: '添加到代码收藏',
  contextMenuGroupId: '9_cutcopypaste',
  contextMenuOrder: 11,
  run: (editor, ctx) => {
    const model = editor.getModel();
    const sel = editor.getSelection();
    if (!model || !sel) return;

    const line = sel.startLineNumber;
    const column = sel.startColumn;
    const endLine = sel.endLineNumber;
    const endColumn = sel.endColumn;
    const snippet = endLine > line
      ? model.getLineContent(line).trim() + ' …'
      : model.getLineContent(line).trim();
    const relPath = toRelativePath(model.uri.path, ctx);
    if (!relPath) return;

    const fileName = relPath.split('/').pop() || relPath;
    const lineLabel = endLine > line ? `${line}-${endLine}` : `${line}`;

    useCodeFavoritesStore.getState().setPendingFavorite({
      workspaceId: ctx.workspaceId,
      path: relPath,
      line,
      column,
      endLine,
      endColumn,
      label: `${fileName}:${lineLabel}`,
      snippet: snippet.length > 80 ? snippet.slice(0, 80) + '…' : snippet,
    });
  },
});
