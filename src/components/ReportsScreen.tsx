import { useMemo, useState } from 'react';
import {
  CATEGORY_STYLE_META,
  CURRENCY_CONFIG,
  getReportPeriodMetrics,
  REPORTS_BASELINE_HISTORY,
} from '../data/seed';
import type { AppScreen, CurrencyCode, ReportPeriod, Transaction } from '../types/finance';
import {
  buildSimplePDF,
  buildTransactionsCSV,
  computeDynamicSixMonthSeries,
  computeExpenseBreakdown,
  filterTransactionsByDateRange,
  filterTransactionsByMonth,
  formatMoney,
  formatNumberBR,
  getMonthCycleInfo,
  toLocalISODate,
} from '../utils/finance';

interface ReportsScreenProps {
  transactions: Transaction[];
  currency: CurrencyCode;
  onNavigate: (screen: AppScreen) => void;
}

export function ReportsScreen({ transactions, currency, onNavigate }: ReportsScreenProps) {
  const cycleInfo = useMemo(() => getMonthCycleInfo(), []);
  const firstOfMonthIso = useMemo(
    () => toLocalISODate(new Date(cycleInfo.year, cycleInfo.monthIndex, 1)),
    [cycleInfo.year, cycleInfo.monthIndex]
  );
  const todayIso = useMemo(() => toLocalISODate(), []);

  const [period, setPeriod] = useState<ReportPeriod>('mes');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [customStart, setCustomStart] = useState(firstOfMonthIso);
  const [customEnd, setCustomEnd] = useState(todayIso);
  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
  const [includeIncome, setIncludeIncome] = useState(true);
  const [includeExpense, setIncludeExpense] = useState(true);
  const [includeInvestments, setIncludeInvestments] = useState(true);
  const [exportFeedback, setExportFeedback] = useState(false);

  const periodChips: Array<{ id: ReportPeriod; label: string }> = [
    { id: 'mes', label: 'Mês Atual' },
    { id: 'trimestre', label: 'Trimestre' },
    { id: 'ano', label: `Ano ${cycleInfo.year}` },
    { id: 'custom', label: 'Personalizado' },
  ];

  const accountOptions = useMemo(() => {
    const set = new Set<string>();
    for (const tx of transactions) {
      set.add(tx.account);
    }
    return Array.from(set);
  }, [transactions]);

  const filteredBaseTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (accountFilter !== 'all' && t.account !== accountFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      return true;
    });
  }, [transactions, accountFilter, statusFilter]);

  const scopedTransactions = useMemo(() => {
    if (period === 'mes') {
      return filterTransactionsByMonth(
        filteredBaseTransactions,
        cycleInfo.year,
        cycleInfo.monthIndex
      );
    }
    if (period === 'trimestre') {
      const start = new Date(cycleInfo.year, cycleInfo.monthIndex - 2, 1);
      return filterTransactionsByDateRange(
        filteredBaseTransactions,
        toLocalISODate(start),
        todayIso
      );
    }
    if (period === 'ano') {
      return filteredBaseTransactions.filter((t) => t.date.startsWith(`${cycleInfo.year}-`));
    }
    return filterTransactionsByDateRange(filteredBaseTransactions, customStart, customEnd);
  }, [
    period,
    filteredBaseTransactions,
    cycleInfo.year,
    cycleInfo.monthIndex,
    todayIso,
    customStart,
    customEnd,
  ]);

  const metrics = useMemo(
    () => getReportPeriodMetrics(period, filteredBaseTransactions, scopedTransactions),
    [period, filteredBaseTransactions, scopedTransactions]
  );

  const monthlySeries = useMemo(
    () => computeDynamicSixMonthSeries(filteredBaseTransactions, REPORTS_BASELINE_HISTORY),
    [filteredBaseTransactions]
  );

  const activeSeriesItem = useMemo(() => {
    return (
      monthlySeries.find((m) => m.key === selectedSeriesKey) ??
      monthlySeries[monthlySeries.length - 1]
    );
  }, [monthlySeries, selectedSeriesKey]);

  const maxSeriesValue = useMemo(() => {
    const peak = monthlySeries.reduce(
      (max, item) => Math.max(max, item.income, item.expense),
      1000
    );
    return peak * 1.08;
  }, [monthlySeries]);

  const expenseCategories = useMemo(
    () => computeExpenseBreakdown(scopedTransactions),
    [scopedTransactions]
  );

  const incomeSources = useMemo(() => {
    const incomes = scopedTransactions.filter((t) => t.type === 'income');
    const total = incomes.reduce((sum, t) => sum + t.amount, 0);
    const map = new Map<string, number>();
    for (const tx of incomes) {
      map.set(tx.category, (map.get(tx.category) ?? 0) + tx.amount);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([title, amount]) => {
        const style = CATEGORY_STYLE_META[title] ?? CATEGORY_STYLE_META.Outros;
        const pct = total > 0 ? ((amount / total) * 100).toFixed(1) : '0.0';
        return {
          title,
          icon: style.icon,
          badge: `${style.bg} ${style.color}`,
          amount,
          share: `${pct}% da renda`,
        };
      });
  }, [scopedTransactions]);

  const cfg = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.MZN;
  const convertedSavings = metrics.netSavings * cfg.rateFromBase;

  const triggerDownload = (forceCsv = false) => {
    const useCsv = forceCsv || exportFormat === 'csv';
    const exportSource = scopedTransactions.length > 0 ? scopedTransactions : transactions;

    if (useCsv) {
      const csvContent = buildTransactionsCSV(exportSource, {
        includeIncome,
        includeExpense,
        includeInvestments,
      });
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = forceCsv
        ? `fintrack_extrato_${toLocalISODate()}.csv`
        : `fintrack_extrato_completo_${toLocalISODate()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const pdfLines = [
        `Periodo: ${periodChips.find((p) => p.id === period)?.label ?? period}`,
        `Gerado em: ${toLocalISODate()}`,
        `Economia Liquida: ${metrics.netSavings < 0 ? '-' : ''}${formatMoney(metrics.netSavings, currency)}`,
        `Receitas Totais: ${formatMoney(metrics.incomeTotal, currency)}`,
        `Despesas Totais: ${formatMoney(metrics.expenseTotal, currency)}`,
        `Taxa de Poupanca: ${metrics.savingsRate}`,
        `Maior Categoria de Gasto: ${metrics.topExpenseTitle} (${formatMoney(metrics.topExpenseAmount, currency)})`,
      ];
      const blob = buildSimplePDF('FinTrack - Resumo Executivo', pdfLines);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fintrack_resumo_${toLocalISODate()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    setExportFeedback(true);
    setTimeout(() => setExportFeedback(false), 4000);
  };

  return (
    <div className="flex flex-col w-full px-3 space-y-3 pb-2">
      {/* Top Action & Period Control Filter */}
      <section className="flex flex-col space-y-2.5 pt-1.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-[15.5px] leading-snug font-bold text-on-surface whitespace-nowrap">
              Relatórios de Desempenho
            </h1>
            <button
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-primary text-on-primary rounded-xl shadow-md hover:bg-primary-container active:scale-95 transition-all cursor-pointer shrink-0 whitespace-nowrap"
              onClick={() => triggerDownload(true)}
              type="button"
            >
              <span className="material-symbols-outlined text-[15px]">download</span>
              <span className="text-[11.5px] font-semibold">Exportar CSV</span>
            </button>
          </div>
          <span className="text-[12px] text-on-surface-variant">
            Análise contábil e exportação consolidada
          </span>
        </div>

        {/* Dropdown Selectors */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[148px]">
            <label className="sr-only" htmlFor="reportPeriodSelect">
              Selecionar período
            </label>
            <select
              className="w-full h-9 pl-3 pr-7 rounded-xl bg-primary text-on-primary text-[12px] font-semibold shadow-sm appearance-none focus:outline-none cursor-pointer"
              id="reportPeriodSelect"
              onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
              value={period}
            >
              {periodChips.map((chip) => (
                <option key={chip.id} className="bg-surface-container-lowest text-on-surface" value={chip.id}>
                  {chip.label}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-on-primary">
              expand_more
            </span>
          </div>

          <div className="relative flex-1 min-w-[148px]">
            <label className="sr-only" htmlFor="reportAccountFilter">
              Filtrar por conta
            </label>
            <select
              className="w-full h-9 pl-3 pr-7 rounded-xl bg-surface-container-lowest text-on-surface text-[12px] font-semibold shadow-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/25 cursor-pointer"
              id="reportAccountFilter"
              onChange={(e) => setAccountFilter(e.target.value)}
              value={accountFilter}
            >
              <option value="all">Conta: Todas</option>
              {accountOptions.map((acc) => (
                <option key={acc} value={acc}>
                  {acc}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant">
              expand_more
            </span>
          </div>

          <div className="relative flex-1 min-w-[148px]">
            <label className="sr-only" htmlFor="reportStatusFilter">
              Filtrar por estado
            </label>
            <select
              className="w-full h-9 pl-3 pr-7 rounded-xl bg-surface-container-lowest text-on-surface text-[12px] font-semibold shadow-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/25 cursor-pointer"
              id="reportStatusFilter"
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'completed' | 'pending')}
              value={statusFilter}
            >
              <option value="all">Estado: Todos</option>
              <option value="completed">Liquidados</option>
              <option value="pending">Pendentes</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant">
              expand_more
            </span>
          </div>
        </div>

        {/* Interactive Custom Range Picker */}
        {period === 'custom' && (
          <div className="flex gap-2 p-3 rounded-xl bg-surface-container-lowest shadow-sm">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <label
                className="text-[11px] font-semibold text-on-surface-variant"
                htmlFor="reportCustomStart"
              >
                De
              </label>
              <input
                className="w-full h-9 px-2 rounded-lg bg-surface-container-low text-on-surface text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20"
                id="reportCustomStart"
                onChange={(e) => setCustomStart(e.target.value)}
                type="date"
                value={customStart}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <label
                className="text-[11px] font-semibold text-on-surface-variant"
                htmlFor="reportCustomEnd"
              >
                Até
              </label>
              <input
                className="w-full h-9 px-2 rounded-lg bg-surface-container-low text-on-surface text-[12px] focus:outline-none focus:ring-2 focus:ring-primary/20"
                id="reportCustomEnd"
                onChange={(e) => setCustomEnd(e.target.value)}
                type="date"
                value={customEnd}
              />
            </div>
          </div>
        )}
      </section>

      {/* Executive Summary Bento Cards */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-bold text-on-surface">Resumo Executivo</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary-container text-on-secondary-container text-[11px] font-bold whitespace-nowrap shrink-0">
            <span className="material-symbols-outlined text-[14px]">trending_up</span>
            {metrics.trendBadge}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="p-3 rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 w-28 h-28 bg-secondary/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-start justify-between gap-2.5">
              <div className="space-y-0.5 min-w-0 flex-1">
                <span className="text-[12px] text-on-surface-variant font-medium block">
                  Economia Total Líquida
                </span>
                <div className="text-[24px] leading-[30px] sm:text-[28px] font-bold text-on-surface flex items-baseline gap-1.5 tabular-nums break-words flex-wrap">
                  {convertedSavings < 0 && <span>-</span>}
                  {cfg.position === 'left' && (
                    <span className="text-[15px] text-secondary font-semibold">{cfg.symbol}</span>
                  )}
                  <span>{formatNumberBR(Math.abs(convertedSavings))}</span>
                  {cfg.position === 'right' && (
                    <span className="text-[15px] text-secondary font-semibold">{cfg.symbol}</span>
                  )}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[19px]">savings</span>
              </div>
            </div>
            <div className="mt-2.5 pt-2 border-t border-surface-container flex items-center justify-between gap-2 text-on-surface-variant text-[11.5px]">
              <span>Taxa média de poupança</span>
              <span className="text-secondary font-bold tabular-nums whitespace-nowrap">
                {metrics.savingsRate}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 min-w-0 p-3 rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] text-on-surface-variant font-medium leading-tight">
                  Maior Gasto
                </span>
                <div className="w-7 h-7 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed-variant flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[15px]">home</span>
                </div>
              </div>
              <div className="min-w-0">
                <span className="text-[12.5px] font-semibold text-on-surface block break-words leading-snug">
                  {metrics.topExpenseTitle}
                </span>
                <span className="text-[14.5px] leading-snug text-tertiary font-bold tabular-nums block break-words">
                  {formatMoney(metrics.topExpenseAmount, currency)}
                </span>
                <span className="text-[10.5px] text-on-surface-variant block mt-0.5 leading-tight">
                  {metrics.topExpenseShare}
                </span>
              </div>
            </div>

            <div className="flex-1 min-w-0 p-3 rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] text-on-surface-variant font-medium leading-tight">
                  Média Diária
                </span>
                <div className="w-7 h-7 rounded-lg bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[15px]">calendar_today</span>
                </div>
              </div>
              <div className="min-w-0">
                <span className="text-[12.5px] font-semibold text-on-surface block break-words leading-snug">
                  Saída por Dia
                </span>
                <span className="text-[14.5px] leading-snug text-on-surface font-bold tabular-nums block break-words">
                  {formatMoney(metrics.dailyAvg, currency)}
                </span>
                <span className="text-[10.5px] text-secondary font-medium block mt-0.5 leading-tight">
                  {metrics.dailyDelta}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Cash Flow Chart (Income vs Expense) */}
      <section className="p-3 rounded-2xl bg-surface-container-lowest shadow-sm space-y-2.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[16px] font-bold text-on-surface">
              Evolução Mensal
            </span>
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="flex items-center gap-1 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-secondary shrink-0" />
                <span className="text-[11px] font-semibold text-on-surface-variant">Entrada</span>
              </div>
              <div className="flex items-center gap-1 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-tertiary-container shrink-0" />
                <span className="text-[11px] font-semibold text-on-surface-variant">Saída</span>
              </div>
            </div>
          </div>
          <span className="text-[11.5px] text-on-surface-variant">
            Toque num mês para ver os detalhes (Últimos 6 meses)
          </span>
        </div>

        <div className="relative w-full">
          <svg
            aria-label="Evolução mensal receitas e despesas"
            className="w-full h-40 overflow-visible"
            viewBox="0 0 320 155"
          >
            <defs>
              <linearGradient id="grad-green" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#006c49" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#006c49" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="grad-red" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#bc1d25" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#bc1d25" stopOpacity="0.4" />
              </linearGradient>
            </defs>

            <line
              stroke="#eaedff"
              strokeDasharray="3,3"
              strokeWidth="1"
              x1="0"
              x2="320"
              y1="30"
              y2="30"
            />
            <line
              stroke="#eaedff"
              strokeDasharray="3,3"
              strokeWidth="1"
              x1="0"
              x2="320"
              y1="80"
              y2="80"
            />
            <line stroke="#eaedff" strokeWidth="1" x1="0" x2="320" y1="130" y2="130" />

            {monthlySeries.map((m, idx) => {
              const xBase = 16 + idx * 52;
              const incH = Math.max(
                Math.round((m.income / maxSeriesValue) * 100),
                m.income > 0 ? 4 : 0
              );
              const expH = Math.max(
                Math.round((m.expense / maxSeriesValue) * 100),
                m.expense > 0 ? 4 : 0
              );
              const isSelected = activeSeriesItem?.key === m.key;

              return (
                <g
                  key={m.key}
                  aria-label={`Inspecionar ${m.month}`}
                  className="cursor-pointer"
                  onClick={() => setSelectedSeriesKey(m.key)}
                  role="button"
                  tabIndex={0}
                >
                  <rect
                    fill={isSelected ? '#eaedff' : 'transparent'}
                    height="148"
                    rx="7"
                    width="42"
                    x={xBase - 5}
                    y="6"
                  />
                  <rect
                    className="transition-all duration-300"
                    fill="url(#grad-green)"
                    height={incH}
                    opacity={isSelected ? 1 : 0.8}
                    rx="4"
                    width="14"
                    x={xBase}
                    y={130 - incH}
                  />
                  <rect
                    className="transition-all duration-300"
                    fill="url(#grad-red)"
                    height={expH}
                    opacity={isSelected ? 1 : 0.8}
                    rx="4"
                    width="14"
                    x={xBase + 17}
                    y={130 - expH}
                  />
                  <text
                    fill={isSelected ? '#3525cd' : '#464555'}
                    fontSize="11"
                    fontWeight={isSelected ? '700' : '500'}
                    textAnchor="middle"
                    x={xBase + 15}
                    y="148"
                  >
                    {m.month}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {activeSeriesItem && (
          <div className="p-2.5 rounded-xl bg-surface-container flex items-center justify-between gap-2 flex-wrap text-on-surface">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="material-symbols-outlined text-primary text-[17px] shrink-0">
                insights
              </span>
              <span className="text-[11.5px] font-semibold break-words">
                {activeSeriesItem.month}/{activeSeriesItem.year}:
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[11.5px] tabular-nums">
              <span className="text-secondary font-bold">
                +{formatMoney(activeSeriesItem.income, currency)}
              </span>
              <span className="text-tertiary font-bold">
                -{formatMoney(activeSeriesItem.expense, currency)}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-lowest font-bold text-primary">
                {activeSeriesItem.savePct}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Expense Breakdown by Category */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-bold text-on-surface">
            Despesas por Categoria
          </span>
          <button
            className="text-[12px] font-semibold text-primary cursor-pointer hover:underline whitespace-nowrap shrink-0"
            onClick={() => onNavigate('transacoes')}
            type="button"
          >
            Ver extrato ({scopedTransactions.length})
          </button>
        </div>

        <div className="p-3 rounded-2xl bg-surface-container-lowest shadow-sm space-y-2.5">
          {expenseCategories.length === 0 ? (
            <p className="text-[12px] text-on-surface-variant text-center py-4">
              Nenhuma despesa registrada no período selecionado.
            </p>
          ) : (
            expenseCategories.map((cat) => {
              const style = CATEGORY_STYLE_META[cat.name] ?? CATEGORY_STYLE_META.Outros;
              return (
                <div key={cat.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-8 h-8 rounded-lg ${style.bg} ${style.color} flex items-center justify-center shrink-0`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {style.icon}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[13px] font-semibold text-on-surface block leading-snug break-words">
                          {cat.name}
                        </span>
                        <span className="text-[11px] text-on-surface-variant font-medium">
                          {cat.percentage}% do período
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[14px] font-bold text-on-surface tabular-nums block leading-tight whitespace-nowrap">
                        {formatMoney(cat.amount, currency)}
                      </span>
                      <span className="text-[11px] text-on-surface-variant font-medium tabular-nums">
                        {cat.percentage}% do total
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`${cat.barClass} h-1.5 rounded-full`}
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Income Sources Breakdown */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[16px] font-bold text-on-surface">Fontes de Receita</span>
          <span className="text-[12px] text-secondary font-bold tabular-nums whitespace-nowrap shrink-0">
            {formatMoney(metrics.incomeTotal, currency)} Total
          </span>
        </div>

        {incomeSources.length === 0 ? (
          <div className="p-4 rounded-2xl bg-surface-container-lowest shadow-sm text-center">
            <p className="text-[12px] text-on-surface-variant">
              Nenhuma receita registrada no período selecionado.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {incomeSources.map((src) => (
              <div
                key={src.title}
                className="min-w-0 p-3 rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-between gap-1.5"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10.5px] text-on-surface-variant uppercase tracking-wider font-semibold break-words leading-tight">
                    {src.title}
                  </span>
                  <span
                    className={`w-6 h-6 rounded-md ${src.badge} flex items-center justify-center shrink-0`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{src.icon}</span>
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[14.5px] leading-snug text-on-surface font-bold tabular-nums block break-words">
                    {formatMoney(src.amount, currency)}
                  </span>
                  <span className="text-[10.5px] text-on-surface-variant block leading-tight">
                    {src.share}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Complete Export Control Panel */}
      <section className="p-3 rounded-2xl bg-surface-container-lowest shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-[16px] font-bold text-on-surface block">
              Central de Exportação
            </span>
            <span className="text-[12px] text-on-surface-variant block">
              Baixe os registros contábeis originais
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">file_download</span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[12px] font-semibold text-on-surface-variant block mb-1.5">
              Formato do Arquivo
            </label>
            <div className="flex gap-2">
              <button
                className={
                  exportFormat === 'csv'
                    ? 'flex-1 min-w-0 flex items-center gap-2 p-2.5 rounded-xl bg-primary text-on-primary text-left transition-colors cursor-pointer'
                    : 'flex-1 min-w-0 flex items-center gap-2 p-2.5 rounded-xl bg-surface-container text-on-surface-variant text-left transition-colors cursor-pointer'
                }
                onClick={() => setExportFormat('csv')}
                type="button"
              >
                <span className="material-symbols-outlined text-[19px] shrink-0">table_view</span>
                <div className="min-w-0 flex-1">
                  <span className="text-[12px] font-semibold block leading-tight">
                    Planilha CSV
                  </span>
                  <span
                    className={`text-[10px] leading-tight block ${
                      exportFormat === 'csv' ? 'text-on-primary-container' : 'text-on-surface-variant'
                    }`}
                  >
                    Excel, Sheets, Contábil
                  </span>
                </div>
              </button>

              <button
                className={
                  exportFormat === 'pdf'
                    ? 'flex-1 min-w-0 flex items-center gap-2 p-2.5 rounded-xl bg-primary text-on-primary text-left transition-colors cursor-pointer'
                    : 'flex-1 min-w-0 flex items-center gap-2 p-2.5 rounded-xl bg-surface-container text-on-surface-variant text-left transition-colors cursor-pointer'
                }
                onClick={() => setExportFormat('pdf')}
                type="button"
              >
                <span className="material-symbols-outlined text-[19px] shrink-0">
                  picture_as_pdf
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-[12px] font-semibold block leading-tight">
                    Resumo PDF
                  </span>
                  <span
                    className={`text-[10px] leading-tight block ${
                      exportFormat === 'pdf' ? 'text-on-primary-container' : 'text-on-surface-variant'
                    }`}
                  >
                    Relatório Imprimível
                  </span>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-on-surface-variant block mb-1.5">
              Tipos Inclusos
            </label>
            <div className="flex items-center gap-2">
              <label className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-surface-container-low cursor-pointer">
                <input
                  checked={includeIncome}
                  className="w-4 h-4 rounded accent-primary shrink-0"
                  onChange={(e) => setIncludeIncome(e.target.checked)}
                  type="checkbox"
                />
                <span className="text-[12px] font-semibold text-on-surface whitespace-nowrap">
                  Receitas
                </span>
              </label>
              <label className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-surface-container-low cursor-pointer">
                <input
                  checked={includeExpense}
                  className="w-4 h-4 rounded accent-primary shrink-0"
                  onChange={(e) => setIncludeExpense(e.target.checked)}
                  type="checkbox"
                />
                <span className="text-[12px] font-semibold text-on-surface whitespace-nowrap">
                  Despesas
                </span>
              </label>
              <label className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-surface-container-low cursor-pointer">
                <input
                  checked={includeInvestments}
                  className="w-4 h-4 rounded accent-primary shrink-0"
                  onChange={(e) => setIncludeInvestments(e.target.checked)}
                  type="checkbox"
                />
                <span className="text-[12px] font-semibold text-on-surface whitespace-nowrap">
                  Aportes
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="pt-1">
          <button
            className="w-full py-3 px-4 bg-primary text-on-primary rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
            onClick={() => triggerDownload(false)}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">download_for_offline</span>
            <span>
              {exportFormat === 'pdf'
                ? 'Gerar e Baixar Resumo (.pdf)'
                : 'Baixar Extrato Completo (.csv)'}
            </span>
          </button>

          {exportFeedback && (
            <div className="mt-2.5 flex items-center gap-2 p-2.5 rounded-xl bg-secondary-container text-on-secondary-container">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span className="font-body-sm text-body-sm font-semibold">
                Arquivo gerado e baixado com sucesso!
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
