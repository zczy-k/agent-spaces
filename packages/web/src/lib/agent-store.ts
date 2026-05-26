'use client';

const STORAGE_KEY = 'agent-spaces:store-api-base';

export function getStoreApiBase(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY) || 'https://gh-proxy.org/https://github.com/hunmer/agent-spaces/raw/refs/heads/main/packages/agents/';
}

export function setStoreApiBase(url: string) {
  if (typeof window === 'undefined') return;
  if (url) localStorage.setItem(STORAGE_KEY, url);
  else localStorage.removeItem(STORAGE_KEY);
}

export async function fetchStoreIndex<T>(path: string): Promise<T[]> {
  const base = getStoreApiBase();
  const url = base ? `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}` : `/agents-store/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  return res.json();
}
