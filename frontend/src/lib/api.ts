const BASE_URL = '/api';

type ApiError = { error: string; detail?: string; [key: string]: unknown };

export class ApiRequestError extends Error {
  status: number;
  body: ApiError;
  constructor(status: number, body: ApiError) {
    super(body.error || `Request failed with status ${status}`);
    this.name = 'ApiRequestError';
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('flooring_jwt');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ error: res.statusText }))) as ApiError;
    throw new ApiRequestError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
};

export type Role = 'client' | 'staff' | 'admin';

export type LoginResponse = {
  token: string;
  user: { id: string; email: string; role: Role; displayName: string };
};

export type WorkOrderPortalView = {
  id: string;
  status: string;
  po_number: string | null;
  target_turn_date: string | null;
  created_at: string;
  line_items: { roomName: string; quantityCalculated: number; quantityActualUsed: number | null }[];
};

export type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit_of_measure: string;
  quantity_on_hand: number;
  reorder_threshold: number;
  needs_reorder: boolean;
};

export type TemplateImportRowError = { line: number; error: string };

export type TemplateImportResultRow = {
  propertyName: string;
  planName: string;
  status: 'created' | 'updated' | 'failed';
  templateId?: string;
  roomCount?: number;
  error?: string;
};

export type TemplateImportResponse = {
  templatesProcessed: number;
  results: TemplateImportResultRow[];
  rowErrors: TemplateImportRowError[];
};
