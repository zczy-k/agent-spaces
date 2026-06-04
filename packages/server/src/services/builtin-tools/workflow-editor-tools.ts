import { v4 as uuid } from 'uuid';
import type { NodeTypeDefinition, Workflow, WorkflowEdge, WorkflowNode } from '@agent-spaces/shared';
import type { AgentFunctionTool } from '../../adapters/agent-runtime-types.js';
import * as workflowService from '../workflow.js';

export interface WorkflowEditorToolContext {
  workflow: Workflow;
  nodeDefinitions: NodeTypeDefinition[];
}

type JsonRecord = Record<string, unknown>;

const WORKFLOW_AGENT_SYSTEM_PROMPT = `你是 Agent Spaces 的工作流编辑助手。你的职责是帮助用户创建、修改、排查和优化当前可视化工作流。

回复规则：
- 回复使用中文。
- 优先通过工具直接完成工作流编辑，而不是只给口头建议。
- 只有在本轮实际调用了对应编辑工具并看到 success=true 的工具结果后，才能说“已创建”“已连接”“已更新”。
- 不要臆测节点字段结构、变量写法或连线方式。

工作流编辑硬规则：
1. 准备使用、创建、插入或更新某个节点类型前，必须先调用 search_node_usage 查看节点定义。
2. 如果用户只描述用途但没给出节点类型，先用 list_node_types 找候选，再用 search_node_usage 看具体字段、句柄和使用说明。
3. 编辑现有工作流前，优先调用 get_current_workflow；需要完整 data 时用 summarize=false。
4. 节点参数里的字符串值支持变量引用，优先使用 {{ __data__["节点ID"].字段路径 }} 和 {{ context.some.path }}。
5. 结束节点返回结果来自 data.outputs，设置时使用 data: { outputs: [{ key, type, value }] }。
6. 需要数据整形、字段映射或结构转换时，优先插入 run_code 节点；代码中不要写 {{ }}，必须定义 async function main({ params, context })。
7. 复杂、多步、批量或破坏性改动前先调用 create_workflow_version。
8. 修改后通常调用 auto_layout 整理画布。

约束：
- 只能使用本次 Agent Spaces runtime 暴露的工作流编辑工具。
- 不要编造节点类型、参数或执行结果；工具结果不足时明确说明需要补充信息。`;

