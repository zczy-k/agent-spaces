export const BUILT_IN_AGENT_TOOLS = [
  {
    name: 'CreateCurrentChannelIssue',
    label: 'Create Current Issue',
    description: 'Create and bind an issue for the current channel.',
  },
  {
    name: 'ViewCurrentChannelIssue',
    label: 'View Current Issue',
    description: 'View the issue and comments bound to the current channel.',
  },
  {
    name: 'AddCurrentChannelComment',
    label: 'Add Current Comment',
    description: 'Add a comment to the issue bound to the current channel.',
  },
  {
    name: 'ListQuickCommands',
    label: 'List Quick Commands',
    description: 'List all quick commands for a workspace with their running status.',
  },
  {
    name: 'RunQuickCommand',
    label: 'Run Quick Command',
    description: 'Start a quick command by its ID. Returns the terminal session ID.',
  },
  {
    name: 'StopQuickCommand',
    label: 'Stop Quick Command',
    description: 'Stop a running quick command by its ID.',
  },
] as const;

export type BuiltInAgentToolName = typeof BUILT_IN_AGENT_TOOLS[number]['name'];
