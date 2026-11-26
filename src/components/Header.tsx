import { AppIcon } from './AppIcon';
import { useEffect, useMemo, useState } from 'react';
import type { AppScreen, CurrencyCode } from '../types/finance';
import { formatHeaderDateLabel, getUserInitials } from '../utils/finance';

interface HeaderProps {
  screen: AppScreen;
  userName: string;
  avatarUrl?: string;
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
  userName,
  avatarUrl = '',
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
  const [imgError, setImgError] = useState(false);
  const headerDateLabel = useMemo(() => formatHeaderDateLabel(now), [now]);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  if (screen === 'login') {
    return null;
  }

  const firstName = userName.trim().split(' ')[0] || 'Utilizador';
  const initials = getUserInitials(userName);
  const showAvatarImg = Boolean(avatarUrl) && !imgError;

  return (
    <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] z-40 bg-surface/95 backdrop-blur-xl border-b border-surface-container/60 pt-safe">
      <div className="h-16 px-3 flex items-center justify-between gap-2">
        {screen === 'perfil' ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              aria-label="Voltar"
              className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-on-surface hover:bg-surface-container transition-colors cursor-pointer shrink-0"
              onClick={onBack}
              type="button"
            >
              <AppIcon name="arrow_back_ios_new" className="text-[20px]" />
            </button>
            <div className="min-w-0">
              <span className="text-[11px] text-on-surface-variant font-medium leading-tight block">
                {headerDateLabel}
              </span>
              <h1 className="text-[16px] text-on-surface font-bold tracking-tight leading-snug">
                Meu Perfil
              </h1>
            </div>
          </div>
        ) : (
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[11px] text-on-surface-variant font-medium leading-tight">
              {headerDateLabel}
            </span>
            <h1 className="text-[16px] text-on-surface font-bold tracking-tight leading-snug">
              Olá, {firstName} 👋
            </h1>
          </div>
        )}

        {/* Seletor de Moeda + Notificações + Avatar */}
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
              <option value="MZN">MZN</option>
              <option value="USD">USD</option>
            </select>
            <AppIcon name="expand_more" className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[15px] text-on-surface-variant" />
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
            <AppIcon name={hasCriticalAlert || balanceAlertStatus ? 'notifications_active' : 'notifications'} className="text-[19px]" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-tertiary-container text-on-tertiary text-[9.5px] font-bold flex items-center justify-center tabular-nums shadow-xs">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            aria-label="Abrir Página de Perfil"
            className={`w-8 h-8 rounded-full overflow-hidden ring-2 transition-all cursor-pointer shrink-0 flex items-center justify-center bg-primary-fixed text-primary font-bold text-[11px] ${
              screen === 'perfil'
                ? 'ring-primary'
                : 'ring-primary/15 hover:ring-primary/35'
            }`}
            onClick={onOpenProfile}
            type="button"
          >
            {showAvatarImg ? (
              <img
                alt="Foto de perfil"
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
                referrerPolicy="no-referrer"
                src={avatarUrl}
              />
            ) : (
              <span>{initials}</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
