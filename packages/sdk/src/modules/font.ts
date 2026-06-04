import type { HttpClient } from '../client';

export function createFontApi(http: HttpClient) {
  return {
    list: (): Promise<Array<{ id: string; name: string; url: string }>> =>
      http.get('/api/fonts'),

    upload: (formData: FormData): Promise<{ id: string; name: string; url: string }> =>
      http.upload('/api/fonts', formData),

    delete_: (id: string): Promise<void> =>
      http.delete(`/api/fonts/${id}`),
  };
}
