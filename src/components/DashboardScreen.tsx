import { useMemo, useState } from 'react';
import { CATEGORY_STYLE_META, DASHBOARD_BASELINE_HISTORY } from '../data/seed';
import type { AppScreen, CurrencyCode, Transaction, TransactionType } from '../types/finance';
import {
  computeDynamicSixMonthSeries,
  computeExpenseBreakdown,
  computeTransactionSummary,
  daysAgoISODate,
  filterTransactionsByMonth,
  formatMoney,
  getMonthCycleInfo,
  toLocalISODate,
} from '../utils/finance';

interface DashboardScreenProps {
  transactions: Transaction[];
  currency: CurrencyCode;
  firstName: string;
  isBalanceHidden: boolean;
  onChangeCurrency: (c: CurrencyCode) => void;
  onToggleHideBalance: () => void;
  onOpenNewTransaction: (type: TransactionType) => void;
  onEditTransaction: (tx: Transaction) => void;
  onNavigate: (screen: AppScreen) => void;
  onExportCSV: () => void;
  onNotify: (msg: string) => void;
}

export function DashboardScreen({
  transactions,
  currency,
  firstName,
  isBalanceHidden,
  onChangeCurrency,
  onToggleHideBalance,
  onOpenNewTransaction,
  onEditTransaction,
  onNavigate,
  onExportCSV,
  onNotify,
}: DashboardScreenProps) {
  const [barTip, setBarTip] = useState<string | null>(null);

  const cycleInfo = useMemo(() => getMonthCycleInfo(), []);
  const summary = useMemo(() => computeTransactionSummary(transactions), [transactions]);
  const currentMonthTxs = useMemo(
    () => filterTransactionsByMonth(transactions, cycleInfo.year, cycleInfo.monthIndex),
    [transactions, cycleInfo.year, cycleInfo.monthIndex]
  );

  const cashFlowSeries = useMemo(
    () => computeDynamicSixMonthSeries(transactions, DASHBOARD_BASELINE_HISTORY),
    [transactions]
  );

  const maxFlowValue = useMemo(() => {
    const peak = cashFlowSeries.reduce(
      (max, item) => Math.max(max, item.income, item.expense),
      1000
    );
    return peak * 1.08;
  }, [cashFlowSeries]);

  const expenseBreakdown = useMemo(
    () => computeExpenseBreakdown(currentMonthTxs.length > 0 ? currentMonthTxs : transactions),
    [currentMonthTxs, transactions]
  );

  const donutSegments = useMemo(() => {
    const circumference = 2 * Math.PI * 38;
    const totalAmount = expenseBreakdown.reduce((sum, item) => sum + item.amount, 0);
    let cumulativeOffset = 0;
    return expenseBreakdown.map((item) => {
      const fraction = totalAmount > 0 ? item.amount / totalAmount : 0;
      const dashLength = Math.max(fraction * circumference, 2);
      const segment = {
        ...item,
        dashArray: `${dashLength.toFixed(1)} ${circumference.toFixed(1)}`,
        dashOffset: -cumulativeOffset,
      };
      cumulativeOffset += dashLength;
      return segment;
    });
  }, [expenseBreakdown]);

  const sortedRecentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => {
        const aKey = `${a.date}T${a.time ?? '00:00'}`;
        const bKey = `${b.date}T${b.time ?? '00:00'}`;
        return bKey.localeCompare(aKey);
      })
      .slice(0, 5);
  }, [transactions]);

  const topDateLabel = useMemo(() => {
    const formatted = new Date().toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    return `Hoje, ${formatted.charAt(0).toUpperCase() + formatted.slice(1)}`;
  }, []);

  const todayIso = toLocalISODate();
  const yesterdayIso = daysAgoISODate(1);

  const formatSigned = (val: number, sign: '' | '+' | '-') => {
    if (isBalanceHidden) {
      return sign === '' ? '••••••••' : `${sign}••••`;
    }
    return `${sign}${formatMoney(val, currency)}`;
  };

  const savingNumeric = parseFloat(summary.savingRate);
  const savingNote =
    savingNumeric >= 20
      ? 'Meta batida! 🎉'
      : savingNumeric >= 0
        ? 'No controle'
        : 'Saldo negativo';

  return (
    <div className="flex flex-col w-full px-margin space-y-space-lg pb-10">
      {/* Acolhimento & Seletor de Moeda */}
      <section className="flex items-center justify-between pt-2">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span>{topDateLabel}</span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight mt-0.5">
            Olá, {firstName} 👋
          </h1>
        </div>

        {/* Moeda Dropdown Pill */}
        <div className="relative">
          <label className="sr-only" htmlFor="currency-selector">
            Selecionar moeda
          </label>
          <select
            className="appearance-none bg-surface-container-high text-on-surface font-label-sm text-label-sm pl-3 pr-7 py-1.5 rounded-full shadow-sm focus:outline-none focus:bg-surface-container-highest transition-colors cursor-pointer"
            id="currency-selector"
            onChange={(e) => {
              const next = e.target.value as CurrencyCode;
              onChangeCurrency(next);
              onNotify(`Moeda alterada para ${next}`);
            }}
            value={currency}
          >
            <option value="MZN">MZN (MT)</option>
            <option value="USD">USD ($)</option>
          </select>
          <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant">
            expand_more
          </span>
        </div>
      </section>

      {/* Card Principal de Saldo Total */}
      <section className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-36 h-36 bg-primary-fixed/30 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between mb-1 relative z-10">
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Saldo Total Líquido
          </span>
          <button
            aria-label={isBalanceHidden ? 'Mostrar Saldo' : 'Ocultar Saldo'}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
            onClick={onToggleHideBalance}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isBalanceHidden ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>

        <div className="flex items-baseline gap-2 mb-4 relative z-10 flex-wrap">
          <span
            className="font-display-hero-mobile text-display-hero-mobile text-on-surface tracking-tight font-bold"
            data-testid="total-balance"
          >
            {isBalanceHidden
              ? '••••••••'
              : `${summary.netBalance < 0 ? '-' : ''}${formatMoney(summary.netBalance, currency)}`}
          </span>
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[11px]">
            <span className="material-symbols-outlined text-[14px]">arrow_upward</span> +4.2%
          </span>
        </div>

        {/* Grid 3 Mini-Cards de Resumo */}
        <div className="grid grid-cols-3 gap-space-xs pt-2">
          <div className="bg-surface-container-low p-2.5 rounded-xl flex flex-col justify-between min-w-0">
            <div className="flex items-center gap-1 text-secondary font-label-sm text-[11px] mb-1">
              <span className="material-symbols-outlined text-[15px]">trending_up</span>
              <span>Entradas</span>
            </div>
            <span
              className="font-currency-standard text-[13px] leading-[18px] tracking-tight text-secondary font-bold whitespace-nowrap"
              data-testid="income-amount"
            >
              {formatSigned(summary.totalIncome, '+')}
            </span>
            <span className="font-body-sm text-[10px] text-on-surface-variant mt-0.5">
              {summary.incomeCount} no extrato
            </span>
          </div>

          <div className="bg-surface-container-low p-2.5 rounded-xl flex flex-col justify-between min-w-0">
            <div className="flex items-center gap-1 text-tertiary font-label-sm text-[11px] mb-1">
              <span className="material-symbols-outlined text-[15px]">trending_down</span>
              <span>Saídas</span>
            </div>
            <span
              className="font-currency-standard text-[13px] leading-[18px] tracking-tight text-tertiary font-bold whitespace-nowrap"
              data-testid="expense-amount"
            >
              {formatSigned(summary.totalExpense, '-')}
            </span>
            <span className="font-body-sm text-[10px] text-on-surface-variant mt-0.5">
              {summary.expenseCount} lançamentos
            </span>
          </div>

          <div className="bg-primary-fixed/40 p-2.5 rounded-xl flex flex-col justify-between min-w-0">
            <div className="flex items-center gap-1 text-primary font-label-sm text-[11px] mb-1">
              <span className="material-symbols-outlined text-[15px]">savings</span>
              <span>Economia</span>
            </div>
            <span className="font-currency-standard text-[14px] leading-[18px] text-primary truncate font-bold">
              {summary.savingRate}%
            </span>
            <span className="font-body-sm text-[10px] text-primary/80 mt-0.5 truncate">
              {savingNote}
            </span>
          </div>
        </div>
      </section>

      {/* Ações Rápidas */}
      <section className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Ações Rápidas</h2>
          <span className="font-label-sm text-[11px] text-on-surface-variant">
            Atalhos dinâmicos
          </span>
        </div>
        <div className="grid grid-cols-4 gap-space-xs">
          <button
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container active:scale-95 shadow-sm transition-all group cursor-pointer"
            onClick={() => onOpenNewTransaction('income')}
            type="button"
          >
            <div className="w-10 h-10 rounded-full bg-secondary-container/60 text-secondary flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[20px]">add_circle</span>
            </div>
            <span className="font-label-sm text-[11px] text-on-surface text-center">+ Receita</span>
          </button>

          <button
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container active:scale-95 shadow-sm transition-all group cursor-pointer"
            onClick={() => onOpenNewTransaction('expense')}
            type="button"
          >
            <div className="w-10 h-10 rounded-full bg-tertiary-fixed/70 text-tertiary flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[20px]">remove_circle</span>
            </div>
            <span className="font-label-sm text-[11px] text-on-surface text-center">- Despesa</span>
          </button>

          <button
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container active:scale-95 shadow-sm transition-all group cursor-pointer"
            onClick={() => {
              onNavigate('orcamentos');
              onNotify('Metas orçamentárias sincronizadas!');
            }}
            type="button"
          >
            <div className="w-10 h-10 rounded-full bg-primary-fixed text-primary flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[20px]">flag</span>
            </div>
            <span className="font-label-sm text-[11px] text-on-surface text-center">
              Definir Meta
            </span>
          </button>

          <button
            className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-surface-container-lowest hover:bg-surface-container active:scale-95 shadow-sm transition-all group cursor-pointer"
            onClick={onExportCSV}
            type="button"
          >
            <div className="w-10 h-10 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[20px]">download</span>
            </div>
            <span className="font-label-sm text-[11px] text-on-surface text-center">
              Extrato CSV
            </span>
          </button>
        </div>
      </section>

      {/* Gráfico de Fluxo de Caixa (Últimos 6 Meses) */}
      <section className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">Fluxo de Caixa</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Últimos 6 meses de movimentação
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 font-label-sm text-[11px] text-on-surface-variant">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary" /> Entradas
            </div>
            <div className="flex items-center gap-1 font-label-sm text-[11px] text-on-surface-variant">
              <span className="w-2.5 h-2.5 rounded-full bg-error" /> Saídas
            </div>
          </div>
        </div>

        <div className="relative w-full h-44 flex flex-col justify-end pt-4 pb-1">
          <div
            className={`absolute -top-1 left-1/2 -translate-x-1/2 pointer-events-none transition-all duration-200 bg-inverse-surface text-inverse-on-surface font-label-sm text-[11px] px-2.5 py-1 rounded-lg shadow-md z-10 whitespace-nowrap ${
              barTip ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {barTip ?? ''}
          </div>
          <svg
            aria-label="Gráfico de fluxo de caixa dos últimos 6 meses"
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 320 120"
          >
            <line
              stroke="#f2f3ff"
              strokeDasharray="4"
              strokeWidth="1"
              x1="0"
              x2="320"
              y1="20"
              y2="20"
            />
            <line
              stroke="#f2f3ff"
              strokeDasharray="4"
              strokeWidth="1"
              x1="0"
              x2="320"
              y1="65"
              y2="65"
            />
            <line stroke="#dae2fd" strokeWidth="1" x1="0" x2="320" y1="110" y2="110" />

            {cashFlowSeries.map((m, idx) => {
              const xBase = 15 + idx * 53;
              const incHeight = Math.max(Math.round((m.income / maxFlowValue) * 90), m.income > 0 ? 4 : 0);
              const expHeight = Math.max(Math.round((m.expense / maxFlowValue) * 90), m.expense > 0 ? 4 : 0);
              const tip = `${m.month}/${m.year}: Entradas ${formatMoney(m.income, currency)} | Saídas ${formatMoney(m.expense, currency)}`;

              return (
                <g
                  key={m.key}
                  className="cursor-pointer group"
                  onClick={() => setBarTip((prev) => (prev === tip ? null : tip))}
                  onMouseEnter={() => setBarTip(tip)}
                  onMouseLeave={() => setBarTip(null)}
                >
                  <rect
                    className="transition-opacity group-hover:opacity-80"
                    fill="#006c49"
                    height={incHeight}
                    rx="4"
                    width="12"
                    x={xBase}
                    y={110 - incHeight}
                  />
                  <rect
                    className="transition-opacity group-hover:opacity-80"
                    fill="#ba1a1a"
                    height={expHeight}
                    rx="4"
                    width="12"
                    x={xBase + 15}
                    y={110 - expHeight}
                  />
                  <text
                    fill={m.highlight ? '#3525cd' : '#777587'}
                    fontFamily="Inter"
                    fontSize="9"
                    fontWeight={m.highlight ? '700' : '400'}
                    textAnchor="middle"
                    x={xBase + 13}
                    y="122"
                  >
                    {m.month}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      {/* Despesas por Categoria (Mês Atual) */}
      <section className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              Despesas por Categoria
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Distribuição percentual deste mês
            </p>
          </div>
          <span className="inline-flex px-2 py-0.5 rounded-full bg-surface-container font-label-sm text-[11px] text-on-surface-variant">
            {cycleInfo.monthYearLabel}
          </span>
        </div>

        {donutSegments.length === 0 ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant text-center py-4">
            Nenhuma despesa registrada para calcular a distribuição.
          </p>
        ) : (
          <div className="flex items-center justify-center gap-6">
            <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" fill="transparent" r="38" stroke="#f2f3ff" strokeWidth="12" />
                {donutSegments.map((seg) => (
                  <circle
                    key={seg.name}
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="38"
                    stroke={seg.strokeColor}
                    strokeDasharray={seg.dashArray}
                    strokeDashoffset={seg.dashOffset}
                    strokeWidth="12"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-body-sm text-[10px] text-on-surface-variant font-medium leading-none">
                  Total
                </span>
                <span className="font-headline-sm text-[16px] text-on-surface font-bold mt-0.5">
                  100%
                </span>
              </div>
            </div>

            <div className="flex flex-col space-y-1.5 flex-1 min-w-0">
              {donutSegments.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-body-sm">
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.dotClass} shrink-0`} />
                    <span className="text-on-surface truncate">{item.name}</span>
                  </div>
                  <span className="font-semibold text-on-surface shrink-0 ml-1">
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Últimas Transações */}
      <section className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              Últimas Transações
            </h3>
            <span
              className="px-2 py-0.5 rounded-full bg-surface-container font-label-sm text-[11px] text-on-surface-variant font-bold"
              data-testid="trans-count-badge"
            >
              {transactions.length}
            </span>
          </div>
          <button
            className="font-label-sm text-label-sm text-primary hover:underline cursor-pointer"
            onClick={() => onNavigate('transacoes')}
            type="button"
          >
            Ver todas
          </button>
        </div>

        {sortedRecentTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 bg-surface-container-lowest rounded-2xl text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[32px]">receipt_long</span>
            </div>
            <div className="flex flex-col">
              <h4 className="font-headline-sm text-headline-sm text-on-surface">
                Nenhuma transação ainda
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant max-w-xs mt-1">
                Registre suas despesas ou receitas para manter sua vida financeira nos trilhos.
              </p>
            </div>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-label-sm text-label-sm hover:bg-primary-container active:scale-95 transition-all shadow-md shadow-primary/20 cursor-pointer"
              onClick={() => onOpenNewTransaction('income')}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">add</span> Adicionar Primeira
              Transação
            </button>
          </div>
        ) : (
          <div className="flex flex-col space-y-2" data-testid="dashboard-transactions-list">
            {sortedRecentTransactions.map((item) => {
              const isIncome = item.type === 'income';
              const catConfig = CATEGORY_STYLE_META[item.category] ?? CATEGORY_STYLE_META.Outros;
              const sign = isIncome ? '+' : '-';
              const statusLabel =
                item.status === 'pending' ? 'Pendente' : isIncome ? 'Recebido' : 'Pago';
              const datePrefix =
                item.date === todayIso
                  ? 'Hoje'
                  : item.date === yesterdayIso
                    ? 'Ontem'
                    : item.date.split('-').reverse().slice(0, 2).join('/');
              const dateDisplay = item.time ? `${datePrefix}, ${item.time}` : datePrefix;

              return (
                <button
                  key={item.id}
                  className="w-full text-left flex items-center justify-between p-3 bg-surface-container-lowest rounded-2xl shadow-sm hover:bg-surface-container-low transition-colors cursor-pointer"
                  onClick={() => onEditTransaction(item)}
                  type="button"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-full ${catConfig.bg} ${catConfig.color} flex items-center justify-center shrink-0`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {catConfig.icon}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-md text-label-md text-on-surface font-semibold truncate">
                        {item.description}
                      </span>
                      <div className="flex items-center gap-1.5 text-body-sm text-[11px] text-on-surface-variant min-w-0">
                        <span className="shrink-0">{dateDisplay}</span>
                        <span>•</span>
                        <span className="truncate">{item.account}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0 pl-2">
                    <span
                      className={`font-currency-standard text-currency-standard font-bold ${
                        isIncome ? 'text-secondary' : 'text-on-surface'
                      }`}
                    >
                      {isBalanceHidden
                        ? '••••'
                        : `${sign}${formatMoney(item.amount, currency)}`}
                    </span>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] rounded-full font-label-sm mt-0.5 ${
                        item.status === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : isIncome
                            ? 'bg-secondary-container text-on-secondary-container'
                            : 'bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
