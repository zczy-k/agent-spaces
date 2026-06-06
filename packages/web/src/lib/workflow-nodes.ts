
import type { NodeTypeDefinition } from '@agent-spaces/shared';
import { StickyNoteView } from '@/components/workflow/sticky-note-view';
import {
  LOCAL_BRIDGE_WORKFLOW_NODES,
  LOOP_BREAK_NODE_TYPE,
  LOOP_BODY_NODE_TYPE,
  LOOP_BODY_ROLE,
  LOOP_BODY_SOURCE_HANDLE,
  LOOP_NEXT_SOURCE_HANDLE,
  LOOP_NODE_TYPE,
  LOOP_ROOT_ROLE,
} from '@agent-spaces/shared';

// ---- Condition operators ----

export const CONDITION_OPERATORS = [
  { value: 'equals', label: '等于' },
  { value: 'not_equals', label: '不等于' },
  { value: 'greater_than', label: '大于' },
  { value: 'less_than', label: '小于' },
  { value: 'greater_than_or_equal', label: '大于等于' },
  { value: 'less_than_or_equal', label: '小于等于' },
  { value: 'contains', label: '包含' },
  { value: 'not_contains', label: '不包含' },
  { value: 'starts_with', label: '开头是' },
  { value: 'ends_with', label: '结尾是' },
  { value: 'is_empty', label: '为空' },
  { value: 'is_not_empty', label: '不为空' },
  { value: 'is_true', label: '为真' },
  { value: 'is_false', label: '为假' },
] as const;

export const NO_VALUE_OPERATORS = new Set(['is_empty', 'is_not_empty', 'is_true', 'is_false']);

// ---- Default code template ----

const RUN_CODE_DEFAULT_CODE = `// 在这里，您可以通过 'params' 获取节点中的输入变量，并通过 'ret' 输出结果
// 'params' 已经被正确地注入到环境中
// 下面是一个示例，获取节点输入中参数名为 'input' 的值：
// const input = params.input
// 下面是一个示例，输出一个包含多种数据类型的 'ret' 对象：
// const ret = { "name": '小明', "hobbies": ["看书", "旅游"] }

async function main({ params }) {
  const ret = {
    "key0": params.input + params.input,
    "key1": ["hello", "world"],
    "key2": {
      "key21": "hi",
    },
  }

  return ret
}`;

// ---- Flow Control Nodes ----

