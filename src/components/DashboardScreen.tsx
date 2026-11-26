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
      <section className="flex items-center justify-between gap-3 pt-2">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[12px] text-on-surface-variant font-medium truncate">
            {topDateLabel}
          </span>
          <h1 className="text-[20px] leading-tight font-bold text-on-surface tracking-tight mt-0.5 truncate">
            Olá, {firstName} 👋
          </h1>
        </div>

        {/* Seletor de Moeda */}
        <div className="relative shrink-0">
          <label className="sr-only" htmlFor="currency-selector">
            Selecionar moeda
          </label>
          <select
            className="appearance-none bg-surface-container-high text-on-surface text-[12px] font-semibold pl-3 pr-7 py-1.5 rounded-full shadow-sm focus:outline-none focus:bg-surface-container-highest transition-colors cursor-pointer"
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
          <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[17px] text-on-surface-variant">
            expand_more
          </span>
        </div>
      </section>

      {/* Card Principal de Saldo Total */}
      <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col gap-3">
        <div className="absolute -right-12 -top-12 w-36 h-36 bg-primary-fixed/30 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between gap-2 relative z-10">
          <span className="text-[12px] font-semibold text-on-surface-variant">
            Saldo Total Líquido
          </span>
          <button
            aria-label={isBalanceHidden ? 'Mostrar Saldo' : 'Ocultar Saldo'}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer shrink-0"
            onClick={onToggleHideBalance}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">
              {isBalanceHidden ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 relative z-10 flex-wrap">
          <span
            className="text-[26px] leading-[32px] sm:text-[30px] text-on-surface tracking-tight font-bold tabular-nums break-words"
            data-testid="total-balance"
          >
            {isBalanceHidden
              ? '••••••••'
              : `${summary.netBalance < 0 ? '-' : ''}${formatMoney(summary.netBalance, currency)}`}
          </span>
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-secondary-container text-on-secondary-container text-[11px] font-bold whitespace-nowrap shrink-0">
            <span className="material-symbols-outlined text-[14px]">arrow_upward</span> +4.2%
          </span>
        </div>

        {/* Flex Cards de Resumo (Entradas, Saídas e Economia) */}
        <div className="flex flex-col gap-2 pt-1 relative z-10">
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 bg-surface-container-low p-3 rounded-xl flex flex-col justify-between gap-0.5">
              <div className="flex items-center gap-1 text-secondary text-[11px] font-semibold">
                <span className="material-symbols-outlined text-[15px] shrink-0">trending_up</span>
                <span className="whitespace-nowrap">Entradas</span>
              </div>
              <span
                className="text-[15px] leading-snug tracking-tight text-secondary font-bold tabular-nums break-words"
                data-testid="income-amount"
              >
                {formatSigned(summary.totalIncome, '+')}
              </span>
              <span className="text-[10.5px] text-on-surface-variant">
                {summary.incomeCount} no extrato
              </span>
            </div>

            <div className="flex-1 min-w-0 bg-surface-container-low p-3 rounded-xl flex flex-col justify-between gap-0.5">
              <div className="flex items-center gap-1 text-tertiary text-[11px] font-semibold">
                <span className="material-symbols-outlined text-[15px] shrink-0">
                  trending_down
                </span>
                <span className="whitespace-nowrap">Saídas</span>
              </div>
              <span
                className="text-[15px] leading-snug tracking-tight text-tertiary font-bold tabular-nums break-words"
                data-testid="expense-amount"
              >
                {formatSigned(summary.totalExpense, '-')}
              </span>
              <span className="text-[10.5px] text-on-surface-variant">
                {summary.expenseCount} lançamentos
              </span>
            </div>
          </div>

          <div className="bg-primary-fixed/40 px-3 py-2 rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-primary text-[12px] font-semibold min-w-0">
              <span className="material-symbols-outlined text-[16px] shrink-0">savings</span>
              <span className="whitespace-nowrap">Economia do mês</span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] shrink-0 whitespace-nowrap">
              <span className="font-bold text-primary tabular-nums">{summary.savingRate}%</span>
              <span aria-hidden="true" className="text-primary/50">
                ·
              </span>
              <span className="text-primary/90 font-medium">{savingNote}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Ações Rápidas */}
      <section className="flex flex-col space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[16px] font-bold text-on-surface">Ações Rápidas</h2>
          <span className="text-[11px] text-on-surface-variant whitespace-nowrap">
            Atalhos dinâmicos
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button
            className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl bg-surface-container-lowest hover:bg-surface-container active:scale-95 shadow-sm transition-all group cursor-pointer min-w-0"
            onClick={() => onOpenNewTransaction('income')}
            type="button"
          >
            <div className="w-9 h-9 rounded-full bg-secondary-container/60 text-secondary flex items-center justify-center mb-1 group-hover:scale-110 transition-transform shrink-0">
              <span className="material-symbols-outlined text-[19px]">add_circle</span>
            </div>
            <span className="text-[10.5px] font-semibold text-on-surface text-center whitespace-nowrap">
              + Receita
            </span>
          </button>

          <button
            className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl bg-surface-container-lowest hover:bg-surface-container active:scale-95 shadow-sm transition-all group cursor-pointer min-w-0"
            onClick={() => onOpenNewTransaction('expense')}
            type="button"
          >
            <div className="w-9 h-9 rounded-full bg-tertiary-fixed/70 text-tertiary flex items-center justify-center mb-1 group-hover:scale-110 transition-transform shrink-0">
              <span className="material-symbols-outlined text-[19px]">remove_circle</span>
            </div>
            <span className="text-[10.5px] font-semibold text-on-surface text-center whitespace-nowrap">
              - Despesa
            </span>
          </button>

          <button
            className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl bg-surface-container-lowest hover:bg-surface-container active:scale-95 shadow-sm transition-all group cursor-pointer min-w-0"
            onClick={() => {
              onNavigate('orcamentos');
              onNotify('Metas orçamentárias sincronizadas!');
            }}
            type="button"
          >
            <div className="w-9 h-9 rounded-full bg-primary-fixed text-primary flex items-center justify-center mb-1 group-hover:scale-110 transition-transform shrink-0">
              <span className="material-symbols-outlined text-[19px]">flag</span>
            </div>
            <span className="text-[10.5px] font-semibold text-on-surface text-center whitespace-nowrap">
              Definir Meta
            </span>
          </button>

          <button
            className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl bg-surface-container-lowest hover:bg-surface-container active:scale-95 shadow-sm transition-all group cursor-pointer min-w-0"
            onClick={onExportCSV}
            type="button"
          >
            <div className="w-9 h-9 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center mb-1 group-hover:scale-110 transition-transform shrink-0">
              <span className="material-symbols-outlined text-[19px]">download</span>
            </div>
            <span className="text-[10.5px] font-semibold text-on-surface text-center whitespace-nowrap">
              Extrato CSV
            </span>
          </button>
        </div>
      </section>

      {/* Gráfico de Fluxo de Caixa (Últimos 6 Meses) */}
      <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col space-y-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[16px] font-bold text-on-surface truncate">Fluxo de Caixa</h3>
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-secondary shrink-0" /> Entradas
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-error shrink-0" /> Saídas
              </div>
            </div>
          </div>
          <p className="text-[12px] text-on-surface-variant">Últimos 6 meses de movimentação</p>
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
              const incHeight = Math.max(
                Math.round((m.income / maxFlowValue) * 90),
                m.income > 0 ? 4 : 0
              );
              const expHeight = Math.max(
                Math.round((m.expense / maxFlowValue) * 90),
                m.expense > 0 ? 4 : 0
              );
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
      <section className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col space-y-3.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[16px] font-bold text-on-surface truncate">
              Despesas por Categoria
            </h3>
            <span className="text-[11px] font-semibold text-on-surface-variant whitespace-nowrap shrink-0">
              {cycleInfo.monthYearLabel}
            </span>
          </div>
          <p className="text-[12px] text-on-surface-variant">
            Distribuição percentual deste mês
          </p>
        </div>

        {donutSegments.length === 0 ? (
          <p className="text-[12px] text-on-surface-variant text-center py-4">
            Nenhuma despesa registrada para calcular a distribuição.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center shrink-0">
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
                <span className="text-[10px] text-on-surface-variant font-medium leading-none">
                  Total
                </span>
                <span className="text-[15px] text-on-surface font-bold mt-0.5 tabular-nums">
                  100%
                </span>
              </div>
            </div>

            <div className="flex flex-col space-y-1.5 flex-1 min-w-0">
              {donutSegments.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-2 text-[12px]"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.dotClass} shrink-0`} />
                    <span className="text-on-surface truncate">{item.name}</span>
                  </div>
                  <span className="font-bold text-on-surface shrink-0 tabular-nums">
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Últimas Transações */}
      <section className="flex flex-col space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-[16px] font-bold text-on-surface truncate">Últimas Transações</h3>
            <span
              className="text-[12px] text-on-surface-variant font-semibold tabular-nums shrink-0"
              data-testid="trans-count-badge"
            >
              ({transactions.length})
            </span>
          </div>
          <button
            className="text-[12px] font-semibold text-primary hover:underline cursor-pointer whitespace-nowrap shrink-0"
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
              <h4 className="text-[16px] font-bold text-on-surface">Nenhuma transação ainda</h4>
              <p className="text-[12px] text-on-surface-variant max-w-xs mt-1">
                Registre suas despesas ou receitas para manter sua vida financeira nos trilhos.
              </p>
            </div>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-[12px] font-semibold hover:bg-primary-container active:scale-95 transition-all shadow-md shadow-primary/20 cursor-pointer whitespace-nowrap"
              onClick={() => onOpenNewTransaction('income')}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">add</span> Adicionar Primeira
              Transação
            </button>
          </div>
        ) : (
          <div
            className="bg-surface-container-lowest rounded-2xl shadow-sm divide-y divide-surface-container/60 overflow-hidden"
            data-testid="dashboard-transactions-list"
          >
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
                  className="w-full text-left flex items-start gap-3 p-3.5 hover:bg-surface-container-low/60 transition-colors cursor-pointer"
                  onClick={() => onEditTransaction(item)}
                  type="button"
                >
                  <div
                    className={`w-10 h-10 rounded-full ${catConfig.bg} ${catConfig.color} flex items-center justify-center shrink-0 mt-0.5`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {catConfig.icon}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[14px] leading-snug text-on-surface font-semibold truncate flex-1 min-w-0">
                        {item.description}
                      </span>
                      <span
                        className={`text-[14px] leading-snug font-bold tabular-nums whitespace-nowrap shrink-0 ${
                          isIncome ? 'text-secondary' : 'text-on-surface'
                        }`}
                      >
                        {isBalanceHidden
                          ? '••••'
                          : `${sign}${formatMoney(item.amount, currency)}`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-on-surface-variant min-w-0 truncate">
                        <span className="shrink-0">{dateDisplay}</span>
                        <span aria-hidden="true" className="shrink-0">
                          ·
                        </span>
                        <span className="truncate">{item.account}</span>
                      </div>
                      <span
                        className={`shrink-0 font-semibold ${
                          item.status === 'pending'
                            ? 'text-amber-700'
                            : isIncome
                              ? 'text-secondary'
                              : 'text-on-surface-variant'
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </div>
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
