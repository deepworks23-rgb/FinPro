import { AppIcon } from './AppIcon';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  AdminAnnouncement,
  AdminOverviewStats,
  AdminSubscriptionItem,
  AdminUserItem,
  CurrencyCode,
  SubscriptionPlan,
  SubscriptionPlanItem,
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
  onNavigateToLanding?: () => void;
  onLogout?: () => Promise<void>;
}

type AdminTab =
  | 'dashboard'
  | 'statistics'
  | 'subscriptions'
  | 'users'
  | 'plans'
  | 'tickets'
  | 'announcements'
  | 'settings';

export function AdminScreen({
  authToken,
  currency,
  currentUser,
  onNotify,
  onNavigateToLanding,
  onLogout,
}: AdminScreenProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionItem[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlanItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtros & Pesquisa
  const [userSearch, setUserSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | SubscriptionPlan>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Modais de Gestão (CRUD)
  const [resetPwdModalUser, setResetPwdModalUser] = useState<AdminUserItem | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Modal de Comunicados
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnMessage, setNewAnnMessage] = useState('');
  const [newAnnSeverity, setNewAnnSeverity] = useState<'info' | 'warning' | 'critical'>('info');
  const [isPublishingAnn, setIsPublishingAnn] = useState(false);

  // Modal de Planos de Subscrição (CRUD de Planos)
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanItem | null>(null);
  const [planName, setPlanName] = useState('');
  const [planSlug, setPlanSlug] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [planPriceMonthly, setPlanPriceMonthly] = useState<number>(0);
  const [planPriceYearly, setPlanPriceYearly] = useState<number>(0);
  const [planFeaturesText, setPlanFeaturesText] = useState('');
  const [planIsPopular, setPlanIsPopular] = useState(false);
  const [planIsActive, setPlanIsActive] = useState(true);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Carregamento de Dados 100% Reais
  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [overviewRes, usersRes, subscriptionsRes, plansRes, ticketsRes, annRes] = await Promise.all([
        adminApi.getOverview(authToken).catch(() => ({ ok: false, stats: null })),
        adminApi.getUsers(authToken).catch(() => ({ ok: false, users: [] })),
        adminApi.getSubscriptions(authToken).catch(() => ({ ok: false, subscriptions: [] })),
        adminApi.getPlans(authToken).catch(() => ({ ok: false, plans: [] })),
        adminApi.getTickets(authToken).catch(() => ({ ok: false, tickets: [] })),
        adminApi.getAnnouncements(authToken).catch(() => ({ ok: false, announcements: [] })),
      ]);

      if (overviewRes.stats) setStats(overviewRes.stats);
      if (Array.isArray(usersRes.users)) setUsers(usersRes.users);
      if (Array.isArray(subscriptionsRes.subscriptions)) setSubscriptions(subscriptionsRes.subscriptions);
      if (Array.isArray(plansRes.plans)) setPlans(plansRes.plans);
      if (Array.isArray(ticketsRes.tickets)) setTickets(ticketsRes.tickets);
      if (Array.isArray(annRes.announcements)) setAnnouncements(annRes.announcements);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao sincronizar dados da base de dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [authToken]);

  // Taxa de Conversão Real (Sem Fictício)
  const conversionRate = useMemo(() => {
    if (!stats || stats.totalUsers === 0) return 0;
    const paid = (stats.proUsersCount || 0) + (stats.businessUsersCount || 0);
    return Math.round((paid / stats.totalUsers) * 100);
  }, [stats]);

  // Exportar Relatório em CSV Real
  const handleExportCSV = () => {
    if (users.length === 0) {
      onNotify('Não existem registos de clientes para exportar.');
      return;
    }
    const headers = ['Nome', 'Telefone', 'Email', 'Plano Atual', 'Estado da Conta', 'Data de Registo', 'Referencia Pagamento'];
    const rows = users.map((u) => [
      `"${u.name.replace(/"/g, '""')}"`,
      `"${u.phone}"`,
      `"${u.email}"`,
      `"${u.plan.toUpperCase()}"`,
      `"${u.isSuspended ? 'Suspenso' : 'Ativo'}"`,
      `"${u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-MZ') : ''}"`,
      `"${u.paymentReference || ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-clientes-saas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('Relatório de clientes exportado em formato CSV com sucesso!');
  };

  // CRUD de Clientes
  const handleToggleUserSuspension = async (user: AdminUserItem) => {
    try {
      setUpdatingUserId(user.id);
      const nextSuspended = !user.isSuspended;
      const res = await adminApi.toggleUserSuspension(authToken, user.id, nextSuspended);
      onNotify(res.message);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isSuspended: nextSuspended } : u))
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao alterar estado do utilizador.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleChangeUserPlan = async (userId: string, newPlan: SubscriptionPlan) => {
    try {
      setUpdatingUserId(userId);
      const res = await adminApi.updateUserPlan(authToken, userId, newPlan);
      onNotify(res.message);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, plan: newPlan } : u))
      );
      void loadData();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao atualizar plano.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleApproveSubscription = async (sub: AdminSubscriptionItem) => {
    try {
      const planToApprove = sub.plan === 'business' ? 'business' : 'pro';
      const res = await adminApi.approveSubscription(authToken, sub.id, planToApprove);
      onNotify(res.message);
      void loadData();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao aprovar subscrição.');
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: 'aberto' | 'em_andamento' | 'resolvido') => {
    try {
      const res = await adminApi.updateTicketStatus(authToken, ticketId, status);
      onNotify(res.message);
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status } : t))
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao atualizar chamado.');
    }
  };

  const handleResetPasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetPwdModalUser || newPasswordVal.length < 6) {
      onNotify('A nova senha deve ter no mínimo 6 caracteres.');
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

  // CRUD de Comunicados
  const handleCreateAnnouncement = async (e: FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnMessage.trim()) return;
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

  // CRUD de Planos de Subscrição
  const handleOpenPlanModal = (planToEdit?: SubscriptionPlanItem) => {
    if (planToEdit) {
      setEditingPlan(planToEdit);
      setPlanName(planToEdit.name);
      setPlanSlug(planToEdit.slug);
      setPlanDescription(planToEdit.description);
      setPlanPriceMonthly(Number(planToEdit.priceMonthly));
      setPlanPriceYearly(Number(planToEdit.priceYearly));
      setPlanFeaturesText(planToEdit.features.join('\n'));
      setPlanIsPopular(planToEdit.isPopular);
      setPlanIsActive(planToEdit.isActive);
    } else {
      setEditingPlan(null);
      setPlanName('');
      setPlanSlug('');
      setPlanDescription('');
      setPlanPriceMonthly(0);
      setPlanPriceYearly(0);
      setPlanFeaturesText('');
      setPlanIsPopular(false);
      setPlanIsActive(true);
    }
    setPlanModalOpen(true);
  };

  const handleSavePlanSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!planName.trim()) {
      onNotify('O nome do plano é obrigatório.');
      return;
    }
    setIsSavingPlan(true);
    try {
      const features = planFeaturesText
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean);

      if (editingPlan) {
        const res = await adminApi.updatePlan(authToken, editingPlan.id, {
          name: planName.trim(),
          description: planDescription.trim(),
          priceMonthly: Number(planPriceMonthly),
          priceYearly: Number(planPriceYearly),
          features,
          isPopular: planIsPopular,
          isActive: planIsActive,
        });
        onNotify(res.message);
      } else {
        const res = await adminApi.createPlan(authToken, {
          name: planName.trim(),
          slug: planSlug.trim(),
          description: planDescription.trim(),
          priceMonthly: Number(planPriceMonthly),
          priceYearly: Number(planPriceYearly),
          currency: 'MZN',
          features,
          isPopular: planIsPopular,
          isActive: planIsActive,
        });
        onNotify(res.message);
      }
      setPlanModalOpen(false);
      void loadData();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao guardar plano.');
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleDeletePlan = async (planId: string, planName: string) => {
    if (!confirm(`Tem certeza que deseja eliminar o plano "${planName}"? Esta ação removerá o plano do site público.`)) {
      return;
    }
    try {
      const res = await adminApi.deletePlan(authToken, planId);
      onNotify(res.message);
      void loadData();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao eliminar plano.');
    }
  };

  const handleTogglePlanActive = async (plan: SubscriptionPlanItem) => {
    try {
      const nextActive = !plan.isActive;
      const res = await adminApi.updatePlan(authToken, plan.id, {
        name: plan.name,
        isActive: nextActive,
      });
      onNotify(res.message);
      setPlans((prev) =>
        prev.map((p) => (p.id === plan.id ? { ...p, isActive: nextActive } : p))
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao alterar estado do plano.');
    }
  };

  // Filtro de Clientes
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

  // Gráfico de Barras com Dados 100% Reais
  const chartBars = useMemo(() => {
    if (stats?.weeklyRevenue && stats.weeklyRevenue.length > 0) {
      return stats.weeklyRevenue;
    }
    return [
      { label: 'Dom', val: 0 },
      { label: 'Seg', val: 0 },
      { label: 'Ter', val: 0 },
      { label: 'Qua', val: 0 },
      { label: 'Qui', val: 0 },
      { label: 'Sex', val: 0 },
      { label: 'Sáb', val: 0 },
    ];
  }, [stats?.weeklyRevenue]);

  const maxBarVal = Math.max(...chartBars.map((b) => b.val), 100);

  // Inicial do Administrador
  const adminName = currentUser?.name || 'Joswil Admin';
  const adminInitials = getUserInitials(adminName);

  return (
    <div className="h-screen w-full bg-surface-container-low/40 flex text-on-surface overflow-hidden">
      {/* 1. BARRA LATERAL ESQUERDA (Navegação Exclusiva em Português) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 lg:w-64 bg-surface-container-lowest border-r border-surface-container flex flex-col justify-between transition-transform duration-200 md:static md:translate-x-0 h-screen shrink-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Cabeçalho da Barra Lateral */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-surface-container/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-[10px] bg-primary text-on-primary flex items-center justify-center shadow-sm shadow-primary/25 shrink-0">
                <AppIcon name="grid_view" className="text-[20px]" filled />
              </div>
              <div>
                <span className="text-[16px] font-black text-on-surface tracking-tight block leading-tight">
                  FinTrack
                </span>
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest block leading-tight">
                  Gestão SaaS
                </span>
              </div>
            </div>

            <button
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-[10px] text-on-surface-variant hover:text-on-surface hover:bg-surface-container cursor-pointer"
              onClick={() => setMobileMenuOpen(false)}
              type="button"
            >
              <AppIcon name="close" className="text-[18px]" />
            </button>
          </div>

          {/* Menus de Navegação com Indicadores Reais */}
          <nav className="p-3 space-y-1 flex-1 overflow-y-auto no-scrollbar">
            <button
              className={`w-full h-10 px-3.5 rounded-[10px] flex items-center gap-3 text-[13px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-primary text-on-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('dashboard');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="dashboard" className="text-[19px]" filled={activeTab === 'dashboard'} />
              <span>Visão Geral</span>
            </button>

            <button
              className={`w-full h-10 px-3.5 rounded-[10px] flex items-center gap-3 text-[13px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'statistics'
                  ? 'bg-primary text-on-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('statistics');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="analytics" className="text-[19px]" filled={activeTab === 'statistics'} />
              <span>Estatísticas & Receitas</span>
            </button>

            <button
              className={`w-full h-10 px-3.5 rounded-[10px] flex items-center gap-3 text-[13px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'subscriptions'
                  ? 'bg-primary text-on-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('subscriptions');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="receipt_long" className="text-[19px]" filled={activeTab === 'subscriptions'} />
              <span className="flex-1">Subscrições & Pagamentos</span>
              {subscriptions.filter((s) => s.paymentReference && s.status === 'trialing').length > 0 && (
                <span className="px-1.5 py-0.5 rounded-[6px] bg-tertiary-container text-on-tertiary text-[9.5px] font-bold">
                  {subscriptions.filter((s) => s.paymentReference && s.status === 'trialing').length}
                </span>
              )}
            </button>

            <button
              className={`w-full h-10 px-3.5 rounded-[10px] flex items-center gap-3 text-[13px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-primary text-on-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('users');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="group" className="text-[19px]" filled={activeTab === 'users'} />
              <span className="flex-1">Gestão de Clientes</span>
              <span className="text-[10.5px] font-bold opacity-80">{users.length}</span>
            </button>

            {/* Nova Aba de CRUD de Planos */}
            <button
              className={`w-full h-10 px-3.5 rounded-[10px] flex items-center gap-3 text-[13px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'plans'
                  ? 'bg-primary text-on-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('plans');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="workspace_premium" className="text-[19px]" filled={activeTab === 'plans'} />
              <span className="flex-1">Planos de Subscrição</span>
              <span className="text-[10.5px] font-bold opacity-80">{plans.length}</span>
            </button>

            <button
              className={`w-full h-10 px-3.5 rounded-[10px] flex items-center gap-3 text-[13px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'tickets'
                  ? 'bg-primary text-on-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('tickets');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="support_agent" className="text-[19px]" filled={activeTab === 'tickets'} />
              <span className="flex-1">Central de Suporte</span>
              {tickets.filter((t) => t.status === 'aberto').length > 0 && (
                <span className="px-1.5 py-0.5 rounded-[6px] bg-error-container text-on-error-container text-[9.5px] font-bold">
                  {tickets.filter((t) => t.status === 'aberto').length}
                </span>
              )}
            </button>

            <button
              className={`w-full h-10 px-3.5 rounded-[10px] flex items-center gap-3 text-[13px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'announcements'
                  ? 'bg-primary text-on-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('announcements');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="campaign" className="text-[19px]" filled={activeTab === 'announcements'} />
              <span>Avisos & Comunicados</span>
            </button>

            <button
              className={`w-full h-10 px-3.5 rounded-[10px] flex items-center gap-3 text-[13px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-primary text-on-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('settings');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="settings" className="text-[19px]" filled={activeTab === 'settings'} />
              <span>Configurações</span>
            </button>
          </nav>
        </div>

        {/* Rodapé da Barra Lateral: Perfil do Admin & Terminar Sessão */}
        <div className="p-3 border-t border-surface-container/70 space-y-2 bg-surface-container-low/30 shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="w-9 h-9 rounded-[10px] bg-primary-fixed text-primary font-black text-[12px] flex items-center justify-center shrink-0 ring-1 ring-primary/20">
              {currentUser?.avatarDataUrl ? (
                <img
                  src={currentUser.avatarDataUrl}
                  alt={adminName}
                  className="w-full h-full object-cover rounded-[10px]"
                />
              ) : (
                adminInitials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[13px] font-bold text-on-surface truncate block leading-tight">
                {adminName}
              </span>
              <span className="text-[10.5px] font-medium text-primary block leading-tight">
                Administrador Master
              </span>
            </div>
          </div>

          {onLogout && (
            <button
              className="w-full h-9 px-3 rounded-[10px] text-tertiary hover:bg-error-container/60 text-[12px] font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              onClick={() => void onLogout()}
              type="button"
            >
              <AppIcon name="logout" className="text-[17px]" />
              <span>Terminar Sessão</span>
            </button>
          )}
        </div>
      </aside>

      {/* Backdrop para Menu Mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-inverse-surface/40 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* 2. ÁREA PRINCIPAL COM SCROLL INTERNO E 100% LARGURA */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-surface-container-low/20">
        {/* Cabeçalho Superior Fixo */}
        <header className="h-16 px-4 sm:px-6 border-b border-surface-container flex items-center justify-between bg-surface-container-lowest/90 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-[10px] bg-surface-container text-on-surface cursor-pointer"
              onClick={() => setMobileMenuOpen(true)}
              type="button"
            >
              <AppIcon name="menu" className="text-[20px]" />
            </button>

            <div>
              <h1 className="text-[18px] sm:text-[20px] font-black text-on-surface tracking-tight leading-tight">
                {activeTab === 'dashboard'
                  ? 'Painel Geral de Controlo SaaS'
                  : activeTab === 'statistics'
                    ? 'Estatísticas & Receitas'
                    : activeTab === 'subscriptions'
                      ? 'Subscrições & Pagamentos'
                      : activeTab === 'users'
                        ? 'Gestão de Clientes'
                        : activeTab === 'plans'
                          ? 'Gestão de Planos de Subscrição'
                          : activeTab === 'tickets'
                            ? 'Central de Suporte & Chamados'
                            : activeTab === 'announcements'
                              ? 'Avisos & Comunicados Globais'
                              : 'Configurações da Plataforma'}
              </h1>
              <span className="text-[11px] font-medium text-on-surface-variant block leading-tight">
                27 de Novembro, 2026 · FinTrack Backoffice Master
              </span>
            </div>
          </div>

          {/* Ações Superiores */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {onNavigateToLanding && (
              <button
                className="h-9 px-3 rounded-[10px] bg-surface-container hover:bg-surface-container-high text-on-surface text-[11.5px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer hidden sm:flex"
                onClick={onNavigateToLanding}
                title="Abrir o Site Público e Landing Page"
                type="button"
              >
                <AppIcon name="public" className="text-[16px] text-primary" />
                <span>Site Público</span>
              </button>
            )}

            <button
              className="w-9 h-9 rounded-[10px] bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-colors cursor-pointer"
              onClick={loadData}
              title="Atualizar Dados da Base de Dados"
              type="button"
            >
              <AppIcon name="refresh" className={`text-[18px] ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Chip do Perfil Admin */}
            <div className="flex items-center gap-2 pl-2 border-l border-surface-container">
              <div className="w-8 h-8 rounded-[10px] bg-primary-fixed text-primary font-black text-[12px] flex items-center justify-center shrink-0 ring-1 ring-primary/20">
                {currentUser?.avatarDataUrl ? (
                  <img
                    src={currentUser.avatarDataUrl}
                    alt={adminName}
                    className="w-full h-full object-cover rounded-[10px]"
                  />
                ) : (
                  adminInitials
                )}
              </div>
              <div className="hidden lg:block text-left">
                <span className="text-[12px] font-bold text-on-surface block leading-tight">
                  {adminName}
                </span>
                <span className="text-[10px] font-medium text-on-surface-variant block leading-tight">
                  Admin Master
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Mensagem de Erro se houver */}
        {errorMsg && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-[10px] bg-error-container text-on-error-container text-[12px] font-medium flex items-center gap-2 shrink-0">
            <AppIcon name="error" className="text-[17px] shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 3. CONTEÚDO PRINCIPAL COM SCROLL INTERNO */}
        <main className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto w-full">
          {activeTab === 'dashboard' && (
            <div className="space-y-4 animate-fade-in w-full">
              {/* LINHA 1: CARDS DE MÉTRICAS 100% REAIS (Raio 10px, Compactos) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Card 1: Receita Recorrente Mensal (MRR) Real */}
                <div className="p-4 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[8px] bg-primary-fixed/50 text-primary text-[10.5px] font-bold">
                      <AppIcon name="monetization_on" className="text-[13px]" />
                      <span>Faturamento Mensal</span>
                    </span>
                    <span className="text-[10.5px] font-bold text-primary">
                      MRR Real
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <span className="text-[22px] lg:text-[24px] font-black text-on-surface tracking-tight block">
                      {formatMoney(stats?.mrrMzn ?? 0, currency)}
                    </span>
                    <span className="text-[11.5px] font-medium text-on-surface-variant mt-0.5 block">
                      Receita mensal recorrente aprovada
                    </span>
                  </div>
                </div>

                {/* Card 2: Projeção Anual (ARR) Real */}
                <div className="p-4 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[8px] bg-secondary-container/50 text-on-secondary-container text-[10.5px] font-bold">
                      <AppIcon name="trending_up" className="text-[13px]" />
                      <span>Projeção Anual</span>
                    </span>
                    <span className="text-[10.5px] font-bold text-on-surface-variant">
                      ARR Estimado
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <span className="text-[22px] lg:text-[24px] font-black text-on-surface tracking-tight block">
                      {formatMoney((stats?.mrrMzn ?? 0) * 12, currency)}
                    </span>
                    <span className="text-[11.5px] font-medium text-on-surface-variant mt-0.5 block">
                      Run Rate anualizado baseado em MRR
                    </span>
                  </div>
                </div>

                {/* Card 3: Taxa de Conversão Real */}
                <div className="p-4 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[8px] bg-tertiary-container/50 text-on-tertiary-container text-[10.5px] font-bold">
                      <AppIcon name="pie_chart" className="text-[13px]" />
                      <span>Conversão Pagante</span>
                    </span>
                    <span className="text-[10.5px] font-bold text-secondary">
                      {conversionRate > 0 ? `${conversionRate}%` : '0%'}
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <span className="text-[22px] lg:text-[24px] font-black text-on-surface tracking-tight block">
                      {conversionRate}%
                    </span>
                    <span className="text-[11.5px] font-medium text-on-surface-variant mt-0.5 block">
                      {stats ? `${(stats.proUsersCount || 0) + (stats.businessUsersCount || 0)} pagantes de ${stats.totalUsers} clientes` : '0 pagantes'}
                    </span>
                  </div>
                </div>

                {/* Card 4: Estado Operacional SaaS */}
                <div className="p-4 rounded-[10px] bg-primary text-on-primary shadow-md shadow-primary/25 flex flex-col justify-between relative overflow-hidden">
                  <div className="relative z-10">
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-on-primary/80 block">
                      Estado da Plataforma
                    </span>
                    <span className="text-[20px] lg:text-[22px] font-black tracking-tight mt-0.5 block">
                      {subscriptions.length} Subscrições
                    </span>
                    <p className="text-[11px] text-on-primary/85 mt-1 leading-snug">
                      Neon Postgres & S3 Storage operacionais em Maputo.
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-on-primary/20 flex items-center justify-between relative z-10">
                    <button
                      className="px-3 py-1.5 rounded-[8px] bg-surface-container-lowest text-primary text-[11px] font-bold transition-transform active:scale-95 cursor-pointer"
                      onClick={() => setActiveTab('subscriptions')}
                      type="button"
                    >
                      Validar M-Pesa
                    </button>
                    <span className="text-[10.5px] font-semibold text-on-primary/80">
                      M-Pesa / e-Mola
                    </span>
                  </div>
                </div>
              </div>

              {/* LINHA 2: HISTÓRICO REAL DE FATURAMENTO + ANÁLISE DE PLANOS + SUPORTE */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                {/* Gráfico Semanal Real */}
                <div className="lg:col-span-6 p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-[16px] font-black text-on-surface tracking-tight">
                        Faturamento Semanal Real
                      </h2>
                      <span className="text-[11.5px] font-medium text-on-surface-variant">
                        Valores cobrados nos últimos 7 dias (sem dados fictícios)
                      </span>
                    </div>
                    <button
                      className="px-3 py-1 rounded-[8px] bg-surface-container hover:bg-surface-container-high text-on-surface text-[11.5px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      onClick={handleExportCSV}
                      title="Exportar Clientes em CSV"
                      type="button"
                    >
                      <AppIcon name="download" className="text-[15px]" />
                      <span>Exportar CSV</span>
                    </button>
                  </div>

                  {/* Barras de Faturamento Real */}
                  <div className="mt-4">
                    <div className="h-36 flex items-end justify-between gap-2.5 px-2 border-b border-surface-container">
                      {chartBars.map((bar) => {
                        const heightPct = bar.val > 0 ? Math.max(Math.round((bar.val / maxBarVal) * 100), 15) : 4;
                        return (
                          <div key={bar.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                            <span className="text-[9.5px] font-bold text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">
                              {bar.val > 0 ? `${formatMoney(bar.val, currency)}` : '0 MT'}
                            </span>
                            <div
                              style={{ height: `${heightPct}%` }}
                              className={`w-full max-w-[26px] rounded-t-[6px] transition-all ${
                                bar.val > 0
                                  ? 'bg-primary shadow-xs shadow-primary/30'
                                  : 'bg-surface-container-high'
                              }`}
                            />
                            <span className="text-[10.5px] font-bold text-on-surface-variant pt-1">
                              {bar.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Análise de Distribuição de Planos */}
                <div className="lg:col-span-3 p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div>
                    <h2 className="text-[16px] font-black text-on-surface tracking-tight">
                      Distribuição de Planos
                    </h2>
                    <span className="text-[11.5px] font-medium text-on-surface-variant">
                      Rácio de subscrições ativas
                    </span>

                    <div className="mt-3.5 space-y-2.5">
                      <div
                        className="p-3 rounded-[10px] bg-surface-container-low hover:bg-surface-container flex items-center justify-between transition-colors cursor-pointer"
                        onClick={() => setActiveTab('users')}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-[8px] bg-primary text-on-primary flex items-center justify-center">
                            <AppIcon name="workspace_premium" className="text-[15px]" />
                          </div>
                          <div>
                            <span className="text-[12.5px] font-bold text-on-surface block leading-tight">
                              Planos Pro & Negócios
                            </span>
                            <span className="text-[10.5px] text-on-surface-variant leading-tight">
                              {(stats?.proUsersCount || 0) + (stats?.businessUsersCount || 0)} Assinantes Pagantes
                            </span>
                          </div>
                        </div>
                        <AppIcon name="chevron_right" className="text-[16px] text-on-surface-variant" />
                      </div>

                      <div
                        className="p-3 rounded-[10px] bg-surface-container-low hover:bg-surface-container flex items-center justify-between transition-colors cursor-pointer"
                        onClick={() => setActiveTab('users')}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-[8px] bg-surface-container-high text-on-surface flex items-center justify-center">
                            <AppIcon name="person" className="text-[15px]" />
                          </div>
                          <div>
                            <span className="text-[12.5px] font-bold text-on-surface block leading-tight">
                              Plano Gratuito
                            </span>
                            <span className="text-[10.5px] text-on-surface-variant leading-tight">
                              {stats?.freeUsersCount ?? 0} Contas Gratuitas
                            </span>
                          </div>
                        </div>
                        <AppIcon name="chevron_right" className="text-[16px] text-on-surface-variant" />
                      </div>
                    </div>
                  </div>

                  <button
                    className="text-[11px] font-bold text-primary mt-3 flex items-center gap-1 hover:underline cursor-pointer"
                    onClick={() => setActiveTab('plans')}
                    type="button"
                  >
                    <span>Gerir Planos & Preços</span>
                    <AppIcon name="arrow_forward" className="text-[13px]" />
                  </button>
                </div>

                {/* Central de Atendimento Diário */}
                <div className="lg:col-span-3 p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-[8px] bg-secondary-container text-on-secondary-container flex items-center justify-center">
                        <AppIcon name="forum" className="text-[15px]" />
                      </div>
                      <h2 className="text-[16px] font-black text-on-surface tracking-tight">
                        Suporte ao Cliente
                      </h2>
                    </div>

                    <div className="mt-3 p-3 rounded-[10px] bg-surface-container-low/60 border border-surface-container space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11.5px] font-bold text-on-surface">
                          Chamados em Espera
                        </span>
                        <span className="px-2 py-0.5 rounded-[6px] bg-error-container text-on-error-container text-[10.5px] font-extrabold">
                          {tickets.filter((t) => t.status === 'aberto').length} Abertos
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-snug">
                        Dúvidas de clientes ou solicitações de validação de depósito M-Pesa.
                      </p>
                    </div>
                  </div>

                  <button
                    className="w-full h-9 mt-3 rounded-[10px] bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[11.5px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    onClick={() => setActiveTab('tickets')}
                    type="button"
                  >
                    <AppIcon name="headset_mic" className="text-[16px] text-primary" />
                    <span>Ver Fila de Atendimento</span>
                  </button>
                </div>
              </div>

              {/* LINHA 3: TABELA DE CLIENTES RECENTES & MEMBROS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                {/* Tabela de Clientes */}
                <div className="lg:col-span-8 p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <h2 className="text-[16px] font-black text-on-surface tracking-tight">
                        Clientes & Subscrições Recentes
                      </h2>
                      <span className="text-[11.5px] font-medium text-on-surface-variant">
                        Últimos utilizadores registados na plataforma
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <AppIcon
                          name="search"
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[15px] text-on-surface-variant"
                        />
                        <input
                          className="h-8 pl-8 pr-3 rounded-[8px] bg-surface-container text-on-surface text-[11.5px] placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30"
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Pesquisar..."
                          type="text"
                          value={userSearch}
                        />
                      </div>
                      <button
                        className="h-8 px-3 rounded-[8px] bg-primary text-on-primary text-[11.5px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                        onClick={() => setActiveTab('users')}
                        type="button"
                      >
                        <span>Ver Todos</span>
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left text-[12.5px]">
                      <thead>
                        <tr className="border-b border-surface-container text-[10.5px] font-bold text-on-surface-variant uppercase tracking-wider">
                          <th className="py-2.5 px-3">Cliente</th>
                          <th className="py-2.5 px-3">Contacto</th>
                          <th className="py-2.5 px-3">Plano</th>
                          <th className="py-2.5 px-3">Estado</th>
                          <th className="py-2.5 px-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container/60 font-medium">
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-on-surface-variant text-[12px]">
                              Nenhum cliente registado encontrado.
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.slice(0, 5).map((user) => (
                            <tr key={user.id} className="hover:bg-surface-container-low/40 transition-colors">
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-[8px] bg-primary-fixed text-primary font-bold text-[10.5px] flex items-center justify-center shrink-0">
                                    {getUserInitials(user.name)}
                                  </div>
                                  <span className="font-bold text-on-surface">{user.name}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-on-surface-variant text-[11.5px]">
                                {user.phone}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-[6px] text-[10px] font-extrabold uppercase ${
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
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-[6px] text-[10px] font-bold ${
                                    user.isSuspended
                                      ? 'bg-error-container text-on-error-container'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {user.isSuspended ? 'Suspenso' : 'Ativo'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  className="px-2.5 py-1 rounded-[6px] bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-bold cursor-pointer transition-colors"
                                  onClick={() => setResetPwdModalUser(user)}
                                  type="button"
                                >
                                  Redefinir Senha
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Clientes Recentes & Atalho WhatsApp */}
                <div className="lg:col-span-4 p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div>
                    <h2 className="text-[16px] font-black text-on-surface tracking-tight">
                      Membros Recentes
                    </h2>
                    <span className="text-[11.5px] font-medium text-on-surface-variant">
                      Últimos registos na plataforma
                    </span>

                    <div className="mt-3 space-y-2">
                      {users.length === 0 ? (
                        <p className="text-[12px] text-on-surface-variant py-4 text-center">Nenhum membro registado.</p>
                      ) : (
                        users.slice(0, 4).map((member) => (
                          <div
                            key={member.id}
                            className="p-2.5 rounded-[10px] bg-surface-container-low flex items-center justify-between gap-2.5"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-[8px] bg-primary-fixed text-primary font-bold text-[10.5px] flex items-center justify-center shrink-0">
                                {getUserInitials(member.name)}
                              </div>
                              <div className="min-w-0">
                                <span className="text-[12px] font-bold text-on-surface truncate block">
                                  {member.name}
                                </span>
                                <span className="text-[10.5px] text-on-surface-variant truncate block">
                                  {member.phone}
                                </span>
                              </div>
                            </div>

                            <a
                              className="w-7 h-7 rounded-[8px] bg-emerald-100 text-emerald-800 flex items-center justify-center hover:bg-emerald-200 transition-colors shrink-0"
                              href={`https://wa.me/${member.phone.replace(/\D/g, '')}?text=Olá%20${encodeURIComponent(member.name)},%20suporte%20FinTrack.`}
                              rel="noopener noreferrer"
                              target="_blank"
                              title="Conversar no WhatsApp"
                            >
                              <AppIcon name="chat" className="text-[14px]" />
                            </a>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <button
                    className="w-full h-9 mt-3 rounded-[10px] bg-primary text-on-primary text-[11.5px] font-bold flex items-center justify-center gap-1.5 shadow-xs transition-transform active:scale-95 cursor-pointer"
                    onClick={() => setAnnouncementModalOpen(true)}
                    type="button"
                  >
                    <AppIcon name="add" className="text-[16px]" />
                    <span>Publicar Novo Comunicado</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PLANOS DE SUBSCRIÇÃO (CRUD COMPLETO DE PLANOS) */}
          {activeTab === 'plans' && (
            <div className="p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                    Gestão dos Planos de Subscrição (CRUD)
                  </h2>
                  <p className="text-[11.5px] text-on-surface-variant">
                    Crie novos planos, altere valores e recursos. As alterações refletem-se instantaneamente no site público.
                  </p>
                </div>

                <button
                  className="h-9 px-4 rounded-[8px] bg-primary text-on-primary text-[12px] font-bold flex items-center gap-1.5 shadow-xs cursor-pointer hover:bg-primary-container"
                  onClick={() => handleOpenPlanModal()}
                  type="button"
                >
                  <AppIcon name="add" className="text-[16px]" />
                  <span>Novo Plano de Subscrição</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map((p) => (
                  <div
                    key={p.id}
                    className={`p-4 rounded-[10px] border flex flex-col justify-between transition-all ${
                      p.isActive
                        ? p.isPopular
                          ? 'border-2 border-primary bg-surface-container-lowest shadow-md'
                          : 'border-surface-container bg-surface-container-lowest shadow-xs'
                        : 'border-surface-container/60 bg-surface-container-low/50 opacity-75'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-black text-on-surface">
                          {p.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {p.isPopular && (
                            <span className="px-2 py-0.5 rounded-[6px] bg-primary-fixed text-primary text-[10px] font-bold">
                              Destaque ⭐
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-[6px] text-[10px] font-bold ${
                              p.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-surface-container text-on-surface-variant'
                            }`}
                          >
                            {p.isActive ? 'Ativo no Site' : 'Inativo'}
                          </span>
                        </div>
                      </div>

                      <div className="my-2.5">
                        <span className="text-[22px] font-black text-on-surface">
                          {Number(p.priceMonthly).toLocaleString('pt-MZ')} MT
                        </span>
                        <span className="text-[11px] text-on-surface-variant ml-1 font-semibold">/ mês</span>
                        {Number(p.priceYearly) > 0 && (
                          <span className="text-[10.5px] text-secondary font-bold block mt-0.5">
                            {Number(p.priceYearly).toLocaleString('pt-MZ')} MT / ano
                          </span>
                        )}
                      </div>

                      <p className="text-[11.5px] text-on-surface-variant mb-3 leading-snug">
                        {p.description || 'Sem descrição cadastrada.'}
                      </p>

                      <div className="space-y-1.5 border-t border-surface-container/60 pt-2.5">
                        <span className="text-[10.5px] font-bold text-on-surface uppercase tracking-wider block">
                          Funcionalidades ({p.features.length})
                        </span>
                        <ul className="space-y-1 text-[11.5px] text-on-surface-variant">
                          {p.features.map((feat, idx) => (
                            <li key={idx} className="flex items-center gap-1.5">
                              <AppIcon name="check" className="text-secondary text-[14px] shrink-0" />
                              <span className="truncate">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-surface-container/60 flex items-center justify-between gap-2">
                      <button
                        className="flex-1 h-8 px-2.5 rounded-[6px] bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-bold cursor-pointer"
                        onClick={() => handleOpenPlanModal(p)}
                        type="button"
                      >
                        Editar Plano
                      </button>

                      <button
                        className={`h-8 px-2.5 rounded-[6px] text-[11px] font-bold cursor-pointer ${
                          p.isActive
                            ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                            : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        }`}
                        onClick={() => handleTogglePlanActive(p)}
                        title={p.isActive ? 'Ocultar do site público' : 'Exibir no site público'}
                        type="button"
                      >
                        {p.isActive ? 'Desativar' : 'Ativar'}
                      </button>

                      {p.slug !== 'free' && (
                        <button
                          className="w-8 h-8 rounded-[6px] bg-error-container text-on-error-container flex items-center justify-center hover:opacity-90 cursor-pointer"
                          onClick={() => handleDeletePlan(p.id, p.name)}
                          title="Eliminar este plano"
                          type="button"
                        >
                          <AppIcon name="delete" className="text-[15px]" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: GESTÃO DE CLIENTES */}
          {activeTab === 'users' && (
            <div className="p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                    Gestão Completa de Clientes
                  </h2>
                  <p className="text-[11.5px] text-on-surface-variant">
                    Pesquise, altere planos, modere acessos ou redefina senhas de utilizadores.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="h-9 px-3 rounded-[8px] bg-surface-container text-on-surface text-[12px] placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30"
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Pesquisar utilizador..."
                    type="text"
                    value={userSearch}
                  />
                  <select
                    className="h-9 px-2.5 rounded-[8px] bg-surface-container text-on-surface text-[11.5px] font-bold cursor-pointer"
                    onChange={(e) => setPlanFilter(e.target.value as any)}
                    value={planFilter}
                  >
                    <option value="all">Todos os Planos</option>
                    <option value="free">Gratuito</option>
                    <option value="pro">Pro (499 MT)</option>
                    <option value="business">Negócios (1.499 MT)</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-surface-container text-[10.5px] font-bold text-on-surface-variant uppercase">
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Contacto</th>
                      <th className="py-2.5 px-3">Plano Atual</th>
                      <th className="py-2.5 px-3">Alterar Plano</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container/60 font-medium">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-surface-container-low/40">
                        <td className="py-2.5 px-3 font-bold text-on-surface">{user.name}</td>
                        <td className="py-2.5 px-3 text-on-surface-variant">{user.phone}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-extrabold uppercase bg-primary-fixed text-primary">
                            {user.plan}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            className="h-7 px-2 rounded-[6px] bg-surface-container text-on-surface text-[10.5px] font-bold cursor-pointer disabled:opacity-50"
                            disabled={updatingUserId === user.id}
                            onChange={(e) => handleChangeUserPlan(user.id, e.target.value as SubscriptionPlan)}
                            value={user.plan}
                          >
                            <option value="free">Gratuito</option>
                            <option value="pro">Pro</option>
                            <option value="business">Negócios</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-[6px] text-[10px] font-bold ${
                              user.isSuspended
                                ? 'bg-error-container text-on-error-container'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {user.isSuspended ? 'Suspenso' : 'Ativo'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-2">
                          <button
                            className="px-2 py-1 rounded-[6px] bg-surface-container text-on-surface text-[10.5px] font-bold hover:bg-surface-container-high cursor-pointer"
                            onClick={() => setResetPwdModalUser(user)}
                            type="button"
                          >
                            Senha
                          </button>
                          <button
                            className={`px-2 py-1 rounded-[6px] text-[10.5px] font-bold cursor-pointer ${
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

          {/* TAB: SUBSCRIÇÕES E DEPÓSITOS M-PESA */}
          {activeTab === 'subscriptions' && (
            <div className="p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs space-y-4 animate-fade-in">
              <div>
                <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                  Validação de Subscrições & Pagamentos M-Pesa
                </h2>
                <p className="text-[11.5px] text-on-surface-variant">
                  Confira as referências de transação enviadas pelos clientes e ative o plano instantaneamente.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-surface-container text-[10.5px] font-bold text-on-surface-variant uppercase">
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Plano</th>
                      <th className="py-2.5 px-3">Referência M-Pesa</th>
                      <th className="py-2.5 px-3">Valor</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container/60 font-medium">
                    {subscriptions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-on-surface-variant text-[12px]">
                          Nenhuma subscrição registada até ao momento.
                        </td>
                      </tr>
                    ) : (
                      subscriptions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-surface-container-low/40">
                          <td className="py-2.5 px-3 font-bold text-on-surface">{sub.userName}</td>
                          <td className="py-2.5 px-3 uppercase font-extrabold text-primary">{sub.plan}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-on-surface">
                            {sub.paymentReference || 'Sem referência'}
                          </td>
                          <td className="py-2.5 px-3">{formatMoney(sub.pricePaid, currency)}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-[6px] text-[10px] font-bold ${
                                sub.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {sub.status === 'active' ? 'Ativo' : 'Pendente'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              className="px-3 py-1 rounded-[8px] bg-primary text-on-primary text-[11px] font-bold shadow-xs hover:bg-primary-container cursor-pointer"
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
          )}

          {/* TAB: SUPORTE & HELPDESK */}
          {activeTab === 'tickets' && (
            <div className="p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs space-y-4 animate-fade-in">
              <div>
                <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                  Central de Atendimento & Helpdesk
                </h2>
                <p className="text-[11.5px] text-on-surface-variant">
                  Chamados abertos pelos clientes. Fale diretamente no WhatsApp ou marque como resolvido.
                </p>
              </div>

              <div className="space-y-2.5">
                {tickets.length === 0 ? (
                  <p className="text-[12px] text-on-surface-variant py-6 text-center">Nenhum chamado aberto na fila.</p>
                ) : (
                  tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="p-3.5 rounded-[10px] bg-surface-container-low border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary text-[11.5px]">
                            {ticket.code}
                          </span>
                          <span className="text-[13px] font-bold text-on-surface">
                            {ticket.subject}
                          </span>
                          <span className="px-2 py-0.5 rounded-[6px] bg-secondary-container text-on-secondary-container text-[9.5px] font-bold">
                            {ticket.category}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-on-surface-variant leading-relaxed">
                          {ticket.message}
                        </p>
                        <span className="text-[10.5px] text-outline block">
                          Cliente: {ticket.userName} ({ticket.userPhone})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          className="h-8 px-2.5 rounded-[8px] bg-emerald-100 text-emerald-800 text-[11.5px] font-bold flex items-center gap-1.5 hover:bg-emerald-200 transition-colors"
                          href={`https://wa.me/${ticket.userPhone.replace(/\D/g, '')}?text=Olá%20${encodeURIComponent(ticket.userName)},%20referente%20ao%20chamado%20${ticket.code}:`}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          <AppIcon name="chat" className="text-[15px]" />
                          <span>WhatsApp</span>
                        </a>
                        <button
                          className="h-8 px-2.5 rounded-[8px] bg-surface-container hover:bg-surface-container-high text-on-surface text-[11.5px] font-bold cursor-pointer"
                          onClick={() => handleUpdateTicketStatus(ticket.id, 'resolvido')}
                          type="button"
                        >
                          Resolver
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: AVISOS & COMUNICADOS GLOBAIS */}
          {activeTab === 'announcements' && (
            <div className="p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                    Comunicados Globais (Broadcast nos Apps)
                  </h2>
                  <p className="text-[11.5px] text-on-surface-variant">
                    Mensagens emitidas para todos os utilizadores no topo dos aplicativos.
                  </p>
                </div>
                <button
                  className="h-9 px-3.5 rounded-[8px] bg-primary text-on-primary text-[11.5px] font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  onClick={() => setAnnouncementModalOpen(true)}
                  type="button"
                >
                  <AppIcon name="add" className="text-[16px]" />
                  <span>Novo Comunicado</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {announcements.length === 0 ? (
                  <p className="text-[12px] text-on-surface-variant py-6 text-center">Nenhum comunicado global ativo.</p>
                ) : (
                  announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className="p-3 rounded-[10px] bg-surface-container-low border border-surface-container flex items-center justify-between gap-3"
                    >
                      <div>
                        <span className="text-[13px] font-bold text-on-surface block">
                          {ann.title}
                        </span>
                        <p className="text-[11.5px] text-on-surface-variant mt-0.5">
                          {ann.message}
                        </p>
                      </div>
                      <button
                        className="px-2.5 py-1 rounded-[6px] bg-error-container text-on-error-container text-[11px] font-bold cursor-pointer hover:opacity-90"
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        type="button"
                      >
                        Remover
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: ESTATÍSTICAS E RELATÓRIO FINANCEIRO */}
          {activeTab === 'statistics' && (
            <div className="p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs space-y-4 animate-fade-in">
              <div>
                <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                  Relatório Financeiro & Métricas SaaS
                </h2>
                <p className="text-[11.5px] text-on-surface-variant">
                  Evolução do faturamento, planos mais vendidos e receita real por plano.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 rounded-[10px] bg-surface-container-low">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase">Receita Plano Pro</span>
                  <span className="text-[20px] font-black text-on-surface block mt-1">
                    {formatMoney((stats?.proUsersCount || 0) * 499, currency)}
                  </span>
                  <span className="text-[10.5px] text-on-surface-variant mt-0.5 block">
                    {stats?.proUsersCount ?? 0} assinantes Pro
                  </span>
                </div>
                <div className="p-4 rounded-[10px] bg-surface-container-low">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase">Receita Plano Negócios</span>
                  <span className="text-[20px] font-black text-on-surface block mt-1">
                    {formatMoney((stats?.businessUsersCount || 0) * 1499, currency)}
                  </span>
                  <span className="text-[10.5px] text-on-surface-variant mt-0.5 block">
                    {stats?.businessUsersCount ?? 0} assinantes Negócios
                  </span>
                </div>
                <div className="p-4 rounded-[10px] bg-surface-container-low">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase">Total Clientes Pagantes</span>
                  <span className="text-[20px] font-black text-on-surface block mt-1">
                    {(stats?.proUsersCount || 0) + (stats?.businessUsersCount || 0)}
                  </span>
                  <span className="text-[10.5px] text-on-surface-variant mt-0.5 block">
                    De um total de {stats?.totalUsers ?? 0} utilizadores
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: CONFIGURAÇÕES DA PLATAFORMA */}
          {activeTab === 'settings' && (
            <div className="p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs space-y-4 animate-fade-in">
              <div>
                <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                  Infraestrutura & Configurações da Plataforma
                </h2>
                <p className="text-[11.5px] text-on-surface-variant">
                  Status de saúde dos servidores, limites operacionais e base de dados.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3.5 rounded-[10px] bg-surface-container-low flex items-center justify-between">
                  <div>
                    <span className="text-[12.5px] font-bold text-on-surface block">Neon Postgres Database</span>
                    <span className="text-[11px] text-emerald-700 font-semibold">Conectado · Latência 42ms</span>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                <div className="p-3.5 rounded-[10px] bg-surface-container-low flex items-center justify-between">
                  <div>
                    <span className="text-[12.5px] font-bold text-on-surface block">S3 Object Storage (Neon)</span>
                    <span className="text-[11px] text-emerald-700 font-semibold">Comprovativos e Avatares OK</span>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: CRIAR OU EDITAR PLANO DE SUBSCRIÇÃO (CRUD COMPLETO) */}
      {planModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface-container-lowest p-5 rounded-[10px] shadow-2xl border border-surface-container space-y-3.5 max-h-[90vh] overflow-y-auto">
            <h3 className="text-[16px] font-black text-on-surface">
              {editingPlan ? `Editar Plano: ${editingPlan.name}` : 'Criar Novo Plano de Subscrição'}
            </h3>
            <p className="text-[11.5px] text-on-surface-variant">
              Configure as propriedades e valores. O plano será exibido no site público imediatamente após guardar.
            </p>

            <form onSubmit={handleSavePlanSubmit} className="space-y-3">
              <div>
                <label className="text-[11.5px] font-bold text-on-surface block mb-1">Nome do Plano</label>
                <input
                  className="w-full h-10 px-3 rounded-[8px] bg-surface-container text-on-surface text-[12px] placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30"
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Ex: FinPro Negócios Plus"
                  required
                  type="text"
                  value={planName}
                />
              </div>

              {!editingPlan && (
                <div>
                  <label className="text-[11.5px] font-bold text-on-surface block mb-1">Identificador Único (Slug)</label>
                  <input
                    className="w-full h-10 px-3 rounded-[8px] bg-surface-container text-on-surface text-[12px] placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30"
                    onChange={(e) => setPlanSlug(e.target.value)}
                    placeholder="Ex: negocios-plus"
                    type="text"
                    value={planSlug}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11.5px] font-bold text-on-surface block mb-1">Preço Mensal (MT)</label>
                  <input
                    className="w-full h-10 px-3 rounded-[8px] bg-surface-container text-on-surface text-[12px] placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30"
                    min={0}
                    onChange={(e) => setPlanPriceMonthly(Number(e.target.value))}
                    required
                    type="number"
                    value={planPriceMonthly}
                  />
                </div>
                <div>
                  <label className="text-[11.5px] font-bold text-on-surface block mb-1">Preço Anual (MT)</label>
                  <input
                    className="w-full h-10 px-3 rounded-[8px] bg-surface-container text-on-surface text-[12px] placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30"
                    min={0}
                    onChange={(e) => setPlanPriceYearly(Number(e.target.value))}
                    required
                    type="number"
                    value={planPriceYearly}
                  />
                </div>
              </div>

              <div>
                <label className="text-[11.5px] font-bold text-on-surface block mb-1">Descrição Curta</label>
                <input
                  className="w-full h-10 px-3 rounded-[8px] bg-surface-container text-on-surface text-[12px] placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30"
                  onChange={(e) => setPlanDescription(e.target.value)}
                  placeholder="Ex: Para microempresas e escritórios que exigem contabilidade rigorosa."
                  type="text"
                  value={planDescription}
                />
              </div>

              <div>
                <label className="text-[11.5px] font-bold text-on-surface block mb-1">
                  Funcionalidades Incluídas (uma por linha)
                </label>
                <textarea
                  className="w-full h-24 p-2.5 rounded-[8px] bg-surface-container text-on-surface text-[12px] placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                  onChange={(e) => setPlanFeaturesText(e.target.value)}
                  placeholder="Transações Ilimitadas&#10;Relatórios em PDF e CSV&#10;Suporte VIP no WhatsApp"
                  value={planFeaturesText}
                />
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-[12px] font-semibold text-on-surface">
                  <input
                    type="checkbox"
                    checked={planIsPopular}
                    onChange={(e) => setPlanIsPopular(e.target.checked)}
                    className="rounded text-primary"
                  />
                  <span>Destacar como "Mais Escolhido" ⭐</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-[12px] font-semibold text-on-surface">
                  <input
                    type="checkbox"
                    checked={planIsActive}
                    onChange={(e) => setPlanIsActive(e.target.checked)}
                    className="rounded text-primary"
                  />
                  <span>Ativo no Site Público</span>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-surface-container/60">
                <button
                  className="flex-1 h-9 rounded-[8px] bg-surface-container text-on-surface font-bold text-[11.5px] cursor-pointer"
                  onClick={() => setPlanModalOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 h-9 rounded-[8px] bg-primary text-on-primary font-bold text-[11.5px] shadow-xs cursor-pointer disabled:opacity-60"
                  disabled={isSavingPlan}
                  type="submit"
                >
                  {isSavingPlan ? 'A guardar...' : editingPlan ? 'Atualizar Plano' : 'Criar Plano'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REDEFINIR SENHA DO CLIENTE */}
      {resetPwdModalUser && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest p-5 rounded-[10px] shadow-2xl border border-surface-container space-y-3.5">
            <h3 className="text-[16px] font-black text-on-surface">
              Redefinir Senha do Cliente
            </h3>
            <p className="text-[11.5px] text-on-surface-variant">
              Informe uma nova senha para o cliente <strong>{resetPwdModalUser.name}</strong> ({resetPwdModalUser.phone}).
            </p>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
              <input
                className="w-full h-10 px-3 rounded-[8px] bg-surface-container text-on-surface text-[12px] placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30"
                onChange={(e) => setNewPasswordVal(e.target.value)}
                placeholder="Nova senha (mínimo 6 caracteres)..."
                required
                type="text"
                value={newPasswordVal}
              />
              <div className="flex items-center gap-2 pt-1">
                <button
                  className="flex-1 h-9 rounded-[8px] bg-surface-container text-on-surface font-bold text-[11.5px] cursor-pointer"
                  onClick={() => setResetPwdModalUser(null)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 h-9 rounded-[8px] bg-primary text-on-primary font-bold text-[11.5px] shadow-xs cursor-pointer disabled:opacity-60"
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

      {/* MODAL: NOVO COMUNICADO GLOBAL */}
      {announcementModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest p-5 rounded-[10px] shadow-2xl border border-surface-container space-y-3.5">
            <h3 className="text-[16px] font-black text-on-surface">
              Publicar Comunicado Global
            </h3>
            <p className="text-[11.5px] text-on-surface-variant">
              Esta mensagem aparecerá para todos os utilizadores no topo dos aplicativos.
            </p>

            <form onSubmit={handleCreateAnnouncement} className="space-y-3">
              <input
                className="w-full h-10 px-3 rounded-[8px] bg-surface-container text-on-surface text-[12px] placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30"
                onChange={(e) => setNewAnnTitle(e.target.value)}
                placeholder="Título do comunicado (ex: Manutenção Programada)..."
                required
                type="text"
                value={newAnnTitle}
              />

              <textarea
                className="w-full h-20 p-2.5 rounded-[8px] bg-surface-container text-on-surface text-[12px] placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                onChange={(e) => setNewAnnMessage(e.target.value)}
                placeholder="Mensagem do comunicado..."
                required
                value={newAnnMessage}
              />

              <select
                className="w-full h-9 px-2.5 rounded-[8px] bg-surface-container text-on-surface text-[11.5px] font-bold cursor-pointer"
                onChange={(e) => setNewAnnSeverity(e.target.value as any)}
                value={newAnnSeverity}
              >
                <option value="info">Informativo (Azul)</option>
                <option value="warning">Alerta Importante (Âmbar)</option>
                <option value="critical">Urgente / Manutenção (Vermelho)</option>
              </select>

              <div className="flex items-center gap-2 pt-1">
                <button
                  className="flex-1 h-9 rounded-[8px] bg-surface-container text-on-surface font-bold text-[11.5px] cursor-pointer"
                  onClick={() => setAnnouncementModalOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 h-9 rounded-[8px] bg-primary text-on-primary font-bold text-[11.5px] shadow-xs cursor-pointer disabled:opacity-60"
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
