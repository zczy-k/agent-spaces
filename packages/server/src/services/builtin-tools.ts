import type { Channel, Issue } from '@agent-spaces/shared';
import type { AgentFunctionTool } from '../adapters/agent-runtime-types.js';
import * as issueService from './issue.js';
import * as channelService from './channel.js';

const boundIssueInputSchema = {
  type: 'object',
  properties: {
    issueId: {
      type: 'string',
      description: 'Must match the issue id bound to the current channel.',
    },
  },
  required: ['issueId'],
  additionalProperties: false,
};

const createIssueInputSchema = {
  type: 'object',
  properties: {
    issueId: {
      type: 'string',
      description: 'Must match the issue id bound to the current channel.',
    },
    title: {
      type: 'string',
      description: 'Issue title to apply to the bound issue and channel.',
    },
    description: {
      type: 'string',
      description: 'Issue description to apply to the bound issue.',
    },
  },
  required: ['issueId'],
  additionalProperties: false,
};

export function createIssueFunctionTools(workspaceId: string, channel: Channel | undefined): AgentFunctionTool[] {
  if (channel?.type !== 'issue' || !channel.issueId) return [];

  return [
    {
      name: 'CreateCurrentChannelIssue',
      description: 'Create or update the issue bound to the current issue channel. The issueId must be the current channel issue id.',
      inputSchema: createIssueInputSchema,
      annotations: { destructive: false, openWorld: false },
      execute: async (input) => createOrUpdateBoundIssue(workspaceId, channel, input),
    },
    {
      name: 'ViewCurrentChannelIssue',
      description: 'View the issue bound to the current issue channel. The issueId must be the current channel issue id.',
      inputSchema: boundIssueInputSchema,
      annotations: { readOnly: true, openWorld: false },
      execute: async (input) => viewBoundIssue(workspaceId, channel, input),
    },
  ];
}

export function isBuiltInIssueToolName(name: string): boolean {
  return name === 'CreateCurrentChannelIssue'
    || name === 'ViewCurrentChannelIssue'
    || name === 'agent-spaces.CreateCurrentChannelIssue'
    || name === 'agent-spaces.ViewCurrentChannelIssue';
}

function viewBoundIssue(workspaceId: string, channel: Channel, input: unknown): Issue {
  assertBoundIssueId(channel, input);
  const issue = issueService.getById(workspaceId, channel.issueId!);
  if (!issue) throw new Error(`Bound issue not found: ${channel.issueId}`);
  return issue;
}

function createOrUpdateBoundIssue(workspaceId: string, channel: Channel, input: unknown): Issue {
  const data = assertBoundIssueId(channel, input);
  const issue = issueService.getById(workspaceId, channel.issueId!);
  if (!issue) throw new Error(`Bound issue not found: ${channel.issueId}`);

  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const description = typeof data.description === 'string' ? data.description.trim() : '';
  if (title) issue.title = title;
  if (description) issue.description = description;
  issue.updatedAt = new Date().toISOString();

  const updated = issueService.save(workspaceId, issue);
  if (title) channelService.updateChannel(workspaceId, channel.id, { name: title, type: 'issue', issueId: issue.id });
  return updated;
}

function assertBoundIssueId(channel: Channel, input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Tool input must be an object.');
  }
  const data = input as Record<string, unknown>;
  if (data.issueId !== channel.issueId) {
    throw new Error(`issueId must match the current channel issue id: ${channel.issueId}`);
  }
  return data;
}
