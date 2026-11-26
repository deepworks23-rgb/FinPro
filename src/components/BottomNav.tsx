import { AppIcon } from './AppIcon';
import type { AppScreen } from '../types/finance';

interface BottomNavProps {
  activeScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  onOpenNewTransaction: () => void;
}

export function BottomNav({
  activeScreen,
  onNavigate,
  onOpenNewTransaction,
}: BottomNavProps) {
  if (activeScreen === 'login') return null;

  const navItemClass = (target: AppScreen) =>
    activeScreen === target
      ? 'flex flex-col items-center justify-center w-14 h-14 text-primary font-bold transition-colors cursor-pointer'
      : 'flex flex-col items-center justify-center w-14 h-14 text-on-surface-variant transition-colors hover:text-on-surface cursor-pointer';

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] z-40 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-2px_12px_rgba(0,0,0,0.05)]"
    >
      <div className="flex items-center justify-around h-16 px-space-xs relative">
        <button
          aria-current={activeScreen === 'dashboard-inicio' ? 'page' : undefined}
          className={navItemClass('dashboard-inicio')}
          onClick={() => onNavigate('dashboard-inicio')}
          type="button"
        >
          <AppIcon name="dashboard" className="text-[24px]" filled={activeScreen === 'dashboard-inicio'} />
          <span className="font-label-sm text-[10px] leading-tight mt-0.5">Início</span>
        </button>

        <button
          aria-current={activeScreen === 'transacoes' ? 'page' : undefined}
          className={navItemClass('transacoes')}
          onClick={() => onNavigate('transacoes')}
          type="button"
        >
          <AppIcon name="receipt_long" className="text-[24px]" filled={activeScreen === 'transacoes'} />
          <span className="font-label-sm text-[10px] leading-tight mt-0.5">Extrato</span>
        </button>

        <div className="relative flex items-center justify-center w-14 h-14 -mt-4">
          <button
            aria-label="Nova Transação"
            className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg shadow-primary/25 hover:bg-primary-container transition-transform active:scale-95 cursor-pointer"
            onClick={onOpenNewTransaction}
            type="button"
          >
            <AppIcon name="add" className="text-[26px]" />
          </button>
        </div>

        <button
          aria-current={activeScreen === 'orcamentos' ? 'page' : undefined}
          className={navItemClass('orcamentos')}
          onClick={() => onNavigate('orcamentos')}
          type="button"
        >
          <AppIcon name="pie_chart" className="text-[24px]" filled={activeScreen === 'orcamentos'} />
          <span className="font-label-sm text-[10px] leading-tight mt-0.5">Metas</span>
        </button>

        <button
          aria-current={activeScreen === 'relatorios' ? 'page' : undefined}
          className={navItemClass('relatorios')}
          onClick={() => onNavigate('relatorios')}
          type="button"
        >
          <AppIcon name="analytics" className="text-[24px]" filled={activeScreen === 'relatorios'} />
          <span className="font-label-sm text-[10px] leading-tight mt-0.5">Relatórios</span>
        </button>
      </div>
    </nav>
  );
}
