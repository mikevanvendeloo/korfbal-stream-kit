// Centralized API base configuration and helpers

export const API_BASE: string =
  (import.meta as any)?.env?.VITE_API_URL || 'http://localhost:3333';

export function apiUrl(path: string): string {
  if (!path) return API_BASE;
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, API_BASE).toString();
}

export function assetUrl(relativePath: string): string {
  const p = String(relativePath || '').replace(/^\/+/, '');
  return new URL(`/assets/${p}`, API_BASE).toString();
}

export function uploadUrl(relativePath: string): string {
  const p = String(relativePath || '').replace(/^\/+/, '');
  return new URL(`/uploads/${p}`, API_BASE).toString();
}
