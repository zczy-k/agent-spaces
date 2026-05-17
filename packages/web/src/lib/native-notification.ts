/**
 * Native notification abstraction layer.
 *
 * - Web: uses the browser Notification API
 * - Tauri: uses @tauri-apps/plugin-notification
 */

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

const ANDROID_ONGOING_TASK_NOTIFICATION_ID = 10001;

interface NativeNotificationOptions {
  id?: number;
  ongoing?: boolean;
}

/** Detect whether we are running inside a Tauri webview. */
export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined"
    && (window.location.hostname === "tauri.localhost" || "__TAURI_INTERNALS__" in window);
}

/** Detect whether we are running inside a Flutter webview. */
export function isFlutterEnvironment(): boolean {
  return typeof window !== "undefined" && "__FLUTTER_INTERNALS__" in window;
}

/** Detect whether we are running inside a native webview (Tauri or Flutter). */
export function isNativeEnvironment(): boolean {
  return isTauriEnvironment() || isFlutterEnvironment();
}

/** Detect whether we are running inside the Android Tauri webview. */
export function isTauriAndroidEnvironment(): boolean {
  return isTauriEnvironment()
    && typeof navigator !== 'undefined'
    && /android/i.test(navigator.userAgent);
}

/** Get the current native notification permission status. */
export async function getNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (isTauriEnvironment()) {
    return getTauriPermission();
  }
  if (isFlutterEnvironment()) {
    return getFlutterPermission();
  }
  return getWebPermission();
}

/** Request native notification permission. Returns the resulting status. */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (isTauriEnvironment()) {
    return requestTauriPermission();
  }
  if (isFlutterEnvironment()) {
    return requestFlutterPermission();
  }
  return requestWebPermission();
}

/** Send a native notification. */
export async function sendNativeNotification(title: string, body: string, options: NativeNotificationOptions = {}): Promise<void> {
  if (isTauriEnvironment()) {
    return sendTauriNotification(title, body, options);
  }
  if (isFlutterEnvironment()) {
    return sendFlutterNotification(title, body);
  }
  return sendWebNotification(title, body);
}

/** Update the Android ongoing task notification by reusing a stable notification id. */
export async function sendAndroidOngoingTaskNotification(body: string): Promise<void> {
  if (!isTauriAndroidEnvironment()) return;
  return sendNativeNotification('Agent Spaces', body, {
    id: ANDROID_ONGOING_TASK_NOTIFICATION_ID,
    ongoing: true,
  });
}

// ---------------------------------------------------------------------------
// Web (browser Notification API)
// ---------------------------------------------------------------------------

function getWebPermission(): NotificationPermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return mapWebStatus(Notification.permission);
}

async function requestWebPermission(): Promise<NotificationPermissionStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const result = await Notification.requestPermission();
  return mapWebStatus(result);
}

function sendWebNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }
  new Notification(title, { body, icon: '/favicon.ico' });
}

function mapWebStatus(permission: NotificationPermission): NotificationPermissionStatus {
  switch (permission) {
    case 'granted': return 'granted';
    case 'denied': return 'denied';
    default: return 'default';
  }
}

// ---------------------------------------------------------------------------
// Tauri (tauri-plugin-notification)
// ---------------------------------------------------------------------------

async function getTauriPermission(): Promise<NotificationPermissionStatus> {
  try {
    const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
    const granted = await isPermissionGranted();
    return granted ? 'granted' : 'default';
  } catch {
    return 'unsupported';
  }
}

async function requestTauriPermission(): Promise<NotificationPermissionStatus> {
  try {
    const { requestPermission, isPermissionGranted } = await import('@tauri-apps/plugin-notification');
    const permission = await requestPermission();
    if (permission === 'granted' || await isPermissionGranted()) {
      return 'granted';
    }
    return 'denied';
  } catch {
    return 'unsupported';
  }
}

async function sendTauriNotification(title: string, body: string, options: NativeNotificationOptions = {}): Promise<void> {
  try {
    const { sendNotification, isPermissionGranted } = await import('@tauri-apps/plugin-notification');
    if (!(await isPermissionGranted())) return;
    sendNotification({ title, body, ...options });
  } catch {
    // Tauri plugin not available, fall back silently
  }
}

// ---------------------------------------------------------------------------
// Flutter (flutter_inappwebview JS Bridge)
// ---------------------------------------------------------------------------

async function getFlutterPermission(): Promise<NotificationPermissionStatus> {
  try {
    const bridge = (window as Window & { __flutterBridge?: { invoke: (method: string, args: unknown) => Promise<unknown> } }).__flutterBridge;
    if (!bridge) return 'unsupported';
    const result = await bridge.invoke('getNotificationPermission', null);
    return result === true ? 'granted' : 'default';
  } catch {
    return 'unsupported';
  }
}

async function requestFlutterPermission(): Promise<NotificationPermissionStatus> {
  try {
    const bridge = (window as Window & { __flutterBridge?: { invoke: (method: string, args: unknown) => Promise<unknown> } }).__flutterBridge;
    if (!bridge) return 'unsupported';
    const result = await bridge.invoke('requestNotificationPermission', null);
    return result === true ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

async function sendFlutterNotification(title: string, body: string): Promise<void> {
  try {
    const bridge = (window as Window & { __flutterBridge?: { invoke: (method: string, args: unknown) => Promise<unknown> } }).__flutterBridge;
    if (!bridge) return;
    await bridge.invoke('sendNotification', { title, body });
  } catch {
    // Flutter bridge not available
  }
}
