import { useMemo, useState, type FormEvent } from 'react';
import { ASSETS, CURRENCY_CONFIG } from '../data/seed';
import type { BudgetCategory, CurrencyCode, FinancialGoal } from '../types/finance';
import {
  computeBudgetTotals,
  evaluateBudgetStatus,
  formatMoney,
  getMonthCycleInfo,
} from '../utils/finance';

interface BudgetsScreenProps {
  budgets: BudgetCategory[];
  goals: FinancialGoal[];
  currency: CurrencyCode;
  onAddBudget: (budget: Omit<BudgetCategory, 'id'>) => void;
  onUpdateBudget: (id: string, updates: Pick<BudgetCategory, 'limit' | 'spent'>) => void;
  onDeleteBudget: (id: string) => void;
  onAddGoal: (goal: Omit<FinancialGoal, 'id'>) => void;
  onContributeGoal: (id: string, addedAmountBase: number) => void;
  onDeleteGoal: (id: string) => void;
  onNotify: (msg: string) => void;
}

const CUSTOM_CATEGORY_OPTIONS = [
  { value: 'Educação', label: 'Educação e Cursos', icon: 'school' },
  { value: 'Vestuário', label: 'Vestuário e Compras', icon: 'checkroom' },
  { value: 'Assinaturas', label: 'Assinaturas e Streaming', icon: 'subscriptions' },
  { value: 'Pets', label: 'Cuidados com Pets', icon: 'pets' },
  { value: 'Alimentação', label: 'Alimentação', icon: 'restaurant' },
  { value: 'Transporte', label: 'Transporte', icon: 'directions_car' },
];

