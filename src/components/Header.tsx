import { useMemo } from 'react';
import { ASSETS } from '../data/seed';
import type { AppScreen, CurrencyCode } from '../types/finance';
import { formatHeaderDateLabel } from '../utils/finance';

interface HeaderProps {
  screen: AppScreen;
  firstName: string;
  currency: CurrencyCode;
  now?: Date;
  onChangeCurrency: (next: CurrencyCode) => void;
  onBack: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  unreadNotificationsCount: number;
  hasCriticalAlert?: boolean;
  balanceAlertStatus?: 'critical' | 'warning' | null;
}

export function Header({
  screen,
  firstName,
  currency,
  now = new Date(),
  onChangeCurrency,
  onBack,
  onOpenNotifications,
  onOpenProfile,
  unreadNotificationsCount,
  hasCriticalAlert = false,
  balanceAlertStatus = null,
}: HeaderProps) {
  const headerDateLabel = useMemo(() => formatHeaderDateLabel(now), [now]);

  if (screen === 'login') {
    return (
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] z-40 pt-safe bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-14 px-3 flex items-center justify-between">
          <button
            aria-label="Voltar"
            className="min-w-[40px] min-h-[40px] -ml-1 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            onClick={onBack}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
          </button>
          <span className="text-[16px] text-on-surface font-bold tracking-tight">
            Aceder Conta
          </span>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary text-[17px]">person</span>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] z-40 bg-surface/95 backdrop-blur-xl border-b border-surface-container/60 pt-safe">
      <div className="h-16 px-3 flex items-center justify-between gap-2">
        {/* Saudação & Data Dinâmica */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[11px] text-on-surface-variant font-medium leading-tight">
            {headerDateLabel}
          </span>
          <h1 className="text-[16px] text-on-surface font-bold tracking-tight leading-snug">
            Olá, {firstName} 👋
          </h1>
        </div>

        {/* Seletor de Moeda + Notificações + Avatar (sem nome) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="relative">
            <label className="sr-only" htmlFor="currency-selector">
              Selecionar moeda
            </label>
            <select
              className="appearance-none bg-surface-container-low hover:bg-surface-container text-on-surface text-[11.5px] font-semibold pl-2.5 pr-7 h-8 rounded-full ring-1 ring-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors cursor-pointer"
              id="currency-selector"
              onChange={(e) => onChangeCurrency(e.target.value as CurrencyCode)}
              value={currency}
            >
              <option value="MZN">MZN (MT)</option>
              <option value="USD">USD ($)</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[15px] text-on-surface-variant">
              expand_more
            </span>
          </div>

          <button
            aria-label="Notificações"
            className={`relative w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
              hasCriticalAlert || balanceAlertStatus === 'critical'
                ? 'bg-error-container/60 text-tertiary hover:bg-error-container'
                : balanceAlertStatus === 'warning'
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
            }`}
            onClick={onOpenNotifications}
            type="button"
          >
            <span className="material-symbols-outlined text-[19px]">
              {hasCriticalAlert || balanceAlertStatus ? 'notifications_active' : 'notifications'}
            </span>
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-tertiary-container text-on-tertiary text-[9.5px] font-bold flex items-center justify-center tabular-nums shadow-xs">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            aria-label="Perfil e Configurações"
            className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-primary/15 hover:ring-primary/35 transition-all cursor-pointer shrink-0"
            onClick={onOpenProfile}
            type="button"
          >
            <img
              alt="Foto de perfil"
              className="w-full h-full object-cover"
              src={ASSETS.avatar}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
