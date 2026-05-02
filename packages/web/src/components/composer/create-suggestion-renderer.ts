import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance } from 'tippy.js';
import type { SuggestionProps } from '@tiptap/suggestion';

import { SuggestionList } from './suggestion-list';

type SuggestionRendererProps = SuggestionProps<Record<string, unknown>>;

export function createSuggestionRenderer() {
  let component: ReactRenderer | null = null;
  let popup: Instance[] | null = null;

  return {
    onStart(props: SuggestionRendererProps) {
      component = new ReactRenderer(SuggestionList, {
        props,
        editor: props.editor,
      });
      if (!props.clientRect) return;
      const getReferenceClientRect = () => props.clientRect?.() ?? new DOMRect();
      popup = tippy('body', {
        getReferenceClientRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
      });
    },
    onUpdate(props: SuggestionRendererProps) {
      component?.updateProps(props);
      if (popup?.[0] && props.clientRect) {
        popup[0].setProps({ getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect() });
      }
    },
    onKeyDown(props: { event: KeyboardEvent }) {
      if (component?.ref && typeof component.ref === 'object' && 'onKeyDown' in component.ref) {
        return (component.ref as { onKeyDown: (props: { event: KeyboardEvent }) => boolean }).onKeyDown(props);
      }
      return false;
    },
    onExit() {
      popup?.[0]?.destroy();
      component?.destroy();
    },
  };
}
