const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

export const SHELL_OPTIONS = isMac
  ? [
      { value: '/bin/zsh', label: 'zsh' },
      { value: '/bin/bash', label: 'bash' },
    ]
  : [
      { value: 'cmd.exe', label: 'CMD' },
      { value: 'powershell.exe', label: 'PowerShell' },
    ];

export const DEFAULT_SHELL = SHELL_OPTIONS[0];

export function getShellLabel(shell?: string) {
  if (!shell) return DEFAULT_SHELL.label;
  return SHELL_OPTIONS.find((s) => s.value === shell)?.label ?? shell;
}
