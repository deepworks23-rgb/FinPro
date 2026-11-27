import { AppIcon } from './AppIcon';
import type { UserSubscription } from '../types/finance';

interface TrialCountdownBannerProps {
  subscription: UserSubscription | null;
  isAdmin?: boolean;
  onOpenPricing: () => void;
}

export function TrialCountdownBanner({
  subscription,
  isAdmin = false,
  onOpenPricing,
}: TrialCountdownBannerProps) {
  if (isAdmin || !subscription) {
    return null;
  }

  // Active paid plan - no trial banner needed
  if (subscription.plan !== 'free' && subscription.status === 'active') {
    return null;
  }

  // 1. Pending Approval Banner
  if (subscription.status === 'pending_approval') {
    return (
      <div className="w-full mb-3 rounded-[10px] bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 p-3 sm:p-3.5 shadow-xs flex items-center justify-between gap-3 text-amber-950 dark:text-amber-100 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[8px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 flex items-center justify-center shrink-0">
            <AppIcon name="pending_actions" className="text-[18px]" />
          </div>
          <div className="min-w-0 text-[12.5px] sm:text-[13px]">
            <span className="font-bold block sm:inline">Aprovação em Análise: </span>
            <span className="opacity-90">
              O seu pedido de ativação ({subscription.paymentMethod.toUpperCase()} Ref:{' '}
              <strong className="font-mono">{subscription.paymentReference}</strong>) está a aguardar validação do administrador.
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenPricing}
          className="px-3 py-1.5 rounded-[8px] bg-amber-200 hover:bg-amber-300 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-950 dark:text-amber-100 text-[11.5px] font-bold shrink-0 transition-colors cursor-pointer shadow-xs"
        >
          Ver Detalhes
        </button>
      </div>
    );
  }

  // Calculate days remaining
  const now = Date.now();
  const expireTime = subscription.expiresAt ? new Date(subscription.expiresAt).getTime() : 0;
  const isExpired =
    subscription.status === 'past_due' ||
    Boolean(subscription.isTrialExpired) ||
    (subscription.plan === 'free' && expireTime > 0 && expireTime < now);

  const diffMs = expireTime - now;
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  // 2. Expired Trial Banner
  if (isExpired) {
    return (
      <div className="w-full mb-3 rounded-[10px] bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800/80 p-3.5 sm:p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-950 dark:text-rose-100 shrink-0">
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-[8px] bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-200 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <AppIcon name="lock" className="text-[20px]" />
          </div>
          <div className="min-w-0 text-[12.5px] sm:text-[13px] leading-snug">
            <div className="flex items-center gap-1.5 font-black uppercase text-[11px] tracking-wider text-rose-700 dark:text-rose-300">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
              Período de Teste de 7 Dias Expirado
            </div>
            <p className="mt-0.5 opacity-90">
              O seu período gratuito terminou e as ações do sistema foram bloqueadas. Ative o <strong>Plano Pro</strong> para continuar utilizando.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenPricing}
          className="w-full sm:w-auto px-4 py-2 rounded-[8px] bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-bold shrink-0 transition-colors cursor-pointer shadow-md flex items-center justify-center gap-1.5"
        >
          <AppIcon name="verified" className="text-[15px]" />
          <span>Ativar Plano Pro Agora</span>
        </button>
      </div>
    );
  }

  // 3. Active 7-day Trial Countdown Banner
  return (
    <div className="w-full mb-3 rounded-[10px] bg-primary-fixed/25 dark:bg-primary-950/30 border border-primary/20 dark:border-primary/40 p-2.5 sm:p-3 shadow-xs flex items-center justify-between gap-3 text-on-surface shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-[7px] bg-primary-fixed text-primary flex items-center justify-center shrink-0">
          <AppIcon name="timer" className="text-[16px]" />
        </div>
        <div className="min-w-0 text-[12px] sm:text-[12.5px] leading-tight">
          <span className="font-bold text-primary">Teste Grátis: </span>
          <span className="opacity-90">
            {daysLeft === 1 ? 'Resta 1 dia de teste gratuito.' : `Restam ${daysLeft} dias de teste gratuito.`}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenPricing}
        className="px-2.5 py-1 rounded-[7px] bg-primary text-on-primary hover:bg-primary-container text-[11px] font-bold shrink-0 transition-colors cursor-pointer shadow-xs flex items-center gap-1"
      >
        <span>Fazer Upgrade</span>
      </button>
    </div>
  );
}
