import { useMemo, useState } from 'react';
import {
  CATEGORY_STYLE_META,
  CURRENCY_CONFIG,
  getReportPeriodMetrics,
  REPORTS_BASELINE_HISTORY,
} from '../data/seed';
import type { AppScreen, CurrencyCode, ReportPeriod, Transaction } from '../types/finance';
import {
  buildStyledReportCSV,
  buildStyledReportPDF,
  computeDynamicSixMonthSeries,
  computeExpenseBreakdown,
  computeTransactionSummary,
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
  isBalanceHidden?: boolean;
  userName?: string;
  userPhone?: string;
  onNavigate: (screen: AppScreen) => void;
  onNotify?: (msg: string) => void;
}

export function ReportsScreen({
  transactions,
  currency,
  isBalanceHidden = false,
  userName = 'Utilizador FinTrack',
  userPhone = '',
  onNavigate,
  onNotify,
}: ReportsScreenProps) {
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
    let list: Transaction[];
    if (period === 'mes') {
      list = filterTransactionsByMonth(filteredBaseTransactions, cycleInfo.year, cycleInfo.monthIndex);
    } else if (period === 'trimestre') {
      const start = new Date(cycleInfo.year, cycleInfo.monthIndex - 2, 1);
      list = filterTransactionsByDateRange(filteredBaseTransactions, toLocalISODate(start), todayIso);
    } else if (period === 'ano') {
      list = filteredBaseTransactions.filter((t) => t.date.startsWith(`${cycleInfo.year}-`));
    } else {
      list = filterTransactionsByDateRange(filteredBaseTransactions, customStart, customEnd);
    }
    return [...list].sort((a, b) =>
      `${b.date}T${b.time ?? '00:00'}`.localeCompare(`${a.date}T${a.time ?? '00:00'}`)
    );
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

  const tableSummary = useMemo(
    () => computeTransactionSummary(scopedTransactions),
    [scopedTransactions]
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
  const activePeriodLabel =
    period === 'custom'
      ? `${customStart.split('-').reverse().join('/')} a ${customEnd.split('-').reverse().join('/')}`
      : (periodChips.find((p) => p.id === period)?.label ?? period);

  const handleExportPDF = () => {
    const blob = buildStyledReportPDF({
      transactions: scopedTransactions,
      currency,
      periodLabel: activePeriodLabel,
      userName,
      userPhone,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FinTrack_Relatorio_${toLocalISODate()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify?.('Relatório PDF estilizado exportado!');
  };

  const handleExportCSV = () => {
    const csvContent = buildStyledReportCSV({
      transactions: scopedTransactions,
      currency,
      periodLabel: activePeriodLabel,
      userName,
      userPhone,
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FinTrack_Relatorio_${toLocalISODate()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify?.('Relatório CSV estruturado exportado!');
  };

  return (
    <div className="flex flex-col w-full px-3 space-y-3 pb-3">
      {/* Top Title & Direct PDF / CSV Export Buttons */}
      <section className="flex flex-col space-y-2.5 pt-1.5">
        <div className="flex flex-col gap-2">
          <div>
            <h1 className="text-[16px] leading-snug font-bold text-on-surface">
              Relatórios de Desempenho
            </h1>
            <span className="text-[12px] text-on-surface-variant block">
              Análise contábil com tabela estruturada e exportação
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              className="h-10 px-3 bg-primary text-on-primary rounded-xl shadow-sm hover:bg-primary-container active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
              onClick={handleExportPDF}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              <span className="text-[12.5px] font-semibold">Exportar PDF</span>
            </button>
            <button
              className="h-10 px-3 bg-secondary text-on-secondary rounded-xl shadow-sm hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
              onClick={handleExportCSV}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">table_view</span>
              <span className="text-[12.5px] font-semibold">Exportar CSV</span>
            </button>
          </div>
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
                <option
                  key={chip.id}
                  className="bg-surface-container-lowest text-on-surface"
                  value={chip.id}
                >
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
                  {isBalanceHidden ? (
                    <span>••••••••</span>
                  ) : (
                    <>
                      {convertedSavings < 0 && <span>-</span>}
                      {cfg.position === 'left' && (
                        <span className="text-[15px] text-secondary font-semibold">{cfg.symbol}</span>
                      )}
                      <span>{formatNumberBR(Math.abs(convertedSavings))}</span>
                      {cfg.position === 'right' && (
                        <span className="text-[15px] text-secondary font-semibold">{cfg.symbol}</span>
                      )}
                    </>
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
                  {isBalanceHidden ? '••••' : formatMoney(metrics.topExpenseAmount, currency)}
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
                  {isBalanceHidden ? '••••' : formatMoney(metrics.dailyAvg, currency)}
                </span>
                <span className="text-[10.5px] text-secondary font-medium block mt-0.5 leading-tight">
                  {metrics.dailyDelta}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Styled Report Table Preview */}
      <section className="rounded-2xl bg-surface-container-lowest shadow-sm overflow-hidden">
        <div className="p-3 flex items-center justify-between gap-2 border-b border-surface-container">
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-on-surface leading-tight">
              Tabela do Relatório
            </h2>
            <p className="text-[11.5px] text-on-surface-variant">
              {activePeriodLabel} · {scopedTransactions.length} movimento
              {scopedTransactions.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            className="text-[12px] font-semibold text-primary hover:underline cursor-pointer whitespace-nowrap shrink-0"
            onClick={() => onNavigate('transacoes')}
            type="button"
          >
            Gerir extrato
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-primary text-on-primary text-[11px] font-semibold">
                <th className="py-2.5 px-2.5 whitespace-nowrap">Data</th>
                <th className="py-2.5 px-2">Descrição & Conta</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">Estado</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container/70 text-[12px]">
              {scopedTransactions.length === 0 ? (
                <tr>
                  <td className="py-6 px-3 text-center text-on-surface-variant" colSpan={4}>
                    Sem movimentos para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                scopedTransactions.map((tx, idx) => {
                  const isIncome = tx.type === 'income';
                  const dateBr = tx.date.split('-').reverse().slice(0, 2).join('/');
                  const statusText =
                    tx.status === 'completed' ? (isIncome ? 'Recebido' : 'Pago') : 'Pendente';
                  return (
                    <tr
                      key={tx.id}
                      className={idx % 2 === 1 ? 'bg-surface-container-low/55' : 'bg-surface-container-lowest'}
                    >
                      <td className="py-2.5 px-2.5 align-top text-on-surface-variant font-medium tabular-nums whitespace-nowrap">
                        {dateBr}
                      </td>
                      <td className="py-2.5 px-2 align-top min-w-[130px]">
                        <span className="font-semibold text-on-surface block leading-snug break-words">
                          {tx.description}
                        </span>
                        <span className="text-[10.5px] text-on-surface-variant block leading-tight">
                          {tx.category} · {tx.account}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 align-top text-center whitespace-nowrap">
                        <span
                          className={`text-[11px] font-semibold ${
                            tx.status === 'pending' ? 'text-amber-800' : 'text-secondary'
                          }`}
                        >
                          {statusText}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 px-2.5 align-top text-right font-bold tabular-nums whitespace-nowrap ${
                          isIncome ? 'text-secondary' : 'text-tertiary'
                        }`}
                      >
                        {isBalanceHidden
                          ? `${isIncome ? '+' : '-'}••••`
                          : `${isIncome ? '+' : '-'}${formatMoney(tx.amount, currency)}`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-surface-container text-[12px] font-bold text-on-surface border-t border-surface-container-highest">
                <td className="py-2.5 px-2.5" colSpan={2}>
                  Saldo Líquido do Período
                </td>
                <td className="py-2.5 px-2 text-center text-[11px] text-primary whitespace-nowrap">
                  {tableSummary.savingRate}%
                </td>
                <td
                  className={`py-2.5 px-2.5 text-right tabular-nums whitespace-nowrap ${
                    tableSummary.netBalance >= 0 ? 'text-secondary' : 'text-tertiary'
                  }`}
                >
                  {isBalanceHidden
                    ? '••••'
                    : `${tableSummary.netBalance < 0 ? '-' : ''}${formatMoney(Math.abs(tableSummary.netBalance), currency)}`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Interactive Cash Flow Chart (Income vs Expense) */}
      <section className="p-3 rounded-2xl bg-surface-container-lowest shadow-sm space-y-2.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[16px] font-bold text-on-surface">Evolução Mensal</span>
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

            <line stroke="#eaedff" strokeDasharray="3,3" strokeWidth="1" x1="0" x2="320" y1="30" y2="30" />
            <line stroke="#eaedff" strokeDasharray="3,3" strokeWidth="1" x1="0" x2="320" y1="80" y2="80" />
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
                {isBalanceHidden ? '+••••' : `+${formatMoney(activeSeriesItem.income, currency)}`}
              </span>
              <span className="text-tertiary font-bold">
                {isBalanceHidden ? '-••••' : `-${formatMoney(activeSeriesItem.expense, currency)}`}
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
                        <span className="material-symbols-outlined text-[18px]">{style.icon}</span>
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
                        {isBalanceHidden ? '••••' : formatMoney(cat.amount, currency)}
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
            {isBalanceHidden ? '••••' : formatMoney(metrics.incomeTotal, currency)} Total
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
                    {isBalanceHidden ? '••••' : formatMoney(src.amount, currency)}
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
    </div>
  );
}
