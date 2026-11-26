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
  const [customStart, setCustomStart] = useState(firstOfMonthIso);
  const [customEnd, setCustomEnd] = useState(todayIso);
  const [tooltipText, setTooltipText] = useState<string | null>(null);
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

  const scopedTransactions = useMemo(() => {
    if (period === 'mes') {
      return filterTransactionsByMonth(transactions, cycleInfo.year, cycleInfo.monthIndex);
    }
    if (period === 'trimestre') {
      const start = new Date(cycleInfo.year, cycleInfo.monthIndex - 2, 1);
      return filterTransactionsByDateRange(transactions, toLocalISODate(start), todayIso);
    }
    if (period === 'ano') {
      return transactions.filter((t) => t.date.startsWith(`${cycleInfo.year}-`));
    }
    return filterTransactionsByDateRange(transactions, customStart, customEnd);
  }, [period, transactions, cycleInfo.year, cycleInfo.monthIndex, todayIso, customStart, customEnd]);

  const metrics = useMemo(
    () => getReportPeriodMetrics(period, transactions, scopedTransactions),
    [period, transactions, scopedTransactions]
  );

  const monthlySeries = useMemo(
    () => computeDynamicSixMonthSeries(transactions, REPORTS_BASELINE_HISTORY),
    [transactions]
  );

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
    <div className="flex flex-col w-full px-margin space-y-space-lg pb-space-xl">
      {/* Top Action & Period Control Filter */}
      <section className="flex flex-col space-y-space-md pt-2">
        <div className="flex items-center justify-between gap-space-sm">
          <div className="flex flex-col min-w-0">
            <span className="font-headline-sm text-headline-sm text-on-surface truncate">
              Relatórios de Desempenho
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Análise contábil e exportação consolidada
            </span>
          </div>
          <button
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-on-primary rounded-xl shadow-md hover:bg-primary-container active:scale-95 transition-all cursor-pointer shrink-0"
            onClick={() => triggerDownload(true)}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span className="font-label-sm text-label-sm whitespace-nowrap">Exportar CSV</span>
          </button>
        </div>

        {/* Period Selectors Horizontal Scroll */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {periodChips.map((chip) => {
            const active = period === chip.id;
            return (
              <button
                key={chip.id}
                aria-pressed={active}
                className={
                  active
                    ? 'px-4 py-2 rounded-full font-label-sm text-label-sm bg-primary text-on-primary shadow-sm transition-colors whitespace-nowrap cursor-pointer'
                    : 'px-4 py-2 rounded-full font-label-sm text-label-sm bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-colors whitespace-nowrap cursor-pointer'
                }
                onClick={() => setPeriod(chip.id)}
                type="button"
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Interactive Custom Range Picker */}
        {period === 'custom' && (
          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-surface-container-lowest shadow-sm">
            <div className="flex flex-col gap-1">
              <label
                className="font-label-sm text-[11px] text-on-surface-variant"
                htmlFor="reportCustomStart"
              >
                De
              </label>
              <input
                className="h-9 px-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                id="reportCustomStart"
                onChange={(e) => setCustomStart(e.target.value)}
                type="date"
                value={customStart}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                className="font-label-sm text-[11px] text-on-surface-variant"
                htmlFor="reportCustomEnd"
              >
                Até
              </label>
              <input
                className="h-9 px-2.5 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
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
      <section className="space-y-space-sm">
        <div className="flex items-center justify-between">
          <span className="font-label-md text-label-md text-on-surface">Resumo Executivo</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[14px]">trending_up</span>
            {metrics.trendBadge}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-space-sm">
          <div className="col-span-2 p-space-md rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-secondary/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Economia Total Líquida
                </span>
                <div className="font-currency-lead text-currency-lead text-on-surface flex items-baseline gap-1.5">
                  {convertedSavings < 0 && <span>-</span>}
                  {cfg.position === 'left' && (
                    <span className="font-body-sm text-body-sm text-secondary font-semibold">
                      {cfg.symbol}
                    </span>
                  )}
                  <span>{formatNumberBR(Math.abs(convertedSavings))}</span>
                  {cfg.position === 'right' && (
                    <span className="font-body-sm text-body-sm text-secondary font-semibold">
                      {cfg.symbol}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">savings</span>
              </div>
            </div>
            <div className="mt-space-md pt-space-sm border-t border-surface-container flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
              <span>Taxa média de poupança</span>
              <span className="font-label-sm text-label-sm text-secondary font-bold">
                {metrics.savingsRate}
              </span>
            </div>
          </div>

          <div className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-body-sm text-body-sm text-on-surface-variant">Maior Gasto</span>
              <div className="w-7 h-7 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed-variant flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px]">home</span>
              </div>
            </div>
            <div className="mt-2">
              <span className="font-label-md text-label-md text-on-surface block truncate">
                {metrics.topExpenseTitle}
              </span>
              <span className="font-currency-standard text-currency-standard text-tertiary font-bold">
                {formatMoney(metrics.topExpenseAmount, currency)}
              </span>
              <span className="font-body-sm text-[11px] text-on-surface-variant block mt-0.5">
                {metrics.topExpenseShare}
              </span>
            </div>
          </div>

          <div className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Média Diária
              </span>
              <div className="w-7 h-7 rounded-lg bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
              </div>
            </div>
            <div className="mt-2">
              <span className="font-label-md text-label-md text-on-surface block truncate">
                Saída por Dia
              </span>
              <span className="font-currency-standard text-currency-standard text-on-surface font-bold">
                {formatMoney(metrics.dailyAvg, currency)}
              </span>
              <span className="font-body-sm text-[11px] text-secondary font-medium block mt-0.5">
                {metrics.dailyDelta}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Cash Flow Chart (Income vs Expense) */}
      <section className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm space-y-space-md">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-headline-sm text-headline-sm text-on-surface block">
              Evolução Mensal
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Receitas vs. Despesas (Últimos 6 meses)
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
              <span className="font-label-sm text-[11px] text-on-surface-variant">Entrada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-tertiary-container" />
              <span className="font-label-sm text-[11px] text-on-surface-variant">Saída</span>
            </div>
          </div>
        </div>

        <div className="relative w-full">
          <div
            className={`absolute -top-7 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-inverse-surface text-inverse-on-surface font-label-sm text-label-sm shadow-md transition-all duration-200 pointer-events-none whitespace-nowrap ${
              tooltipText ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {tooltipText ?? ''}
          </div>

          <svg
            aria-label="Evolução mensal receitas e despesas"
            className="w-full h-44 overflow-visible"
            viewBox="0 0 320 160"
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
              const incH = Math.max(Math.round((m.income / maxSeriesValue) * 100), m.income > 0 ? 4 : 0);
              const expH = Math.max(Math.round((m.expense / maxSeriesValue) * 100), m.expense > 0 ? 4 : 0);
              const tip = `${m.label}: +${formatMoney(m.income, currency)} | -${formatMoney(m.expense, currency)} (${m.savePct} poupados)`;

              return (
                <g
                  key={m.key}
                  className="cursor-pointer"
                  onClick={() => setTooltipText((prev) => (prev === tip ? null : tip))}
                  onMouseEnter={() => setTooltipText(tip)}
                  onMouseLeave={() => setTooltipText(null)}
                >
                  <rect
                    className="transition-opacity hover:opacity-80"
                    fill="url(#grad-green)"
                    height={incH}
                    rx="4"
                    width="14"
                    x={xBase}
                    y={130 - incH}
                  />
                  <rect
                    className="transition-opacity hover:opacity-80"
                    fill="url(#grad-red)"
                    height={expH}
                    rx="4"
                    width="14"
                    x={xBase + 17}
                    y={130 - expH}
                  />
                  <text
                    fill={m.highlight ? '#3525cd' : '#464555'}
                    fontSize="11"
                    fontWeight={m.highlight ? '700' : '500'}
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

        <div className="p-space-sm rounded-xl bg-surface-container flex items-center justify-between text-on-surface">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">insights</span>
            <span className="font-body-sm text-body-sm">{metrics.highlightMonthText}</span>
          </div>
          <span className="font-label-md text-label-md text-secondary">
            {metrics.netSavings < 0 ? '-' : ''}
            {formatMoney(metrics.netSavings, currency)} ({metrics.savingsRate})
          </span>
        </div>
      </section>

      {/* Expense Breakdown by Category */}
      <section className="space-y-space-sm">
        <div className="flex items-center justify-between">
          <span className="font-headline-sm text-headline-sm text-on-surface">
            Despesas por Categoria
          </span>
          <button
            className="font-label-sm text-label-sm text-primary cursor-pointer hover:underline"
            onClick={() => onNavigate('transacoes')}
            type="button"
          >
            Ver extrato ({scopedTransactions.length})
          </button>
        </div>

        <div className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm space-y-space-md">
          {expenseCategories.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant text-center py-4">
              Nenhuma despesa registrada no período selecionado.
            </p>
          ) : (
            expenseCategories.map((cat) => {
              const style = CATEGORY_STYLE_META[cat.name] ?? CATEGORY_STYLE_META.Outros;
              return (
                <div key={cat.name} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-lg ${style.bg} ${style.color} flex items-center justify-center`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {style.icon}
                        </span>
                      </div>
                      <div>
                        <span className="font-label-md text-label-md text-on-surface block leading-tight">
                          {cat.name}
                        </span>
                        <span className="font-body-sm text-[11px] text-on-surface-variant font-medium">
                          {cat.percentage}% do período
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-currency-standard text-currency-standard text-on-surface block leading-tight">
                        {formatMoney(cat.amount, currency)}
                      </span>
                      <span className="font-body-sm text-[11px] text-on-surface-variant font-medium">
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
      <section className="space-y-space-sm">
        <div className="flex items-center justify-between">
          <span className="font-headline-sm text-headline-sm text-on-surface">
            Fontes de Receita
          </span>
          <span className="font-label-sm text-label-sm text-secondary font-bold">
            {formatMoney(metrics.incomeTotal, currency)} Total
          </span>
        </div>

        {incomeSources.length === 0 ? (
          <div className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm text-center">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Nenhuma receita registrada no período selecionado.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-space-sm">
            {incomeSources.map((src) => (
              <div
                key={src.title}
                className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="font-body-sm text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
                    {src.title}
                  </span>
                  <span className={`w-6 h-6 rounded-md ${src.badge} flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-[14px]">{src.icon}</span>
                  </span>
                </div>
                <div className="mt-3">
                  <span className="font-currency-standard text-currency-standard text-on-surface font-bold">
                    {formatMoney(src.amount, currency)}
                  </span>
                  <span className="font-body-sm text-[11px] text-on-surface-variant block">
                    {src.share}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Complete Export Control Panel */}
      <section className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm space-y-space-md">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-headline-sm text-headline-sm text-on-surface block">
              Central de Exportação
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Baixe os registros contábeis originais
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">file_download</span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1.5">
              Formato do Arquivo
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={
                  exportFormat === 'csv'
                    ? 'flex items-center gap-2 p-2.5 rounded-xl bg-primary text-on-primary text-left transition-colors cursor-pointer'
                    : 'flex items-center gap-2 p-2.5 rounded-xl bg-surface-container text-on-surface-variant text-left transition-colors cursor-pointer'
                }
                onClick={() => setExportFormat('csv')}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">table_view</span>
                <div>
                  <span className="font-label-sm text-label-sm block leading-tight">
                    Planilha CSV
                  </span>
                  <span
                    className={`font-body-sm text-[10px] leading-tight ${
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
                    ? 'flex items-center gap-2 p-2.5 rounded-xl bg-primary text-on-primary text-left transition-colors cursor-pointer'
                    : 'flex items-center gap-2 p-2.5 rounded-xl bg-surface-container text-on-surface-variant text-left transition-colors cursor-pointer'
                }
                onClick={() => setExportFormat('pdf')}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                <div>
                  <span className="font-label-sm text-label-sm block leading-tight">
                    Resumo PDF
                  </span>
                  <span
                    className={`font-body-sm text-[10px] leading-tight ${
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
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1.5">
              Tipos Inclusos
            </label>
            <div className="flex items-center gap-2">
              <label className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-surface-container-low cursor-pointer">
                <input
                  checked={includeIncome}
                  className="w-4 h-4 rounded accent-primary"
                  onChange={(e) => setIncludeIncome(e.target.checked)}
                  type="checkbox"
                />
                <span className="font-label-sm text-label-sm text-on-surface">Receitas</span>
              </label>
              <label className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-surface-container-low cursor-pointer">
                <input
                  checked={includeExpense}
                  className="w-4 h-4 rounded accent-primary"
                  onChange={(e) => setIncludeExpense(e.target.checked)}
                  type="checkbox"
                />
                <span className="font-label-sm text-label-sm text-on-surface">Despesas</span>
              </label>
              <label className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-surface-container-low cursor-pointer">
                <input
                  checked={includeInvestments}
                  className="w-4 h-4 rounded accent-primary"
                  onChange={(e) => setIncludeInvestments(e.target.checked)}
                  type="checkbox"
                />
                <span className="font-label-sm text-label-sm text-on-surface">Aportes</span>
              </label>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <button
            className="w-full py-3.5 px-4 bg-primary text-on-primary rounded-xl font-label-md text-label-md flex items-center justify-center gap-2 shadow-lg shadow-primary/25 active:scale-[0.98] transition-all cursor-pointer"
            onClick={() => triggerDownload(false)}
            type="button"
          >
            <span className="material-symbols-outlined text-[22px]">download_for_offline</span>
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