const flowControlNodes: NodeTypeDefinition[] = [
  {
    type: 'start',
    label: '开始',
    category: '流程控制',
    icon: 'LogIn',
    description: '工作流入口节点，仅支持输出连接',
    properties: [],
    allowInputFields: true,
    handles: { source: true, target: false },
    singleton: true,
  },
  {
    type: 'end',
    label: '结束',
    category: '流程控制',
    icon: 'LogOut',
    description: '工作流出口节点，仅支持输入连接',
    properties: [],
    handles: { source: false, target: true },
    singleton: true,
  },
  {
    type: 'run_code',
    label: '运行 JS 代码',
    category: '流程控制',
    icon: 'Terminal',
    description: '执行自定义 JavaScript 代码',
    properties: [
      {
        key: 'code',
        label: '代码',
        type: 'code',
        required: true,
        default: RUN_CODE_DEFAULT_CODE,
        tooltip: 'JavaScript 代码。需定义 async function main({ params, context }) { ... }',
      },
    ],
  },
  {
    type: 'toast',
    label: 'Toast 消息',
    category: '流程控制',
    icon: 'Bell',
    description: '显示 Toast 通知消息',
    properties: [
      { key: 'message', label: '消息内容', type: 'text', required: true },
      {
        key: 'type', label: '消息类型', type: 'select', default: 'info',
        options: [
          { label: '信息', value: 'info' },
          { label: '成功', value: 'success' },
          { label: '警告', value: 'warning' },
          { label: '错误', value: 'error' },
        ],
      },
    ],
  },
  {
    type: 'switch',
    label: '选择器',
    category: '流程控制',
    icon: 'GitBranch',
    description: '条件分支路由',
    properties: [
      { key: 'conditions', label: '条件列表', type: 'conditions' },
    ],
    handles: { target: true, dynamicSource: { dataKey: 'conditions', extraCount: 1 } },
  },
  {
    type: 'variable_aggregate',
    label: '变量聚合',
    category: '流程控制',
    icon: 'Combine',
    description: '对多个分支的输出变量进行分组聚合',
    properties: [
      {
        key: 'strategy', label: '聚合策略', type: 'select', default: 'first_non_empty', required: true,
        options: [{ label: '返回每个分组中第一个非空的值', value: 'first_non_empty' }],
      },
      {
        key: 'groups', label: '变量分组', type: 'array', default: [], required: true,
        itemTemplate: { key: '', variables: [] },
        fields: [
          { key: 'key', label: '输出字段名', type: 'text', required: true, placeholder: 'result' },
          { key: 'variables', label: '变量列表', type: 'output_fields', required: true },
        ],
      },
    ],
    outputs: [{ key: 'result', type: 'object' }],
  },
  {
    type: LOOP_BREAK_NODE_TYPE,
    label: '跳出循环',
    category: '流程控制',
    icon: 'LogOut',
    description: '在 loop_body 中标记本轮结束后停止后续循环',
    properties: [],
    handles: { target: true, source: true },
    outputs: [{ key: 'break', type: 'boolean' }],
  },
  {
    type: LOOP_NODE_TYPE,
    label: '循环节点',
    category: '流程控制',
    icon: 'RotateCw',
    description: '按次数、数组长度或循环体逻辑重复执行',
    properties: [
      {
        key: 'loopType', label: '循环类型', type: 'select', default: 'count', required: true,
        options: [
          { label: '按次数循环', value: 'count' },
          { label: '使用数组循环', value: 'array' },
          { label: '无限循环', value: 'infinite' },
        ],
      },
      { key: 'count', label: '循环次数', type: 'number', default: 1, required: true, visibleWhen: { key: 'loopType', equals: 'count' } },
      { key: 'arrayPath', label: '数组变量', type: 'text', required: true, visibleWhen: { key: 'loopType', equals: 'array' } },
      { key: 'concurrency', label: '同时处理数量', type: 'number', default: 1, required: true },
      { key: 'sharedVariables', label: '中间变量', type: 'output_fields', default: [] },
    ],
    handles: {
      target: true,
      source: true,
      sourceHandles: [
        { id: LOOP_BODY_SOURCE_HANDLE, label: '循环体' },
        { id: LOOP_NEXT_SOURCE_HANDLE, label: '完成后' },
      ],
    },
    outputs: [{ key: 'items', type: 'any' }],
    compound: {
      rootRole: LOOP_ROOT_ROLE,
      children: [
        { role: LOOP_ROOT_ROLE, type: LOOP_NODE_TYPE },
        { role: LOOP_BODY_ROLE, type: LOOP_BODY_NODE_TYPE, label: '循环体节点', offset: { x: 260, y: 0 }, scopeBoundary: true, parentRole: LOOP_ROOT_ROLE, data: { width: 150, height: 260 } },
      ],
      edges: [
        { sourceRole: LOOP_ROOT_ROLE, targetRole: LOOP_BODY_ROLE, sourceHandle: LOOP_BODY_SOURCE_HANDLE, targetHandle: 'target', locked: true },
      ],
    },
  },
  {
    type: LOOP_BODY_NODE_TYPE,
    label: '循环体节点',
    category: '流程控制',
    icon: 'Container',
    description: '循环节点自动生成的内部锚点',
    properties: [],
    handles: { target: true, source: false },
    debuggable: false,
    manualCreate: false,
  },
];

// ---- AI Nodes ----

const aiNodes: NodeTypeDefinition[] = [
  {
    type: 'agent_run',
    label: 'AI 执行',
    category: 'AI',
    icon: 'Bot',
    description: '调用 Agent 运行任务',
    properties: [
      { key: 'prompt', label: '任务', type: 'textarea', required: true },
      { key: 'systemPrompt', label: '系统提示词', type: 'textarea' },
      { key: 'cwd', label: '工作目录', type: 'text' },
      { key: 'permissionMode', label: '权限模式', type: 'select', default: 'dontAsk',
        options: [
          { label: '默认', value: 'default' },
          { label: '不询问', value: 'dontAsk' },
          { label: '接受编辑', value: 'acceptEdits' },
          { label: '计划模式', value: 'plan' },
          { label: '自动', value: 'auto' },
          { label: '跳过权限', value: 'bypassPermissions' },
        ],
      },
    ],
  },
];

// ---- Interaction Nodes ----

