import type {
  AdminAnnouncement,
  AdminOverviewStats,
  AdminSubscriptionItem,
  AdminUserItem,
  SubscriptionResponse,
  SupportTicket,
  UserProfile,
  UserSubscription,
  UserWorkspacePayload,
} from '../types/finance';

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

const API_BASE = (import.meta.env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

async function apiRequest<T>(
  url: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
    keepalive?: boolean;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const targetUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      keepalive: options.keepalive,
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

  saveWorkspace: (
    token: string,
    workspace: UserWorkspacePayload,
    opts?: { keepalive?: boolean }
  ) =>
    apiRequest<{ workspace: UserWorkspacePayload }>('/api/workspace', {
      method: 'PUT',
      token,
      body: workspace,
      keepalive: opts?.keepalive,
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

export const subscriptionApi = {
  getSubscription: (token: string) =>
    apiRequest<SubscriptionResponse>('/api/subscription', {
      method: 'GET',
      token,
    }),

  upgradeSubscription: (
    token: string,
    data: {
      plan: 'free' | 'pro' | 'business';
      paymentMethod: string;
      phone: string;
      billingCycle?: 'monthly' | 'yearly';
    }
  ) =>
    apiRequest<{ ok: boolean; subscription: UserSubscription; message: string }>(
      '/api/subscription/upgrade',
      {
        method: 'POST',
        token,
        body: data,
      }
    ),
};

export const adminApi = {
  getOverview: (token: string) =>
    apiRequest<{ ok: boolean; stats: AdminOverviewStats }>('/api/admin/overview', {
      method: 'GET',
      token,
    }),

  getUsers: (token: string) =>
    apiRequest<{ ok: boolean; users: AdminUserItem[] }>('/api/admin/users', {
      method: 'GET',
      token,
    }),

  updateUserPlan: (token: string, targetId: string, plan: 'free' | 'pro' | 'business') =>
    apiRequest<{ ok: boolean; subscription: UserSubscription; message: string }>(
      '/api/admin/users/plan',
      {
        method: 'POST',
        token,
        body: { targetId, plan },
      }
    ),

  getTickets: (token: string) =>
    apiRequest<{ ok: boolean; tickets: SupportTicket[] }>('/api/admin/tickets', {
      method: 'GET',
      token,
    }),

  updateTicketStatus: (token: string, ticketId: string, status: string) =>
    apiRequest<{ ok: boolean; message: string }>('/api/admin/tickets/status', {
      method: 'POST',
      token,
      body: { ticketId, status },
    }),

  toggleUserSuspension: (token: string, targetId: string, isSuspended: boolean) =>
    apiRequest<{ ok: boolean; message: string }>('/api/admin/users/status', {
      method: 'POST',
      token,
      body: { targetId, isSuspended },
    }),

  resetUserPassword: (token: string, targetId: string, newPassword: string) =>
    apiRequest<{ ok: boolean; message: string }>('/api/admin/users/reset-password', {
      method: 'POST',
      token,
      body: { targetId, newPassword },
    }),

  getSubscriptions: (token: string) =>
    apiRequest<{ ok: boolean; subscriptions: AdminSubscriptionItem[] }>(
      '/api/admin/subscriptions',
      {
        method: 'GET',
        token,
      }
    ),

  approveSubscription: (
    token: string,
    targetId: string,
    plan: 'pro' | 'business',
    billingCycle: 'monthly' | 'yearly' = 'monthly'
  ) =>
    apiRequest<{ ok: boolean; message: string }>('/api/admin/subscriptions/approve', {
      method: 'POST',
      token,
      body: { targetId, plan, billingCycle },
    }),

  getAnnouncements: (token: string) =>
    apiRequest<{ ok: boolean; announcements: AdminAnnouncement[] }>(
      '/api/admin/announcements',
      {
        method: 'GET',
        token,
      }
    ),

  createAnnouncement: (
    token: string,
    data: { title: string; message: string; severity?: string }
  ) =>
    apiRequest<{ ok: boolean; message: string }>('/api/admin/announcements', {
      method: 'POST',
      token,
      body: data,
    }),

  deleteAnnouncement: (token: string, id: string) =>
    apiRequest<{ ok: boolean; message: string }>(`/api/admin/announcements/${id}`, {
      method: 'DELETE',
      token,
    }),

  getClientAnnouncements: () =>
    apiRequest<{ ok: boolean; announcements: AdminAnnouncement[] }>('/api/announcements', {
      method: 'GET',
    }),
};
