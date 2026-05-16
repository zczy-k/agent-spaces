import { getActiveServerUrl } from './server';

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  const key = '__api_patched__' as keyof Window;

  if (!(window[key] as boolean)) {
    (window as unknown as Record<string, unknown>)[key] = true;

    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      if (typeof input === 'string' && input.startsWith('/api/')) {
        const baseUrl = getActiveServerUrl();
        if (baseUrl) {
          input = `${baseUrl}${input}`;
        }
      }
      return originalFetch.call(window, input, init);
    };
  }
}
