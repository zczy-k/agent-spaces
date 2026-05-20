import { Extension, type Editor } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';

import { createSuggestionRenderer } from './create-suggestion-renderer';

type EditorRange = { from: number; to: number };
type GetSkills = () => string[];

function getSkillItems(skills: string[], query: string) {
  const keyword = query.toLowerCase();
  const seen = new Set<string>();

  return skills
    .map((skill) => skill.trim())
    .filter((skill) => {
      if (!skill || seen.has(skill)) return false;
      seen.add(skill);
      return skill.toLowerCase().includes(keyword);
    })
    .map((skill) => ({
      id: skill,
      title: skill,
      description: 'skill',
    }));
}

export function createSlashExtension(getSkills: GetSkills = () => []) {
  return Extension.create({
    name: 'slashCommand',
    addOptions() {
      return {
        suggestion: {
          char: '/',
          items: ({ query }: { query: string }) => {
            return getSkillItems(getSkills(), query);
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
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent(`[use skill: ${props.id}]`)
              .run();
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
