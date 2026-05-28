import {
  postCapture,
  copyToClipboard,
  type InspectorHookOptions,
  type CapturedSourceInfo,
  type ActionMode,
} from './types'

export type { InspectorHookOptions, CapturedSourceInfo, ActionMode }

/**
 * Generate code-inspector-plugin behavior config for vite.config.ts.
 */
export function createBehavior(options?: { copy?: boolean }) {
  return {
    locate: false,
    copy: false,
  }
}

interface TrackCodeDetail {
  path: string
  name: string
  line: number
  column: number
}

type TrackCodeEvent = CustomEvent<TrackCodeDetail>

function showActionDialog(info: CapturedSourceInfo, options: InspectorHookOptions): Promise<ActionMode | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(0,0,0,0.3)',
      zIndex: '9999999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    })

    const panel = document.createElement('div')
    Object.assign(panel.style, {
      background: '#fff',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      fontFamily: 'system-ui, sans-serif',
      minWidth: '320px',
    })

    const title = document.createElement('div')
    Object.assign(title.style, {
      fontSize: '14px',
      color: '#666',
      marginBottom: '16px',
      wordBreak: 'break-all',
    })
    title.textContent = `${info.path}:${info.line}:${info.column}`
    panel.appendChild(title)

    const btnContainer = document.createElement('div')
    Object.assign(btnContainer.style, {
      display: 'flex',
      gap: '8px',
    })

    const actions: { label: string; value: ActionMode | null }[] = [
      { label: 'Send HTTP', value: 'http' },
      { label: 'Open Editor', value: 'editor' },
      { label: 'Cancel', value: null },
    ]

    for (const action of actions) {
      const btn = document.createElement('button')
      btn.textContent = action.label
      Object.assign(btn.style, {
        flex: '1',
        padding: '10px',
        borderRadius: '8px',
        border: action.value === null ? '1px solid #ddd' : '1px solid #4f46e5',
        background: action.value === null ? '#fff' : '#4f46e5',
        color: action.value === null ? '#666' : '#fff',
        fontSize: '14px',
        cursor: 'pointer',
      })
      btn.onclick = () => {
        document.body.removeChild(overlay)
        resolve(action.value)
      }
      btnContainer.appendChild(btn)
    }

    panel.appendChild(btnContainer)
    overlay.appendChild(panel)
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay)
        resolve(null)
      }
    }
    document.body.appendChild(overlay)
  })
}

function handleAction(mode: ActionMode | null, info: CapturedSourceInfo, options: InspectorHookOptions) {
  if (mode === 'http' || mode === 'auto') {
    if (options.url) {
      postCapture(options.url, info, options.headers)
    }
  } else if (mode === 'editor') {
    const params = new URLSearchParams({
      file: info.path,
      line: String(info.line),
      column: String(info.column),
    })
    window.open(`http://localhost:5678?${params}`, '_blank')
  }
}

/**
 * Bind listener to code-inspector:trackCode event.
 * Call once in app entry (main.ts / main.jsx).
 * Returns an unbind function.
 */
export function bindCaptureListener(options: InspectorHookOptions) {
  const { mode = 'auto', copy = false } = options

  const handler = async (e: Event) => {
    const detail = (e as TrackCodeEvent).detail
    if (!detail?.path) return

    const info: CapturedSourceInfo = {
      path: detail.path,
      name: detail.name,
      line: detail.line,
      column: detail.column,
      timestamp: Date.now(),
    }

    if (copy) {
      copyToClipboard(`${info.path}:${info.line}:${info.column}`)
    }

    if (mode === 'auto') {
      const action = await showActionDialog(info, options)
      if (action) handleAction(action, info, options)
    } else {
      handleAction(mode, info, options)
    }
  }

  window.addEventListener('code-inspector:trackCode', handler)
  return () => window.removeEventListener('code-inspector:trackCode', handler)
}
