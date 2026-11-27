import { AppIcon } from './AppIcon';
import { useEffect, useState } from 'react';
import type {
  AdminOverviewStats,
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
}

export function AdminScreen({ authToken, currency, onNotify }: AdminScreenProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'tickets' | 'settings'>('users');
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | SubscriptionPlan>('all');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [overviewRes, usersRes, ticketsRes] = await Promise.all([
        adminApi.getOverview(authToken),
        adminApi.getUsers(authToken),
        adminApi.getTickets(authToken),
      ]);
      setStats(overviewRes.stats);
      setUsers(usersRes.users);
      setTickets(ticketsRes.tickets);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao carregar dados de administração.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [authToken]);

  const handleChangeUserPlan = async (targetId: string, nextPlan: SubscriptionPlan) => {
    setUpdatingUserId(targetId);
    try {
      const res = await adminApi.updateUserPlan(authToken, targetId, nextPlan);
      onNotify(res.message);
      setUsers((prev) =>
        prev.map((u) => (u.id === targetId ? { ...u, plan: nextPlan, status: 'active' } : u))
      );
      if (stats) {
        void adminApi.getOverview(authToken).then((r) => setStats(r.stats)).catch(() => {});
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao atualizar plano.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    try {
      await adminApi.updateTicketStatus(authToken, ticketId, 'fechado');
      onNotify('Bilhete de suporte resolvido com sucesso!');
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: 'aberto' as const } : t))
      );
      void loadData();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao atualizar bilhete.');
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.phone.includes(userSearch) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.paymentReference.toLowerCase().includes(userSearch.toLowerCase());
    const matchesPlan = planFilter === 'all' || u.plan === planFilter;
    return matchesSearch && matchesPlan;
  });

  return (
    <div className="flex flex-col w-full space-y-4 pb-8 animate-fade-in">
      {/* Header do Painel Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-primary/20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
            <AppIcon name="admin_panel_settings" className="text-[26px]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[18px] sm:text-[20px] font-black text-on-surface tracking-tight">
                Painel Administrativo FinTrack SaaS
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-primary text-[10px] font-extrabold uppercase">
                Admin Master
              </span>
            </div>
            <p className="text-[12px] text-on-surface-variant">
              Gestão de subscrições, utilizadores, métricas de receita (MRR) e bilhetes de suporte.
            </p>
          </div>
        </div>

        <button
          className="h-10 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
          onClick={loadData}
          type="button"
        >
          <AppIcon name="refresh" className={`text-[17px] ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar Dados</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-2xl bg-error-container text-on-error-container text-[12.5px] font-medium flex items-center gap-2">
          <AppIcon name="error" className="text-[18px] shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Cards de Negócio (MRR, Utilizadores, Planos) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: MRR */}
        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Receita Mensal (MRR)
            </span>
            <div className="w-8 h-8 rounded-xl bg-secondary-container text-secondary flex items-center justify-center">
              <AppIcon name="payments" className="text-[18px]" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-[22px] sm:text-[26px] font-black text-secondary tabular-nums block">
              {stats ? formatMoney(stats.mrrMzn, currency) : '—'}
            </span>
            <span className="text-[11px] text-on-surface-variant">
              Base de assinantes pagantes ativos
            </span>
          </div>
        </div>

        {/* Card 2: Total Utilizadores */}
        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Total de Contas
            </span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <AppIcon name="people" className="text-[18px]" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-[22px] sm:text-[26px] font-black text-on-surface tabular-nums block">
              {stats ? stats.totalUsers : '—'}
            </span>
            <span className="text-[11px] text-on-surface-variant">
              Utilizadores cadastrados na nuvem
            </span>
          </div>
        </div>

        {/* Card 3: Assinantes Pro + Business */}
        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Assinantes Pagos
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
              <AppIcon name="workspace_premium" className="text-[18px]" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-[22px] sm:text-[26px] font-black text-primary tabular-nums block">
              {stats ? stats.proUsersCount + stats.businessUsersCount : '—'}
            </span>
            <span className="text-[11px] text-on-surface-variant">
              {stats ? `${stats.proUsersCount} Pro · ${stats.businessUsersCount} Negócios` : '—'}
            </span>
          </div>
        </div>

        {/* Card 4: Suporte Aberto */}
        <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Suporte Pendente
            </span>
            <div className="w-8 h-8 rounded-xl bg-surface-container text-on-surface-variant flex items-center justify-center">
              <AppIcon name="support_agent" className="text-[18px]" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-[22px] sm:text-[26px] font-black text-on-surface tabular-nums block">
              {stats ? stats.openTicketsCount : '—'}
            </span>
            <span className="text-[11px] text-on-surface-variant">
              Bilhetes a aguardar atendimento
            </span>
          </div>
        </div>
      </div>

      {/* Tabs de Navegação Interna */}
      <div className="flex items-center gap-2 border-b border-surface-container pb-1 text-[13px] font-bold">
        <button
          className={`h-10 px-4 rounded-xl flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'users'
              ? 'bg-primary text-on-primary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
          }`}
          onClick={() => setActiveTab('users')}
          type="button"
        >
          <AppIcon name="badge" className="text-[18px]" />
          <span>Utilizadores & Planos ({users.length})</span>
        </button>

        <button
          className={`h-10 px-4 rounded-xl flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'tickets'
              ? 'bg-primary text-on-primary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
          }`}
          onClick={() => setActiveTab('tickets')}
          type="button"
        >
          <AppIcon name="chat" className="text-[18px]" />
          <span>Bilhetes de Suporte ({tickets.length})</span>
        </button>

        <button
          className={`h-10 px-4 rounded-xl flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-primary text-on-primary shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
          }`}
          onClick={() => setActiveTab('settings')}
          type="button"
        >
          <AppIcon name="settings_suggest" className="text-[18px]" />
          <span>Infraestrutura SaaS</span>
        </button>
      </div>

      {/* Tab 1: Utilizadores & Subscrições */}
      {activeTab === 'users' && (
        <div className="space-y-3">
          {/* Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <AppIcon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-on-surface-variant"
              />
              <input
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/25"
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Pesquisar por nome, telefone, e-mail ou código de referência..."
                type="text"
                value={userSearch}
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="adminPlanFilterSelect">
                Filtrar por plano
              </label>
              <select
                className="h-10 px-3 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface text-[12px] font-semibold focus:outline-none cursor-pointer"
                id="adminPlanFilterSelect"
                onChange={(e) => setPlanFilter(e.target.value as 'all' | SubscriptionPlan)}
                value={planFilter}
              >
                <option value="all">Todos os Planos</option>
                <option value="free">Apenas Gratuito</option>
                <option value="pro">Apenas FinPro Pessoal</option>
                <option value="business">Apenas FinPro Negócios</option>
              </select>
            </div>
          </div>

          {/* Tabela de Utilizadores */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant text-[11px] font-bold uppercase tracking-wider border-b border-surface-container">
                    <th className="py-3 px-3">Utilizador & Contacto</th>
                    <th className="py-3 px-2">Plano Atual</th>
                    <th className="py-3 px-2">Método / Ref.</th>
                    <th className="py-3 px-2">Data Cadastro</th>
                    <th className="py-3 px-3 text-right">Ação de Upgrade/Alterar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container text-[12px]">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td className="py-8 px-4 text-center text-on-surface-variant" colSpan={5}>
                        Nenhum utilizador encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isUpdating = updatingUserId === u.id;
                      return (
                        <tr key={u.id} className="hover:bg-surface-container-low/40 transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-primary-fixed text-primary font-bold flex items-center justify-center text-[11px] shrink-0">
                                {u.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-on-surface block truncate">
                                  {u.name}
                                </span>
                                <span className="text-[11px] text-on-surface-variant block">
                                  {u.phone} {u.email ? `· ${u.email}` : ''}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10.5px] font-extrabold uppercase ${
                                u.plan === 'business'
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : u.plan === 'pro'
                                    ? 'bg-primary-fixed text-primary'
                                    : 'bg-surface-container text-on-surface-variant'
                              }`}
                            >
                              {u.plan === 'business' ? 'Negócios' : u.plan === 'pro' ? 'Pro' : 'Grátis'}
                            </span>
                          </td>
                          <td className="py-3 px-2 whitespace-nowrap text-on-surface-variant text-[11.5px]">
                            <span className="font-semibold block uppercase">
                              {u.paymentMethod || 'free'}
                            </span>
                            <span className="text-[10px] text-on-surface-variant/80 block font-mono">
                              {u.paymentReference || '—'}
                            </span>
                          </td>
                          <td className="py-3 px-2 whitespace-nowrap text-on-surface-variant text-[11px]">
                            {u.createdAt.split('T')[0].split('-').reverse().join('/')}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {u.plan !== 'pro' && (
                                <button
                                  className="h-8 px-2.5 rounded-lg bg-primary-fixed hover:bg-primary-fixed-dim text-primary text-[11px] font-bold cursor-pointer transition-colors"
                                  disabled={isUpdating}
                                  onClick={() => handleChangeUserPlan(u.id, 'pro')}
                                  type="button"
                                >
                                  Tornar Pro
                                </button>
                              )}
                              {u.plan !== 'business' && (
                                <button
                                  className="h-8 px-2.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold cursor-pointer transition-colors"
                                  disabled={isUpdating}
                                  onClick={() => handleChangeUserPlan(u.id, 'business')}
                                  type="button"
                                >
                                  Tornar Negócios
                                </button>
                              )}
                              {u.plan !== 'free' && (
                                <button
                                  className="h-8 px-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-semibold cursor-pointer transition-colors"
                                  disabled={isUpdating}
                                  onClick={() => handleChangeUserPlan(u.id, 'free')}
                                  type="button"
                                >
                                  Mudar p/ Grátis
                                </button>
                              )}
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

      {/* Tab 2: Bilhetes de Suporte */}
      {activeTab === 'tickets' && (
        <div className="space-y-3">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm p-4 divide-y divide-surface-container">
            {tickets.length === 0 ? (
              <p className="text-center py-8 text-on-surface-variant text-[13px]">
                Nenhum bilhete de suporte registado.
              </p>
            ) : (
              tickets.map((t) => (
                <div key={t.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[11px] font-bold text-primary px-2 py-0.5 rounded bg-primary-fixed/50">
                        {t.code}
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        por {t.userName} ({t.userPhone})
                      </span>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                        Canal: {t.contactChannel}
                      </span>
                    </div>
                    <h4 className="text-[13.5px] font-bold text-on-surface leading-tight">
                      {t.subject}
                    </h4>
                    <p className="text-[12px] text-on-surface-variant mt-1 leading-snug">
                      {t.message}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <a
                      className="h-9 px-3 rounded-xl bg-secondary/15 text-secondary hover:bg-secondary/25 text-[11.5px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      href={`https://wa.me/${t.userPhone.replace(/\D/g, '')}?text=Olá%20${encodeURIComponent(t.userName)},%20sou%20do%20Suporte%20FinTrack%20sobre%20o%20bilhete%20${t.code}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <AppIcon name="chat" className="text-[15px]" />
                      <span>Responder no WhatsApp</span>
                    </a>
                    <button
                      className="h-9 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-[11.5px] font-semibold transition-colors cursor-pointer"
                      onClick={() => handleResolveTicket(t.id)}
                      type="button"
                    >
                      Concluir
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Configurações & Infraestrutura SaaS */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-surface-container pb-2">
              <AppIcon name="database" className="text-primary text-[20px]" />
              <h3 className="text-[14.5px] font-bold text-on-surface">Base de Dados & Armazenamento</h3>
            </div>
            <div className="space-y-2 text-[12px] text-on-surface-variant">
              <p><strong>Motor:</strong> Neon Postgres Serverless (Lakebase)</p>
              <p><strong>Armazenamento S3:</strong> Neon Object Storage / AWS S3 Compatível</p>
              <p><strong>Migrações:</strong> Sistema versionado por carimbo de data/hora (14 dígitos)</p>
              <p><strong>Segurança:</strong> Headers Cache-Control no-store com isolamento total</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-surface-container pb-2">
              <AppIcon name="payments" className="text-secondary text-[20px]" />
              <h3 className="text-[14.5px] font-bold text-on-surface">Gateways de Cobrança Integrados</h3>
            </div>
            <div className="space-y-2 text-[12px] text-on-surface-variant">
              <p><strong>M-Pesa Moçambique:</strong> Vodacom C2B / STK Push Instantâneo</p>
              <p><strong>e-Mola Moçambique:</strong> Movitel Carteira Móvel</p>
              <p><strong>Cartões Bancários:</strong> VISA, Mastercard e Débito Internacional</p>
              <p><strong>Política de Renovação:</strong> Mensal ou Anual com -20% de desconto</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
