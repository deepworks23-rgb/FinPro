import { AppIcon } from './AppIcon';
import type { AppScreen, CurrencyCode, UserProfile } from '../types/finance';
import { getUserInitials } from '../utils/finance';

interface SidebarProps {
  activeScreen: AppScreen;
  currency: CurrencyCode;
  user: UserProfile;
  unreadNotificationsCount?: number;
  hasCriticalAlert?: boolean;
  onNavigate: (screen: AppScreen) => void;
  onOpenNewTransaction: () => void;
  onChangeCurrency: (currency: CurrencyCode) => void;
  onOpenNotifications: () => void;
  onLogout: () => void;
}

export function Sidebar({
  activeScreen,
  currency,
  user,
  unreadNotificationsCount = 0,
  hasCriticalAlert = false,
  onNavigate,
  onOpenNewTransaction,
  onChangeCurrency,
  onOpenNotifications,
  onLogout,
}: SidebarProps) {
  const navItems: Array<{
    screen: AppScreen;
    label: string;
    icon: string;
  }> = [
    { screen: 'dashboard-inicio', label: 'Painel Geral', icon: 'dashboard' },
    { screen: 'transacoes', label: 'Extrato & Transações', icon: 'receipt_long' },
    { screen: 'orcamentos', label: 'Metas & Orçamentos', icon: 'pie_chart' },
    { screen: 'relatorios', label: 'Relatórios & Análise', icon: 'analytics' },
    { screen: 'perfil', label: 'Meu Perfil & Conta', icon: 'person' },
  ];

  const initials = getUserInitials(user.name);

  return (
    <aside
      aria-label="Menu principal Desktop"
      className="hidden md:flex flex-col w-64 lg:w-72 bg-surface-container-lowest border-r border-surface-container/80 h-screen sticky top-0 shrink-0 select-none z-30 shadow-xs"
    >
      {/* 1. Brand Logo */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-surface-container/60 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
          <AppIcon name="account_balance_wallet" className="text-[22px]" filled />
        </div>
        <div className="min-w-0">
          <span className="text-[17px] font-bold text-on-surface tracking-tight block leading-tight">
            FinTrack
          </span>
          <span className="text-[11px] font-medium text-on-surface-variant block leading-tight">
            Gestão Financeira
          </span>
        </div>
      </div>

      {/* 2. Primary CTA: Nova Transação */}
      <div className="p-4 pb-2 shrink-0">
        <button
          className="w-full h-11 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-[13.5px] font-semibold flex items-center justify-center gap-2 shadow-md shadow-primary/20 hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
          onClick={onOpenNewTransaction}
          type="button"
        >
          <AppIcon name="add" className="text-[20px]" />
          <span>Nova Transação</span>
        </button>
      </div>

      {/* 3. Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = activeScreen === item.screen;
          return (
            <button
              key={item.screen}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full h-11 px-3.5 rounded-xl flex items-center gap-3 text-[13.5px] font-medium transition-all text-left cursor-pointer ${
                isActive
                  ? 'bg-primary-fixed text-primary font-bold shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => onNavigate(item.screen)}
              type="button"
            >
              <AppIcon
                name={item.icon}
                className="text-[20px] shrink-0"
                filled={isActive}
              />
              <span className="truncate flex-1">{item.label}</span>
              {item.screen === 'dashboard-inicio' && unreadNotificationsCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-tertiary-container text-on-tertiary text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 4. Bottom Controls: Currency, Notifications & User */}
      <div className="p-4 border-t border-surface-container/70 flex flex-col gap-3 shrink-0 bg-surface-container-low/30">
        {/* Currency Switcher & Notifications Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-surface-container-lowest px-2.5 py-1.5 rounded-xl border border-surface-container/80 text-[12px]">
            <span className="text-[11px] font-semibold text-on-surface-variant">Moeda:</span>
            <button
              className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition-colors cursor-pointer ${
                currency === 'MZN'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              onClick={() => onChangeCurrency('MZN')}
              type="button"
            >
              MZN
            </button>
            <button
              className={`px-2 py-0.5 rounded-md font-bold text-[11px] transition-colors cursor-pointer ${
                currency === 'USD'
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              onClick={() => onChangeCurrency('USD')}
              type="button"
            >
              USD
            </button>
          </div>

          <button
            aria-label="Abrir Notificações"
            className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer border border-surface-container/80 ${
              hasCriticalAlert
                ? 'bg-error-container text-tertiary'
                : 'bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
            onClick={onOpenNotifications}
            type="button"
          >
            <AppIcon name={hasCriticalAlert ? 'notifications_active' : 'notifications'} className="text-[18px]" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-tertiary-container text-on-tertiary text-[9.5px] font-bold flex items-center justify-center tabular-nums">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>
        </div>

        {/* User Profile Card & Logout */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-surface-container/60">
          <button
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left hover:opacity-85 transition-opacity cursor-pointer group"
            onClick={() => onNavigate('perfil')}
            type="button"
          >
            <div className="w-9 h-9 rounded-full bg-primary-fixed text-primary font-bold text-[12px] flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-primary/20 group-hover:ring-primary/40">
              {user.avatarDataUrl ? (
                <img
                  alt="Avatar"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  src={user.avatarDataUrl}
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[13px] font-bold text-on-surface truncate block leading-tight">
                {user.name}
              </span>
              <span className="text-[11px] text-on-surface-variant truncate block leading-tight">
                {user.email || user.phone}
              </span>
            </div>
          </button>

          <button
            aria-label="Terminar Sessão"
            className="w-8 h-8 rounded-lg text-on-surface-variant hover:text-tertiary hover:bg-error-container/40 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            onClick={onLogout}
            title="Sair da conta"
            type="button"
          >
            <AppIcon name="logout" className="text-[18px]" />
          </button>
        </div>
      </div>
    </aside>
  );
}
