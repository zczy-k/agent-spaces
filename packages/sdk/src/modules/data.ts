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
  };
}
