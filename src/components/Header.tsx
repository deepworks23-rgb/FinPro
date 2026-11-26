import { ASSETS } from '../data/seed';
import type { AppScreen } from '../types/finance';

interface HeaderProps {
  screen: AppScreen;
  onBack: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
  unreadNotificationsCount: number;
}

const SCREEN_SUBTITLES: Record<Exclude<AppScreen, 'login'>, string> = {
  'dashboard-inicio': 'Dashboard Início',
  transacoes: 'Transações',
  orcamentos: 'Orçamentos',
  relatorios: 'Relatórios',
};

export function Header({
  screen,
  onBack,
  onOpenNotifications,
  onOpenProfile,
  unreadNotificationsCount,
}: HeaderProps) {
  if (screen === 'login') {
    return (
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] z-40 pt-safe bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 px-gutter flex items-center justify-between">
          <button
            aria-label="Voltar"
            className="min-w-[44px] min-h-[44px] -ml-2 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            onClick={onBack}
            type="button"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back_ios_new</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary-container flex items-center justify-center text-on-primary shadow-sm">
              <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
            </div>
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">
              Login
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] z-40 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-safe">
      <div className="h-16 px-margin flex items-center justify-between">
        <div className="flex items-center gap-space-sm">
          <img
            alt="FinTrack Logo"
            className="h-8 w-auto object-contain rounded-md"
            src={ASSETS.logo}
          />
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm text-on-surface leading-none font-bold">
              FinTrack
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant font-medium tracking-tight">
              {SCREEN_SUBTITLES[screen]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-space-xs">
          <button
            aria-label="Notificações"
            className="w-11 h-11 flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            onClick={onOpenNotifications}
            type="button"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
          </button>
          <button
            aria-label="Perfil e Configurações"
            className="flex items-center justify-center p-0.5 rounded-full ring-2 ring-primary/10 hover:ring-primary/30 transition-all cursor-pointer"
            onClick={onOpenProfile}
            type="button"
          >
            <img
              alt="Foto de perfil de Lucas"
              className="w-8 h-8 rounded-full object-cover"
              src={ASSETS.avatar}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
