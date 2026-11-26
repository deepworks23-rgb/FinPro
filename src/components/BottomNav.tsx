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
      <div className="flex items-center justify-around h-20 px-space-xs relative">
        <button
          aria-current={activeScreen === 'dashboard-inicio' ? 'page' : undefined}
          className={navItemClass('dashboard-inicio')}
          onClick={() => onNavigate('dashboard-inicio')}
          type="button"
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={
              activeScreen === 'dashboard-inicio'
                ? { fontVariationSettings: "'FILL' 1" }
                : undefined
            }
          >
            dashboard
          </span>
          <span className="font-label-sm text-[10px] leading-tight mt-0.5">Início</span>
        </button>

        <button
          aria-current={activeScreen === 'transacoes' ? 'page' : undefined}
          className={navItemClass('transacoes')}
          onClick={() => onNavigate('transacoes')}
          type="button"
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={
              activeScreen === 'transacoes'
                ? { fontVariationSettings: "'FILL' 1" }
                : undefined
            }
          >
            receipt_long
          </span>
          <span className="font-label-sm text-[10px] leading-tight mt-0.5">Extrato</span>
        </button>

        <div className="relative flex items-center justify-center w-14 h-14 -mt-5">
          <button
            aria-label="Nova Transação"
            className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg shadow-primary/25 hover:bg-primary-container transition-transform active:scale-95 cursor-pointer"
            onClick={onOpenNewTransaction}
            type="button"
          >
            <span className="material-symbols-outlined text-[26px]">add</span>
          </button>
        </div>

        <button
          aria-current={activeScreen === 'orcamentos' ? 'page' : undefined}
          className={navItemClass('orcamentos')}
          onClick={() => onNavigate('orcamentos')}
          type="button"
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={
              activeScreen === 'orcamentos'
                ? { fontVariationSettings: "'FILL' 1" }
                : undefined
            }
          >
            pie_chart
          </span>
          <span className="font-label-sm text-[10px] leading-tight mt-0.5">Metas</span>
        </button>

        <button
          aria-current={activeScreen === 'relatorios' ? 'page' : undefined}
          className={navItemClass('relatorios')}
          onClick={() => onNavigate('relatorios')}
          type="button"
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={
              activeScreen === 'relatorios'
                ? { fontVariationSettings: "'FILL' 1" }
                : undefined
            }
          >
            analytics
          </span>
          <span className="font-label-sm text-[10px] leading-tight mt-0.5">Relatórios</span>
        </button>
      </div>
    </nav>
  );
}
