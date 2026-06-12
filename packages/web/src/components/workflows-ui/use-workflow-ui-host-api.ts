import { createElement, useEffect, useRef } from 'react';
import { fetchWithAuth } from '@/lib/auth';
import * as AgentSpacesUI from '@/lib/ui-exports';
import { useEditorStore } from '@/stores/editor';

const LAST_SELECTION_CONFIG = 'last-selection.json';

type UploadedWorkflowFile = {
  name: string;
  path: string;
  size: number;
  type: string;
  url: string;
  httpPath?: string;
};

type WorkflowFileUploadItem = {
  id: string;
  file: File & Partial<UploadedWorkflowFile> & {
    uploading?: boolean;
    uploadError?: string;
    uploadPromise?: Promise<UploadedWorkflowFile>;
  };
  preview?: string;
};

function normalizeRelativePath(filePath: string, fallback: string) {
  const normalized = (filePath || fallback).trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('\0') || normalized.split('/').includes('..')) {
    throw new Error(`Invalid file path: ${filePath}`);
  }
  return normalized;
}

function inferDownloadFileName(url: string) {
  try {
    const parsed = new URL(url, window.location.href);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
    return lastSegment ? decodeURIComponent(lastSegment) : 'download.bin';
  } catch {
    return 'download.bin';
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function uploadWorkflowFile(file: File): Promise<UploadedWorkflowFile> {
  const formData = new FormData();
  formData.append('file', file);

  const resp = await fetchWithAuth('/api/upload', {
    method: 'POST',
    body: formData,
  });
  const payload = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new Error(payload?.error || `Failed to upload file: ${resp.status} ${resp.statusText}`);
  }
  return payload;
}

function createWorkflowUploadFile(file: File, uploadPromise: Promise<UploadedWorkflowFile>) {
  return Object.assign(file, {
    uploading: true,
    uploadPromise,
  });
}

function mergeUploadedFile(file: WorkflowFileUploadItem['file'], uploaded: UploadedWorkflowFile) {
  return Object.assign(file, {
    ...uploaded,
    uploading: false,
    uploadError: undefined,
    uploadPromise: Promise.resolve(uploaded),
  });
}

function markUploadFailed(file: WorkflowFileUploadItem['file'], error: unknown) {
  return Object.assign(file, {
    uploading: false,
    uploadError: error instanceof Error ? error.message : String(error || 'Upload failed'),
  });
}

function WrappedFileUpload(props: any) {
  const latestValueRef = useRef<WorkflowFileUploadItem[]>(props.value || []);

  useEffect(() => {
    latestValueRef.current = props.value || [];
  }, [props.value]);

  const handleChange = (files: WorkflowFileUploadItem[]) => {
    const next = files.map((item) => {
      const file = item.file;
      if (!file || file.path || file.httpPath || file.uploadPromise || !(file instanceof File)) {
        return item;
      }

      const uploadPromise = uploadWorkflowFile(file);
      return {
        ...item,
        file: createWorkflowUploadFile(file, uploadPromise),
      };
    });

    latestValueRef.current = next;
    props.onChange?.(next);

    for (const item of next) {
      const promise = item.file?.uploadPromise;
      if (!promise || !item.file.uploading) continue;

      promise
        .then((uploaded) => {
          const current = latestValueRef.current;
          const updated = current.map((currentItem) => (
            currentItem.id === item.id
              ? { ...currentItem, file: mergeUploadedFile(currentItem.file, uploaded) }
              : currentItem
          ));
          latestValueRef.current = updated;
          props.onChange?.(updated);
        })
        .catch((error) => {
          const current = latestValueRef.current;
          const updated = current.map((currentItem) => (
            currentItem.id === item.id
              ? { ...currentItem, file: markUploadFailed(currentItem.file, error) }
              : currentItem
          ));
          latestValueRef.current = updated;
          props.onChange?.(updated);
        });
    }
  };

  return createElement(AgentSpacesUI.FileUpload as any, {
    ...props,
    onChange: handleChange,
  });
}

/**
 * Mount `window.AgentSpacesUI`, `window.AgentSpaces`, `window.AgentSpacesAPI`
 * for workflow-ui preview code. Cleans up on unmount.
 */
export function useWorkflowUiHostApi(projectId: string) {
  useEffect(() => {
    const executePluginTool = async (pluginId: string, toolName: string, args: Record<string, any>) => {
      const resp = await fetchWithAuth(`/api/plugins/${pluginId}/tools/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: toolName, args }),
      });
      const payload = await resp.json();
      if (!resp.ok) return payload;
      return Object.prototype.hasOwnProperty.call(payload, 'result') ? payload.result : payload;
    };

    const readConfigJson = async <T,>(filePath = LAST_SELECTION_CONFIG): Promise<T | null> => {
      const path = normalizeRelativePath(filePath, LAST_SELECTION_CONFIG);
      const resp = await fetchWithAuth(`/api/workflows-ui/${projectId}/configs/content?path=${encodeURIComponent(path)}`);
      if (!resp.ok) throw new Error(`Failed to read config: ${resp.status} ${resp.statusText}`);
      const { value } = await resp.json();
      return value;
    };

    const writeConfigJson = async (filePath: string, value: unknown) => {
      const path = normalizeRelativePath(filePath, LAST_SELECTION_CONFIG);
      const resp = await fetchWithAuth(`/api/workflows-ui/${projectId}/configs/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, value }),
      });
      if (!resp.ok) throw new Error(`Failed to write config: ${resp.status} ${resp.statusText}`);
      return { ok: true, path: `configs/${path}` };
    };

    const readLastSelection = <T,>() => readConfigJson<T>(LAST_SELECTION_CONFIG);
    const writeLastSelection = (value: unknown) => writeConfigJson(LAST_SELECTION_CONFIG, value);

    const saveDataFile = async (filePath: string, content: string | Blob | ArrayBuffer | Uint8Array) => {
      const path = normalizeRelativePath(filePath, 'download.bin');
      if (typeof content === 'string') {
        const resp = await fetchWithAuth(`/api/workflows-ui/${projectId}/data/content`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, content }),
        });
        if (!resp.ok) throw new Error(`Failed to save data file: ${resp.status} ${resp.statusText}`);
        return resp.json();
      }

      const blob = content instanceof Blob ? content : new Blob([content as BlobPart]);
      const base64 = await blobToBase64(blob);
      const resp = await fetchWithAuth(`/api/workflows-ui/${projectId}/data/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content: base64, encoding: 'base64' }),
      });
      if (!resp.ok) throw new Error(`Failed to save data file: ${resp.status} ${resp.statusText}`);
      return resp.json();
    };

    const downloadFile = async (url: string, filePath?: string, init?: RequestInit) => {
      const response = await fetch(url, init);
      if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      const path = normalizeRelativePath(filePath ?? inferDownloadFileName(url), 'download.bin');
      const base64 = await blobToBase64(await response.blob());
      const resp = await fetchWithAuth(`/api/workflows-ui/${projectId}/data/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content: base64, encoding: 'base64' }),
      });
      if (!resp.ok) throw new Error(`Failed to save downloaded file: ${resp.status} ${resp.statusText}`);
      return resp.json();
    };

    // ---- Plugin info ----
    const getPluginInfo = async (pluginId: string) => {
      const resp = await fetchWithAuth(`/api/plugins`);
      if (!resp.ok) throw new Error(`Failed to list plugins: ${resp.status}`);
      const plugins: any[] = await resp.json();
      return plugins.find((p: any) => p.id === pluginId) ?? null;
    };

    // ---- Tool exists check ----
    const toolExists = async (pluginId: string, toolName: string): Promise<boolean> => {
      const resp = await fetchWithAuth(`/api/plugins/${pluginId}/tools`);
      if (!resp.ok) return false;
      const tools: Array<{ name: string }> = await resp.json();
      return tools.some((t) => t.name === toolName);
    };

    // ---- Open file in editor ----
    const openFile = async (filePath: string, line?: number, column?: number) => {
      window.dispatchEvent(new CustomEvent('agent-spaces:open-file', {
        detail: { workspaceId: projectId, path: filePath, line, column },
      }));
    };

    // ---- Reveal folder in file manager ----
    const revealFolder = async (folderPath?: string) => {
      const query = folderPath ? `?path=${encodeURIComponent(folderPath)}` : '';
      const resp = await fetchWithAuth(`/api/workspaces/${projectId}/files/reveal${query}`, {
        method: 'POST',
      });
      if (!resp.ok) throw new Error(`Failed to reveal folder: ${resp.status}`);
      return resp.json();
    };

    // ---- Send notification ----
    const sendNotification = async (type: string, title: string, description?: string, data?: Record<string, unknown>) => {
      const resp = await fetchWithAuth(`/api/workspaces/${projectId}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title, description, data }),
      });
      if (!resp.ok) throw new Error(`Failed to send notification: ${resp.status}`);
      return resp.json();
    };

    const hostUi = {
      ...AgentSpacesUI,
      FileUpload: WrappedFileUpload,
      readConfigJson,
      writeConfigJson,
      readLastSelection,
      writeLastSelection,
      saveDataFile,
      downloadFile,
    };

    const pluginApi = {
      callPluginTool: executePluginTool,
      executePluginTool,
      getPluginInfo,
      toolExists,
    };

    const fileApi = {
      openFile,
      revealFolder,
    };

    const notificationApi = {
      sendNotification,
    };

    (window as any).AgentSpacesUI = hostUi;
    (window as any).AgentSpaces = {
      ...pluginApi,
      ...fileApi,
      ...notificationApi,
      readConfigJson,
      writeConfigJson,
      readLastSelection,
      writeLastSelection,
      saveDataFile,
      downloadFile,
    };
    (window as any).AgentSpacesAPI = {
      ...pluginApi,
      ...fileApi,
      ...notificationApi,
      readConfigJson,
      writeConfigJson,
      readLastSelection,
      writeLastSelection,
      saveDataFile,
      downloadFile,
    };

    const handleOpenFile = (e: Event) => {
      const { workspaceId, path, line, column } = (e as CustomEvent).detail;
      const openFile = useEditorStore.getState().openFile;
      openFile(workspaceId, path).then(() => {
        // Scroll to line if specified (dispatched after content loads)
        if (line != null) {
          window.dispatchEvent(new CustomEvent('agent-spaces:scroll-to-line', {
            detail: { path, line, column },
          }));
        }
      });
    };
    window.addEventListener('agent-spaces:open-file', handleOpenFile);

    return () => {
      window.removeEventListener('agent-spaces:open-file', handleOpenFile);
      delete (window as any).AgentSpacesUI;
      delete (window as any).AgentSpaces;
      delete (window as any).AgentSpacesAPI;
    };
  }, [projectId]);
}
