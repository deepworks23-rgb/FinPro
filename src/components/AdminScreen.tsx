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

// Ordem estrita solicitada: Painel Geral, Clientes, Subscrições, Financeiro, Relatórios, Comunicados, Suporte, Configurações
type AdminTab =
  | 'dashboard'
  | 'users'
  | 'subscriptions'
  | 'financial'
  | 'reports'
  | 'announcements'
  | 'support'
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
  const [isLiveSyncing, setIsLiveSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtros & Pesquisa
  const [userSearch, setUserSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | SubscriptionPlan>('all');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  // Filtros de Subscrição
  const [subStatusFilter, setSubStatusFilter] = useState<'all' | 'pending_approval' | 'trialing' | 'active' | 'past_due'>('all');

  // Filtros de Suporte
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'aberto' | 'resolvido'>('all');
  const [ticketSearch, setTicketSearch] = useState('');

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

  // Sub-abas de Configurações
  const [settingsSubTab, setSettingsSubTab] = useState<'plans' | 'users' | 'infra'>('plans');

  // Modal de Criar Administrador
  const [createAdminModalOpen, setCreateAdminModalOpen] = useState(false);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);

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

  // Carregamento de Dados 100% Reais com suporte a sincronização silenciosa em tempo real
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsLiveSyncing(true);
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
      setIsLiveSyncing(false);
    }
  };

  // Sincronização em tempo real (Polling a cada 6 segundos e ao focar a janela)
  useEffect(() => {
    void loadData(false);

    const intervalId = window.setInterval(() => {
      void loadData(true);
    }, 6000);

    const onFocus = () => void loadData(true);
    window.addEventListener('focus', onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
    };
  }, [authToken]);

  // Taxa de Conversão Real
  const conversionRate = useMemo(() => {
    if (!stats || stats.totalUsers === 0) return 0;
    const paid = (stats.proUsersCount || 0) + (stats.businessUsersCount || 0);
    return Math.round((paid / stats.totalUsers) * 100);
  }, [stats]);

  // ARPU Real (Ticket Médio por Cliente Pagante)
  const arpuReal = useMemo(() => {
    const paidCount = (stats?.proUsersCount || 0) + (stats?.businessUsersCount || 0);
    if (!stats || paidCount === 0) return 0;
    return Math.round((stats.mrrMzn || 0) / paidCount);
  }, [stats]);

  // Exportação Real de Relatórios em CSV
  const handleExportUsersCSV = () => {
    const clientsOnly = users.filter((u) => !u.isAdmin);
    if (clientsOnly.length === 0) {
      onNotify('Não existem registos de clientes para exportar.');
      return;
    }
    const headers = ['Nome', 'Telefone', 'Email', 'Plano Atual', 'Estado da Conta', 'Data de Registo', 'Referencia Pagamento'];
    const rows = clientsOnly.map((u) => [
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

  const handleExportFinancialCSV = () => {
    if (subscriptions.length === 0) {
      onNotify('Não existem transações de subscrições para exportar.');
      return;
    }
    const headers = ['ID Subscrição', 'Cliente', 'Telefone', 'Plano', 'Valor Pago (MT)', 'Ciclo', 'Referência M-Pesa', 'Estado', 'Data Início'];
    const rows = subscriptions.map((s) => [
      `"${s.id}"`,
      `"${s.userName.replace(/"/g, '""')}"`,
      `"${s.userPhone}"`,
      `"${s.plan.toUpperCase()}"`,
      `"${s.pricePaid}"`,
      `"${s.billingCycle === 'yearly' ? 'Anual' : 'Mensal'}"`,
      `"${s.paymentReference || ''}"`,
      `"${s.status === 'active' ? 'Ativo' : 'Pendente'}"`,
      `"${s.startedAt ? new Date(s.startedAt).toLocaleDateString('pt-MZ') : ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-financeiro-fintrack-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('Relatório financeiro exportado com sucesso!');
  };

  const handleExportTicketsCSV = () => {
    if (tickets.length === 0) {
      onNotify('Não existem chamados de suporte para exportar.');
      return;
    }
    const headers = ['Protocolo', 'Cliente', 'Telefone', 'Assunto', 'Categoria', 'Canal', 'Mensagem', 'Estado', 'Data Abertura'];
    const rows = tickets.map((t) => [
      `"${t.code}"`,
      `"${t.userName.replace(/"/g, '""')}"`,
      `"${t.userPhone}"`,
      `"${t.subject.replace(/"/g, '""')}"`,
      `"${t.category}"`,
      `"${t.contactChannel}"`,
      `"${t.message.replace(/"/g, '""')}"`,
      `"${t.status.toUpperCase()}"`,
      `"${t.createdAt ? new Date(t.createdAt).toLocaleDateString('pt-MZ') : ''}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-suporte-fintrack-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('Relatório de suporte exportado com sucesso!');
  };

  // Ações de Clientes
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
      void loadData(true);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao atualizar plano.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminName || !newAdminPhone || newAdminPassword.length < 6) {
      onNotify('Preencha o nome, telefone e uma senha de no mínimo 6 caracteres.');
      return;
    }
    try {
      setCreatingAdmin(true);
      const res = await adminApi.createAdmin(authToken, {
        name: newAdminName.trim(),
        phone: newAdminPhone.trim(),
        email: newAdminEmail.trim() || undefined,
        password: newAdminPassword.trim(),
      });
      onNotify(res.message);
      setCreateAdminModalOpen(false);
      setNewAdminName('');
      setNewAdminPhone('');
      setNewAdminEmail('');
      setNewAdminPassword('');
      void loadData(true);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao criar administrador.');
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleApproveSubscription = async (sub: AdminSubscriptionItem) => {
    try {
      const planToApprove = sub.plan === 'business' ? 'business' : 'pro';
      const targetUserId = sub.userId || sub.id;
      const res = await adminApi.approveSubscription(
        authToken,
        targetUserId,
        planToApprove,
        sub.billingCycle === 'yearly' ? 'yearly' : 'monthly'
      );
      onNotify(res.message);
      void loadData(true);
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
      void loadData(true);
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
      void loadData(true);
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
      void loadData(true);
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

  // Administradores do Sistema (Geridos em Configurações -> Utilizadores)
  const adminUsers = useMemo(() => {
    return users.filter((u) => u.isAdmin);
  }, [users]);

  // Filtros de Clientes (Administradores são geridos exclusivamente em Configurações -> Utilizadores)
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (u.isAdmin) return false;
      const matchesSearch =
        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.phone.includes(userSearch) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.paymentReference.toLowerCase().includes(userSearch.toLowerCase());
      const matchesPlan = planFilter === 'all' || u.plan === planFilter;
      const matchesStatus =
        userStatusFilter === 'all' ||
        (userStatusFilter === 'active' && !u.isSuspended) ||
        (userStatusFilter === 'suspended' && u.isSuspended);
      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [users, userSearch, planFilter, userStatusFilter]);

  // Filtros de Subscrições
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((s) => {
      if (subStatusFilter === 'all') return true;
      if (subStatusFilter === 'pending_approval') return s.status === 'pending_approval';
      if (subStatusFilter === 'trialing') return s.status === 'trialing';
      if (subStatusFilter === 'active') return s.status === 'active';
      return s.status === 'past_due' || s.status === 'canceled';
    });
  }, [subscriptions, subStatusFilter]);

  // Filtros de Suporte
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchesSearch =
        t.code.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        t.userName.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        t.userPhone.includes(ticketSearch) ||
        t.subject.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        t.message.toLowerCase().includes(ticketSearch.toLowerCase());
      const matchesStatus =
        ticketStatusFilter === 'all' || t.status === ticketStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [tickets, ticketSearch, ticketStatusFilter]);

  // Gráfico com Faturamento Semanal Real
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

  const adminName = currentUser?.name || 'Joswil Admin';
  const adminInitials = getUserInitials(adminName);

  return (
    <div className="h-screen w-full bg-surface-container-low/40 flex text-on-surface overflow-hidden">
      {/* 1. BARRA LATERAL ESQUERDA (Ordem Estrita: Painel Geral, Clientes, Subscrições, Financeiro, Relatórios, Comunicados, Suporte, Configurações) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 lg:w-64 bg-surface-container-lowest border-r border-surface-container flex flex-col justify-between transition-transform duration-200 md:static md:translate-x-0 h-screen shrink-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logotipo e Badge */}
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
                  Painel Admin
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

          {/* Menus de Navegação Estruturados Conforme Solicitado */}
          <nav className="p-3 space-y-1 flex-1 overflow-y-auto no-scrollbar">
            {/* 1. Painel Geral */}
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
              <span>Painel Geral</span>
            </button>

            {/* 2. Clientes */}
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
              <span className="flex-1">Clientes</span>
              <span className="text-[10.5px] font-bold opacity-80">{users.filter((u) => !u.isAdmin).length}</span>
            </button>

            {/* 3. Subscrições */}
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
              <span className="flex-1">Subscrições</span>
              {subscriptions.filter((s) => s.status === 'pending_approval' || (s.status === 'trialing' && s.plan !== 'free')).length > 0 && (
                <span className="px-1.5 py-0.5 rounded-[6px] bg-amber-200 text-amber-950 text-[9.5px] font-black animate-pulse">
                  {subscriptions.filter((s) => s.status === 'pending_approval' || (s.status === 'trialing' && s.plan !== 'free')).length}
                </span>
              )}
            </button>

            {/* 4. Financeiro */}
            <button
              className={`w-full h-10 px-3.5 rounded-[10px] flex items-center gap-3 text-[13px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'financial'
                  ? 'bg-primary text-on-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('financial');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="monetization_on" className="text-[19px]" filled={activeTab === 'financial'} />
              <span>Financeiro</span>
            </button>

            {/* 5. Relatórios */}
            <button
              className={`w-full h-10 px-3.5 rounded-[10px] flex items-center gap-3 text-[13px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-primary text-on-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('reports');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="analytics" className="text-[19px]" filled={activeTab === 'reports'} />
              <span>Relatórios</span>
            </button>

            {/* 6. Comunicados */}
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
              <span>Comunicados</span>
            </button>

            {/* 7. Suporte */}
            <button
              className={`w-full h-10 px-3.5 rounded-[10px] flex items-center gap-3 text-[13px] font-semibold transition-all text-left cursor-pointer ${
                activeTab === 'support'
                  ? 'bg-primary text-on-primary shadow-xs font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => {
                setActiveTab('support');
                setMobileMenuOpen(false);
              }}
              type="button"
            >
              <AppIcon name="support_agent" className="text-[19px]" filled={activeTab === 'support'} />
              <span className="flex-1">Suporte</span>
              {tickets.filter((t) => t.status === 'aberto').length > 0 && (
                <span className="px-1.5 py-0.5 rounded-[6px] bg-error-container text-on-error-container text-[9.5px] font-bold">
                  {tickets.filter((t) => t.status === 'aberto').length}
                </span>
              )}
            </button>

            {/* 8. Configurações */}
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

        {/* Rodapé: Perfil e Terminar Sessão */}
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

      {/* Backdrop Mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-inverse-surface/40 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* 2. ÁREA CENTRAL DE CONTEÚDO (100% Largura com Scroll Interno) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-surface-container-low/20">
        {/* Cabeçalho Fixo */}
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
              <div className="flex items-center gap-2">
                <h1 className="text-[18px] sm:text-[20px] font-black text-on-surface tracking-tight leading-tight">
                  {activeTab === 'dashboard'
                    ? 'Painel Geral'
                    : activeTab === 'users'
                      ? 'Gestão de Clientes'
                      : activeTab === 'subscriptions'
                        ? 'Gestão de Subscrições'
                        : activeTab === 'financial'
                          ? 'Gestão Financeira SaaS'
                          : activeTab === 'reports'
                            ? 'Central de Relatórios'
                            : activeTab === 'announcements'
                              ? 'Avisos & Comunicados'
                              : activeTab === 'support'
                                ? 'Central de Suporte & Atendimento'
                                : 'Configurações da Plataforma'}
                </h1>
                {/* Indicador de Tempo Real */}
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${isLiveSyncing ? 'animate-ping' : 'animate-pulse'}`} />
                  <span>Em tempo real</span>
                </span>
              </div>
              <span className="text-[11px] font-medium text-on-surface-variant block leading-tight mt-0.5">
                FinTrack Backoffice Master · Maputo
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            {onNavigateToLanding && (
              <button
                className="h-9 px-3 rounded-[10px] bg-surface-container hover:bg-surface-container-high text-on-surface text-[11.5px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer hidden sm:flex"
                onClick={onNavigateToLanding}
                title="Abrir Site Público"
                type="button"
              >
                <AppIcon name="public" className="text-[16px] text-primary" />
                <span>Site Público</span>
              </button>
            )}

            <button
              className="w-9 h-9 rounded-[10px] bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-colors cursor-pointer"
              onClick={() => void loadData(false)}
              title="Atualizar Dados Agora"
              type="button"
            >
              <AppIcon name="refresh" className={`text-[18px] ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Avatar Admin */}
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

        {errorMsg && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-[10px] bg-error-container text-on-error-container text-[12px] font-medium flex items-center gap-2 shrink-0">
            <AppIcon name="error" className="text-[17px] shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 3. CONTEÚDO COM SCROLL INTERNO (Cada Aba 100% Funcional e Não-Vazia) */}
        <main className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto w-full">
          {/* TAB 1: PAINEL GERAL */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4 animate-fade-in w-full">
              {/* KPIs Superiores Reais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[8px] bg-primary-fixed/50 text-primary text-[10.5px] font-bold">
                      <AppIcon name="monetization_on" className="text-[13px]" />
                      <span>Faturamento Mensal</span>
                    </span>
                    <span className="text-[10.5px] font-bold text-primary">MRR</span>
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

                <div className="p-4 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[8px] bg-secondary-container/50 text-on-secondary-container text-[10.5px] font-bold">
                      <AppIcon name="trending_up" className="text-[13px]" />
                      <span>Previsão Anual</span>
                    </span>
                    <span className="text-[10.5px] font-bold text-on-surface-variant">ARR</span>
                  </div>
                  <div className="mt-2.5">
                    <span className="text-[22px] lg:text-[24px] font-black text-on-surface tracking-tight block">
                      {formatMoney((stats?.mrrMzn ?? 0) * 12, currency)}
                    </span>
                    <span className="text-[11.5px] font-medium text-on-surface-variant mt-0.5 block">
                      Run Rate Anualizado
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[8px] bg-tertiary-container/50 text-on-tertiary-container text-[10.5px] font-bold">
                      <AppIcon name="pie_chart" className="text-[13px]" />
                      <span>Conversão</span>
                    </span>
                    <span className="text-[10.5px] font-bold text-secondary">
                      {conversionRate}%
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

                <div className="p-4 rounded-[10px] bg-primary text-on-primary shadow-md shadow-primary/25 flex flex-col justify-between relative overflow-hidden">
                  <div className="relative z-10">
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-on-primary/80 block">
                      Estado Operacional
                    </span>
                    <span className="text-[20px] lg:text-[22px] font-black tracking-tight mt-0.5 block">
                      {subscriptions.filter((s) => s.status === 'active').length} Ativas
                    </span>
                    <p className="text-[11px] text-on-primary/85 mt-1 leading-snug">
                      {subscriptions.filter((s) => s.status === 'trialing').length} subscrições pendentes de validação.
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
                      Tempo Real
                    </span>
                  </div>
                </div>
              </div>

              {/* Linha Central: Gráfico Semanal Real + Distribuição + Alerta de Suporte */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                <div className="lg:col-span-6 p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-[16px] font-black text-on-surface tracking-tight">
                        Faturamento Semanal Real
                      </h2>
                      <span className="text-[11.5px] font-medium text-on-surface-variant">
                        Pagamentos reais confirmados na base de dados
                      </span>
                    </div>
                    <button
                      className="px-3 py-1 rounded-[8px] bg-surface-container hover:bg-surface-container-high text-on-surface text-[11.5px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      onClick={handleExportFinancialCSV}
                      type="button"
                    >
                      <AppIcon name="download" className="text-[15px]" />
                      <span>Exportar CSV</span>
                    </button>
                  </div>

                  <div className="mt-4">
                    <div className="h-36 flex items-end justify-between gap-2.5 px-2 border-b border-surface-container">
                      {chartBars.map((bar) => {
                        const heightPct = bar.val > 0 ? Math.max(Math.round((bar.val / maxBarVal) * 100), 15) : 4;
                        return (
                          <div key={bar.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                            <span className="text-[9.5px] font-bold text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">
                              {bar.val > 0 ? formatMoney(bar.val, currency) : '0 MT'}
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

                <div className="lg:col-span-3 p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col justify-between">
                  <div>
                    <h2 className="text-[16px] font-black text-on-surface tracking-tight">
                      Distribuição de Planos
                    </h2>
                    <span className="text-[11.5px] font-medium text-on-surface-variant">
                      Clientes por modalidade
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
                              Pro & Negócios
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
                              Gratuito
                            </span>
                            <span className="text-[10.5px] text-on-surface-variant leading-tight">
                              {stats?.freeUsersCount ?? 0} Contas Free
                            </span>
                          </div>
                        </div>
                        <AppIcon name="chevron_right" className="text-[16px] text-on-surface-variant" />
                      </div>
                    </div>
                  </div>

                  <button
                    className="text-[11px] font-bold text-primary mt-3 flex items-center gap-1 hover:underline cursor-pointer"
                    onClick={() => setActiveTab('settings')}
                    type="button"
                  >
                    <span>Configurar Planos & Preços</span>
                    <AppIcon name="arrow_forward" className="text-[13px]" />
                  </button>
                </div>

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
                    onClick={() => setActiveTab('support')}
                    type="button"
                  >
                    <AppIcon name="headset_mic" className="text-[16px] text-primary" />
                    <span>Ver Fila de Atendimento</span>
                  </button>
                </div>
              </div>

              {/* Linha Inferior: Subscrições Recentes & Membros Recentes */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                <div className="lg:col-span-8 p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-[16px] font-black text-on-surface tracking-tight">
                        Últimas Subscrições Submetidas
                      </h2>
                      <span className="text-[11.5px] font-medium text-on-surface-variant">
                        Clientes aguardando ativação ou recentemente aprovados
                      </span>
                    </div>

                    <button
                      className="h-8 px-3 rounded-[8px] bg-primary text-on-primary text-[11.5px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                      onClick={() => setActiveTab('subscriptions')}
                      type="button"
                    >
                      <span>Ver Todas ({subscriptions.length})</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left text-[12.5px]">
                      <thead>
                        <tr className="border-b border-surface-container text-[10.5px] font-bold text-on-surface-variant uppercase tracking-wider">
                          <th className="py-2.5 px-3">Cliente</th>
                          <th className="py-2.5 px-3">Plano</th>
                          <th className="py-2.5 px-3">Referência M-Pesa</th>
                          <th className="py-2.5 px-3">Estado</th>
                          <th className="py-2.5 px-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container/60 font-medium">
                        {subscriptions.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-on-surface-variant text-[12px]">
                              Nenhuma subscrição registada.
                            </td>
                          </tr>
                        ) : (
                          subscriptions.slice(0, 5).map((sub) => (
                            <tr key={sub.id} className="hover:bg-surface-container-low/40 transition-colors">
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-on-surface block">{sub.userName}</span>
                                <span className="text-[11px] text-on-surface-variant block">{sub.userPhone}</span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-extrabold uppercase bg-primary-fixed text-primary">
                                  {sub.plan}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-on-surface">
                                {sub.paymentReference || 'Sem referência'}
                              </td>
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
                                {sub.status !== 'active' ? (
                                  <button
                                    className="px-2.5 py-1 rounded-[6px] bg-primary text-on-primary text-[11px] font-bold cursor-pointer hover:bg-primary-container"
                                    onClick={() => handleApproveSubscription(sub)}
                                    type="button"
                                  >
                                    Aprovar
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-emerald-700 font-bold">Aprovado</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

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
                    className="w-full h-9 mt-3 rounded-[10px] bg-surface-container hover:bg-surface-container-high text-on-surface text-[11.5px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    onClick={() => setActiveTab('users')}
                    type="button"
                  >
                    <AppIcon name="group" className="text-[16px]" />
                    <span>Ver Todos os Clientes</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CLIENTES */}
          {activeTab === 'users' && (
            <div className="p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                    Gestão Completa de Clientes
                  </h2>
                  <p className="text-[11.5px] text-on-surface-variant">
                    Consulte clientes em tempo real, altere planos, suspenda contas ou inicie suporte via WhatsApp.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    className="h-9 px-3 rounded-[8px] bg-surface-container hover:bg-surface-container-high text-on-surface text-[11.5px] font-bold flex items-center gap-1.5 cursor-pointer"
                    onClick={handleExportUsersCSV}
                    type="button"
                  >
                    <AppIcon name="download" className="text-[15px]" />
                    <span>Exportar Lista CSV</span>
                  </button>

                  <input
                    className="h-9 px-3 rounded-[8px] bg-surface-container text-on-surface text-[12px] placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30"
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Pesquisar cliente..."
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

                  <select
                    className="h-9 px-2.5 rounded-[8px] bg-surface-container text-on-surface text-[11.5px] font-bold cursor-pointer"
                    onChange={(e) => setUserStatusFilter(e.target.value as any)}
                    value={userStatusFilter}
                  >
                    <option value="all">Todos os Estados</option>
                    <option value="active">Apenas Ativos</option>
                    <option value="suspended">Apenas Suspensos</option>
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
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-on-surface-variant text-[12px]">
                          Nenhum cliente encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-surface-container-low/40">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-[8px] bg-primary-fixed text-primary font-bold text-[10.5px] flex items-center justify-center shrink-0">
                                {getUserInitials(user.name)}
                              </div>
                              <span className="font-bold text-on-surface">{user.name}</span>
                            </div>
                          </td>
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
                          <td className="py-2.5 px-3 text-right space-x-1.5">
                            <a
                              className="inline-flex items-center justify-center w-7 h-7 rounded-[6px] bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-colors align-middle"
                              href={`https://wa.me/${user.phone.replace(/\D/g, '')}?text=Olá%20${encodeURIComponent(user.name)},%20contacto%20do%20FinTrack.`}
                              rel="noopener noreferrer"
                              target="_blank"
                              title="Conversar no WhatsApp"
                            >
                              <AppIcon name="chat" className="text-[14px]" />
                            </a>
                            <button
                              className="px-2 py-1 rounded-[6px] bg-surface-container text-on-surface text-[10.5px] font-bold hover:bg-surface-container-high cursor-pointer align-middle"
                              onClick={() => setResetPwdModalUser(user)}
                              type="button"
                            >
                              Senha
                            </button>
                            <button
                              className={`px-2 py-1 rounded-[6px] text-[10.5px] font-bold cursor-pointer align-middle ${
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SUBSCRIÇÕES */}
          {activeTab === 'subscriptions' && (
            <div className="p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                    Gestão de Subscrições & Ativação M-Pesa
                  </h2>
                  <p className="text-[11.5px] text-on-surface-variant">
                    Valide códigos M-Pesa e ative instantaneamente o acesso dos clientes.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    className="h-9 px-2.5 rounded-[8px] bg-surface-container text-on-surface text-[11.5px] font-bold cursor-pointer"
                    onChange={(e) => setSubStatusFilter(e.target.value as any)}
                    value={subStatusFilter}
                  >
                    <option value="all">Todas as Subscrições</option>
                    <option value="pending_approval">Aprovação Pendente (M-Pesa)</option>
                    <option value="trialing">Em Período de Teste (7 Dias)</option>
                    <option value="active">Subscrições Ativas</option>
                    <option value="past_due">Expiradas / Bloqueadas</option>
                  </select>

                  <button
                    className="h-9 px-3 rounded-[8px] bg-surface-container hover:bg-surface-container-high text-on-surface text-[11.5px] font-bold flex items-center gap-1.5 cursor-pointer"
                    onClick={handleExportFinancialCSV}
                    type="button"
                  >
                    <AppIcon name="download" className="text-[15px]" />
                    <span>Exportar CSV</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12.5px]">
                  <thead>
                    <tr className="border-b border-surface-container text-[10.5px] font-bold text-on-surface-variant uppercase">
                      <th className="py-2.5 px-3">Cliente</th>
                      <th className="py-2.5 px-3">Plano</th>
                      <th className="py-2.5 px-3">Referência M-Pesa</th>
                      <th className="py-2.5 px-3">Valor</th>
                      <th className="py-2.5 px-3">Ciclo</th>
                      <th className="py-2.5 px-3">Estado</th>
                      <th className="py-2.5 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container/60 font-medium">
                    {filteredSubscriptions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-on-surface-variant text-[12px]">
                          Nenhuma subscrição encontrada neste filtro.
                        </td>
                      </tr>
                    ) : (
                      filteredSubscriptions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-surface-container-low/40">
                          <td className="py-2.5 px-3 font-bold text-on-surface">
                            <div>{sub.userName}</div>
                            <div className="text-[11px] text-on-surface-variant font-normal">{sub.userPhone}</div>
                          </td>
                          <td className="py-2.5 px-3 uppercase font-extrabold text-primary">{sub.plan}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-on-surface">
                            {sub.paymentReference || 'Sem referência'}
                          </td>
                          <td className="py-2.5 px-3 font-bold">{formatMoney(sub.pricePaid, currency)}</td>
                          <td className="py-2.5 px-3 text-[11.5px]">
                            {sub.billingCycle === 'yearly' ? 'Anual' : 'Mensal'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-[6px] text-[10px] font-bold ${
                                sub.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : sub.status === 'pending_approval'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse font-extrabold'
                                    : sub.status === 'trialing'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {sub.status === 'active'
                                ? 'Ativo'
                                : sub.status === 'pending_approval'
                                  ? 'Aprovação Pendente'
                                  : sub.status === 'trialing'
                                    ? 'Teste 7 Dias'
                                    : 'Expirado / Bloqueado'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {sub.status !== 'active' ? (
                              <button
                                className="px-3 py-1 rounded-[8px] bg-primary text-on-primary text-[11px] font-bold shadow-xs hover:bg-primary-container cursor-pointer"
                                onClick={() => handleApproveSubscription(sub)}
                                type="button"
                              >
                                Aprovar & Ativar
                              </button>
                            ) : (
                              <span className="text-[11px] text-emerald-700 font-bold">Ativa</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: FINANCEIRO */}
          {activeTab === 'financial' && (
            <div className="p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs space-y-5 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                    Gestão Financeira & Receitas SaaS
                  </h2>
                  <p className="text-[11.5px] text-on-surface-variant">
                    Métricas reais de faturação, ticket médio (ARPU) e projeções de fluxo de caixa recorrente.
                  </p>
                </div>
                <button
                  className="h-9 px-3 rounded-[8px] bg-primary text-on-primary text-[11.5px] font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  onClick={handleExportFinancialCSV}
                  type="button"
                >
                  <AppIcon name="download" className="text-[15px]" />
                  <span>Exportar Relatório Financeiro (CSV)</span>
                </button>
              </div>

              {/* Grid de KPIs Financeiros */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-[10px] bg-surface-container-low border border-surface-container">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase">Receita Mensal (MRR)</span>
                  <span className="text-[22px] font-black text-on-surface block mt-1">
                    {formatMoney(stats?.mrrMzn ?? 0, currency)}
                  </span>
                  <span className="text-[10.5px] text-emerald-700 font-semibold block mt-0.5">
                    Faturação recorrente ativa
                  </span>
                </div>

                <div className="p-4 rounded-[10px] bg-surface-container-low border border-surface-container">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase">Projeção Anual (ARR)</span>
                  <span className="text-[22px] font-black text-on-surface block mt-1">
                    {formatMoney((stats?.mrrMzn ?? 0) * 12, currency)}
                  </span>
                  <span className="text-[10.5px] text-on-surface-variant block mt-0.5">
                    12 meses projetados
                  </span>
                </div>

                <div className="p-4 rounded-[10px] bg-surface-container-low border border-surface-container">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase">Ticket Médio (ARPU)</span>
                  <span className="text-[22px] font-black text-on-surface block mt-1">
                    {formatMoney(arpuReal, currency)}
                  </span>
                  <span className="text-[10.5px] text-on-surface-variant block mt-0.5">
                    Por cliente pagante
                  </span>
                </div>

                <div className="p-4 rounded-[10px] bg-surface-container-low border border-surface-container">
                  <span className="text-[11px] font-bold text-on-surface-variant uppercase">Clientes Pagantes</span>
                  <span className="text-[22px] font-black text-on-surface block mt-1">
                    {(stats?.proUsersCount || 0) + (stats?.businessUsersCount || 0)}
                  </span>
                  <span className="text-[10.5px] text-primary font-semibold block mt-0.5">
                    {stats?.proUsersCount ?? 0} Pro · {stats?.businessUsersCount ?? 0} Negócios
                  </span>
                </div>
              </div>

              {/* Detalhamento de Receita por Plano */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-[10px] bg-surface-container-lowest border border-surface-container">
                  <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                    <span className="font-bold text-[13.5px] text-on-surface">Plano FinPro Pessoal</span>
                    <span className="text-[11px] font-bold text-primary">299 MT / mês</span>
                  </div>
                  <div className="mt-3 space-y-1.5 text-[12px]">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Assinantes Ativos:</span>
                      <span className="font-bold text-on-surface">{stats?.proUsersCount ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Faturamento Mensal:</span>
                      <span className="font-bold text-on-surface">{formatMoney((stats?.proUsersCount || 0) * 299, currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Faturamento Anualizado:</span>
                      <span className="font-bold text-on-surface">{formatMoney((stats?.proUsersCount || 0) * 299 * 12, currency)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-[10px] bg-surface-container-lowest border border-surface-container">
                  <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                    <span className="font-bold text-[13.5px] text-on-surface">Plano FinPro Negócios</span>
                    <span className="text-[11px] font-bold text-primary">799 MT / mês</span>
                  </div>
                  <div className="mt-3 space-y-1.5 text-[12px]">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Assinantes Ativos:</span>
                      <span className="font-bold text-on-surface">{stats?.businessUsersCount ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Faturamento Mensal:</span>
                      <span className="font-bold text-on-surface">{formatMoney((stats?.businessUsersCount || 0) * 799, currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Faturamento Anualizado:</span>
                      <span className="font-bold text-on-surface">{formatMoney((stats?.businessUsersCount || 0) * 799 * 12, currency)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: RELATÓRIOS */}
          {activeTab === 'reports' && (
            <div className="p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs space-y-5 animate-fade-in">
              <div>
                <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                  Central de Relatórios & Auditoria SaaS
                </h2>
                <p className="text-[11.5px] text-on-surface-variant">
                  Gere e descarregue relatórios consolidados em formato CSV para gestão contabilística e auditoria.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Relatório 1: Clientes */}
                <div className="p-4 rounded-[10px] bg-surface-container-low border border-surface-container flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="w-8 h-8 rounded-[8px] bg-primary text-on-primary flex items-center justify-center">
                      <AppIcon name="group" className="text-[17px]" />
                    </div>
                    <h3 className="text-[14px] font-bold text-on-surface pt-1">Relatório de Clientes</h3>
                    <p className="text-[11.5px] text-on-surface-variant">
                      Lista completa de utilizadores registados, contactos telefónicos, e-mails, planos e data de adesão.
                    </p>
                  </div>
                  <button
                    className="w-full h-9 mt-4 rounded-[8px] bg-primary text-on-primary text-[11.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    onClick={handleExportUsersCSV}
                    type="button"
                  >
                    <AppIcon name="download" className="text-[15px]" />
                    <span>Descarregar CSV de Clientes</span>
                  </button>
                </div>

                {/* Relatório 2: Financeiro */}
                <div className="p-4 rounded-[10px] bg-surface-container-low border border-surface-container flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="w-8 h-8 rounded-[8px] bg-secondary-container text-on-secondary-container flex items-center justify-center">
                      <AppIcon name="payments" className="text-[17px]" />
                    </div>
                    <h3 className="text-[14px] font-bold text-on-surface pt-1">Relatório Financeiro</h3>
                    <p className="text-[11.5px] text-on-surface-variant">
                      Extrato de todas as transações, referências M-Pesa/e-Mola validadas, planos ativados e montantes recebidos.
                    </p>
                  </div>
                  <button
                    className="w-full h-9 mt-4 rounded-[8px] bg-secondary text-on-secondary text-[11.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    onClick={handleExportFinancialCSV}
                    type="button"
                  >
                    <AppIcon name="download" className="text-[15px]" />
                    <span>Descarregar CSV Financeiro</span>
                  </button>
                </div>

                {/* Relatório 3: Suporte */}
                <div className="p-4 rounded-[10px] bg-surface-container-low border border-surface-container flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="w-8 h-8 rounded-[8px] bg-tertiary-container text-on-tertiary-container flex items-center justify-center">
                      <AppIcon name="support_agent" className="text-[17px]" />
                    </div>
                    <h3 className="text-[14px] font-bold text-on-surface pt-1">Relatório de Atendimento</h3>
                    <p className="text-[11.5px] text-on-surface-variant">
                      Histórico de chamados de suporte, protocolos emitidos, canais de contacto e estado de resolução.
                    </p>
                  </div>
                  <button
                    className="w-full h-9 mt-4 rounded-[8px] bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-[11.5px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    onClick={handleExportTicketsCSV}
                    type="button"
                  >
                    <AppIcon name="download" className="text-[15px]" />
                    <span>Descarregar CSV de Suporte</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: COMUNICADOS */}
          {activeTab === 'announcements' && (
            <div className="p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                    Avisos & Comunicados Globais (Broadcast)
                  </h2>
                  <p className="text-[11.5px] text-on-surface-variant">
                    Mensagens emitidas para todos os utilizadores no topo dos seus aplicativos em tempo real.
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
                      className="p-3.5 rounded-[10px] bg-surface-container-low border border-surface-container flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold text-on-surface block">
                            {ann.title}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded-[4px] text-[9.5px] font-bold uppercase ${
                              ann.severity === 'critical'
                                ? 'bg-error-container text-on-error-container'
                                : ann.severity === 'warning'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-primary-fixed text-primary'
                            }`}
                          >
                            {ann.severity}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-on-surface-variant">
                          {ann.message}
                        </p>
                        <span className="text-[10px] text-outline block">
                          Publicado em: {new Date(ann.createdAt).toLocaleString('pt-MZ')}
                        </span>
                      </div>
                      <button
                        className="px-2.5 py-1 rounded-[6px] bg-error-container text-on-error-container text-[11px] font-bold cursor-pointer hover:opacity-90 shrink-0"
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

          {/* TAB 7: SUPORTE & HELPDESK */}
          {activeTab === 'support' && (
            <div className="p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                    Central de Atendimento & Helpdesk em Tempo Real
                  </h2>
                  <p className="text-[11.5px] text-on-surface-variant">
                    Chamados enviados pelos clientes no aplicativo. Inicie conversa no WhatsApp com 1 clique ou resolva o chamado.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    className="h-9 px-3 rounded-[8px] bg-surface-container text-on-surface text-[12px] placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30"
                    onChange={(e) => setTicketSearch(e.target.value)}
                    placeholder="Pesquisar protocolo ou cliente..."
                    type="text"
                    value={ticketSearch}
                  />

                  <select
                    className="h-9 px-2.5 rounded-[8px] bg-surface-container text-on-surface text-[11.5px] font-bold cursor-pointer"
                    onChange={(e) => setTicketStatusFilter(e.target.value as any)}
                    value={ticketStatusFilter}
                  >
                    <option value="all">Todos os Chamados</option>
                    <option value="aberto">Apenas Abertos</option>
                    <option value="resolvido">Apenas Resolvidos</option>
                  </select>

                  <button
                    className="h-9 px-3 rounded-[8px] bg-surface-container hover:bg-surface-container-high text-on-surface text-[11.5px] font-bold flex items-center gap-1.5 cursor-pointer"
                    onClick={handleExportTicketsCSV}
                    type="button"
                  >
                    <AppIcon name="download" className="text-[15px]" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              {/* Contadores de Suporte */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-[10px] bg-surface-container-low border border-surface-container flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-on-surface-variant uppercase">Total de Chamados</span>
                    <span className="text-[20px] font-black text-on-surface block mt-0.5">{tickets.length}</span>
                  </div>
                  <AppIcon name="receipt" className="text-[22px] text-on-surface-variant" />
                </div>

                <div className="p-3 rounded-[10px] bg-error-container/20 border border-error-container/40 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-error uppercase">Abertos em Espera</span>
                    <span className="text-[20px] font-black text-error block mt-0.5">
                      {tickets.filter((t) => t.status === 'aberto').length}
                    </span>
                  </div>
                  <AppIcon name="hourglass_top" className="text-[22px] text-error" />
                </div>

                <div className="p-3 rounded-[10px] bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-emerald-800 uppercase">Resolvidos</span>
                    <span className="text-[20px] font-black text-emerald-800 block mt-0.5">
                      {tickets.filter((t) => t.status === 'resolvido').length}
                    </span>
                  </div>
                  <AppIcon name="check_circle" className="text-[22px] text-emerald-600" />
                </div>
              </div>

              <div className="space-y-2.5">
                {filteredTickets.length === 0 ? (
                  <p className="text-[12px] text-on-surface-variant py-6 text-center">Nenhum chamado encontrado com o filtro atual.</p>
                ) : (
                  filteredTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="p-3.5 rounded-[10px] bg-surface-container-low border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-primary text-[11.5px] px-1.5 py-0.5 rounded-[4px] bg-primary-fixed">
                            {ticket.code}
                          </span>
                          <span className="text-[13px] font-bold text-on-surface">
                            {ticket.subject}
                          </span>
                          <span className="px-2 py-0.5 rounded-[6px] bg-secondary-container text-on-secondary-container text-[9.5px] font-bold">
                            {ticket.category}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-[6px] text-[9.5px] font-bold ${
                              ticket.status === 'resolvido'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-error-container text-on-error-container'
                            }`}
                          >
                            {ticket.status === 'resolvido' ? 'Resolvido' : 'Em Aberto'}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-on-surface-variant leading-relaxed">
                          {ticket.message}
                        </p>
                        <span className="text-[10.5px] text-outline block">
                          Cliente: <strong>{ticket.userName}</strong> ({ticket.userPhone}) · Aberto em: {new Date(ticket.createdAt).toLocaleString('pt-MZ')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          className="h-8 px-2.5 rounded-[8px] bg-emerald-100 text-emerald-800 text-[11.5px] font-bold flex items-center gap-1.5 hover:bg-emerald-200 transition-colors"
                          href={`https://wa.me/${ticket.userPhone.replace(/\D/g, '')}?text=Olá%20${encodeURIComponent(ticket.userName)},%20suporte%20FinTrack%20sobre%20o%20chamado%20${ticket.code}:%20${encodeURIComponent(ticket.subject)}`}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          <AppIcon name="chat" className="text-[15px]" />
                          <span>Atender no WhatsApp</span>
                        </a>

                        {ticket.status !== 'resolvido' && (
                          <button
                            className="h-8 px-2.5 rounded-[8px] bg-surface-container hover:bg-surface-container-high text-on-surface text-[11.5px] font-bold cursor-pointer"
                            onClick={() => handleUpdateTicketStatus(ticket.id, 'resolvido')}
                            type="button"
                          >
                            Marcar Resolvido
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 8: CONFIGURAÇÕES (CRUD de Planos, Gestão de Utilizadores Administradores & Infraestrutura) */}
          {activeTab === 'settings' && (
            <div className="p-4 sm:p-5 rounded-[10px] bg-surface-container-lowest border border-surface-container shadow-xs space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-black text-on-surface tracking-tight">
                    Configurações do Sistema
                  </h2>
                  <p className="text-[11.5px] text-on-surface-variant">
                    Personalize os planos de subscrição, faça a gestão de administradores e confira a saúde dos servidores.
                  </p>
                </div>

                {settingsSubTab === 'plans' && (
                  <button
                    className="h-9 px-4 rounded-[8px] bg-primary text-on-primary text-[12px] font-bold flex items-center gap-1.5 shadow-xs cursor-pointer hover:bg-primary-container"
                    onClick={() => handleOpenPlanModal()}
                    type="button"
                  >
                    <AppIcon name="add" className="text-[16px]" />
                    <span>Novo Plano de Subscrição</span>
                  </button>
                )}

                {settingsSubTab === 'users' && (
                  <button
                    className="h-9 px-4 rounded-[8px] bg-primary text-on-primary text-[12px] font-bold flex items-center gap-1.5 shadow-xs cursor-pointer hover:bg-primary-container"
                    onClick={() => setCreateAdminModalOpen(true)}
                    type="button"
                  >
                    <AppIcon name="add" className="text-[16px]" />
                    <span>Novo Administrador</span>
                  </button>
                )}
              </div>

              {/* Sub-abas de Navegação */}
              <div className="flex items-center gap-1.5 p-1 bg-surface-container-low rounded-[10px] w-fit">
                <button
                  type="button"
                  onClick={() => setSettingsSubTab('plans')}
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-bold transition-all cursor-pointer ${
                    settingsSubTab === 'plans'
                      ? 'bg-surface-container-lowest text-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Planos de Subscrição ({plans.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsSubTab('users')}
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    settingsSubTab === 'users'
                      ? 'bg-surface-container-lowest text-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <AppIcon name="security" className="text-[15px]" />
                  <span>Utilizadores do Sistema ({adminUsers.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsSubTab('infra')}
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-bold transition-all cursor-pointer ${
                    settingsSubTab === 'infra'
                      ? 'bg-surface-container-lowest text-primary shadow-xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Infraestrutura Cloud
                </button>
              </div>

              {/* SUB-ABA 1: PLANOS DE SUBSCRIÇÃO */}
              {settingsSubTab === 'plans' && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[14px] font-bold text-on-surface">
                      Planos Ativos no Site Público ({plans.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
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
                            Editar
                          </button>

                          <button
                            className={`h-8 px-2.5 rounded-[6px] text-[11px] font-bold cursor-pointer ${
                              p.isActive
                                ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            }`}
                            onClick={() => handleTogglePlanActive(p)}
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

              {/* SUB-ABA 2: UTILIZADORES DO SISTEMA (ADMINISTRADORES) */}
              {settingsSubTab === 'users' && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[14px] font-bold text-on-surface">
                        Contas Administrativas ({adminUsers.length})
                      </h3>
                      <p className="text-[11.5px] text-on-surface-variant">
                        Utilizadores com privilégios de gestão total e suporte no FinTrack.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-surface-container rounded-[10px]">
                    <table className="w-full text-left border-collapse text-[11.5px]">
                      <thead>
                        <tr className="border-b border-surface-container text-[10.5px] font-bold text-on-surface-variant uppercase bg-surface-container-low/50">
                          <th className="py-2.5 px-3">Administrador</th>
                          <th className="py-2.5 px-3">Telefone</th>
                          <th className="py-2.5 px-3">E-mail</th>
                          <th className="py-2.5 px-3">Nível de Acesso</th>
                          <th className="py-2.5 px-3">Estado</th>
                          <th className="py-2.5 px-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-container/60 font-medium">
                        {adminUsers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-on-surface-variant text-[12px]">
                              Nenhum administrador encontrado.
                            </td>
                          </tr>
                        ) : (
                          adminUsers.map((admin) => {
                            const isSelf = admin.id === currentUser?.id;
                            return (
                              <tr key={admin.id} className="hover:bg-surface-container-low/40">
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-[8px] bg-primary-fixed text-primary font-bold text-[10.5px] flex items-center justify-center shrink-0">
                                      {getUserInitials(admin.name)}
                                    </div>
                                    <div>
                                      <span className="font-bold text-on-surface block leading-tight">
                                        {admin.name}
                                      </span>
                                      {isSelf && (
                                        <span className="text-[9.5px] text-primary font-bold">
                                          (Conta Atual)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-on-surface-variant">{admin.phone}</td>
                                <td className="py-2.5 px-3 text-on-surface-variant">{admin.email || '—'}</td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-extrabold uppercase bg-primary-fixed text-primary flex items-center gap-1 w-fit">
                                    <AppIcon name="verified_user" className="text-[12px]" />
                                    <span>Administrador</span>
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-[6px] text-[10px] font-bold ${
                                      admin.isSuspended
                                        ? 'bg-error-container text-on-error-container'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {admin.isSuspended ? 'Suspenso' : 'Ativo'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right space-x-1.5">
                                  <button
                                    className="px-2.5 py-1 rounded-[6px] bg-surface-container text-on-surface text-[10.5px] font-bold hover:bg-surface-container-high cursor-pointer align-middle"
                                    onClick={() => setResetPwdModalUser(admin)}
                                    type="button"
                                    title="Alterar senha deste administrador"
                                  >
                                    Senha
                                  </button>
                                  <button
                                    className={`px-2.5 py-1 rounded-[6px] text-[10.5px] font-bold cursor-pointer align-middle disabled:opacity-40 disabled:cursor-not-allowed ${
                                      admin.isSuspended
                                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                        : 'bg-error-container text-on-error-container hover:opacity-90'
                                    }`}
                                    disabled={isSelf}
                                    onClick={() => handleToggleUserSuspension(admin)}
                                    title={isSelf ? 'Não pode suspender a sua própria sessão atual' : undefined}
                                    type="button"
                                  >
                                    {admin.isSuspended ? 'Reativar' : 'Suspender'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SUB-ABA 3: INFRAESTRUTURA CLOUD */}
              {settingsSubTab === 'infra' && (
                <div className="space-y-3 pt-1">
                  <h3 className="text-[14px] font-bold text-on-surface">
                    Estado da Infraestrutura Cloud
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-3.5 rounded-[10px] bg-surface-container-low flex items-center justify-between">
                      <div>
                        <span className="text-[12.5px] font-bold text-on-surface block">Neon Postgres Database</span>
                        <span className="text-[11px] text-emerald-700 font-semibold">Conectado · Latência 38ms</span>
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

                    <div className="p-3.5 rounded-[10px] bg-surface-container-low flex items-center justify-between">
                      <div>
                        <span className="text-[12.5px] font-bold text-on-surface block">Vercel Edge & Functions</span>
                        <span className="text-[11px] text-emerald-700 font-semibold">Região CDG1 · Operacional</span>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    </div>

                    <div className="p-3.5 rounded-[10px] bg-surface-container-low flex items-center justify-between">
                      <div>
                        <span className="text-[12.5px] font-bold text-on-surface block">M-Pesa Webhook & Processamento</span>
                        <span className="text-[11px] text-emerald-700 font-semibold">Ativo com Notificações</span>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* MODAL: CRIAR OU EDITAR PLANO DE SUBSCRIÇÃO */}
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
              Esta mensagem aparecerá para todos os utilizadores no topo dos seus aplicativos.
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

      {/* MODAL: CRIAR NOVO ADMINISTRADOR */}
      {createAdminModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-container-lowest p-5 rounded-[10px] shadow-2xl border border-surface-container space-y-3.5 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-black text-on-surface flex items-center gap-2">
                <AppIcon name="security" className="text-primary text-[18px]" />
                <span>Novo Administrador do Sistema</span>
              </h3>
              <button
                type="button"
                onClick={() => setCreateAdminModalOpen(false)}
                className="w-7 h-7 rounded-[6px] bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <AppIcon name="close" className="text-[16px]" />
              </button>
            </div>
            <p className="text-[11.5px] text-on-surface-variant leading-snug">
              Cadastre um novo operador com privilégios administrativos. Ele terá acesso total ao painel de gestão do FinTrack.
            </p>

            <form onSubmit={handleCreateAdmin} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-on-surface block mb-1">
                  Nome Completo
                </label>
                <input
                  className="w-full h-9 px-3 rounded-[8px] bg-surface-container text-on-surface text-[12px] placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30"
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="ex: Carlos Alberto"
                  required
                  type="text"
                  value={newAdminName}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-on-surface block mb-1">
                  Telefone / WhatsApp (Moçambique)
                </label>
                <input
                  className="w-full h-9 px-3 rounded-[8px] bg-surface-container text-on-surface text-[12px] placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30"
                  onChange={(e) => setNewAdminPhone(e.target.value)}
                  placeholder="+258 84 000 0000"
                  required
                  type="text"
                  value={newAdminPhone}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-on-surface block mb-1">
                  E-mail (Opcional)
                </label>
                <input
                  className="w-full h-9 px-3 rounded-[8px] bg-surface-container text-on-surface text-[12px] placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30"
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin@fintrack.co.mz"
                  type="email"
                  value={newAdminEmail}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-on-surface block mb-1">
                  Senha Inicial (mínimo 6 caracteres)
                </label>
                <input
                  className="w-full h-9 px-3 rounded-[8px] bg-surface-container text-on-surface text-[12px] placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary/30"
                  minLength={6}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  type="password"
                  value={newAdminPassword}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  className="flex-1 h-9 rounded-[8px] bg-surface-container text-on-surface font-bold text-[11.5px] cursor-pointer"
                  onClick={() => setCreateAdminModalOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 h-9 rounded-[8px] bg-primary text-on-primary font-bold text-[11.5px] shadow-xs cursor-pointer disabled:opacity-60"
                  disabled={creatingAdmin}
                  type="submit"
                >
                  {creatingAdmin ? 'A criar...' : 'Criar Administrador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
