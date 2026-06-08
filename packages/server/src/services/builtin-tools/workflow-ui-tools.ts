import type { AgentFunctionTool } from '../../adapters/agent-runtime-types.js';
import { getPluginTools, executePluginTool } from '../plugin.js';
import { createBuiltinPluginApi } from '../plugin-runtime-api.js';

type JsonRecord = Record<string, unknown>;

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

export interface WorkflowUiToolContext {
  enabledPlugins: string[];
}

export function createWorkflowUiFunctionTools(ctx: WorkflowUiToolContext): AgentFunctionTool[] {
  return [
    {
      name: 'list_plugin_tools',
      description: '列出当前 UI 项目已启用插件注册的所有 tools，返回轻量摘要（name/description）。需要执行某个 tool 时，先调用 get_plugin_tool_detail 查看参数 schema。',
      inputSchema: schema({
        pluginId: { type: 'string', description: '可选，按插件 ID 筛选' },
        keyword: { type: 'string', description: '可选，模糊搜索 tool 名称或描述' },
      }),
      annotations: { readOnly: true },
      execute: async (input) => {
        const record = asRecord(input);
        const filterPluginId = stringInput(record, 'pluginId');
        const keyword = stringInput(record, 'keyword')?.toLowerCase();
        const pluginIds = filterPluginId ? [filterPluginId] : ctx.enabledPlugins;
        const results: Array<{ pluginId: string; toolName: string; description: string }> = [];

        for (const pluginId of pluginIds) {
          try {
            const pluginTools = getPluginTools(pluginId);
            for (const tool of pluginTools) {
              if (keyword) {
                const text = `${tool.name} ${tool.description}`.toLowerCase();
                if (!text.includes(keyword)) continue;
              }
              results.push({ pluginId, toolName: tool.name, description: tool.description });
            }
          } catch { /* plugin not found, skip */ }
        }

        return { success: true, total: results.length, tools: results };
      },
    },
    {
      name: 'get_plugin_tool_detail',
      description: '查看指定插件 tool 的完整 input_schema 和描述。执行 tool 前建议先调用此工具查看参数要求。',
      inputSchema: schema({
        pluginId: { type: 'string', description: '插件 ID' },
        toolName: { type: 'string', description: 'Tool 名称' },
      }, ['pluginId', 'toolName']),
      annotations: { readOnly: true },
      execute: async (input) => {
        const record = asRecord(input);
        const pluginId = stringInput(record, 'pluginId');
        const toolName = stringInput(record, 'toolName');
        if (!pluginId || !toolName) {
          return { success: false, message: 'pluginId and toolName are required' };
        }
        try {
          const pluginTools = getPluginTools(pluginId);
          const tool = pluginTools.find(t => t.name === toolName);
          if (!tool) {
            return { success: false, message: `Tool "${toolName}" not found in plugin "${pluginId}"` };
          }
          return { success: true, pluginId, toolName: tool.name, description: tool.description, inputSchema: tool.input_schema };
        } catch (error: any) {
          return { success: false, message: error.message };
        }
      },
    },
    {
      name: 'execute_plugin_tool',
      description: '执行指定插件的 tool 并返回结果。执行前必须先调用 get_plugin_tool_detail 确认参数格式。',
      inputSchema: schema({
        pluginId: { type: 'string', description: '插件 ID' },
        toolName: { type: 'string', description: 'Tool 名称' },
        args: { type: 'object', description: 'Tool 参数' },
      }, ['pluginId', 'toolName']),
      execute: async (input) => {
        const record = asRecord(input);
        const pluginId = stringInput(record, 'pluginId');
        const toolName = stringInput(record, 'toolName');
        if (!pluginId || !toolName) {
          return { success: false, message: 'pluginId and toolName are required' };
        }
        const args = (record.args && typeof record.args === 'object' && !Array.isArray(record.args))
          ? record.args as Record<string, any>
          : {};
        try {
          const result = await executePluginTool(pluginId, toolName, args, createBuiltinPluginApi());
          return { success: true, result };
        } catch (error: any) {
          return { success: false, message: error.message };
        }
      },
    },
  ];
}
