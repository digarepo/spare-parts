import { storage } from './storage';

const API = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  refresh_expires_at: string;
  user: { id: string; email: string; fullName?: string | null; createdAt: string };
  tenantId: string;
}

export interface MeResponse {
  ok: boolean;
  tenantId: string;
  email: string;
}

export interface TenantOverviewResponse {
  ok: boolean;
  tenant: { id: string; name: string } | null;
}

export function getToken(): string {
  return storage.getItem('access_token') ?? '';
}

export function setAuth(resp: LoginResponse): void {
  storage.setItem('access_token', resp.access_token);
  storage.setItem('tenant_id', resp.tenantId);
}

export function clearAuth(): void {
  storage.removeItem('access_token');
  storage.removeItem('tenant_id');
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();

  // Use Headers (strongly typed) instead of raw HeadersInit
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API}${path}`, { ...init, headers });

  const contentType = res.headers.get('content-type') ?? '';
  let body: unknown = null;

  try {
    body = contentType.includes('application/json') ? await res.json() : await res.text();
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status}`, res.status, body);
  }

  return body as T;
}
