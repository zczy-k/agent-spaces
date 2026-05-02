import { Extension, type Editor } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';

import { COMMANDS } from '@/lib/commands';
import { createSuggestionRenderer } from './create-suggestion-renderer';

type EditorRange = { from: number; to: number };

export function createSlashExtension(openFilePicker?: () => void) {
  return Extension.create({
    name: 'slashCommand',
    addOptions() {
      return {
        suggestion: {
          char: '/',
          items: ({ query }: { query: string }) => {
            const keyword = query.toLowerCase();
            return COMMANDS.filter((item) =>
              `${item.title} ${item.description}`.toLowerCase().includes(keyword)
            ).map((item) => ({
              id: item.id,
              title: item.title,
              description: item.description,
            }));
          },
          command: ({
            editor,
            range,
            props,
          }: {
            editor: Editor;
            range: EditorRange;
            props: { id: string; title: string; description: string };
          }) => {
            editor.chain().focus().deleteRange(range).run();
            switch (props.id) {
              case 'heading1':
                editor.chain().focus().toggleHeading({ level: 1 }).run();
                break;
              case 'blockquote':
                editor.chain().focus().toggleBlockquote().run();
                break;
              case 'divider':
                editor.chain().focus().setHorizontalRule().run();
                break;
              case 'attach':
                openFilePicker?.();
                break;
            }
          },
          render: () => createSuggestionRenderer(),
        },
      };
    },
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          ...this.options.suggestion,
        }),
      ];
    },
  });
}
