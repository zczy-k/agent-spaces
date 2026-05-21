export type ActionMode = 'auto' | 'http' | 'editor'

export interface InspectorHookOptions {
  /** POST target URL */
  url?: string
  /** Custom headers */
  headers?: Record<string, string>
  /**
   * Action mode:
   * - auto: show dialog to let user choose (default)
   * - http: silently POST to url
   * - editor: open IDE editor
   */
  mode?: ActionMode
  /**
   * Auto copy source info (path:line:column) on click.
   * Default: false
   */
  copy?: boolean
}

export interface CapturedSourceInfo {
  path: string
  name: string
  line: number
  column: number
  timestamp: number
}

export async function postCapture(
  url: string,
  data: CapturedSourceInfo,
  headers?: Record<string, string>,
): Promise<void> {
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(data),
    })
  } catch (err) {
    console.error('[dom-inspector-hook] POST failed:', err)
  }
}

export function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch((err) => {
    console.error('[dom-inspector-hook] Copy failed:', err)
  })
}
