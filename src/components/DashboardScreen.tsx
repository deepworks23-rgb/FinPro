import { AppIcon } from './AppIcon';
import { useMemo, useState } from 'react';
import { CATEGORY_STYLE_META, DASHBOARD_BASELINE_HISTORY } from '../data/seed';
import type {
  AlertSettings,
  AppScreen,
  CurrencyCode,
  Transaction,
  TransactionType,
} from '../types/finance';
import {
  computeDynamicSixMonthSeries,
  computeExpenseBreakdown,
  computeMonthOverMonthDelta,
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
  isBalanceHidden: boolean;
  alertSettings: AlertSettings;
  now?: Date;
  onToggleHideBalance: () => void;
  onOpenNewTransaction: (type: TransactionType) => void;
  onEditTransaction: (tx: Transaction) => void;
  onToggleStatus: (id: string) => void;
  onNavigate: (screen: AppScreen) => void;
  onOpenNotifications: () => void;
  onExportCSV: () => void;
  onNotify: (msg: string) => void;
}

export function DashboardScreen({
  transactions,
  currency,
  isBalanceHidden,
  alertSettings,
  now = new Date(),
  onToggleHideBalance,
  onOpenNewTransaction,
  onEditTransaction,
  onToggleStatus,
  onNavigate,
  onOpenNotifications,
  onExportCSV,
  onNotify,
}: DashboardScreenProps) {
  const [selectedFlowKey, setSelectedFlowKey] = useState<string | null>(null);
  const [selectedDonutCategory, setSelectedDonutCategory] = useState<string | null>(null);
  const [donutScope, setDonutScope] = useState<'all' | 'completed'>('all');

  const cycleInfo = useMemo(() => getMonthCycleInfo(now), [now]);
  const summary = useMemo(() => computeTransactionSummary(transactions), [transactions]);
  const currentMonthTxs = useMemo(
    () => filterTransactionsByMonth(transactions, cycleInfo.year, cycleInfo.monthIndex),
    [transactions, cycleInfo.year, cycleInfo.monthIndex]
  );

  const cashFlowSeries = useMemo(
    () => computeDynamicSixMonthSeries(transactions, DASHBOARD_BASELINE_HISTORY, now),
    [transactions, now]
  );

  const momDelta = useMemo(() => computeMonthOverMonthDelta(cashFlowSeries), [cashFlowSeries]);

  const activeFlowItem = useMemo(() => {
    return (
      cashFlowSeries.find((m) => m.key === selectedFlowKey) ??
      cashFlowSeries[cashFlowSeries.length - 1]
    );
  }, [cashFlowSeries, selectedFlowKey]);

  const maxFlowValue = useMemo(() => {
    const peak = cashFlowSeries.reduce(
      (max, item) => Math.max(max, item.income, item.expense),
      1000
    );
    return peak * 1.1;
  }, [cashFlowSeries]);

  const scopedDonutTxs = useMemo(() => {
    const base = currentMonthTxs.length > 0 ? currentMonthTxs : transactions;
    return donutScope === 'completed' ? base.filter((t) => t.status === 'completed') : base;
  }, [currentMonthTxs, transactions, donutScope]);

  const expenseBreakdown = useMemo(
    () => computeExpenseBreakdown(scopedDonutTxs),
    [scopedDonutTxs]
  );

  const totalDonutAmount = useMemo(
    () => expenseBreakdown.reduce((sum, item) => sum + item.amount, 0),
    [expenseBreakdown]
  );

  const activeDonutItem = useMemo(
    () => expenseBreakdown.find((item) => item.name === selectedDonutCategory) ?? null,
    [expenseBreakdown, selectedDonutCategory]
  );

  const donutSegments = useMemo(() => {
    const circumference = 2 * Math.PI * 38;
    let cumulativeOffset = 0;
    return expenseBreakdown.map((item) => {
      const fraction = totalDonutAmount > 0 ? item.amount / totalDonutAmount : 0;
      const dashLength = Math.max(fraction * circumference, 2);
      const segment = {
        ...item,
        dashArray: `${dashLength.toFixed(1)} ${circumference.toFixed(1)}`,
        dashOffset: -cumulativeOffset,
      };
      cumulativeOffset += dashLength;
      return segment;
    });
  }, [expenseBreakdown, totalDonutAmount]);

  const sortedRecentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => {
        const aKey = `${a.date}T${a.time ?? '00:00'}`;
        const bKey = `${b.date}T${b.time ?? '00:00'}`;
        return bKey.localeCompare(aKey);
      })
      .slice(0, 5);
  }, [transactions]);

  const todayIso = toLocalISODate(now);
  const yesterdayIso = daysAgoISODate(1, now);

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

  const isCriticalBalance =
    transactions.length > 0 &&
    alertSettings.enableLowBalanceAlerts &&
    summary.netBalance <= alertSettings.negativeAlertThreshold;
  const isLowBalance =
    transactions.length > 0 &&
    alertSettings.enableLowBalanceAlerts &&
    !isCriticalBalance &&
    summary.netBalance <= Math.max(alertSettings.lowBalanceThreshold, alertSettings.negativeAlertThreshold);

  return (
    <div className="flex flex-col w-full px-3 pt-2 space-y-3 pb-2">
      {/* Card Principal de Saldo Total */}
      <section className="bg-surface-container-lowest rounded-2xl p-3 shadow-sm relative overflow-hidden flex flex-col gap-2.5">
        <div className="absolute -right-12 -top-12 w-32 h-32 bg-primary-fixed/30 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center justify-between gap-2 relative z-10">
          <span className="text-[12px] font-semibold text-on-surface-variant">
            Saldo Total Líquido
          </span>
          <button
            aria-label={isBalanceHidden ? 'Mostrar valores' : 'Ocultar valores'}
            aria-pressed={isBalanceHidden}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
              isBalanceHidden
                ? 'bg-primary-fixed text-primary hover:bg-primary-fixed-dim/50'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
            onClick={onToggleHideBalance}
            title={isBalanceHidden ? 'Mostrar valores' : 'Ocultar valores'}
            type="button"
          >
            <AppIcon name={isBalanceHidden ? 'visibility_off' : 'visibility'} className="text-[19px]" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 relative z-10 flex-wrap">
          <span
            className={`text-[24px] leading-[30px] sm:text-[28px] tracking-tight font-bold tabular-nums break-words ${
              summary.netBalance < 0 ? 'text-tertiary' : 'text-on-surface'
            }`}
            data-testid="total-balance"
          >
            {isBalanceHidden
              ? '••••••••'
              : `${summary.netBalance < 0 ? '-' : ''}${formatMoney(Math.abs(summary.netBalance), currency)}`}
          </span>
          <span
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap shrink-0 ${
              momDelta.isPositive
                ? 'bg-secondary-container text-on-secondary-container'
                : 'bg-error-container text-on-error-container'
            }`}
          >
            <AppIcon name={momDelta.isPositive ? 'arrow_upward' : 'arrow_downward'} className="text-[13px]" />
            {momDelta.pctText}
          </span>
        </div>

        {(isCriticalBalance || isLowBalance) && (
          <button
            className={`relative z-10 w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 text-[11px] font-semibold cursor-pointer transition-opacity hover:opacity-90 ${
              isCriticalBalance
                ? 'bg-error-container/70 text-on-error-container'
                : 'bg-amber-100 text-amber-900'
            }`}
            onClick={onOpenNotifications}
            type="button"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <AppIcon name="warning" className="text-[15px] shrink-0" />
              <span className="break-words">
                {isCriticalBalance
                  ? 'Alerta crítico: saldo atingiu limite definido'
                  : `Saldo a esgotar (margem: ${isBalanceHidden ? '••••' : formatMoney(alertSettings.lowBalanceThreshold, currency)})`}
              </span>
            </span>
            <AppIcon name="chevron_right" className="text-[15px] shrink-0" />
          </button>
        )}

        {/* Flex Cards de Resumo */}
        <div className="flex flex-col gap-1.5 pt-0.5 relative z-10">
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 bg-surface-container-low p-2.5 rounded-xl flex flex-col justify-between gap-0.5">
              <div className="flex items-center gap-1 text-secondary text-[11px] font-semibold">
                <AppIcon name="trending_up" className="text-[14px] shrink-0" />
                <span className="whitespace-nowrap">Entradas</span>
              </div>
              <span
                className="text-[14.5px] leading-snug tracking-tight text-secondary font-bold tabular-nums break-words"
                data-testid="income-amount"
              >
                {formatSigned(summary.totalIncome, '+')}
              </span>
              <span className="text-[10.5px] text-on-surface-variant">
                {summary.incomeCount} no extrato
              </span>
            </div>

            <div className="flex-1 min-w-0 bg-surface-container-low p-2.5 rounded-xl flex flex-col justify-between gap-0.5">
              <div className="flex items-center gap-1 text-tertiary text-[11px] font-semibold">
                <AppIcon name="trending_down" className="text-[14px] shrink-0" />
                <span className="whitespace-nowrap">Saídas</span>
              </div>
              <span
                className="text-[14.5px] leading-snug tracking-tight text-tertiary font-bold tabular-nums break-words"
                data-testid="expense-amount"
              >
                {formatSigned(summary.totalExpense, '-')}
              </span>
              <span className="text-[10.5px] text-on-surface-variant">
                {summary.expenseCount} lançamentos
              </span>
            </div>
          </div>

          <div className="bg-primary-fixed/40 px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-primary text-[11.5px] font-semibold min-w-0">
              <AppIcon name="savings" className="text-[15px] shrink-0" />
              <span className="whitespace-nowrap">Economia do mês</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11.5px] shrink-0 whitespace-nowrap">
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
      <section className="flex flex-col space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-on-surface">Ações Rápidas</h2>
          <span className="text-[11px] text-on-surface-variant whitespace-nowrap">
            Atalhos dinâmicos
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-surface-container-lowest hover:bg-surface-container active:scale-95 shadow-sm transition-all group cursor-pointer min-w-0"
            onClick={() => onOpenNewTransaction('income')}
            type="button"
          >
            <div className="w-8 h-8 rounded-full bg-secondary-container/60 text-secondary flex items-center justify-center mb-1 group-hover:scale-110 transition-transform shrink-0">
              <AppIcon name="add_circle" className="text-[18px]" />
            </div>
            <span className="text-[10.5px] font-semibold text-on-surface text-center whitespace-nowrap">
              + Receita
            </span>
          </button>

          <button
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-surface-container-lowest hover:bg-surface-container active:scale-95 shadow-sm transition-all group cursor-pointer min-w-0"
            onClick={() => onOpenNewTransaction('expense')}
            type="button"
          >
            <div className="w-8 h-8 rounded-full bg-tertiary-fixed/70 text-tertiary flex items-center justify-center mb-1 group-hover:scale-110 transition-transform shrink-0">
              <AppIcon name="remove_circle" className="text-[18px]" />
            </div>
            <span className="text-[10.5px] font-semibold text-on-surface text-center whitespace-nowrap">
              - Despesa
            </span>
          </button>

          <button
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-surface-container-lowest hover:bg-surface-container active:scale-95 shadow-sm transition-all group cursor-pointer min-w-0"
            onClick={() => {
              onNavigate('orcamentos');
              onNotify('Metas orçamentárias sincronizadas!');
            }}
            type="button"
          >
            <div className="w-8 h-8 rounded-full bg-primary-fixed text-primary flex items-center justify-center mb-1 group-hover:scale-110 transition-transform shrink-0">
              <AppIcon name="flag" className="text-[18px]" />
            </div>
            <span className="text-[10.5px] font-semibold text-on-surface text-center whitespace-nowrap">
              Definir Meta
            </span>
          </button>

          <button
            className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-surface-container-lowest hover:bg-surface-container active:scale-95 shadow-sm transition-all group cursor-pointer min-w-0"
            onClick={onExportCSV}
            type="button"
          >
            <div className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center mb-1 group-hover:scale-110 transition-transform shrink-0">
              <AppIcon name="download" className="text-[18px]" />
            </div>
            <span className="text-[10.5px] font-semibold text-on-surface text-center whitespace-nowrap">
              Extrato CSV
            </span>
          </button>
        </div>
      </section>

      {/* Gráfico de Fluxo de Caixa Interativo (Últimos 6 Meses) */}
      <section className="bg-surface-container-lowest rounded-2xl p-3 shadow-sm flex flex-col space-y-2.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-bold text-on-surface">Fluxo de Caixa</h3>
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-secondary shrink-0" /> Entradas
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-error shrink-0" /> Saídas
              </div>
            </div>
          </div>
          <p className="text-[11.5px] text-on-surface-variant">
            Toque em um mês para inspecionar em tempo real
          </p>
        </div>

        <div className="relative w-full h-36 flex flex-col justify-end pt-2">
          <svg
            aria-label="Gráfico de fluxo de caixa dos últimos 6 meses"
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
            viewBox="0 0 320 120"
          >
            <line
              stroke="#f1f5f9"
              strokeDasharray="4"
              strokeWidth="1"
              x1="0"
              x2="320"
              y1="20"
              y2="20"
            />
            <line
              stroke="#f1f5f9"
              strokeDasharray="4"
              strokeWidth="1"
              x1="0"
              x2="320"
              y1="65"
              y2="65"
            />
            <line stroke="#e2e8f0" strokeWidth="1" x1="0" x2="320" y1="110" y2="110" />

            {cashFlowSeries.map((m, idx) => {
              const xBase = 15 + idx * 53;
              const incHeight = Math.max(
                Math.round((m.income / maxFlowValue) * 88),
                m.income > 0 ? 4 : 0
              );
              const expHeight = Math.max(
                Math.round((m.expense / maxFlowValue) * 88),
                m.expense > 0 ? 4 : 0
              );
              const isSelected = activeFlowItem?.key === m.key;

              return (
                <g
                  key={m.key}
                  aria-label={`Selecionar ${m.label}`}
                  className="cursor-pointer group"
                  onClick={() => setSelectedFlowKey(m.key)}
                  role="button"
                  tabIndex={0}
                >
                  <rect
                    fill={isSelected ? '#e2e8f0' : 'transparent'}
                    height="116"
                    rx="6"
                    width="38"
                    x={xBase - 5}
                    y="4"
                  />
                  <rect
                    className="transition-all duration-300"
                    fill="#047857"
                    height={incHeight}
                    opacity={isSelected ? 1 : 0.85}
                    rx="4"
                    width="12"
                    x={xBase}
                    y={110 - incHeight}
                  />
                  <rect
                    className="transition-all duration-300"
                    fill="#dc2626"
                    height={expHeight}
                    opacity={isSelected ? 1 : 0.85}
                    rx="4"
                    width="12"
                    x={xBase + 15}
                    y={110 - expHeight}
                  />
                  <text
                    fill={isSelected ? '#0f172a' : '#64748b'}
                    fontFamily="Inter"
                    fontSize="9.5"
                    fontWeight={isSelected ? '700' : '500'}
                    textAnchor="middle"
                    x={xBase + 13}
                    y="121"
                  >
                    {m.month}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {activeFlowItem && (
          <div className="bg-surface-container-low rounded-xl px-2.5 py-2 flex items-center justify-between gap-2 flex-wrap text-[11px]">
            <span className="font-bold text-primary whitespace-nowrap">
              {activeFlowItem.month}/{activeFlowItem.year}
            </span>
            <div className="flex items-center gap-2.5 flex-wrap tabular-nums">
              <span className="text-secondary font-semibold">
                {formatSigned(activeFlowItem.income, '+')}
              </span>
              <span className="text-tertiary font-semibold">
                {formatSigned(activeFlowItem.expense, '-')}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface font-bold">
                {activeFlowItem.savePct} poupado
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Despesas por Categoria Interativo */}
      <section className="bg-surface-container-lowest rounded-2xl p-3 shadow-sm flex flex-col space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-on-surface">Despesas por Categoria</h3>
            <p className="text-[11.5px] text-on-surface-variant">{cycleInfo.monthYearLabel}</p>
          </div>
          <div className="flex bg-surface-container-low p-0.5 rounded-lg shrink-0 text-[11px] font-semibold">
            <button
              className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                donutScope === 'all'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-on-surface-variant'
              }`}
              onClick={() => setDonutScope('all')}
              type="button"
            >
              Todas
            </button>
            <button
              className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                donutScope === 'completed'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-on-surface-variant'
              }`}
              onClick={() => setDonutScope('completed')}
              type="button"
            >
              Pagas
            </button>
          </div>
        </div>

        {donutSegments.length === 0 ? (
          <p className="text-[12px] text-on-surface-variant text-center py-3">
            Nenhuma despesa registrada neste filtro.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" fill="transparent" r="38" stroke="#f1f5f9" strokeWidth="12" />
                {donutSegments.map((seg) => {
                  const isActive = activeDonutItem?.name === seg.name;
                  return (
                    <circle
                      key={seg.name}
                      className="cursor-pointer transition-all duration-300"
                      cx="50"
                      cy="50"
                      fill="transparent"
                      onClick={() =>
                        setSelectedDonutCategory((prev) => (prev === seg.name ? null : seg.name))
                      }
                      r="38"
                      stroke={seg.strokeColor}
                      strokeDasharray={seg.dashArray}
                      strokeDashoffset={seg.dashOffset}
                      strokeWidth={isActive ? 15 : 12}
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-3">
                <span className="text-[9.5px] text-on-surface-variant font-medium leading-tight">
                  {activeDonutItem ? activeDonutItem.name : 'Total'}
                </span>
                <span className="text-[13px] text-on-surface font-bold mt-0.5 tabular-nums leading-tight">
                  {activeDonutItem ? `${activeDonutItem.percentage}%` : '100%'}
                </span>
              </div>
            </div>

            <div className="flex flex-col space-y-1 flex-1 min-w-0">
              {donutSegments.map((item) => {
                const isActive = activeDonutItem?.name === item.name;
                return (
                  <button
                    key={item.name}
                    className={`w-full text-left flex items-center justify-between gap-2 px-1.5 py-1 rounded-lg text-[11.5px] transition-colors cursor-pointer ${
                      isActive ? 'bg-primary-fixed/50 font-semibold' : 'hover:bg-surface-container-low'
                    }`}
                    onClick={() =>
                      setSelectedDonutCategory((prev) => (prev === item.name ? null : item.name))
                    }
                    type="button"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.dotClass} shrink-0`} />
                      <span className="text-on-surface leading-tight break-words">{item.name}</span>
                    </div>
                    <span className="font-bold text-on-surface shrink-0 tabular-nums">
                      {isActive
                        ? isBalanceHidden
                          ? '••••'
                          : formatMoney(item.amount, currency)
                        : `${item.percentage}%`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Últimas Transações */}
      <section className="flex flex-col space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-[15px] font-bold text-on-surface">Últimas Transações</h3>
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
          <div className="flex flex-col items-center justify-center p-6 bg-surface-container-lowest rounded-2xl text-center space-y-2.5">
            <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
              <AppIcon name="receipt_long" className="text-[28px]" />
            </div>
            <div className="flex flex-col">
              <h4 className="text-[15px] font-bold text-on-surface">Nenhuma transação ainda</h4>
              <p className="text-[12px] text-on-surface-variant max-w-xs mt-1">
                Registre suas despesas ou receitas para manter sua vida financeira nos trilhos.
              </p>
            </div>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-[12px] font-semibold hover:bg-primary-container active:scale-95 transition-all shadow-md shadow-primary/20 cursor-pointer whitespace-nowrap"
              onClick={() => onOpenNewTransaction('income')}
              type="button"
            >
              <AppIcon name="add" className="text-[18px]" /> Adicionar Primeira
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
                <div
                  key={item.id}
                  className="w-full flex items-center gap-2.5 p-2.5 hover:bg-surface-container-low/60 transition-colors"
                >
                  <button
                    aria-label={`Editar ${item.description}`}
                    className={`w-9 h-9 rounded-xl ${catConfig.bg} ${catConfig.color} flex items-center justify-center shrink-0 cursor-pointer`}
                    onClick={() => onEditTransaction(item)}
                    type="button"
                  >
                    <AppIcon name={catConfig.icon} className="text-[19px]" />
                  </button>

                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <button
                      className="w-full text-left flex items-start justify-between gap-2 cursor-pointer"
                      onClick={() => onEditTransaction(item)}
                      type="button"
                    >
                      <span className="text-[13.5px] leading-snug text-on-surface font-semibold break-words flex-1 min-w-0">
                        {item.description}
                      </span>
                      <span
                        className={`text-[13.5px] leading-snug font-bold tabular-nums whitespace-nowrap shrink-0 ${
                          isIncome ? 'text-secondary' : 'text-on-surface'
                        }`}
                      >
                        {isBalanceHidden
                          ? '••••'
                          : `${sign}${formatMoney(item.amount, currency)}`}
                      </span>
                    </button>

                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-on-surface-variant min-w-0 flex-1">
                        <span className="shrink-0">{dateDisplay}</span>
                        <span aria-hidden="true" className="shrink-0">
                          ·
                        </span>
                        <span className="break-words">{item.account}</span>
                      </div>
                      <button
                        aria-label={`Alterar status de ${item.description}`}
                        className={`shrink-0 h-6 px-2 rounded-md font-semibold transition-colors cursor-pointer inline-flex items-center gap-1 whitespace-nowrap ${
                          item.status === 'pending'
                            ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                            : isIncome
                              ? 'bg-secondary-container/60 text-secondary hover:bg-secondary-container'
                              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                        onClick={() => onToggleStatus(item.id)}
                        title="Clique para alterar o status em tempo real"
                        type="button"
                      >
                        <AppIcon name={item.status === 'pending' ? 'schedule' : 'check_circle'} className="text-[12px]" />
                        <span>{statusLabel}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
