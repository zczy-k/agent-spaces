export interface HookConfig {
  name: string;
  description?: string;
  enabled: boolean;
  hooks: {
    PreToolUse?: HookRule[];
    PostToolUse?: HookRule[];
  };
}

export interface HookRule {
  matcher: string;
  type: 'command' | 'webhook' | 'script';
  command?: string;
  url?: string;
  function?: string;
  timeout?: number;
}
