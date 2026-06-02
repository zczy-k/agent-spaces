// ============================================================
// Workflow Shortcut Types
// ============================================================

export type ShortcutGroup = 'tab' | 'navigation' | 'view' | 'tools' | 'window'

export interface ShortcutAction {
  id: string
  label: string
  defaultAccelerator: string
  supportsGlobal: boolean
  group: ShortcutGroup
}

export interface ShortcutBinding {
  id: string
  accelerator: string
  global: boolean
  enabled: boolean
}

export const SHORTCUT_GROUPS: { key: ShortcutGroup; label: string }[] = [
  { key: 'tab', label: '标签页' },
  { key: 'navigation', label: '导航' },
  { key: 'view', label: '视图' },
  { key: 'tools', label: '工具' },
  { key: 'window', label: '窗口' },
]

export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  { id: 'new-tab', label: '新建标签页', defaultAccelerator: 'CmdOrCtrl+T', supportsGlobal: true, group: 'tab' },
  { id: 'close-tab', label: '关闭当前标签页', defaultAccelerator: 'CmdOrCtrl+W', supportsGlobal: true, group: 'tab' },
  { id: 'next-tab', label: '下一个标签页', defaultAccelerator: 'CmdOrCtrl+Tab', supportsGlobal: true, group: 'tab' },
  { id: 'prev-tab', label: '上一个标签页', defaultAccelerator: 'CmdOrCtrl+Shift+Tab', supportsGlobal: true, group: 'tab' },
  { id: 'reload-tab', label: '刷新当前页', defaultAccelerator: 'CmdOrCtrl+R', supportsGlobal: true, group: 'navigation' },
  { id: 'force-reload', label: '强制刷新', defaultAccelerator: 'CmdOrCtrl+Shift+R', supportsGlobal: true, group: 'navigation' },
  { id: 'toggle-fullscreen', label: '切换全屏', defaultAccelerator: 'F11', supportsGlobal: true, group: 'view' },
  { id: 'command-palette', label: '打开命令面板', defaultAccelerator: 'CmdOrCtrl+K', supportsGlobal: false, group: 'tools' },
]

export function getMergedBindings(stored: ShortcutBinding[]): ShortcutBinding[] {
  return SHORTCUT_ACTIONS.map((action) => {
    const custom = stored.find((b) => b.id === action.id)
    return {
      id: action.id,
      accelerator: custom?.accelerator ?? action.defaultAccelerator,
      global: custom?.global ?? false,
      enabled: custom?.enabled ?? true,
    }
  })
}
