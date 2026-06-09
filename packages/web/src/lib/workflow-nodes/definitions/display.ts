import type { NodeTypeDefinition } from '@agent-spaces/shared';
import { StickyNoteView } from '@/components/workflow/sticky-note-view';

export const displayNodes: NodeTypeDefinition[] = [
  {
    type: 'sticky_note',
    label: 'nodes.sticky_note.label',
    category: 'nodes.categories.display',
    icon: 'StickyNote',
    description: 'nodes.sticky_note.description',
    customView: StickyNoteView,
    customViewMinSize: { width: 180, height: 120 },
    properties: [
      { key: 'content', label: 'nodes.sticky_note.props.content', type: 'textarea', tooltip: 'nodes.sticky_note.props.content_tooltip' },
    ],
    handles: { source: false, target: false },
    debuggable: false,
  },
];
