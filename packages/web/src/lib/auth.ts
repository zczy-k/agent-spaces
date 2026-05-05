import { getActiveServer } from './server';

const TOKEN_KEY = 'agent-spaces-token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) || getActiveServer()?.secret || null;
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchWithAuth(input: string, init?: RequestInit) {
  const headers = { ...authHeaders(), ...init?.headers };
  const res = await fetch(input, { ...init, headers });

  if (res.status === 401 || res.status === 403) {
    removeToken();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  return res;
}
