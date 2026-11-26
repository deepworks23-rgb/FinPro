import type { SupportTicket, UserProfile, UserWorkspacePayload } from '../types/finance';

export interface AuthResponse {
  token: string;
  user: UserProfile;
  workspace: UserWorkspacePayload;
}

export interface RegisterRequest {
  name: string;
  phone: string;
  email: string;
  address: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
}

export interface ProfileUpdateRequest {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  avatarDataUrl?: string;
  currency?: 'MZN' | 'USD';
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface CreateSupportTicketRequest {
  subject: string;
  category: string;
  contactChannel: string;
  message: string;
}

async function apiRequest<T>(
  url: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error(
      'Não foi possível ligar ao servidor. Verifique se o app está a correr em http://localhost:3000 (npm run dev).'
    );
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : `Não foi possível concluir a solicitação (HTTP ${response.status}). Tente novamente.`;
    throw new Error(message);
  }

  return payload as T;
}

export const authApi = {
  register: (data: RegisterRequest) =>
    apiRequest<AuthResponse>('/api/auth/register', { method: 'POST', body: data }),

  login: (identifier: string, password: string) =>
    apiRequest<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: { identifier, password },
    }),

  logout: (token: string) =>
    apiRequest<{ ok: boolean }>('/api/auth/logout', { method: 'POST', token }),

  me: (token: string) =>
    apiRequest<{ user: UserProfile; workspace: UserWorkspacePayload }>('/api/auth/me', {
      method: 'GET',
      token,
    }),

  updateProfile: (token: string, data: ProfileUpdateRequest) =>
    apiRequest<{ user: UserProfile; workspace?: UserWorkspacePayload }>('/api/profile', {
      method: 'PATCH',
      token,
      body: data,
    }),

  changePassword: (token: string, data: ChangePasswordRequest) =>
    apiRequest<{ ok: boolean; user: UserProfile }>('/api/profile/password', {
      method: 'POST',
      token,
      body: data,
    }),

  saveWorkspace: (token: string, workspace: UserWorkspacePayload) =>
    apiRequest<{ workspace: UserWorkspacePayload }>('/api/workspace', {
      method: 'PUT',
      token,
      body: workspace,
    }),

  submitSupportTicket: (token: string, data: CreateSupportTicketRequest) =>
    apiRequest<{ ticket: SupportTicket }>('/api/support', {
      method: 'POST',
      token,
      body: data,
    }),

  listSupportTickets: (token: string) =>
    apiRequest<{ tickets: SupportTicket[] }>('/api/support', {
      method: 'GET',
      token,
    }),
};