export function buildWorkflowEditorSystemPrompt(workflow: Workflow, selectedNodes?: WorkflowNode[]): string {
  const summary = summarizeWorkflow(workflow, true);
  const selected = selectedNodes?.length
    ? `\n\n## 当前选中节点\n\n\`\`\`json\n${JSON.stringify(selectedNodes, null, 2)}\n\`\`\``
    : '';

  return `${WORKFLOW_AGENT_SYSTEM_PROMPT}

---

## 当前工作流

当前 workflow_id: ${workflow.id}

\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`${selected}`;
}

export function createWorkflowEditorFunctionTools(ctx: WorkflowEditorToolContext): AgentFunctionTool[] {
  const versions = new Map<string, Pick<Workflow, 'nodes' | 'edges'>>();
  let draft = cloneWorkflow(ctx.workflow);

  const commit = (next: Workflow) => {
    draft = {
      ...next,
      nodes: clone(next.nodes),
      edges: clone(next.edges),
      updatedAt: Date.now(),
    };
    return workflowResult(true, 'updated', draft);
  };

  const definitionByType = new Map(ctx.nodeDefinitions.map((definition) => [definition.type, definition]));
  const searchDefinitions = (input: JsonRecord) => {
    const keyword = stringInput(input, 'keyword')?.toLowerCase();
    const type = stringInput(input, 'type')?.toLowerCase();
    const label = stringInput(input, 'label')?.toLowerCase();
    const category = stringInput(input, 'category')?.toLowerCase();
    const description = stringInput(input, 'description')?.toLowerCase();
    return ctx.nodeDefinitions.filter((definition) => {
      const checks = [
        keyword ? searchableDefinitionText(definition).includes(keyword) : true,
        type ? definition.type.toLowerCase().includes(type) : true,
        label ? definition.label.toLowerCase().includes(label) : true,
        category ? definition.category.toLowerCase().includes(category) : true,
        description ? definition.description.toLowerCase().includes(description) : true,
      ];
      return checks.every(Boolean);
    });
  };

  const tools: AgentFunctionTool[] = [
    {
      name: 'get_workflow',
      description: '按 workflow_id 读取指定工作流的最新已保存文件数据。默认返回摘要，summarize=false 返回完整数据。',
      inputSchema: schema({
        workflow_id: { type: 'string', description: '要读取的工作流 ID。' },
        summarize: { type: 'boolean', description: '是否返回摘要，默认 true。' },
      }, ['workflow_id']),
      annotations: { readOnly: true },
      execute: async (input) => {
        const workflowId = stringInput(asRecord(input), 'workflow_id');
        if (!workflowId) return { success: false, message: 'workflow_id is required' };
        const workflow = workflowService.getWorkflow(workflowId);
        if (!workflow) return { success: false, message: `Workflow not found: ${workflowId}` };
        return { success: true, workflow: summarizeWorkflow(workflow, booleanInput(asRecord(input), 'summarize', true)) };
      },
    },
    {
      name: 'get_current_workflow',
      description: '读取当前编辑器中的工作流草稿，包含尚未保存的编辑状态。默认返回摘要，summarize=false 返回完整数据。',
      inputSchema: schema({ summarize: { type: 'boolean', description: '是否返回摘要，默认 true。' } }),
      annotations: { readOnly: true },
      execute: async (input) => ({
        success: true,
        workflow: summarizeWorkflow(draft, booleanInput(asRecord(input), 'summarize', true)),
      }),
    },
    {
      name: 'create_workflow_version',
      description: '为当前工作流草稿创建会话内版本快照，适合复杂或破坏性编辑前备份。',
      inputSchema: schema({ name: { type: 'string', description: '版本名称。' } }),
      execute: async (input) => {
        const id = `workflow-agent-version-${uuid()}`;
        versions.set(id, { nodes: clone(draft.nodes), edges: clone(draft.edges) });
        return { success: true, version_id: id, name: stringInput(asRecord(input), 'name') ?? 'AI 修改前备份' };
      },
    },
    {
      name: 'restore_workflow_version',
      description: '恢复本次会话内 create_workflow_version 创建的版本快照。',
      inputSchema: schema({ version_id: { type: 'string', description: '要恢复的版本 ID。' } }, ['version_id']),
      execute: async (input) => {
        const versionId = stringInput(asRecord(input), 'version_id');
        const version = versionId ? versions.get(versionId) : undefined;
        if (!version) return { success: false, message: `Version not found: ${versionId ?? ''}` };
        return commit({ ...draft, nodes: clone(version.nodes), edges: clone(version.edges) });
      },
    },
    {
      name: 'search_nodes',
      description: '在当前工作流中搜索节点，支持 keyword/type/label/category/description 模糊匹配。',
      inputSchema: workflowSearchSchema(),
      annotations: { readOnly: true },
      execute: async (input) => {
        const record = asRecord(input);
        const defs = new Map(ctx.nodeDefinitions.map((definition) => [definition.type, definition]));
        const keyword = stringInput(record, 'keyword')?.toLowerCase();
        const type = stringInput(record, 'type')?.toLowerCase();
        const label = stringInput(record, 'label')?.toLowerCase();
        const category = stringInput(record, 'category')?.toLowerCase();
        const description = stringInput(record, 'description')?.toLowerCase();
        const nodes = draft.nodes.filter((node) => {
          const definition = defs.get(node.type);
          const checks = [
            keyword ? [node.id, node.type, node.label, definition?.label, definition?.category, definition?.description].filter(Boolean).join(' ').toLowerCase().includes(keyword) : true,
            type ? node.type.toLowerCase().includes(type) : true,
            label ? node.label.toLowerCase().includes(label) : true,
            category ? (definition?.category ?? '').toLowerCase().includes(category) : true,
            description ? (definition?.description ?? '').toLowerCase().includes(description) : true,
          ];
          return checks.every(Boolean);
        });
        return { success: true, nodes: nodes.map((node) => ({ ...node, definition: defs.get(node.type) })) };
      },
    },
    {
      name: 'list_node_types',
      description: '分页查询可用节点类型列表。默认返回精简摘要；includeDetails=true 返回完整定义。',
      inputSchema: schema({
        category: { type: 'string', description: '按分类筛选。' },
        page: { type: 'number', description: '页码，从 1 开始，默认 1。' },
        pageSize: { type: 'number', description: '每页数量，默认 20，最大 50。' },
        page_size: { type: 'number', description: '每页数量，兼容蛇形命名。' },
        includeDetails: { type: 'boolean', description: '是否返回完整节点定义。' },
      }),
      annotations: { readOnly: true },
      execute: async (input) => {
        const record = asRecord(input);
        const category = stringInput(record, 'category')?.toLowerCase();
        const filtered = category
          ? ctx.nodeDefinitions.filter((definition) => definition.category.toLowerCase().includes(category))
          : ctx.nodeDefinitions;
        const page = Math.max(1, numberInput(record, 'page', 1));
        const pageSize = Math.min(50, Math.max(1, numberInput(record, 'pageSize', numberInput(record, 'page_size', 20))));
        const includeDetails = booleanInput(record, 'includeDetails', false);
        const items = filtered.slice((page - 1) * pageSize, page * pageSize);
        return {
          success: true,
          page,
          page_size: pageSize,
          total: filtered.length,
          nodes: includeDetails ? items : items.map(summarizeNodeDefinition),
        };
      },
    },
    {
      name: 'search_node_usage',
      description: '查询节点类型的具体用法，返回字段说明、句柄、输出和示例 data。准备使用陌生节点前必须调用。',
      inputSchema: workflowSearchSchema(),
      annotations: { readOnly: true },
      execute: async (input) => ({ success: true, nodes: searchDefinitions(asRecord(input)).map(describeNodeUsage) }),
    },
    {
      name: 'create_node',
      description: '在工作流中创建新节点。需要指定有效节点 type，可选 label、data。',
      inputSchema: schema({
        type: { type: 'string', description: '节点类型标识。' },
        label: { type: 'string', description: '节点显示名称。' },
        data: { type: 'object', description: '节点参数数据。', properties: {} },
      }, ['type']),
      execute: async (input) => {
        const record = asRecord(input);
        const type = stringInput(record, 'type');
        if (!type) return { success: false, message: 'type is required' };
        const definition = definitionByType.get(type);
        if (!definition) return { success: false, message: `Unknown node type: ${type}` };
        const node: WorkflowNode = {
          id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type,
          label: stringInput(record, 'label') ?? definition.label,
          position: nextNodePosition(draft.nodes),
          data: { ...defaultData(definition), ...objectInput(record, 'data') },
        };
        return commit({ ...draft, nodes: [...draft.nodes, node] });
      },
    },
    {
      name: 'update_node',
      description: '更新指定节点的 label 或 data。data 会与现有 data 浅合并。',
      inputSchema: schema({
        nodeId: { type: 'string', description: '要更新的节点 ID。' },
        label: { type: 'string', description: '可选，节点显示名称。' },
        data: { type: 'object', description: '要合并的节点参数。', properties: {} },
      }, ['nodeId']),
      execute: async (input) => {
        const record = asRecord(input);
        const nodeId = stringInput(record, 'nodeId');
        if (!nodeId) return { success: false, message: 'nodeId is required' };
        let found = false;
        const nodes = draft.nodes.map((node) => {
          if (node.id !== nodeId) return node;
          found = true;
          return {
            ...node,
            label: stringInput(record, 'label') ?? node.label,
            data: { ...node.data, ...objectInput(record, 'data') },
          };
        });
        return found ? commit({ ...draft, nodes }) : { success: false, message: `Node not found: ${nodeId}` };
      },
    },
    {
      name: 'delete_node',
      description: '删除指定节点及其相关连线。',
      inputSchema: schema({ nodeId: { type: 'string', description: '要删除的节点 ID。' } }, ['nodeId']),
      annotations: { destructive: true },
      execute: async (input) => {
        const nodeId = stringInput(asRecord(input), 'nodeId');
        if (!nodeId) return { success: false, message: 'nodeId is required' };
        if (!draft.nodes.some((node) => node.id === nodeId)) return { success: false, message: `Node not found: ${nodeId}` };
        return commit({
          ...draft,
          nodes: draft.nodes.filter((node) => node.id !== nodeId),
          edges: draft.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
        });
      },
    },
    {
      name: 'create_edge',
      description: '创建连线。source/target 是节点 ID；多输出节点应传 sourceHandle。',
      inputSchema: schema({
        source: { type: 'string', description: '起始节点 ID。' },
        target: { type: 'string', description: '目标节点 ID。' },
        sourceHandle: { type: 'string', description: '起始连接点。' },
        targetHandle: { type: 'string', description: '目标连接点。' },
      }, ['source', 'target']),
      execute: async (input) => {
        const record = asRecord(input);
        const source = stringInput(record, 'source');
        const target = stringInput(record, 'target');
        if (!source || !target) return { success: false, message: 'source and target are required' };
        if (!draft.nodes.some((node) => node.id === source)) return { success: false, message: `Source node not found: ${source}` };
        if (!draft.nodes.some((node) => node.id === target)) return { success: false, message: `Target node not found: ${target}` };
        const edge: WorkflowEdge = {
          id: `e-${source}-${target}-${Date.now().toString(36)}`,
          source,
          target,
          sourceHandle: stringInput(record, 'sourceHandle') ?? undefined,
          targetHandle: stringInput(record, 'targetHandle') ?? undefined,
        };
        return commit({ ...draft, edges: [...draft.edges, edge] });
      },
    },
    {
      name: 'delete_edge',
      description: '删除指定连线。',
      inputSchema: schema({ edgeId: { type: 'string', description: '要删除的连线 ID。' } }, ['edgeId']),
      annotations: { destructive: true },
      execute: async (input) => {
        const edgeId = stringInput(asRecord(input), 'edgeId');
        if (!edgeId) return { success: false, message: 'edgeId is required' };
        if (!draft.edges.some((edge) => edge.id === edgeId)) return { success: false, message: `Edge not found: ${edgeId}` };
        return commit({ ...draft, edges: draft.edges.filter((edge) => edge.id !== edgeId) });
      },
    },
    {
      name: 'insert_node',
      description: '在已有连线中插入新节点，替换为 source -> 新节点 -> target 两条边。',
      inputSchema: schema({
        edgeId: { type: 'string', description: '要插入的边 ID。' },
        type: { type: 'string', description: '新节点类型。' },
        label: { type: 'string', description: '新节点显示名称。' },
        data: { type: 'object', description: '新节点参数。', properties: {} },
      }, ['edgeId', 'type']),
      execute: async (input) => {
        const record = asRecord(input);
        const edgeId = stringInput(record, 'edgeId');
        const type = stringInput(record, 'type');
        const edge = draft.edges.find((item) => item.id === edgeId);
        if (!edge) return { success: false, message: `Edge not found: ${edgeId ?? ''}` };
        if (!type) return { success: false, message: 'type is required' };
        const definition = definitionByType.get(type);
        if (!definition) return { success: false, message: `Unknown node type: ${type}` };
        const sourceNode = draft.nodes.find((node) => node.id === edge.source);
        const targetNode = draft.nodes.find((node) => node.id === edge.target);
        const nodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const node: WorkflowNode = {
          id: nodeId,
          type,
          label: stringInput(record, 'label') ?? definition.label,
          position: {
            x: ((sourceNode?.position.x ?? 0) + (targetNode?.position.x ?? 260)) / 2,
            y: ((sourceNode?.position.y ?? 0) + (targetNode?.position.y ?? 0)) / 2,
          },
          data: { ...defaultData(definition), ...objectInput(record, 'data') },
        };
        return commit({
          ...draft,
          nodes: [...draft.nodes, node],
          edges: [
            ...draft.edges.filter((item) => item.id !== edgeId),
            { id: `e-${edge.source}-${nodeId}`, source: edge.source, target: nodeId, sourceHandle: edge.sourceHandle },
            { id: `e-${nodeId}-${edge.target}`, source: nodeId, target: edge.target, targetHandle: edge.targetHandle },
          ],
        });
      },
    },
    {
      name: 'batch_update',
      description: '批量执行 create_node/update_node/delete_node/create_edge/delete_edge 操作。',
      inputSchema: schema({
        operations: {
          type: 'array',
          description: '每项为 { tool, args }。',
          items: { type: 'object', properties: { tool: { type: 'string' }, args: { type: 'object', properties: {} } } },
        },
      }, ['operations']),
      execute: async (input) => {
        const operationsInput = asRecord(input).operations;
        const operations = Array.isArray(operationsInput) ? operationsInput : [];
        const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
        const results: unknown[] = [];
        for (const operation of operations) {
          const record = asRecord(operation);
          const toolName = stringInput(record, 'tool');
          if (!toolName || toolName === 'batch_update') return { success: false, message: `Invalid batch tool: ${toolName ?? ''}` };
          const tool = toolMap.get(toolName);
          if (!tool) return { success: false, message: `Unknown batch tool: ${toolName}` };
          const result = await tool.execute(record.args);
          results.push(result);
          if (asRecord(result).success === false) return { success: false, results };
        }
        return workflowResult(true, 'batch updated', draft, results);
      },
    },
    {
      name: 'auto_layout',
      description: '自动整理当前工作流节点位置。direction 可选 LR 或 TB。',
      inputSchema: schema({ direction: { type: 'string', description: '布局方向，LR 或 TB，默认 LR。' } }),
      execute: async (input) => {
        const direction = stringInput(asRecord(input), 'direction') === 'TB' ? 'TB' : 'LR';
        return commit({ ...draft, nodes: layoutNodes(draft.nodes, direction) });
      },
    },
  ];

  return tools;
}

function workflowResult(success: boolean, message: string, workflow: Workflow, results?: unknown[]) {
  return {
    success,
    message,
    workflow,
    workflow_patch: {
      workflow_id: workflow.id,
      nodes: workflow.nodes,
      edges: workflow.edges,
      updatedAt: workflow.updatedAt,
    },
    results,
  };
}

function summarizeWorkflow(workflow: Workflow, summarize: boolean): unknown {
  if (!summarize) return workflow;
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    nodes: workflow.nodes.map((node) => ({ id: node.id, type: node.type, label: node.label, dataKeys: Object.keys(node.data ?? {}) })),
    edges: workflow.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle })),
  };
}

function summarizeNodeDefinition(definition: NodeTypeDefinition) {
  return {
    type: definition.type,
    label: definition.label,
    category: definition.category,
    description: definition.description,
    handles: definition.handles,
    properties: definition.properties.map((property) => ({
      key: property.key,
      label: property.label,
      type: property.type,
      required: property.required,
      default: property.default,
    })),
    outputs: definition.outputs,
  };
}

function describeNodeUsage(definition: NodeTypeDefinition) {
  return {
    ...definition,
    exampleData: defaultData(definition),
    usage: {
      variables: '字符串字段支持 {{ __data__["节点ID"].字段路径 }} 和 {{ context.some.path }}。',
      handles: definition.handles ?? {},
    },
  };
}

function defaultData(definition: NodeTypeDefinition): JsonRecord {
  const data: JsonRecord = {};
  for (const property of definition.properties ?? []) {
    if (property.default !== undefined) data[property.key] = clone(property.default);
  }
  return data;
}

function nextNodePosition(nodes: WorkflowNode[]): WorkflowNode['position'] {
  if (!nodes.length) return { x: 120, y: 120 };
  const maxX = Math.max(...nodes.map((node) => node.position.x));
  const avgY = nodes.reduce((sum, node) => sum + node.position.y, 0) / nodes.length;
  return { x: maxX + 260, y: Math.round(avgY) };
}

function layoutNodes(nodes: WorkflowNode[], direction: 'LR' | 'TB'): WorkflowNode[] {
  return nodes.map((node, index) => ({
    ...node,
    position: direction === 'TB'
      ? { x: 160 + (index % 4) * 260, y: 100 + Math.floor(index / 4) * 180 }
      : { x: 120 + index * 260, y: 120 + (index % 3) * 150 },
  }));
}

function searchableDefinitionText(definition: NodeTypeDefinition): string {
  return [
    definition.type,
    definition.label,
    definition.category,
    definition.description,
    ...definition.properties.map((property) => `${property.key} ${property.label} ${property.tooltip ?? ''}`),
  ].join(' ').toLowerCase();
}

function workflowSearchSchema(): Record<string, unknown> {
  return schema({
    keyword: { type: 'string', description: '模糊搜索关键词。' },
    type: { type: 'string', description: '按节点类型筛选。' },
    label: { type: 'string', description: '按节点标签筛选。' },
    category: { type: 'string', description: '按分类筛选。' },
    description: { type: 'string', description: '按描述筛选。' },
  });
}

function schema(properties: Record<string, unknown>, required?: string[]): Record<string, unknown> {
  return { type: 'object', properties, ...(required?.length ? { required } : {}) };
}

function asRecord(input: unknown): JsonRecord {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as JsonRecord : {};
}

function stringInput(input: JsonRecord, key: string): string | undefined {
  const value = input[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberInput(input: JsonRecord, key: string, fallback: number): number {
  const value = input[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function booleanInput(input: JsonRecord, key: string, fallback: boolean): boolean {
  const value = input[key];
  return typeof value === 'boolean' ? value : fallback;
}

function objectInput(input: JsonRecord, key: string): JsonRecord {
  const value = input[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneWorkflow(workflow: Workflow): Workflow {
  return clone(workflow);
}
