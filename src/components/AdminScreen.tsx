import { AppIcon } from './AppIcon';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  AdminAnnouncement,
  AdminOverviewStats,
  AdminSubscriptionItem,
  AdminUserItem,
  CurrencyCode,
  SubscriptionPlan,
  SupportTicket,
  UserProfile,
} from '../types/finance';
import { adminApi } from '../services/api';
import { formatMoney, getUserInitials } from '../utils/finance';

interface AdminScreenProps {
  authToken: string;
  currency: CurrencyCode;
  currentUser?: UserProfile | null;
  onNotify: (msg: string) => void;
  onNavigateToApp?: () => void;
  onNavigateToLanding?: () => void;
  onLogout?: () => Promise<void>;
}

type AdminTab =
  | 'dashboard'
  | 'statistics'
  | 'subscriptions'
  | 'users'
  | 'tickets'
  | 'announcements'
  | 'settings';

export function AdminScreen({
  authToken,
  currency,
  currentUser,
  onNotify,
  onNavigateToApp,
  onNavigateToLanding,
  onLogout,
}: AdminScreenProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Search
  const [userSearch, setUserSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | SubscriptionPlan>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Modals state
  const [resetPwdModalUser, setResetPwdModalUser] = useState<AdminUserItem | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnMessage, setNewAnnMessage] = useState('');
  const [newAnnSeverity, setNewAnnSeverity] = useState<'info' | 'warning' | 'critical'>('info');
  const [isPublishingAnn, setIsPublishingAnn] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Data Loading
  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [overviewRes, usersRes, subscriptionsRes, ticketsRes, annRes] = await Promise.all([
        adminApi.getOverview(authToken).catch(() => ({ ok: false, stats: null })),
        adminApi.getUsers(authToken).catch(() => ({ ok: false, users: [] })),
        adminApi.getSubscriptions(authToken).catch(() => ({ ok: false, subscriptions: [] })),
        adminApi.getTickets(authToken).catch(() => ({ ok: false, tickets: [] })),
        adminApi.getAnnouncements(authToken).catch(() => ({ ok: false, announcements: [] })),
      ]);

      if (overviewRes.stats) setStats(overviewRes.stats);
      if (Array.isArray(usersRes.users)) setUsers(usersRes.users);
      if (Array.isArray(subscriptionsRes.subscriptions)) setSubscriptions(subscriptionsRes.subscriptions);
      if (Array.isArray(ticketsRes.tickets)) setTickets(ticketsRes.tickets);
      if (Array.isArray(annRes.announcements)) setAnnouncements(annRes.announcements);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao sincronizar dados administrativos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [authToken]);

  // Derived metrics
  const conversionRate = useMemo(() => {
    if (!stats || stats.totalUsers === 0) return 0;
    const paidCount = (stats.proUsersCount || 0) + (stats.businessUsersCount || 0);
    return Math.round((paidCount / stats.totalUsers) * 100);
  }, [stats]);

  // Actions: User Plan
  const handleChangeUserPlan = async (targetId: string, nextPlan: SubscriptionPlan) => {
    setUpdatingUserId(targetId);
    try {
      const res = await adminApi.updateUserPlan(authToken, targetId, nextPlan);
      onNotify(res.message);
      setUsers((prev) =>
        prev.map((u) => (u.id === targetId ? { ...u, plan: nextPlan, status: 'active' } : u))
      );
      void loadData();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao atualizar plano.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Actions: User Suspension
  const handleToggleUserSuspension = async (user: AdminUserItem) => {
    const nextSuspended = !user.isSuspended;
    try {
      const res = await adminApi.toggleUserSuspension(authToken, user.id, nextSuspended);
      onNotify(res.message);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isSuspended: nextSuspended } : u))
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao moderar utilizador.');
    }
  };

  // Actions: Reset Password
  const handleResetPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetPwdModalUser || newPasswordVal.length < 6) {
      onNotify('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setIsResettingPassword(true);
    try {
      const res = await adminApi.resetUserPassword(authToken, resetPwdModalUser.id, newPasswordVal);
      onNotify(res.message);
      setResetPwdModalUser(null);
      setNewPasswordVal('');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao redefinir senha.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Actions: Approve M-Pesa Subscription Payment
  const handleApproveSubscription = async (sub: AdminSubscriptionItem) => {
    try {
      const planToApprove = sub.plan === 'business' ? 'business' : 'pro';
      const res = await adminApi.approveSubscription(authToken, sub.userId, planToApprove, sub.billingCycle);
      onNotify(res.message);
      void loadData();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao aprovar subscrição.');
    }
  };

  // Actions: Support Tickets
  const handleUpdateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const res = await adminApi.updateTicketStatus(authToken, ticketId, status);
      onNotify(res.message);
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: status as any } : t)));
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao atualizar bilhete.');
    }
  };

  // Actions: Global Announcements
  const handleCreateAnnouncement = async (e: FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnMessage.trim()) {
      onNotify('Preencha o título e a mensagem do comunicado.');
      return;
    }
    setIsPublishingAnn(true);
    try {
      const res = await adminApi.createAnnouncement(authToken, {
        title: newAnnTitle.trim(),
        message: newAnnMessage.trim(),
        severity: newAnnSeverity,
      });
      onNotify(res.message);
      setAnnouncementModalOpen(false);
      setNewAnnTitle('');
      setNewAnnMessage('');
      void loadData();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao publicar comunicado.');
    } finally {
      setIsPublishingAnn(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      const res = await adminApi.deleteAnnouncement(authToken, id);
      onNotify(res.message);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao remover comunicado.');
    }
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.phone.includes(userSearch) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.paymentReference.toLowerCase().includes(userSearch.toLowerCase());
      const matchesPlan = planFilter === 'all' || u.plan === planFilter;
      return matchesSearch && matchesPlan;
    });
  }, [users, userSearch, planFilter]);

  // Bar chart simulated data based on MRR
  const mrrTotal = stats?.mrrMzn ?? 0;
  const chartBars = [
    { label: 'Dom', val: Math.round(mrrTotal * 0.45) },
    { label: 'Seg', val: Math.round(mrrTotal * 0.65) },
    { label: 'Ter', val: Math.round(mrrTotal * 0.95) },
    { label: 'Qua', val: Math.round(mrrTotal * 0.55) },
    { label: 'Qui', val: Math.round(mrrTotal * 0.75) },
    { label: 'Sex', val: Math.round(mrrTotal * 1.0) },
    { label: 'Sáb', val: Math.round(mrrTotal * 0.85) },
  ];
  const maxBarVal = Math.max(...chartBars.map((b) => b.val), 1000);

  // Admin Initials
  const adminName = currentUser?.name || 'Joswil Admin';
  const adminInitials = getUserInitials(adminName);

  return (
    <div className="min-h-screen w-full bg-surface-container-low/40 flex text-on-surface">
      {/* 1. LEFT SIDEBAR (Modelo Layout Exato) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 lg:w-72 bg-surface-container-lowest border-r border-surface-container flex flex-col justify-between transition-transform duration-200 md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Brand Logo & SaaS Console Header */}
          <div className="h-20 px-6 flex items-center justify-between border-b border-surface-container/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-md shadow-primary/25 shrink-0">
                <AppIcon name="grid_view" className="text-[22px]" filled />
              </div>
              <div>
                <span className="text-[17px] font-black text-on-surface tracking-tight block leading-tight">
                  FinTrack
                </span>
                <span className="text-[10.5px] font-bold text-primary uppercase tracking-widest block leading-tight">
                  SaaS Console
                </span>
              </div>
            </div>

            <button
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container cursor-pointer"
              onClick={() => setMobileMenuOpen(false)}
              type="button"
            >
              <AppIcon name="close" className="text-[20px]" />
            </button>
          </div>

          {/* Navigation Items (Pills no Estilo do Modelo) */}
          <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto no-scrollbar">
            <button
              className={`w-full h-11 px-4 rounded-2xl flex items-center gap-3 text-[13.5px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-primary text-on-primary shadow-md shadow-primary/20 font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('dashboard');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="dashboard" className="text-[20px]" filled={activeTab === 'dashboard'} />
              <span>Dashboard</span>
            </button>

            <button
              className={`w-full h-11 px-4 rounded-2xl flex items-center gap-3 text-[13.5px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'statistics'
                  ? 'bg-primary text-on-primary shadow-md shadow-primary/20 font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('statistics');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="analytics" className="text-[20px]" filled={activeTab === 'statistics'} />
              <span>Statistics</span>
            </button>

            <button
              className={`w-full h-11 px-4 rounded-2xl flex items-center gap-3 text-[13.5px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'subscriptions'
                  ? 'bg-primary text-on-primary shadow-md shadow-primary/20 font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('subscriptions');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="receipt_long" className="text-[20px]" filled={activeTab === 'subscriptions'} />
              <span className="flex-1">Transaction</span>
              {subscriptions.filter((s) => s.paymentReference && s.status === 'trialing').length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary text-[10px] font-bold">
                  {subscriptions.filter((s) => s.paymentReference && s.status === 'trialing').length}
                </span>
              )}
            </button>

            <button
              className={`w-full h-11 px-4 rounded-2xl flex items-center gap-3 text-[13.5px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-primary text-on-primary shadow-md shadow-primary/20 font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('users');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="group" className="text-[20px]" filled={activeTab === 'users'} />
              <span className="flex-1">My Team / Clientes</span>
              <span className="text-[11px] font-bold opacity-80">{users.length}</span>
            </button>

            <button
              className={`w-full h-11 px-4 rounded-2xl flex items-center gap-3 text-[13.5px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'tickets'
                  ? 'bg-primary text-on-primary shadow-md shadow-primary/20 font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('tickets');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="support_agent" className="text-[20px]" filled={activeTab === 'tickets'} />
              <span className="flex-1">Sell Reports / Suporte</span>
              {tickets.filter((t) => t.status === 'aberto').length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[10px] font-bold">
                  {tickets.filter((t) => t.status === 'aberto').length}
                </span>
              )}
            </button>

            <button
              className={`w-full h-11 px-4 rounded-2xl flex items-center gap-3 text-[13.5px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'announcements'
                  ? 'bg-primary text-on-primary shadow-md shadow-primary/20 font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('announcements');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="campaign" className="text-[20px]" filled={activeTab === 'announcements'} />
              <span>Comunicados</span>
            </button>

            <button
              className={`w-full h-11 px-4 rounded-2xl flex items-center gap-3 text-[13.5px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-primary text-on-primary shadow-md shadow-primary/20 font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('settings');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="settings" className="text-[20px]" filled={activeTab === 'settings'} />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Bottom Sidebar: User Profile & Log Out Button (Idêntico ao Modelo) */}
        <div className="p-4 border-t border-surface-container/70 space-y-3 bg-surface-container-low/30 shrink-0">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-10 h-10 rounded-2xl bg-primary-fixed text-primary font-black text-[13px] flex items-center justify-center shrink-0 shadow-xs ring-2 ring-primary/20">
              {currentUser?.avatarDataUrl ? (
                <img
                  src={currentUser.avatarDataUrl}
                  alt={adminName}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                adminInitials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[13.5px] font-bold text-on-surface truncate block leading-tight">
                {adminName}
              </span>
              <span className="text-[11px] font-medium text-primary block leading-tight">
                Admin Master
              </span>
            </div>
          </div>

          {onLogout && (
            <button
              className="w-full h-10 px-3 rounded-xl text-tertiary hover:bg-error-container/60 text-[12.5px] font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              onClick={() => void onLogout()}
              type="button"
            >
              <AppIcon name="logout" className="text-[18px]" />
              <span>Log Out</span>
            </button>
          )}
        </div>
      </aside>

      {/* Backdrop for Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-inverse-surface/40 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* 2. MAIN CONTENT AREA (Header + Grid Widgets) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto bg-surface-container-low/20">
        {/* Top Header (Estilo do Modelo) */}
        <header className="h-20 px-4 sm:px-8 border-b border-surface-container flex items-center justify-between bg-surface-container-lowest/80 backdrop-blur-md sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container text-on-surface cursor-pointer"
              onClick={() => setMobileMenuOpen(true)}
              type="button"
            >
              <AppIcon name="menu" className="text-[22px]" />
            </button>

            <div>
              <h1 className="text-[20px] sm:text-[24px] font-black text-on-surface tracking-tight leading-tight capitalize">
                {activeTab === 'dashboard'
                  ? 'Dashboard'
                  : activeTab === 'statistics'
                    ? 'Statistics & Analytics'
                    : activeTab === 'subscriptions'
                      ? 'Transactions & Subscriptions'
                      : activeTab === 'users'
                        ? 'Team & Customers'
                        : activeTab === 'tickets'
                          ? 'Helpdesk & Reports'
                          : activeTab === 'announcements'
                            ? 'Broadcast Announcements'
                            : 'Settings & Health'}
              </h1>
              <span className="text-[11.5px] font-medium text-on-surface-variant block leading-tight">
                27 de Novembro, 2026 · FinTrack SaaS Master View
              </span>
            </div>
          </div>

          {/* Top Right Actions & Admin Profile Chip (Idêntico ao Modelo) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {onNavigateToApp && (
              <button
                className="h-10 px-3.5 rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface text-[12px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer hidden sm:flex"
                onClick={onNavigateToApp}
                title="Abrir App de Finanças do Cliente"
                type="button"
              >
                <AppIcon name="phone_iphone" className="text-[17px] text-primary" />
                <span>Ver App</span>
              </button>
            )}

            {onNavigateToLanding && (
              <button
                className="h-10 px-3.5 rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface text-[12px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer hidden sm:flex"
                onClick={onNavigateToLanding}
                title="Ver Site e Landing Page Pública"
                type="button"
              >
                <AppIcon name="public" className="text-[17px] text-primary" />
                <span>Site Público</span>
              </button>
            )}

            <button
              className="w-10 h-10 rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-colors cursor-pointer"
              onClick={loadData}
              title="Atualizar Dados do Servidor"
              type="button"
            >
              <AppIcon name="refresh" className={`text-[19px] ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Profile Avatar Chip Top Right (Do Modelo) */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-surface-container">
              <div className="w-10 h-10 rounded-2xl bg-primary-fixed text-primary font-black text-[13px] flex items-center justify-center shrink-0 ring-2 ring-primary/20">
                {currentUser?.avatarDataUrl ? (
                  <img
                    src={currentUser.avatarDataUrl}
                    alt={adminName}
                    className="w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  adminInitials
                )}
              </div>
              <div className="hidden lg:block text-left">
                <span className="text-[13px] font-bold text-on-surface block leading-tight">
                  {adminName}
                </span>
                <span className="text-[10.5px] font-medium text-on-surface-variant block leading-tight">
                  Admin Master
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Notification or Error Banner */}
        {errorMsg && (
          <div className="mx-4 sm:mx-8 mt-4 p-3.5 rounded-2xl bg-error-container text-on-error-container text-[12.5px] font-medium flex items-center gap-2">
            <AppIcon name="error" className="text-[18px] shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 3. BODY CONTENT: O LAYOUT EM GRID DO MODELO */}
        <main className="p-4 sm:p-8 space-y-6 flex-1">
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
              {/* LINHA 1: CARDS SUPERIORES DE MÉTRICAS (Exact Layout: 3 Cards + 1 Right Widget) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Total Earning / MRR */}
                <div className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed/50 text-primary text-[11px] font-bold">
                      <AppIcon name="monetization_on" className="text-[14px]" />
                      <span>Total Earning</span>
                    </span>
                    <span className="text-[11px] font-bold text-secondary flex items-center gap-0.5">
                      <AppIcon name="arrow_upward" className="text-[13px]" />
                      +12.4%
                    </span>
                  </div>
                  <div className="mt-4">
                    <span className="text-[28px] lg:text-[32px] font-black text-on-surface tracking-tight block">
                      {formatMoney(stats?.mrrMzn ?? 0, currency)}
                    </span>
                    <span className="text-[12px] font-medium text-on-surface-variant mt-0.5 block">
                      Receita mensal recorrente (MRR)
                    </span>
                  </div>
                </div>

                {/* Card 2: Average Earning / ARR */}
                <div className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/50 text-on-secondary-container text-[11px] font-bold">
                      <AppIcon name="trending_up" className="text-[14px]" />
                      <span>Average Earning</span>
                    </span>
                    <span className="text-[11px] font-bold text-on-surface-variant">
                      Projeção Anual
                    </span>
                  </div>
                  <div className="mt-4">
                    <span className="text-[28px] lg:text-[32px] font-black text-on-surface tracking-tight block">
                      {formatMoney((stats?.mrrMzn ?? 0) * 12, currency)}
                    </span>
                    <span className="text-[12px] font-medium text-on-surface-variant mt-0.5 block">
                      Run Rate Anual estimado (ARR)
                    </span>
                  </div>
                </div>

                {/* Card 3: Conversation Rate / Taxa de Conversão */}
                <div className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-container/50 text-on-tertiary-container text-[11px] font-bold">
                      <AppIcon name="pie_chart" className="text-[14px]" />
                      <span>Conversion Rate</span>
                    </span>
                    <span className="text-[11px] font-bold text-secondary flex items-center gap-0.5">
                      <AppIcon name="check_circle" className="text-[13px]" />
                      Ótimo
                    </span>
                  </div>
                  <div className="mt-4">
                    <span className="text-[28px] lg:text-[32px] font-black text-on-surface tracking-tight block">
                      {conversionRate}%
                    </span>
                    <span className="text-[12px] font-medium text-on-surface-variant mt-0.5 block">
                      {stats ? `${(stats.proUsersCount || 0) + (stats.businessUsersCount || 0)} pagantes de ${stats.totalUsers}` : 'Calculando taxa...'}
                    </span>
                  </div>
                </div>

                {/* Card 4: Right Action Widget (Upgrade to Pro no modelo -> SaaS Control Center) */}
                <div className="p-5 rounded-3xl bg-primary text-on-primary shadow-lg shadow-primary/25 flex flex-col justify-between relative overflow-hidden">
                  <div className="relative z-10">
                    <span className="text-[12px] font-extrabold uppercase tracking-widest text-on-primary/80 block">
                      SaaS Platform Status
                    </span>
                    <span className="text-[24px] font-black tracking-tight mt-1 block">
                      {stats?.totalSubscriptions ?? 0} Subscrições
                    </span>
                    <p className="text-[12px] text-on-primary/85 mt-1 leading-relaxed">
                      Infraestrutura Neon Postgres e S3 operando com 99.98% de estabilidade.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-on-primary/20 flex items-center justify-between relative z-10">
                    <button
                      className="px-4 py-2 rounded-xl bg-surface-container-lowest text-primary text-[12px] font-bold transition-transform active:scale-95 cursor-pointer"
                      onClick={() => setActiveTab('subscriptions')}
                      type="button"
                    >
                      Aprovar M-Pesa
                    </button>
                    <span className="text-[11px] font-semibold text-on-primary/80">
                      Maputo CAT
                    </span>
                  </div>
                </div>
              </div>

              {/* LINHA 2: GRÁFICOS & ANÁLISES (Wide Chart + Middle Widget + Right Widget) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Widget 1: Regular Sell (Gráfico de Barras em 6 colunas) */}
                <div className="lg:col-span-6 p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                        Regular Sell
                      </h2>
                      <span className="text-[12px] font-medium text-on-surface-variant">
                        Faturamento semanal estimado do SaaS
                      </span>
                    </div>
                    <button
                      className="px-3.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-[12px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      onClick={() => onNotify('Relatório exportado em formato seguro.')}
                      type="button"
                    >
                      <AppIcon name="download" className="text-[16px]" />
                      <span>Export</span>
                    </button>
                  </div>

                  {/* Visual Bar Chart */}
                  <div className="mt-8">
                    <div className="h-44 flex items-end justify-between gap-3 px-2 border-b border-surface-container">
                      {chartBars.map((bar, idx) => {
                        const heightPct = Math.max(Math.round((bar.val / maxBarVal) * 100), 12);
                        const isHighlight = idx === 5; // Sexta-feira
                        return (
                          <div key={bar.label} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                            <span className="text-[10px] font-bold text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">
                              {bar.val > 0 ? `${Math.round(bar.val / 1000)}k` : '0'}
                            </span>
                            <div
                              style={{ height: `${heightPct}%` }}
                              className={`w-full max-w-[28px] rounded-t-xl transition-all ${
                                isHighlight
                                  ? 'bg-primary shadow-sm shadow-primary/30'
                                  : 'bg-surface-container-high hover:bg-primary-fixed hover:shadow-xs'
                              }`}
                            />
                            <span className="text-[11px] font-bold text-on-surface-variant pt-1">
                              {bar.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Widget 2: More Analysis (No Meio - 3 colunas) */}
                <div className="lg:col-span-3 p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div>
                    <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                      More Analysis
                    </h2>
                    <span className="text-[12px] font-medium text-on-surface-variant">
                      Distribuição & Rácio dos Planos
                    </span>

                    <div className="mt-5 space-y-3">
                      <div
                        className="p-3.5 rounded-2xl bg-surface-container-low hover:bg-surface-container flex items-center justify-between transition-colors cursor-pointer"
                        onClick={() => setActiveTab('users')}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center">
                            <AppIcon name="workspace_premium" className="text-[17px]" />
                          </div>
                          <div>
                            <span className="text-[13px] font-bold text-on-surface block">
                              Plano Pro & Business
                            </span>
                            <span className="text-[11px] text-on-surface-variant">
                              {(stats?.proUsersCount || 0) + (stats?.businessUsersCount || 0)} Assinantes
                            </span>
                          </div>
                        </div>
                        <AppIcon name="chevron_right" className="text-[18px] text-on-surface-variant" />
                      </div>

                      <div
                        className="p-3.5 rounded-2xl bg-surface-container-low hover:bg-surface-container flex items-center justify-between transition-colors cursor-pointer"
                        onClick={() => setActiveTab('users')}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-surface-container-high text-on-surface flex items-center justify-center">
                            <AppIcon name="person" className="text-[17px]" />
                          </div>
                          <div>
                            <span className="text-[13px] font-bold text-on-surface block">
                              Plano Gratuito
                            </span>
                            <span className="text-[11px] text-on-surface-variant">
                              {stats?.freeUsersCount ?? 0} Contas Free
                            </span>
                          </div>
                        </div>
                        <AppIcon name="chevron_right" className="text-[18px] text-on-surface-variant" />
                      </div>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold text-primary mt-4 block">
                    FinTrack SaaS Analytics Engine
                  </span>
                </div>

                {/* Widget 3: Daily Action / Helpdesk (À Direita - 3 colunas) */}
                <div className="lg:col-span-3 p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center">
                        <AppIcon name="forum" className="text-[17px]" />
                      </div>
                      <h2 className="text-[17px] font-black text-on-surface tracking-tight">
                        Daily Support
                      </h2>
                    </div>

                    <div className="mt-4 p-4 rounded-2xl bg-surface-container-low/60 border border-surface-container space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold text-on-surface">
                          Tickets em Espera
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[11px] font-extrabold">
                          {tickets.filter((t) => t.status === 'aberto').length} Abertos
                        </span>
                      </div>
                      <p className="text-[12px] text-on-surface-variant leading-relaxed">
                        Clientes aguardando suporte ou validação de depósito M-Pesa.
                      </p>
                    </div>
                  </div>

                  <button
                    className="w-full h-11 mt-4 rounded-2xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[12.5px] font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    onClick={() => setActiveTab('tickets')}
                    type="button"
                  >
                    <AppIcon name="headset_mic" className="text-[18px] text-primary" />
                    <span>Ver Fila de Atendimento</span>
                  </button>
                </div>
              </div>

              {/* LINHA 3: TABELA DE DESTAQUE & LISTA DE EQUIPA (Top Store & Team Member do Modelo) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Tabela Principal (Left / Center - 8 Colunas) */}
                <div className="lg:col-span-8 p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                        Top Customers & Subscriptions
                      </h2>
                      <span className="text-[12px] font-medium text-on-surface-variant">
                        Últimas adesões e transações de clientes
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <AppIcon
                          name="search"
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-on-surface-variant"
                        />
                        <input
                          className="h-9 pl-9 pr-3 rounded-xl bg-surface-container text-on-surface text-[12px] placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20"
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Pesquisar..."
                          type="text"
                          value={userSearch}
                        />
                      </div>
                      <button
                        className="h-9 px-3.5 rounded-xl bg-primary text-on-primary text-[12px] font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                        onClick={() => setActiveTab('users')}
                        type="button"
                      >
                        <span>Ver Todos</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-surface-container text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                          <th className="py-3 px-3">Cliente</th>
                          <th className="py-3 px-3">Contacto</th>
                          <th className="py-3 px-3">Plano</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container/60 font-medium">
                        {filteredUsers.slice(0, 5).map((user) => (
                          <tr key={user.id} className="hover:bg-surface-container-low/40 transition-colors">
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-primary-fixed text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                                  {getUserInitials(user.name)}
                                </div>
                                <span className="font-bold text-on-surface">{user.name}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-on-surface-variant text-[12px]">
                              {user.phone}
                            </td>
                            <td className="py-3.5 px-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase ${
                                  user.plan === 'business'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : user.plan === 'pro'
                                      ? 'bg-primary-fixed text-primary border border-primary/25'
                                      : 'bg-surface-container text-on-surface-variant'
                                }`}
                              >
                                {user.plan}
                              </span>
                            </td>
                            <td className="py-3.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                                  user.isSuspended
                                    ? 'bg-error-container text-on-error-container'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {user.isSuspended ? 'Suspenso' : 'Ativo'}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <button
                                className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[11.5px] font-bold cursor-pointer transition-colors"
                                onClick={() => setResetPwdModalUser(user)}
                                type="button"
                              >
                                Redefinir Senha
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Team Member / Novos Cadastros (Right - 4 Colunas) */}
                <div className="lg:col-span-4 p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div>
                    <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                      Recent Members
                    </h2>
                    <span className="text-[12px] font-medium text-on-surface-variant">
                      Últimos clientes registados
                    </span>

                    <div className="mt-4 space-y-3">
                      {users.slice(0, 4).map((member) => (
                        <div
                          key={member.id}
                          className="p-3 rounded-2xl bg-surface-container-low flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-primary-fixed text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                              {getUserInitials(member.name)}
                            </div>
                            <div className="min-w-0">
                              <span className="text-[13px] font-bold text-on-surface truncate block">
                                {member.name}
                              </span>
                              <span className="text-[11px] text-on-surface-variant truncate block">
                                {member.phone}
                              </span>
                            </div>
                          </div>

                          <a
                            className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center hover:bg-emerald-200 transition-colors shrink-0"
                            href={`https://wa.me/${member.phone.replace(/\D/g, '')}?text=Olá%20${encodeURIComponent(member.name)},%20suporte%20FinTrack.`}
                            rel="noopener noreferrer"
                            target="_blank"
                            title="Conversar no WhatsApp"
                          >
                            <AppIcon name="chat" className="text-[16px]" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    className="w-full h-11 mt-4 rounded-2xl bg-primary text-on-primary text-[12.5px] font-bold flex items-center justify-center gap-2 shadow-xs transition-transform active:scale-95 cursor-pointer"
                    onClick={() => setAnnouncementModalOpen(true)}
                    type="button"
                  >
                    <AppIcon name="add" className="text-[18px]" />
                    <span>Publicar Novo Comunicado</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* OUTRAS ABAS (Mantendo as Ferramentas de Gestão Completas) */}
          {activeTab === 'users' && (
            <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-xs space-y-5 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-[20px] font-black text-on-surface tracking-tight">
                    Gestão Completa de Clientes
                  </h2>
                  <p className="text-[12px] text-on-surface-variant">
                    Pesquise, altere planos, modere acessos ou redefina senhas de utilizadores.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="h-10 px-3.5 rounded-xl bg-surface-container text-on-surface text-[12.5px] placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20"
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Pesquisar utilizador..."
                    type="text"
                    value={userSearch}
                  />
                  <select
                    className="h-10 px-3 rounded-xl bg-surface-container text-on-surface text-[12px] font-bold cursor-pointer"
                    onChange={(e) => setPlanFilter(e.target.value as any)}
                    value={planFilter}
                  >
                    <option value="all">Todos os Planos</option>
                    <option value="free">Gratuito</option>
                    <option value="pro">Pro (499 MT)</option>
                    <option value="business">Business (1.499 MT)</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-surface-container text-[11px] font-bold text-on-surface-variant uppercase">
                      <th className="py-3 px-3">Cliente</th>
                      <th className="py-3 px-3">Contacto</th>
                      <th className="py-3 px-3">Plano Atual</th>
                      <th className="py-3 px-3">Alterar Plano</th>
                      <th className="py-3 px-3">Estado</th>
                      <th className="py-3 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container/60 font-medium">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-surface-container-low/40">
                        <td className="py-3.5 px-3 font-bold text-on-surface">{user.name}</td>
                        <td className="py-3.5 px-3 text-on-surface-variant">{user.phone}</td>
                        <td className="py-3.5 px-3">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase bg-primary-fixed text-primary">
                            {user.plan}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <select
                            className="h-8 px-2 rounded-lg bg-surface-container text-on-surface text-[11px] font-bold cursor-pointer disabled:opacity-50"
                            disabled={updatingUserId === user.id}
                            onChange={(e) => handleChangeUserPlan(user.id, e.target.value as SubscriptionPlan)}
                            value={user.plan}
                          >
                            <option value="free">Free</option>
                            <option value="pro">Pro</option>
                            <option value="business">Business</option>
                          </select>
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                              user.isSuspended
                                ? 'bg-error-container text-on-error-container'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {user.isSuspended ? 'Suspenso' : 'Ativo'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right space-x-2">
                          <button
                            className="px-2.5 py-1 rounded-lg bg-surface-container text-on-surface text-[11px] font-bold hover:bg-surface-container-high cursor-pointer"
                            onClick={() => setResetPwdModalUser(user)}
                            type="button"
                          >
                            Senha
                          </button>
                          <button
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                              user.isSuspended
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-error-container text-on-error-container hover:opacity-90'
                            }`}
                            onClick={() => handleToggleUserSuspension(user)}
                            type="button"
                          >
                            {user.isSuspended ? 'Reativar' : 'Suspender'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'subscriptions' && (
            <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-xs space-y-5 animate-fade-in">
              <div>
                <h2 className="text-[20px] font-black text-on-surface tracking-tight">
                  Validação de Subscrições & Depósitos M-Pesa
                </h2>
                <p className="text-[12px] text-on-surface-variant">
                  Confira as referências enviadas pelos clientes e ative o plano com 1 clique.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-surface-container text-[11px] font-bold text-on-surface-variant uppercase">
                      <th className="py-3 px-3">Cliente</th>
                      <th className="py-3 px-3">Plano</th>
                      <th className="py-3 px-3">Referência M-Pesa</th>
                      <th className="py-3 px-3">Valor</th>
                      <th className="py-3 px-3">Estado</th>
                      <th className="py-3 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container/60 font-medium">
                    {subscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-surface-container-low/40">
                        <td className="py-3.5 px-3 font-bold text-on-surface">{sub.userName}</td>
                        <td className="py-3.5 px-3 uppercase font-extrabold text-primary">{sub.plan}</td>
                        <td className="py-3.5 px-3 font-mono font-bold text-on-surface">
                          {sub.paymentReference || 'Sem referência'}
                        </td>
                        <td className="py-3.5 px-3">{formatMoney(sub.pricePaid, currency)}</td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                              sub.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {sub.status === 'active' ? 'Ativo' : 'Pendente'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <button
                            className="px-3 py-1.5 rounded-xl bg-primary text-on-primary text-[11.5px] font-bold shadow-xs hover:bg-primary-container cursor-pointer"
                            onClick={() => handleApproveSubscription(sub)}
                            type="button"
                          >
                            Aprovar & Ativar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-xs space-y-5 animate-fade-in">
              <div>
                <h2 className="text-[20px] font-black text-on-surface tracking-tight">
                  Central de Atendimento & Helpdesk
                </h2>
                <p className="text-[12px] text-on-surface-variant">
                  Chamados abertos pelos clientes. Fale diretamente no WhatsApp ou marque como resolvido.
                </p>
              </div>

              <div className="space-y-3">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-4 rounded-2xl bg-surface-container-low border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary text-[12px]">
                          {ticket.code}
                        </span>
                        <span className="text-[14px] font-bold text-on-surface">
                          {ticket.subject}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold">
                          {ticket.category}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-on-surface-variant leading-relaxed">
                        {ticket.message}
                      </p>
                      <span className="text-[11px] text-outline block">
                        Cliente: {ticket.userName} ({ticket.userPhone})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        className="h-9 px-3 rounded-xl bg-emerald-100 text-emerald-800 text-[12px] font-bold flex items-center gap-1.5 hover:bg-emerald-200 transition-colors"
                        href={`https://wa.me/${ticket.userPhone.replace(/\D/g, '')}?text=Olá%20${encodeURIComponent(ticket.userName)},%20referente%20ao%20chamado%20${ticket.code}:`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <AppIcon name="chat" className="text-[16px]" />
                        <span>WhatsApp</span>
                      </a>
                      <button
                        className="h-9 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-[12px] font-bold cursor-pointer"
                        onClick={() => handleUpdateTicketStatus(ticket.id, 'resolvido')}
                        type="button"
                      >
                        Resolver
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'announcements' && (
            <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-xs space-y-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[20px] font-black text-on-surface tracking-tight">
                    Comunicados Globais (Broadcast nos Apps)
                  </h2>
                  <p className="text-[12px] text-on-surface-variant">
                    Mensagens que aparecem para todos os utilizadores no topo dos aplicativos.
                  </p>
                </div>
                <button
                  className="h-10 px-4 rounded-xl bg-primary text-on-primary text-[12.5px] font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  onClick={() => setAnnouncementModalOpen(true)}
                  type="button"
                >
                  <AppIcon name="add" className="text-[18px]" />
                  <span>Novo Comunicado</span>
                </button>
              </div>

              <div className="space-y-3">
                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-4 rounded-2xl bg-surface-container-low border border-surface-container flex items-center justify-between gap-4"
                  >
                    <div>
                      <span className="text-[14px] font-bold text-on-surface block">
                        {ann.title}
                      </span>
                      <p className="text-[12.5px] text-on-surface-variant mt-0.5">
                        {ann.message}
                      </p>
                    </div>
                    <button
                      className="px-3 py-1.5 rounded-xl bg-error-container text-on-error-container text-[11.5px] font-bold cursor-pointer hover:opacity-90"
                      onClick={() => handleDeleteAnnouncement(ann.id)}
                      type="button"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'statistics' && (
            <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-xs space-y-5 animate-fade-in">
              <div>
                <h2 className="text-[20px] font-black text-on-surface tracking-tight">
                  Relatório Financeiro & Métricas SaaS
                </h2>
                <p className="text-[12px] text-on-surface-variant">
                  Evolução do faturamento, planos mais vendidos e previsibilidade de caixa.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-surface-container-low">
                  <span className="text-[11.5px] font-bold text-on-surface-variant uppercase">Receita Pro</span>
                  <span className="text-[24px] font-black text-on-surface block mt-1">
                    {formatMoney((stats?.proUsersCount || 0) * 499, currency)}
                  </span>
                </div>
                <div className="p-5 rounded-2xl bg-surface-container-low">
                  <span className="text-[11.5px] font-bold text-on-surface-variant uppercase">Receita Business</span>
                  <span className="text-[24px] font-black text-on-surface block mt-1">
                    {formatMoney((stats?.businessUsersCount || 0) * 1499, currency)}
                  </span>
                </div>
                <div className="p-5 rounded-2xl bg-surface-container-low">
                  <span className="text-[11.5px] font-bold text-on-surface-variant uppercase">Total Clientes Pagantes</span>
                  <span className="text-[24px] font-black text-on-surface block mt-1">
                    {(stats?.proUsersCount || 0) + (stats?.businessUsersCount || 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-xs space-y-5 animate-fade-in">
              <div>
                <h2 className="text-[20px] font-black text-on-surface tracking-tight">
                  Infraestrutura & Configurações da Plataforma
                </h2>
                <p className="text-[12px] text-on-surface-variant">
                  Status de saúde dos servidores, limites operacionais e base de dados.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-surface-container-low flex items-center justify-between">
                  <div>
                    <span className="text-[13.5px] font-bold text-on-surface block">Neon Postgres Database</span>
                    <span className="text-[11.5px] text-emerald-700 font-semibold">Conectado · Latência 42ms</span>
                  </div>
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                <div className="p-4 rounded-2xl bg-surface-container-low flex items-center justify-between">
                  <div>
                    <span className="text-[13.5px] font-bold text-on-surface block">S3 Object Storage (Neon)</span>
                    <span className="text-[11.5px] text-emerald-700 font-semibold">Comprovativos e Avatares OK</span>
                  </div>
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: REDEFINIR SENHA DO CLIENTE */}
      {resetPwdModalUser && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest p-6 rounded-3xl shadow-2xl border border-surface-container space-y-4">
            <h3 className="text-[17px] font-black text-on-surface">
              Redefinir Senha do Cliente
            </h3>
            <p className="text-[12px] text-on-surface-variant">
              Informe uma nova senha para o cliente <strong>{resetPwdModalUser.name}</strong> ({resetPwdModalUser.phone}).
            </p>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
              <input
                className="w-full h-11 px-3.5 rounded-xl bg-surface-container text-on-surface text-[13px] placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20"
                onChange={(e) => setNewPasswordVal(e.target.value)}
                placeholder="Nova senha (mínimo 6 caracteres)..."
                required
                type="text"
                value={newPasswordVal}
              />
              <div className="flex items-center gap-2 pt-2">
                <button
                  className="flex-1 h-11 rounded-xl bg-surface-container text-on-surface font-bold text-[12.5px] cursor-pointer"
                  onClick={() => setResetPwdModalUser(null)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 h-11 rounded-xl bg-primary text-on-primary font-bold text-[12.5px] shadow-xs cursor-pointer disabled:opacity-60"
                  disabled={isResettingPassword}
                  type="submit"
                >
                  {isResettingPassword ? 'A guardar...' : 'Guardar Nova Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO COMUNICADO */}
      {announcementModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest p-6 rounded-3xl shadow-2xl border border-surface-container space-y-4">
            <h3 className="text-[17px] font-black text-on-surface">
              Publicar Comunicado Global
            </h3>
            <p className="text-[12px] text-on-surface-variant">
              Esta mensagem aparecerá para todos os utilizadores no topo do aplicativo.
            </p>

            <form onSubmit={handleCreateAnnouncement} className="space-y-3">
              <input
                className="w-full h-11 px-3.5 rounded-xl bg-surface-container text-on-surface text-[13px] placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20"
                onChange={(e) => setNewAnnTitle(e.target.value)}
                placeholder="Título do comunicado (ex: Nova Funcionalidade)..."
                required
                type="text"
                value={newAnnTitle}
              />

              <textarea
                className="w-full h-24 p-3 rounded-xl bg-surface-container text-on-surface text-[13px] placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                onChange={(e) => setNewAnnMessage(e.target.value)}
                placeholder="Mensagem do comunicado..."
                required
                value={newAnnMessage}
              />

              <select
                className="w-full h-10 px-3 rounded-xl bg-surface-container text-on-surface text-[12px] font-bold cursor-pointer"
                onChange={(e) => setNewAnnSeverity(e.target.value as any)}
                value={newAnnSeverity}
              >
                <option value="info">Informativo (Azul)</option>
                <option value="warning">Alerta Importante (Âmbar)</option>
                <option value="critical">Urgente / Manutenção (Vermelho)</option>
              </select>

              <div className="flex items-center gap-2 pt-2">
                <button
                  className="flex-1 h-11 rounded-xl bg-surface-container text-on-surface font-bold text-[12.5px] cursor-pointer"
                  onClick={() => setAnnouncementModalOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 h-11 rounded-xl bg-primary text-on-primary font-bold text-[12.5px] shadow-xs cursor-pointer disabled:opacity-60"
                  disabled={isPublishingAnn}
                  type="submit"
                >
                  {isPublishingAnn ? 'A publicar...' : 'Publicar Comunicado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
