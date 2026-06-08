import test from 'node:test';
import assert from 'node:assert/strict';
import type { NodeTypeDefinition, Workflow } from '@agent-spaces/shared';
import { createWorkflowEditorFunctionTools } from '../src/services/builtin-tools/workflow-editor-tools.js';

const nodeDefinitions: NodeTypeDefinition[] = [
  {
    type: 'run_code',
    label: '运行 JS 代码',
    category: '流程控制',
    icon: 'Terminal',
    description: '执行自定义 JavaScript 代码',
    properties: [],
  },
  {
    type: 'cos_upload_file',
    label: 'COS上传文件',
    category: '腾讯云COS',
    icon: 'Upload',
    description: '将本地文件上传到 COS',
    properties: [],
  },
  {
    type: 'asr_file_recognition',
    label: '录音文件转写',
    category: '语音识别',
    icon: 'FileAudio',
    description: '提交音频/视频文件URL进行异步语音识别',
    properties: [],
  },
];

const workflow: Workflow = {
  id: 'workflow-1',
  name: 'test workflow',
  folderId: null,
  nodes: [],
  edges: [],
  createdAt: 1,
  updatedAt: 1,
};

test('search_node_usage filters by node_type without swapping results', async () => {
  const tools = createWorkflowEditorFunctionTools({ workflow, nodeDefinitions });
  const searchNodeUsage = tools.find((tool) => tool.name === 'search_node_usage');
  assert.ok(searchNodeUsage);

  for (const nodeType of ['cos_upload_file', 'run_code', 'asr_file_recognition']) {
    const result = await searchNodeUsage.execute({ node_type: nodeType }) as {
      success: boolean;
      total: number;
      nodes: Array<{ type: string }>;
    };
    assert.equal(result.success, true);
    assert.equal(result.total, 1);
    assert.deepEqual(result.nodes.map((node) => node.type), [nodeType]);
  }
});
