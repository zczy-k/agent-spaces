/**
 * Agent runtime adapter interface and factory.
 */

import type { AgentRuntime, AgentRuntimeConfig } from './agent-runtime-types.js';
import { ClaudeCodeRuntime } from './claude-code-runtime.js';
import { OpenAgentSdkRuntime } from './open-agent-sdk-runtime.js';

export type {
  AgentRunOptions,
  AgentRunResult,
  AgentRuntime,
  AgentRuntimeConfig,
  AgentRuntimeKind,
} from './agent-runtime-types.js';
export { ClaudeCodeRuntime } from './claude-code-runtime.js';
export { OpenAgentSdkRuntime } from './open-agent-sdk-runtime.js';

export function createAgentRuntime(config?: AgentRuntimeConfig): AgentRuntime;
export function createAgentRuntime(provider?: string, model?: string): AgentRuntime;
export function createAgentRuntime(
  configOrProvider: AgentRuntimeConfig | string = {},
  model?: string,
): AgentRuntime {
  const config =
    typeof configOrProvider === 'string'
      ? { provider: configOrProvider, model }
      : configOrProvider;

  switch (config.kind ?? 'open-agent-sdk') {
    case 'open-agent-sdk':
      return new OpenAgentSdkRuntime(config);
    case 'claude-code':
      return new ClaudeCodeRuntime(config);
  }
}
