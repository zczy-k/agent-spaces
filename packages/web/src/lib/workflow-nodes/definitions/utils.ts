import type { NodeTypeDefinition } from '@agent-spaces/shared';

export const utilsNodes: NodeTypeDefinition[] = [
  {
    type: 'pluck_array_key',
    label: 'nodes.pluck_array_key.label',
    category: 'nodes.categories.utilities',
    icon: 'ListFilter',
    description: 'nodes.pluck_array_key.description',
    properties: [
      {
        key: 'array',
        label: 'nodes.pluck_array_key.props.array.label',
        type: 'array',
        required: true,
        tooltip: 'nodes.pluck_array_key.props.array.tooltip',
        default: [],
        itemTemplate: {},
        fields: [],
      },
      {
        key: 'key',
        label: 'nodes.pluck_array_key.props.key.label',
        type: 'text',
        required: true,
        placeholder: 'name',
        tooltip: 'nodes.pluck_array_key.props.key.tooltip',
      },
    ],
    outputs: [{ key: 'result', type: 'any[]' }],
  },
];