const interactionNodes: NodeTypeDefinition[] = [
  {
    type: 'alert',
    label: '消息弹窗',
    category: '交互',
    icon: 'MessageSquare',
    description: '显示消息弹窗',
    properties: [
      { key: 'title', label: '标题', type: 'text', default: '提示' },
      { key: 'message', label: '消息内容', type: 'textarea', required: true },
    ],
    outputs: [{ key: 'confirmed', type: 'boolean' }],
  },
  {
    type: 'prompt',
    label: '输入弹窗',
    category: '交互',
    icon: 'TextCursorInput',
    description: '弹出输入框',
    properties: [
      { key: 'title', label: '标题', type: 'text', default: '请输入' },
      { key: 'message', label: '提示文字', type: 'text' },
      { key: 'placeholder', label: '占位文本', type: 'text' },
      { key: 'defaultValue', label: '默认值', type: 'text' },
    ],
    outputs: [{ key: 'value', type: 'string' }, { key: 'confirmed', type: 'boolean' }],
  },
  {
    type: 'form',
    label: '表单弹窗',
    category: '交互',
    icon: 'ClipboardList',
    description: '弹出自定义表单',
    properties: [
      { key: 'title', label: '标题', type: 'text', default: '表单' },
      {
        key: 'items', label: '表单项', type: 'array', required: true,
        itemTemplate: { id: '', title: '', type: 'text', data: { value: '', placeholder: '' } },
        fields: [
          { key: 'id', label: '字段ID', type: 'text', required: true },
          { key: 'title', label: '显示名称', type: 'text', required: true },
          { key: 'type', label: '字段类型', type: 'select', default: 'text',
            options: [
              { label: '文本', value: 'text' },
              { label: '多行文本', value: 'textarea' },
              { label: '数字', value: 'number' },
              { label: '选择', value: 'select' },
              { label: '复选框', value: 'checkbox' },
            ],
          },
        ],
      },
    ],
    outputs: [{ key: 'values', type: 'object' }, { key: 'confirmed', type: 'boolean' }],
  },
];

// ---- Display Nodes ----

const displayNodes: NodeTypeDefinition[] = [
  {
    type: 'sticky_note',
    label: '便签',
    category: '展示',
    icon: 'StickyNote',
    description: '画布注释节点，不影响工作流执行',
    customView: StickyNoteView,
    customViewMinSize: { width: 180, height: 120 },
    properties: [
      { key: 'content', label: '内容', type: 'textarea', tooltip: '便签文本内容' },
    ],
    handles: { source: false, target: false },
    debuggable: false,
  },
];

// ---- All node definitions ----

export const allNodeDefinitions: NodeTypeDefinition[] = [
  ...flowControlNodes,
  ...aiNodes,
  ...interactionNodes,
  ...displayNodes,
  ...LOCAL_BRIDGE_WORKFLOW_NODES,
];

// ---- Registry helpers ----

let _pluginNodeDefinitions: NodeTypeDefinition[] = [];
let _pluginNodesVersion = 0;
const _pluginNodesListeners = new Set<() => void>();

export function getPluginNodesVersion() { return _pluginNodesVersion; }

export function subscribePluginNodesVersion(listener: () => void): () => void {
  _pluginNodesListeners.add(listener);
  return () => _pluginNodesListeners.delete(listener);
}

function notifyPluginNodesChanged(): void {
  for (const listener of _pluginNodesListeners) listener();
}

export function registerPluginNodeDefinitions(nodes: NodeTypeDefinition[]): void {
  _pluginNodeDefinitions = nodes;
  _pluginNodesVersion++;
  notifyPluginNodesChanged();
}

export function clearPluginNodeDefinitions(): void {
  _pluginNodeDefinitions = [];
  _pluginNodesVersion++;
  notifyPluginNodesChanged();
}

export function getNodeDefinitionsByCategory(): Record<string, NodeTypeDefinition[]> {
  const groups: Record<string, NodeTypeDefinition[]> = {};
  for (const def of [...allNodeDefinitions, ..._pluginNodeDefinitions]) {
    if (!groups[def.category]) groups[def.category] = [];
    groups[def.category].push(def);
  }
  return groups;
}

export function getNodeDefinition(type: string): NodeTypeDefinition | undefined {
  return allNodeDefinitions.find(d => d.type === type) || _pluginNodeDefinitions.find(d => d.type === type);
}

export function searchNodeDefinitions(query: string): NodeTypeDefinition[] {
  const q = query.toLowerCase();
  return [...allNodeDefinitions, ..._pluginNodeDefinitions].filter(
    d => d.label.toLowerCase().includes(q) || d.type.toLowerCase().includes(q),
  );
}
