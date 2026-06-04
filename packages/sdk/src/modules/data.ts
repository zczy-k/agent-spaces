import type { HttpClient } from '../client';

export function createDataApi(http: HttpClient) {
  return {
    /** 导出数据为 ZIP */
    exportZip: (): Promise<Response> =>
      http.raw('/api/data/export'),

    /** 导入 ZIP 数据 */
    importZip: (formData: FormData): Promise<{ success: boolean }> =>
      http.upload('/api/data/import', formData),

    /** cc-switch 迁移 */
    importCcSwitch: (): Promise<{ success: boolean; imported: string[] }> =>
      http.post('/api/import/cc-switch', {}),

    /** Preview cc-switch import */
    ccSwitchPreview: (): Promise<{ error?: string; providers?: unknown[]; skills?: unknown[]; mcps?: unknown[] }> =>
      http.get('/api/import/cc-switch/preview'),

    /** Execute cc-switch import */
    ccSwitchExecute: (body: Record<string, unknown>): Promise<{ providers?: string[]; models?: unknown[]; skills?: unknown[]; mcps?: unknown[] }> =>
      http.post('/api/import/cc-switch/execute', body),

    /** Preview ZIP import */
    importPreview: (formData: FormData): Promise<{ error?: string; sessionId?: string; categories?: unknown[] }> =>
      http.upload('/api/data/import/preview', formData),

    /** Execute ZIP import */
    importExecute: (sessionId: string, categories: string[]): Promise<{ error?: string; results?: Record<string, unknown> }> =>
      http.post('/api/data/import/execute', { sessionId, categories }),
  };
}