export function BudgetsScreen({
  budgets,
  goals,
  currency,
  onAddBudget,
  onUpdateBudget,
  onDeleteBudget,
  onAddGoal,
  onContributeGoal,
  onDeleteGoal,
  onNotify,
}: BudgetsScreenProps) {
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetCategory | null>(null);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [contributingGoal, setContributingGoal] = useState<FinancialGoal | null>(null);
  const [contributionInput, setContributionInput] = useState('');

  // Budget form state
  const [selectedCategory, setSelectedCategory] = useState('Educação');
  const [limitInput, setLimitInput] = useState('');
  const [spentInput, setSpentInput] = useState('');

  // Goal form state
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');
  const [goalTarget, setGoalTarget] = useState('');

  const cycleInfo = useMemo(() => getMonthCycleInfo(), []);
  const totals = useMemo(() => computeBudgetTotals(budgets), [budgets]);
  const cfg = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.MZN;
  const symbol = cfg.symbol;

  const openNewBudgetModal = () => {
    setEditingBudget(null);
    setSelectedCategory('Educação');
    setLimitInput('');
    setSpentInput('');
    setIsBudgetModalOpen(true);
  };

  const openEditBudgetModal = (b: BudgetCategory) => {
    setEditingBudget(b);
    setSelectedCategory(b.category);
    setLimitInput((b.limit * cfg.rateFromBase).toFixed(2));
    setSpentInput((b.spent * cfg.rateFromBase).toFixed(2));
    setIsBudgetModalOpen(true);
  };

  const handleBudgetSubmit = (e: FormEvent) => {
    e.preventDefault();
    const limitDisplay = parseFloat(limitInput);
    const spentDisplay = parseFloat(spentInput) || 0;
    if (Number.isNaN(limitDisplay) || limitDisplay <= 0) return;

    const limitBase = Math.round((limitDisplay / cfg.rateFromBase) * 100) / 100;
    const spentBase = Math.round((spentDisplay / cfg.rateFromBase) * 100) / 100;

    if (editingBudget) {
      onUpdateBudget(editingBudget.id, { limit: limitBase, spent: spentBase });
    } else {
      const option = CUSTOM_CATEGORY_OPTIONS.find((o) => o.value === selectedCategory);
      onAddBudget({
        category: selectedCategory,
        limit: limitBase,
        spent: spentBase,
        icon: option?.icon ?? 'category',
        iconBg: 'bg-primary-fixed',
        iconColor: 'text-primary',
        isCustom: true,
      });
      onNotify(`Orçamento para ${selectedCategory} salvo!`);
    }

    setEditingBudget(null);
    setLimitInput('');
    setSpentInput('');
    setIsBudgetModalOpen(false);
  };

  const handleGoalSubmit = (e: FormEvent) => {
    e.preventDefault();
    const targetDisplay = parseFloat(goalTarget);
    const currentDisplay = parseFloat(goalCurrent) || 0;
    if (!goalTitle.trim() || Number.isNaN(targetDisplay) || targetDisplay <= 0) return;

    const targetBase = Math.round((targetDisplay / cfg.rateFromBase) * 100) / 100;
    const currentBase = Math.round((currentDisplay / cfg.rateFromBase) * 100) / 100;

    onAddGoal({
      title: goalTitle.trim(),
      current: currentBase,
      target: targetBase,
      imageUrl: ASSETS.goalInvest,
      barColor: 'bg-primary',
      accentColor: 'text-primary',
    });

    setGoalTitle('');
    setGoalCurrent('');
    setGoalTarget('');
    setIsGoalModalOpen(false);
    onNotify('Nova meta financeira criada!');
  };

  const handleContributionSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!contributingGoal) return;
    const val = parseFloat(contributionInput);
    if (Number.isNaN(val) || val <= 0) return;
    const amountBase = Math.round((val / cfg.rateFromBase) * 100) / 100;
    onContributeGoal(contributingGoal.id, amountBase);
    setContributionInput('');
    setContributingGoal(null);
  };

  return (
    <div className="flex flex-col w-full px-margin space-y-space-lg pb-space-xl">
      {/* Status Chip & Header Subtitle */}
      <div className="flex items-center justify-between gap-2 pt-space-xs">
        <div className="min-w-0 flex-1">
          <span className="text-[16px] font-bold text-on-surface block truncate">
            Planejamento Ativo
          </span>
          <p className="text-[12px] text-on-surface-variant truncate">{cycleInfo.cycleLabel}</p>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary-fixed text-on-secondary-fixed text-[11px] font-bold shadow-sm whitespace-nowrap shrink-0">
          <span className="material-symbols-outlined text-[14px]">schedule</span>
          {cycleInfo.daysRemainingLabel}
        </span>
      </div>

      {/* 1. Card Resumo do Orçamento Geral */}
      <div className="relative overflow-hidden bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
        <div className="absolute -right-10 -top-10 w-36 h-36 bg-primary-fixed/40 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-on-surface-variant">
              Orçamento Mensal Total
            </p>
            <h2 className="text-[26px] leading-[32px] sm:text-[30px] font-bold text-on-surface mt-0.5 tabular-nums tracking-tight break-words">
              {formatMoney(totals.totalLimit, currency)}
            </h2>
          </div>
          <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center text-primary shadow-sm shrink-0">
            <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
          </div>
        </div>

        {/* Progresso Geral */}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between items-center gap-2 text-[12px]">
            <span className="text-on-surface font-semibold whitespace-nowrap">
              Consumo do Mês ({totals.percentage}%)
            </span>
            <span className="text-on-surface-variant tabular-nums whitespace-nowrap">
              Meta: {formatMoney(totals.totalLimit, currency)}
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-surface-container-high overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-secondary via-primary to-tertiary-container transition-all duration-700 ease-out"
              style={{ width: `${totals.percentage}%` }}
            />
          </div>
        </div>

        {/* Indicadores de Saldo */}
        <div className="flex gap-2.5 mt-4 pt-3 border-t border-surface-container">
          <div className="flex-1 min-w-0 p-2.5 rounded-xl bg-surface-container-low flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-on-surface-variant text-[11px] font-semibold">
              <span className="material-symbols-outlined text-[15px] text-tertiary shrink-0">
                arrow_upward
              </span>
              <span className="whitespace-nowrap">Gasto Total</span>
            </div>
            <p className="text-[15px] leading-snug text-tertiary font-bold tabular-nums break-words">
              {formatMoney(totals.totalSpent, currency)}
            </p>
          </div>
          <div className="flex-1 min-w-0 p-2.5 rounded-xl bg-surface-container-low flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-on-surface-variant text-[11px] font-semibold">
              <span className="material-symbols-outlined text-[15px] text-secondary shrink-0">
                savings
              </span>
              <span className="whitespace-nowrap">Disponível</span>
            </div>
            <p className="text-[15px] leading-snug text-secondary font-bold tabular-nums break-words">
              {formatMoney(totals.available, currency)}
            </p>
          </div>
        </div>

        <button
          className="w-full mt-3.5 py-2.5 px-4 rounded-xl bg-primary text-on-primary text-[13px] font-semibold flex items-center justify-center gap-2 shadow-md shadow-primary/20 active:scale-[0.98] transition-transform cursor-pointer whitespace-nowrap"
          onClick={openNewBudgetModal}
          type="button"
        >
          <span className="material-symbols-outlined text-[19px]">add_circle</span>
          Novo Orçamento por Categoria
        </button>
      </div>

      {/* 2. Legenda de Regras de Cores Visuais */}
      <div className="bg-surface-container-low rounded-xl p-3.5 space-y-2">
        <span className="text-[11px] text-on-surface-variant uppercase tracking-wider block font-bold">
          Diretrizes de Consumo
        </span>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-1.5 p-2 rounded-lg bg-surface-container-lowest">
            <span className="w-2 h-2 rounded-full bg-secondary shrink-0" />
            <div className="leading-tight min-w-0">
              <p className="text-[11px] font-bold text-on-surface whitespace-nowrap">&lt; 70%</p>
              <span className="text-[10px] text-on-surface-variant block truncate">
                No controle
              </span>
            </div>
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-1.5 p-2 rounded-lg bg-surface-container-lowest">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <div className="leading-tight min-w-0">
              <p className="text-[11px] font-bold text-on-surface whitespace-nowrap">70% - 90%</p>
              <span className="text-[10px] text-on-surface-variant block truncate">Atenção</span>
            </div>
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-1.5 p-2 rounded-lg bg-surface-container-lowest">
            <span className="w-2 h-2 rounded-full bg-tertiary-container shrink-0" />
            <div className="leading-tight min-w-0">
              <p className="text-[11px] font-bold text-on-surface whitespace-nowrap">&gt; 90%</p>
              <span className="text-[10px] text-on-surface-variant block truncate">
                Alerta crítico
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Lista de Cards de Orçamento por Categoria */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[16px] font-bold text-on-surface truncate">
            Categorias em Monitoramento
          </h3>
          <span className="text-[12px] text-on-surface-variant whitespace-nowrap shrink-0">
            {budgets.length} ativas
          </span>
        </div>

        <div className="space-y-2.5" data-testid="budgets-list">
          {budgets.map((b) => {
            const info = evaluateBudgetStatus(b.spent, b.limit, currency);
            return (
              <div
                key={b.id}
                className={`bg-surface-container-lowest rounded-2xl p-3.5 shadow-sm flex flex-col gap-2.5 ${
                  b.isCustom ? 'ring-1 ring-primary/25' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 rounded-xl ${b.iconBg} flex items-center justify-center ${b.iconColor} shrink-0`}
                    >
                      <span className="material-symbols-outlined text-[21px]">{b.icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[14px] leading-snug font-semibold text-on-surface truncate">
                        {b.category}
                      </h4>
                      <p className="text-[11px] text-on-surface-variant tabular-nums">
                        Limite: {formatMoney(b.limit, currency)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0 -mr-1">
                    <button
                      aria-label={`Editar orçamento ${b.category}`}
                      className="w-8 h-8 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer"
                      onClick={() => openEditBudgetModal(b)}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[17px]">edit</span>
                    </button>
                    <button
                      aria-label={`Remover orçamento ${b.category}`}
                      className="w-8 h-8 rounded-full text-on-surface-variant hover:text-tertiary hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer"
                      onClick={() => onDeleteBudget(b.id)}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[17px]">delete</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-[12px]">
                    <span className={`${info.amountColor} font-bold tabular-nums whitespace-nowrap`}>
                      {formatMoney(b.spent, currency)}
                    </span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`${info.amountColor} text-[11px] font-semibold truncate`}>
                        {info.tagText}
                      </span>
                      <span aria-hidden="true" className="text-on-surface-variant/50 text-[11px]">
                        ·
                      </span>
                      <span className="text-on-surface-variant font-semibold tabular-nums shrink-0">
                        {info.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                    <div
                      className={`h-full rounded-full ${info.barColor} transition-all duration-500`}
                      style={{ width: `${info.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Seção de Metas Financeiras */}
      <div className="space-y-2.5 pt-space-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-bold text-on-surface truncate">Metas Financeiras</h3>
            <p className="text-[12px] text-on-surface-variant truncate">
              Objetivos de médio e longo prazo
            </p>
          </div>
          <button
            aria-label="Adicionar Nova Meta Financeira"
            className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary active:scale-95 transition-transform cursor-pointer shrink-0"
            onClick={() => setIsGoalModalOpen(true)}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
        </div>

        <div className="space-y-2.5" data-testid="goals-list">
          {goals.map((goal) => {
            const pct = Math.min(Math.round((goal.current / goal.target) * 100), 100);
            return (
              <div
                key={goal.id}
                className="bg-surface-container-lowest rounded-2xl p-3.5 shadow-sm flex flex-col gap-2.5"
              >
                <div className="flex items-center gap-3">
                  <img
                    alt={goal.title}
                    className="w-11 h-11 rounded-xl object-cover shrink-0"
                    src={goal.imageUrl}
                  />
                  <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="text-[14px] leading-snug font-semibold text-on-surface truncate flex-1 min-w-0">
                        {goal.title}
                      </h4>
                      <span
                        className={`text-[13px] font-bold tabular-nums shrink-0 ${goal.accentColor}`}
                      >
                        {pct}%
                      </span>
                    </div>
                    <p className="text-[12px] text-on-surface-variant tabular-nums">
                      {formatMoney(goal.current, currency)} de {formatMoney(goal.target, currency)}
                    </p>
                  </div>
                </div>

                <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                  <div
                    className={`h-full rounded-full ${goal.barColor} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    className="px-3 py-1 rounded-lg bg-primary-fixed text-primary text-[11px] font-semibold hover:opacity-85 cursor-pointer whitespace-nowrap"
                    onClick={() => {
                      setContributingGoal(goal);
                      setContributionInput('');
                    }}
                    type="button"
                  >
                    + Aportar
                  </button>
                  <button
                    aria-label={`Remover meta ${goal.title}`}
                    className="w-7 h-7 rounded-lg bg-surface-container text-on-surface-variant hover:text-tertiary flex items-center justify-center cursor-pointer shrink-0"
                    onClick={() => onDeleteGoal(goal.id)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Modal Interativo para Adicionar/Editar Orçamento */}
      {isBudgetModalOpen && (
        <div
          aria-labelledby="budgetModalTitle"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-inverse-surface/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsBudgetModalOpen(false);
          }}
          role="dialog"
        >
          <div className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl p-space-lg shadow-xl space-y-space-md">
            <div className="flex items-center justify-between gap-2 border-b border-surface-container pb-space-sm">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full bg-primary-fixed flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[20px]">tune</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3
                    className="text-[16px] font-bold text-on-surface truncate"
                    id="budgetModalTitle"
                  >
                    {editingBudget ? `Editar: ${editingBudget.category}` : 'Configurar Orçamento'}
                  </h3>
                  <p className="text-[12px] text-on-surface-variant truncate">
                    Ajuste os tetos da categoria
                  </p>
                </div>
              </div>
              <button
                aria-label="Fechar modal de orçamento"
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0"
                onClick={() => setIsBudgetModalOpen(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form className="space-y-space-md" onSubmit={handleBudgetSubmit}>
              {!editingBudget && (
                <div className="space-y-1">
                  <label
                    className="font-label-sm text-label-sm text-on-surface"
                    htmlFor="categorySelect"
                  >
                    Categoria
                  </label>
                  <div className="relative">
                    <select
                      className="w-full h-12 px-3.5 bg-surface-container-low rounded-xl text-on-surface font-body-md text-body-md appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                      id="categorySelect"
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      value={selectedCategory}
                    >
                      {CUSTOM_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-3.5 text-on-surface-variant pointer-events-none text-[20px]">
                      expand_more
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label
                  className="font-label-sm text-label-sm text-on-surface"
                  htmlFor="budgetLimitInput"
                >
                  Limite Mensal Desejado ({symbol})
                </label>
                <div className="relative flex items-center">
                  {cfg.position === 'left' && (
                    <span className="absolute left-3.5 font-currency-standard text-currency-standard text-on-surface-variant">
                      {symbol}
                    </span>
                  )}
                  <input
                    className={`w-full h-12 bg-surface-container-low rounded-xl text-on-surface font-currency-standard text-currency-standard focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      cfg.position === 'left' ? 'pl-11 pr-3.5' : 'pl-3.5 pr-11'
                    }`}
                    id="budgetLimitInput"
                    min="1"
                    onChange={(e) => setLimitInput(e.target.value)}
                    placeholder="400.00"
                    required
                    step="0.01"
                    type="number"
                    value={limitInput}
                  />
                  {cfg.position === 'right' && (
                    <span className="absolute right-3.5 font-currency-standard text-currency-standard text-on-surface-variant">
                      {symbol}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label
                  className="font-label-sm text-label-sm text-on-surface"
                  htmlFor="spentInitialInput"
                >
                  Valor Já Gasto no Ciclo ({symbol})
                </label>
                <div className="relative flex items-center">
                  {cfg.position === 'left' && (
                    <span className="absolute left-3.5 font-currency-standard text-currency-standard text-on-surface-variant">
                      {symbol}
                    </span>
                  )}
                  <input
                    className={`w-full h-12 bg-surface-container-low rounded-xl text-on-surface font-currency-standard text-currency-standard focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      cfg.position === 'left' ? 'pl-11 pr-3.5' : 'pl-3.5 pr-11'
                    }`}
                    id="spentInitialInput"
                    min="0"
                    onChange={(e) => setSpentInput(e.target.value)}
                    placeholder="120.00"
                    required
                    step="0.01"
                    type="number"
                    value={spentInput}
                  />
                  {cfg.position === 'right' && (
                    <span className="absolute right-3.5 font-currency-standard text-currency-standard text-on-surface-variant">
                      {symbol}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  className="flex-1 h-12 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md active:scale-95 transition-transform cursor-pointer"
                  onClick={() => setIsBudgetModalOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 h-12 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-md shadow-primary/20 active:scale-95 transition-transform cursor-pointer"
                  type="submit"
                >
                  Salvar Limite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal para Nova Meta Financeira */}
      {isGoalModalOpen && (
        <div
          aria-labelledby="goalModalTitle"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-inverse-surface/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsGoalModalOpen(false);
          }}
          role="dialog"
        >
          <div className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl p-space-lg shadow-xl space-y-space-md">
            <div className="flex items-center justify-between border-b border-surface-container pb-space-sm">
              <h3 className="font-headline-sm text-headline-sm text-on-surface" id="goalModalTitle">
                Nova Meta Financeira
              </h3>
              <button
                aria-label="Fechar modal de meta"
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer"
                onClick={() => setIsGoalModalOpen(false)}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form className="space-y-space-md" onSubmit={handleGoalSubmit}>
              <div className="space-y-1">
                <label className="font-label-sm text-label-sm text-on-surface" htmlFor="goalTitle">
                  Nome da Meta
                </label>
                <input
                  className="w-full h-12 px-3.5 bg-surface-container-low rounded-xl text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                  id="goalTitle"
                  onChange={(e) => setGoalTitle(e.target.value)}
                  placeholder={`Ex: Carro Novo ${cycleInfo.year + 1}`}
                  required
                  type="text"
                  value={goalTitle}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <label
                    className="font-label-sm text-label-sm text-on-surface"
                    htmlFor="goalCurrent"
                  >
                    Valor Atual ({symbol})
                  </label>
                  <input
                    className="w-full h-12 px-3.5 bg-surface-container-low rounded-xl text-on-surface font-currency-standard text-currency-standard focus:outline-none focus:ring-2 focus:ring-primary/20"
                    id="goalCurrent"
                    min="0"
                    onChange={(e) => setGoalCurrent(e.target.value)}
                    placeholder="2500"
                    required
                    step="0.01"
                    type="number"
                    value={goalCurrent}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <label
                    className="font-label-sm text-label-sm text-on-surface"
                    htmlFor="goalTarget"
                  >
                    Meta Total ({symbol})
                  </label>
                  <input
                    className="w-full h-12 px-3.5 bg-surface-container-low rounded-xl text-on-surface font-currency-standard text-currency-standard focus:outline-none focus:ring-2 focus:ring-primary/20"
                    id="goalTarget"
                    min="1"
                    onChange={(e) => setGoalTarget(e.target.value)}
                    placeholder="10000"
                    required
                    step="0.01"
                    type="number"
                    value={goalTarget}
                  />
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  className="flex-1 h-12 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md cursor-pointer"
                  onClick={() => setIsGoalModalOpen(false)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 h-12 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-md shadow-primary/20 cursor-pointer"
                  type="submit"
                >
                  Criar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Modal para Aportar em Meta Existente */}
      {contributingGoal && (
        <div
          aria-labelledby="contributeGoalTitle"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-inverse-surface/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setContributingGoal(null);
          }}
          role="dialog"
        >
          <div className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl p-space-lg shadow-xl space-y-space-md">
            <div className="flex items-center justify-between gap-2 border-b border-surface-container pb-space-sm">
              <h3
                className="text-[16px] font-bold text-on-surface truncate min-w-0 flex-1"
                id="contributeGoalTitle"
              >
                Aportar: {contributingGoal.title}
              </h3>
              <button
                aria-label="Fechar modal de aporte"
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant cursor-pointer shrink-0"
                onClick={() => setContributingGoal(null)}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form className="space-y-space-md" onSubmit={handleContributionSubmit}>
              <div className="space-y-1">
                <label
                  className="font-label-sm text-label-sm text-on-surface"
                  htmlFor="goalContributeInput"
                >
                  Valor do Aporte ({symbol})
                </label>
                <input
                  className="w-full h-12 px-3.5 bg-surface-container-low rounded-xl text-on-surface font-currency-standard text-currency-standard focus:outline-none focus:ring-2 focus:ring-primary/20"
                  id="goalContributeInput"
                  min="0.01"
                  onChange={(e) => setContributionInput(e.target.value)}
                  placeholder="500.00"
                  required
                  step="0.01"
                  type="number"
                  value={contributionInput}
                />
              </div>
              <div className="pt-2 flex gap-3">
                <button
                  className="flex-1 h-12 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md cursor-pointer"
                  onClick={() => setContributingGoal(null)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="flex-1 h-12 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-md shadow-primary/20 cursor-pointer"
                  type="submit"
                >
                  Confirmar Aporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
