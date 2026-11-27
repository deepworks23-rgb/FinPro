import { AppIcon } from './AppIcon';
import { useEffect, useState, type FormEvent } from 'react';
import type {
  AdminAnnouncement,
  AdminOverviewStats,
  AdminSubscriptionItem,
  AdminUserItem,
  CurrencyCode,
  SubscriptionPlan,
  SupportTicket,
} from '../types/finance';
import { adminApi } from '../services/api';
import { formatMoney } from '../utils/finance';

interface AdminScreenProps {
  authToken: string;
  currency: CurrencyCode;
  onNotify: (msg: string) => void;
  onNavigateToApp?: () => void;
  onNavigateToLanding?: () => void;
  onLogout?: () => Promise<void>;
}

type AdminTab = 'overview' | 'users' | 'subscriptions' | 'tickets' | 'announcements' | 'infrastructure';

export function AdminScreen({
  authToken,
  currency,
  onNotify,
  onNavigateToApp,
  onNavigateToLanding,
  onLogout,
}: AdminScreenProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
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
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [subSearch, setSubSearch] = useState('');

  // Modals & Action States
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [passwordModalUser, setPasswordModalUser] = useState<AdminUserItem | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Announcement Form
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annSeverity, setAnnSeverity] = useState<'info' | 'warning' | 'critical'>('info');
  const [isPublishingAnn, setIsPublishingAnn] = useState(false);

  // Load all SaaS management data
  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [overviewRes, usersRes, subsRes, ticketsRes, annRes] = await Promise.all([
        adminApi.getOverview(authToken).catch(() => ({ stats: null })),
        adminApi.getUsers(authToken).catch(() => ({ users: [] })),
        adminApi.getSubscriptions(authToken).catch(() => ({ subscriptions: [] })),
        adminApi.getTickets(authToken).catch(() => ({ tickets: [] })),
        adminApi.getAnnouncements(authToken).catch(() => ({ announcements: [] })),
      ]);
      setStats(overviewRes.stats);
      setUsers(usersRes.users);
      setSubscriptions(subsRes.subscriptions);
      setTickets(ticketsRes.tickets);
      setAnnouncements(annRes.announcements);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao carregar dados do painel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [authToken]);

  // Actions: Plan Change
  const handleChangeUserPlan = async (targetId: string, nextPlan: SubscriptionPlan) => {
    setUpdatingUserId(targetId);
    try {
      const res = await adminApi.updateUserPlan(authToken, targetId, nextPlan);
      onNotify(res.message);
      setUsers((prev) =>
        prev.map((u) => (u.id === targetId ? { ...u, plan: nextPlan, status: 'active' } : u))
      );
      void adminApi.getOverview(authToken).then((r) => setStats(r.stats)).catch(() => {});
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao atualizar plano.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Actions: Suspend / Reactivate User
  const handleToggleUserSuspension = async (user: AdminUserItem) => {
    const nextState = !user.isSuspended;
    setUpdatingUserId(user.id);
    try {
      const res = await adminApi.toggleUserSuspension(authToken, user.id, nextState);
      onNotify(res.message);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isSuspended: nextState } : u))
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao alterar estado da conta.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Actions: Reset User Password
  const handleResetPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser || newPasswordInput.length < 6) return;
    setIsResettingPassword(true);
    try {
      const res = await adminApi.resetUserPassword(authToken, passwordModalUser.id, newPasswordInput);
      onNotify(res.message);
      setPasswordModalUser(null);
      setNewPasswordInput('');
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
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: 'aberto' as const } : t))
      );
      void loadData();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao atualizar bilhete.');
    }
  };

  // Actions: Global Announcements
  const handlePublishAnnouncement = async (e: FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annMessage.trim()) return;
    setIsPublishingAnn(true);
    try {
      const res = await adminApi.createAnnouncement(authToken, {
        title: annTitle.trim(),
        message: annMessage.trim(),
        severity: annSeverity,
      });
      onNotify(res.message);
      setAnnTitle('');
      setAnnMessage('');
      setShowAnnouncementModal(false);
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

  // Filtered lists
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.phone.includes(userSearch) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesPlan = planFilter === 'all' || u.plan === planFilter;
    const matchesStatus =
      userStatusFilter === 'all' ||
      (userStatusFilter === 'suspended' ? u.isSuspended : !u.isSuspended);
    return matchesSearch && matchesPlan && matchesStatus;
  });

  const filteredSubscriptions = subscriptions.filter((s) => {
    const q = subSearch.toLowerCase();
    return (
      s.userName.toLowerCase().includes(q) ||
      s.userPhone.includes(q) ||
      s.paymentReference.toLowerCase().includes(q) ||
      s.plan.toLowerCase().includes(q)
    );
  });

  const mrrFormatted = formatMoney(stats?.mrrMzn ?? 0, 'MZN');
  const arrFormatted = formatMoney((stats?.mrrMzn ?? 0) * 12, 'MZN');
  const paidUsersCount = (stats?.proUsersCount ?? 0) + (stats?.businessUsersCount ?? 0);
  const totalUsersCount = stats?.totalUsers || users.length || 1;
  const conversionRate = totalUsersCount > 0 ? ((paidUsersCount / totalUsersCount) * 100).toFixed(1) : '0.0';

  return (
    <div className="flex flex-col w-full space-y-5 pb-12 animate-fade-in text-on-surface">
      {/* 1. Header Principal do Backoffice SaaS */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-3xl shadow-sm border border-primary/20">
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-lg shadow-primary/25 shrink-0">
            <AppIcon name="admin_panel_settings" className="text-[28px]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] sm:text-[22px] font-black tracking-tight text-on-surface">
                FinTrack SaaS · Torre de Controle
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary text-[10.5px] font-black uppercase tracking-wider">
                Admin Master
              </span>
            </div>
            <p className="text-[12.5px] text-on-surface-variant mt-0.5">
              Gestão executiva de receitas recorrentes (MRR), base de clientes, validação de pagamentos e suporte.
            </p>
          </div>
        </div>

        {/* Barra de Ações Rápidas */}
        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToApp && (
            <button
              className="h-10 px-4 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
              onClick={onNavigateToApp}
              type="button"
            >
              <AppIcon name="dashboard" className="text-[18px]" />
              <span>Ver App do Cliente</span>
            </button>
          )}

          {onNavigateToLanding && (
            <button
              className="h-10 px-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              onClick={onNavigateToLanding}
              type="button"
            >
              <AppIcon name="public" className="text-[17px] text-primary" />
              <span>Site Público</span>
            </button>
          )}

          <button
            className="h-10 px-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            onClick={loadData}
            type="button"
          >
            <AppIcon name="refresh" className={`text-[17px] ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Recarregar</span>
          </button>

          {onLogout && (
            <button
              className="h-10 px-3.5 rounded-xl bg-error-container/70 hover:bg-error-container text-tertiary text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              onClick={() => void onLogout()}
              type="button"
            >
              <AppIcon name="logout" className="text-[17px]" />
              <span>Sair</span>
            </button>
          )}
        </div>
      </header>

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-error-container text-on-error-container text-[13px] font-medium flex items-center gap-2.5">
          <AppIcon name="error" className="text-[19px] shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. Menu de Navegação em Abas (Módulos do SaaS) */}
      <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar bg-surface-container-lowest p-1.5 rounded-2xl border border-surface-container/70">
        {[
          { id: 'overview', label: '1. Visão Geral & MRR', icon: 'trending_up' },
          { id: 'users', label: `2. Clientes (${users.length})`, icon: 'group' },
          { id: 'subscriptions', label: `3. Subscrições M-Pesa (${subscriptions.length})`, icon: 'payments' },
          { id: 'tickets', label: `4. Helpdesk (${tickets.length})`, icon: 'support_agent' },
          { id: 'announcements', label: `5. Comunicados (${announcements.length})`, icon: 'campaign' },
          { id: 'infrastructure', label: '6. Infraestrutura', icon: 'dns' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`h-10 px-4 rounded-xl flex items-center gap-2 text-[12.5px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              type="button"
            >
              <AppIcon name={tab.icon} className="text-[17px]" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ========================================================================= */}
      {/* ABA 1: VISÃO GERAL & RECEITA DO SAAS (MRR, ARR, CONVERSÃO)                */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-5 animate-fade-in">
          {/* Cartões Executivos de Desempenho Financeiro */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {/* Card 1: MRR */}
            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-on-surface-variant uppercase tracking-wider">
                  MRR (Mensal)
                </span>
                <span className="w-8 h-8 rounded-lg bg-primary-fixed/60 text-primary flex items-center justify-center">
                  <AppIcon name="account_balance" className="text-[18px]" />
                </span>
              </div>
              <div className="mt-2">
                <span className="text-[22px] sm:text-[26px] font-black tracking-tight text-primary">
                  {mrrFormatted}
                </span>
                <p className="text-[11.5px] text-secondary font-semibold mt-0.5">
                  Receita recorrente ativa
                </p>
              </div>
            </div>

            {/* Card 2: ARR Projetado */}
            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-on-surface-variant uppercase tracking-wider">
                  ARR (Anual)
                </span>
                <span className="w-8 h-8 rounded-lg bg-secondary-fixed/60 text-secondary flex items-center justify-center">
                  <AppIcon name="query_stats" className="text-[18px]" />
                </span>
              </div>
              <div className="mt-2">
                <span className="text-[22px] sm:text-[26px] font-black tracking-tight text-on-surface">
                  {arrFormatted}
                </span>
                <p className="text-[11.5px] text-on-surface-variant font-medium mt-0.5">
                  Projeção anual (MRR × 12)
                </p>
              </div>
            </div>

            {/* Card 3: Clientes Pagantes & Conversão */}
            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Assinantes Pagos
                </span>
                <span className="w-8 h-8 rounded-lg bg-tertiary-fixed/60 text-tertiary flex items-center justify-center">
                  <AppIcon name="workspace_premium" className="text-[18px]" />
                </span>
              </div>
              <div className="mt-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-[22px] sm:text-[26px] font-black tracking-tight text-on-surface">
                    {paidUsersCount}
                  </span>
                  <span className="text-[12px] font-bold text-secondary">
                    ({conversionRate}% conv.)
                  </span>
                </div>
                <p className="text-[11.5px] text-on-surface-variant font-medium mt-0.5">
                  {stats?.proUsersCount ?? 0} Pro · {stats?.businessUsersCount ?? 0} Business
                </p>
              </div>
            </div>

            {/* Card 4: Base Total de Utilizadores */}
            <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-on-surface-variant uppercase tracking-wider">
                  Base Total de Clientes
                </span>
                <span className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface flex items-center justify-center">
                  <AppIcon name="group" className="text-[18px]" />
                </span>
              </div>
              <div className="mt-2">
                <span className="text-[22px] sm:text-[26px] font-black tracking-tight text-on-surface">
                  {totalUsersCount}
                </span>
                <p className="text-[11.5px] text-on-surface-variant font-medium mt-0.5">
                  {stats?.freeUsersCount ?? 0} no plano gratuito
                </p>
              </div>
            </div>
          </div>

          {/* Gráfico / Distribuição dos Planos SaaS */}
          <div className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container shadow-xs space-y-4">
            <h3 className="text-[15px] font-bold text-on-surface">
              Distribuição da Base de Assinantes
            </h3>
            <div className="w-full h-4 rounded-full bg-surface-container overflow-hidden flex">
              <div
                style={{ width: `${Math.max(10, ((stats?.freeUsersCount ?? 0) / totalUsersCount) * 100)}%` }}
                className="bg-surface-container-highest h-full"
                title="Gratuito"
              />
              <div
                style={{ width: `${Math.max(5, ((stats?.proUsersCount ?? 0) / totalUsersCount) * 100)}%` }}
                className="bg-primary h-full"
                title="Pro"
              />
              <div
                style={{ width: `${Math.max(5, ((stats?.businessUsersCount ?? 0) / totalUsersCount) * 100)}%` }}
                className="bg-secondary h-full"
                title="Business"
              />
            </div>

            <div className="flex flex-wrap items-center gap-6 text-[12.5px] pt-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-surface-container-highest" />
                <span className="text-on-surface-variant">Gratuito: <strong>{stats?.freeUsersCount ?? 0}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-on-surface-variant">PRO (499 MT): <strong>{stats?.proUsersCount ?? 0}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-secondary" />
                <span className="text-on-surface-variant">Negócios (1.499 MT): <strong>{stats?.businessUsersCount ?? 0}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: GESTÃO DE CLIENTES & UTILIZADORES                                  */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-fade-in">
          {/* Barra de Filtros e Busca de Clientes */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-container-lowest p-3.5 rounded-2xl border border-surface-container">
            <div className="relative flex-1">
              <AppIcon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]"
              />
              <input
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-container-low text-on-surface text-[13px] placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30"
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Buscar cliente por nome, telefone (+258...) ou e-mail..."
                type="text"
                value={userSearch}
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-[12.5px] font-semibold cursor-pointer focus:outline-none"
                onChange={(e) => setPlanFilter(e.target.value as 'all' | SubscriptionPlan)}
                value={planFilter}
              >
                <option value="all">Todos os Planos</option>
                <option value="free">Gratuito</option>
                <option value="pro">Pro (499 MT)</option>
                <option value="business">Negócios (1.499 MT)</option>
              </select>

              <select
                className="h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-[12.5px] font-semibold cursor-pointer focus:outline-none"
                onChange={(e) => setUserStatusFilter(e.target.value as 'all' | 'active' | 'suspended')}
                value={userStatusFilter}
              >
                <option value="all">Todos os Estados</option>
                <option value="active">Apenas Ativos</option>
                <option value="suspended">Suspensos</option>
              </select>
            </div>
          </div>

          {/* Tabela de Clientes */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-surface-container-low/70 text-on-surface-variant font-bold border-b border-surface-container">
                  <tr>
                    <th className="py-3 px-4">Cliente / Nome</th>
                    <th className="py-3 px-4">Contacto (Telefone & E-mail)</th>
                    <th className="py-3 px-4">Plano Atual</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Registo</th>
                    <th className="py-3 px-4 text-right">Ações de Gestão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-on-surface-variant text-[13px]">
                        Nenhum cliente encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isUpdating = updatingUserId === u.id;
                      return (
                        <tr key={u.id} className="hover:bg-surface-container-low/40 transition-colors">
                          <td className="py-3 px-4 font-semibold text-on-surface">
                            <div className="flex items-center gap-2">
                              <span>{u.name}</span>
                              {u.isAdmin && (
                                <span className="px-1.5 py-0.5 rounded bg-primary text-on-primary text-[9.5px] font-bold">
                                  ADMIN
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-on-surface-variant">
                            <a href={`tel:${u.phone}`} className="hover:text-primary font-medium block">
                              {u.phone}
                            </a>
                            {u.email && <span className="text-[11px] block">{u.email}</span>}
                          </td>
                          <td className="py-3 px-4">
                            <select
                              className="h-8 px-2 rounded-lg bg-surface-container font-bold text-[11.5px] cursor-pointer focus:outline-none"
                              disabled={isUpdating}
                              onChange={(e) => handleChangeUserPlan(u.id, e.target.value as SubscriptionPlan)}
                              value={u.plan}
                            >
                              <option value="free">Free (0 MT)</option>
                              <option value="pro">PRO (499 MT)</option>
                              <option value="business">Business (1.499 MT)</option>
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            {u.isSuspended ? (
                              <span className="px-2 py-0.5 rounded-md bg-error-container text-on-error-container text-[11px] font-bold">
                                Suspenso
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-secondary-fixed text-secondary text-[11px] font-bold">
                                Ativo
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-on-surface-variant text-[11.5px]">
                            {new Date(u.createdAt).toLocaleDateString('pt-MZ')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Botão Suspender/Reativar */}
                              <button
                                className={`h-8 px-2.5 rounded-lg text-[11.5px] font-semibold transition-colors cursor-pointer ${
                                  u.isSuspended
                                    ? 'bg-secondary text-on-secondary hover:opacity-90'
                                    : 'bg-error-container/60 hover:bg-error-container text-on-error-container'
                                }`}
                                disabled={isUpdating}
                                onClick={() => handleToggleUserSuspension(u)}
                                title={u.isSuspended ? 'Reativar conta' : 'Suspender conta'}
                                type="button"
                              >
                                {u.isSuspended ? 'Reativar' : 'Suspender'}
                              </button>

                              {/* Botão Redefinir Senha */}
                              <button
                                className="h-8 px-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[11.5px] font-semibold transition-colors cursor-pointer"
                                onClick={() => {
                                  setPasswordModalUser(u);
                                  setNewPasswordInput('');
                                }}
                                title="Redefinir senha do cliente"
                                type="button"
                              >
                                Nova Senha
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: SUBSCRIÇÕES & VALIDAÇÃO DE PAGAMENTOS M-PESA                       */}
      {/* ========================================================================= */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4 animate-fade-in">
          {/* Header & Busca */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-container-lowest p-3.5 rounded-2xl border border-surface-container">
            <div>
              <h3 className="text-[15px] font-bold text-on-surface">
                Fila de Validação de Pagamentos M-Pesa / e-Mola
              </h3>
              <p className="text-[12px] text-on-surface-variant">
                Confira os códigos de referência enviados pelos clientes para aprovar e ativar planos.
              </p>
            </div>
            <div className="relative">
              <input
                className="h-9 px-3 rounded-xl bg-surface-container-low text-[12.5px] text-on-surface placeholder:text-outline focus:outline-none"
                onChange={(e) => setSubSearch(e.target.value)}
                placeholder="Buscar por código ou nome..."
                type="text"
                value={subSearch}
              />
            </div>
          </div>

          {/* Lista de Subscrições & Pedidos */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-surface-container-low/70 text-on-surface-variant font-bold border-b border-surface-container">
                  <tr>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Plano Solicitado</th>
                    <th className="py-3 px-4">Método & Ref. Pagamento</th>
                    <th className="py-3 px-4">Telemóvel Pagador</th>
                    <th className="py-3 px-4">Expiração</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container/60">
                  {filteredSubscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-on-surface-variant text-[13px]">
                        Nenhuma subscrição registada até ao momento.
                      </td>
                    </tr>
                  ) : (
                    filteredSubscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-surface-container-low/40 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-on-surface block">{sub.userName}</span>
                          <span className="text-[11px] text-on-surface-variant">{sub.userPhone}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-primary uppercase">{sub.plan}</span>
                          <span className="text-[11px] text-on-surface-variant block">
                            {sub.billingCycle === 'yearly' ? 'Anual' : 'Mensal'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-surface-container font-mono text-[11.5px] font-bold text-on-surface">
                            {sub.paymentReference || 'Sem referência'}
                          </span>
                          <span className="text-[11px] text-on-surface-variant block mt-0.5">
                            {sub.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-on-surface font-medium">
                          {sub.paymentPhone || sub.userPhone}
                        </td>
                        <td className="py-3 px-4 text-[11.5px] text-on-surface-variant">
                          {sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString('pt-MZ') : 'Contínuo'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            className="h-8 px-3 rounded-xl bg-secondary hover:opacity-90 text-on-secondary text-[11.5px] font-bold transition-all shadow-xs cursor-pointer"
                            onClick={() => handleApproveSubscription(sub)}
                            type="button"
                          >
                            Aprovar & Ativar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: HELPDESK & CENTRAL DE ATENDIMENTO AO CLIENTE                       */}
      {/* ========================================================================= */}
      {activeTab === 'tickets' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between bg-surface-container-lowest p-3.5 rounded-2xl border border-surface-container">
            <div>
              <h3 className="text-[15px] font-bold text-on-surface">
                Chamados de Suporte dos Clientes ({tickets.length})
              </h3>
              <p className="text-[12px] text-on-surface-variant">
                Atendimento direto com botão rápido para WhatsApp e chamada telefónica.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {tickets.length === 0 ? (
              <div className="col-span-full p-8 text-center text-on-surface-variant text-[13px] bg-surface-container-lowest rounded-2xl border border-surface-container">
                Nenhum bilhete de suporte aberto pelos clientes.
              </div>
            ) : (
              tickets.map((t) => {
                const cleanPhone = t.userPhone.replace(/\D/g, '');
                const waUrl = `https://wa.me/${cleanPhone.startsWith('258') ? cleanPhone : '258' + cleanPhone}?text=Ol%C3%A1%20${encodeURIComponent(t.userName)}%2C%20daqui%20fala%20o%20Suporte%20do%20FinTrack%20sobre%20o%20seu%20pedido%20${t.code}.`;
                return (
                  <div
                    key={t.id}
                    className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 border-b border-surface-container pb-2 mb-2">
                        <span className="font-mono font-black text-primary text-[12px]">{t.code}</span>
                        <span className="px-2 py-0.5 rounded bg-secondary-fixed text-secondary text-[10px] font-bold uppercase">
                          {t.category}
                        </span>
                      </div>
                      <h4 className="text-[14px] font-bold text-on-surface leading-snug">{t.subject}</h4>
                      <p className="text-[12px] text-on-surface-variant mt-1.5 p-2 rounded-xl bg-surface-container-low leading-relaxed">
                        &quot;{t.message}&quot;
                      </p>
                    </div>

                    <div className="space-y-2 pt-1 border-t border-surface-container/60">
                      <div className="flex items-center justify-between text-[11.5px] text-on-surface-variant">
                        <span>Cliente: <strong>{t.userName}</strong></span>
                        <span>Canal: <strong>{t.contactChannel}</strong></span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <a
                          className="flex-1 h-9 rounded-xl bg-secondary hover:opacity-95 text-on-secondary text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          href={waUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <AppIcon name="chat" className="text-[16px]" />
                          <span>WhatsApp</span>
                        </a>

                        <a
                          className="h-9 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-[12px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          href={`tel:${t.userPhone}`}
                        >
                          <AppIcon name="call" className="text-[16px]" />
                          <span>Ligar</span>
                        </a>

                        <button
                          className="h-9 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-[12px] font-semibold cursor-pointer"
                          onClick={() => handleUpdateTicketStatus(t.id, 'resolvido')}
                          type="button"
                        >
                          Marcar Resolvido
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 5: COMUNICADOS GLOBAIS (BROADCAST PARA OS APPS)                        */}
      {/* ========================================================================= */}
      {activeTab === 'announcements' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between bg-surface-container-lowest p-4 rounded-2xl border border-surface-container">
            <div>
              <h3 className="text-[15px] font-bold text-on-surface">
                Comunicados Globais (Broadcast)
              </h3>
              <p className="text-[12px] text-on-surface-variant">
                Publique mensagens que aparecerão como alerta para todos os clientes logados no app.
              </p>
            </div>
            <button
              className="h-10 px-4 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-[12.5px] font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              onClick={() => setShowAnnouncementModal(true)}
              type="button"
            >
              <AppIcon name="add" className="text-[18px]" />
              <span>Novo Comunicado</span>
            </button>
          </div>

          <div className="space-y-3">
            {announcements.length === 0 ? (
              <div className="p-8 text-center text-on-surface-variant text-[13px] bg-surface-container-lowest rounded-2xl border border-surface-container">
                Nenhum comunicado ativo no momento.
              </div>
            ) : (
              announcements.map((a) => (
                <div
                  key={a.id}
                  className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-primary-fixed text-primary text-[10px] font-extrabold uppercase">
                        {a.severity}
                      </span>
                      <h4 className="text-[14.5px] font-bold text-on-surface">{a.title}</h4>
                    </div>
                    <p className="text-[12.5px] text-on-surface-variant leading-relaxed">{a.message}</p>
                    <span className="text-[11px] text-outline block pt-1">
                      Publicado em: {new Date(a.createdAt).toLocaleString('pt-MZ')}
                    </span>
                  </div>

                  <button
                    className="h-8 px-2.5 rounded-lg bg-error-container/60 hover:bg-error-container text-on-error-container text-[11.5px] font-semibold cursor-pointer shrink-0"
                    onClick={() => handleDeleteAnnouncement(a.id)}
                    type="button"
                  >
                    Excluir
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 6: INFRAESTRUTURA & SAÚDE DOS SERVIÇOS DO SAAS                        */}
      {/* ========================================================================= */}
      {activeTab === 'infrastructure' && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[15px] font-bold text-on-surface">Banco de Dados (Neon Postgres)</h4>
                <span className="w-3 h-3 rounded-full bg-secondary animate-pulse" />
              </div>
              <p className="text-[12.5px] text-on-surface-variant">
                Lakebase Postgres em Nuvem com conexões seguras, backups contínuos e migrações automáticas ativas.
              </p>
              <div className="p-3 rounded-xl bg-surface-container-low text-[11.5px] font-mono text-on-surface space-y-1">
                <div>Status: <strong>Operacional (200 OK)</strong></div>
                <div>Modo: Pooler de Alta Disponibilidade</div>
                <div>Isolamento: Multi-tenant estrito por utilizador</div>
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-surface-container-lowest border border-surface-container space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[15px] font-bold text-on-surface">Armazenamento S3 (Comprovativos)</h4>
                <span className="w-3 h-3 rounded-full bg-secondary animate-pulse" />
              </div>
              <p className="text-[12.5px] text-on-surface-variant">
                Bucket S3 compatível da Neon para fotos de perfil e comprovativos de transferências móveis.
              </p>
              <div className="p-3 rounded-xl bg-surface-container-low text-[11.5px] font-mono text-on-surface space-y-1">
                <div>Status: <strong>Conectado e Seguro</strong></div>
                <div>Links: Presigned URLs com expiração de 1 hora</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REDEFINIÇÃO DE SENHA DO CLIENTE                                     */}
      {/* ========================================================================= */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-5 shadow-2xl border border-surface-container space-y-4">
            <div className="flex items-center justify-between border-b border-surface-container pb-3">
              <h3 className="text-[16px] font-bold text-on-surface">
                Redefinir Senha do Cliente
              </h3>
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container text-outline cursor-pointer"
                onClick={() => setPasswordModalUser(null)}
                type="button"
              >
                <AppIcon name="close" className="text-[20px]" />
              </button>
            </div>

            <p className="text-[12.5px] text-on-surface-variant">
              Defina uma nova senha temporária para <strong>{passwordModalUser.name}</strong> ({passwordModalUser.phone}):
            </p>

            <form className="space-y-3" onSubmit={handleResetPasswordSubmit}>
              <div>
                <label className="text-[11.5px] font-bold text-on-surface-variant block mb-1">
                  Nova Senha (mínimo 6 caracteres)
                </label>
                <input
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                  minLength={6}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Ex: FinTrack@2026"
                  required
                  type="text"
                  value={newPasswordInput}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="h-10 px-4 rounded-xl text-on-surface hover:bg-surface-container text-[12.5px] font-semibold cursor-pointer"
                  onClick={() => setPasswordModalUser(null)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="h-10 px-5 rounded-xl bg-primary text-on-primary text-[12.5px] font-bold shadow-xs cursor-pointer disabled:opacity-60"
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

      {/* ========================================================================= */}
      {/* MODAL: NOVO COMUNICADO GLOBAL                                             */}
      {/* ========================================================================= */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-5 shadow-2xl border border-surface-container space-y-4">
            <div className="flex items-center justify-between border-b border-surface-container pb-3">
              <h3 className="text-[16px] font-bold text-on-surface">Novo Comunicado Global</h3>
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-container text-outline cursor-pointer"
                onClick={() => setShowAnnouncementModal(false)}
                type="button"
              >
                <AppIcon name="close" className="text-[20px]" />
              </button>
            </div>

            <form className="space-y-3" onSubmit={handlePublishAnnouncement}>
              <div>
                <label className="text-[11.5px] font-bold text-on-surface-variant block mb-1">
                  Tipo / Gravidade
                </label>
                <select
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-[12.5px] font-medium cursor-pointer focus:outline-none"
                  onChange={(e) => setAnnSeverity(e.target.value as 'info' | 'warning' | 'critical')}
                  value={annSeverity}
                >
                  <option value="info">Informativo / Novidade (Verde/Azul)</option>
                  <option value="warning">Atenção / Aviso (Amarelo)</option>
                  <option value="critical">Importante / Urgente (Vermelho)</option>
                </select>
              </div>

              <div>
                <label className="text-[11.5px] font-bold text-on-surface-variant block mb-1">
                  Título do Aviso
                </label>
                <input
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Ex: Atualização dos Relatórios Fiscais"
                  required
                  type="text"
                  value={annTitle}
                />
              </div>

              <div>
                <label className="text-[11.5px] font-bold text-on-surface-variant block mb-1">
                  Mensagem
                </label>
                <textarea
                  className="w-full min-h-[90px] p-3 rounded-xl bg-surface-container-low text-on-surface text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  onChange={(e) => setAnnMessage(e.target.value)}
                  placeholder="Descreva o comunicado que será exibido aos clientes..."
                  required
                  value={annMessage}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="h-10 px-4 rounded-xl text-on-surface hover:bg-surface-container text-[12.5px] font-semibold cursor-pointer"
                  onClick={() => setShowAnnouncementModal(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="h-10 px-5 rounded-xl bg-primary text-on-primary text-[12.5px] font-bold shadow-xs cursor-pointer disabled:opacity-60"
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
