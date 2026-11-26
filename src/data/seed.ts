import type {
  AlertSettings,
  BudgetCategory,
  CurrencyCode,
  FinancialGoal,
  ReportPeriod,
  Transaction,
} from '../types/finance';
import {
  computeTransactionSummary,
  filterTransactionsByMonth,
  getFullMonthName,
} from '../utils/finance';

export const ASSETS = {
  logo: '',
  avatar: '',
  goalEmergency: '',
  goalEurope: '',
  goalInvest: '',
};

export const CURRENCY_CONFIG: Record<
  CurrencyCode,
  { symbol: string; position: 'left' | 'right'; rateFromBase: number }
> = {
  MZN: { symbol: 'MT', position: 'right', rateFromBase: 1 },
  USD: { symbol: '$', position: 'left', rateFromBase: 1 / 64 },
};

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  lowBalanceThreshold: 5000,
  negativeAlertThreshold: 0,
  enableBudgetAlerts: true,
  enableGoalAlerts: true,
  enableLowBalanceAlerts: true,
  enablePendingAlerts: true,
};

export function getInitialTransactions(): Transaction[] {
  return [];
}

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const MOZAMBIQUE_ACCOUNTS = [
  'M-Pesa',
  'e-Mola',
  'mKesh',
  'Millennium bim',
  'BCI',
  'Standard Bank MZ',
  'Absa Moçambique',
  'Numerário',
] as const;

export const EXPENSE_CATEGORIES = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Energia & Água',
  'Comunicação',
  'Saúde',
  'Lazer',
  'Educação',
  'Vestuário',
  'Assinaturas',
  'Outros',
] as const;

export const INCOME_CATEGORIES = [
  'Salário',
  'Consultoria & Freelance',
  'Negócio / Vendas',
  'Investimentos',
  'Subsídios / Bónus',
  'Outros',
] as const;

export const INITIAL_BUDGET_CATEGORIES: BudgetCategory[] = [];

export function getInitialGoals(): FinancialGoal[] {
  return [];
}

export const INITIAL_GOALS: FinancialGoal[] = [];

export const DASHBOARD_BASELINE_HISTORY: Array<{ income: number; expense: number }> = [
  { income: 0, expense: 0 },
  { income: 0, expense: 0 },
  { income: 0, expense: 0 },
  { income: 0, expense: 0 },
  { income: 0, expense: 0 },
  { income: 0, expense: 0 },
];

export const REPORTS_BASELINE_HISTORY: Array<{ income: number; expense: number }> = [
  { income: 0, expense: 0 },
  { income: 0, expense: 0 },
  { income: 0, expense: 0 },
  { income: 0, expense: 0 },
  { income: 0, expense: 0 },
  { income: 0, expense: 0 },
];

export interface ReportMetricsSummary {
  trendBadge: string;
  netSavings: number;
  savingsRate: string;
  topExpenseTitle: string;
  topExpenseAmount: number;
  topExpenseShare: string;
  dailyAvg: number;
  dailyDelta: string;
  highlightMonthText: string;
  incomeTotal: number;
  expenseTotal: number;
}

export function getReportPeriodMetrics(
  period: ReportPeriod,
  transactions: Transaction[],
  scopedTransactions: Transaction[],
  referenceDate: Date = new Date()
): ReportMetricsSummary {
  const year = referenceDate.getFullYear();
  const monthIdx = referenceDate.getMonth();
  const currentMonthName = getFullMonthName(monthIdx);
  const currentDay = Math.max(referenceDate.getDate(), 1);

  const curMonthTxs = filterTransactionsByMonth(transactions, year, monthIdx);
  const activeSet = period === 'mes' ? curMonthTxs : scopedTransactions;
  const summary = computeTransactionSummary(activeSet);

  // Previous month dynamic baseline comparison
  const prevDate = new Date(year, monthIdx - 1, 1);
  const prevMonthTxs = filterTransactionsByMonth(
    transactions,
    prevDate.getFullYear(),
    prevDate.getMonth()
  );
  const prevSummary = computeTransactionSummary(prevMonthTxs);
  const prevFallback = REPORTS_BASELINE_HISTORY[REPORTS_BASELINE_HISTORY.length - 2] ?? {
    income: 0,
    expense: 0,
  };
  const prevNet =
    prevMonthTxs.length > 0 ? prevSummary.netBalance : prevFallback.income - prevFallback.expense;
  const netDeltaPct =
    Math.abs(prevNet) > 0 ? ((summary.netBalance - prevNet) / Math.abs(prevNet)) * 100 : 0;
  const formattedDelta = `${netDeltaPct >= 0 ? '+' : ''}${netDeltaPct.toFixed(1)}%`;

  // Top expense category
  const expenseMap = new Map<string, number>();
  for (const t of activeSet) {
    if (t.type === 'expense') {
      expenseMap.set(t.category, (expenseMap.get(t.category) ?? 0) + t.amount);
    }
  }
  const sortedExpenses = Array.from(expenseMap.entries()).sort((a, b) => b[1] - a[1]);
  const topCat = sortedExpenses[0];
  const topExpenseTitle = topCat ? topCat[0] : 'Sem despesas';
  const topExpenseAmount = topCat ? topCat[1] : 0;
  const topExpenseShare =
    summary.totalExpense > 0 && topCat
      ? `${((topCat[1] / summary.totalExpense) * 100).toFixed(1)}% das despesas`
      : '0.0% das despesas';

  const daysDivisor =
    period === 'mes' ? currentDay : period === 'trimestre' ? 90 : period === 'ano' ? 365 : Math.max(currentDay, 1);
  const dailyAvg = summary.totalExpense / daysDivisor;
  const prevDailyRef =
    (prevMonthTxs.length > 0 ? prevSummary.totalExpense : prevFallback.expense) / 30;
  const dailyDiffPct =
    prevDailyRef > 0 ? ((dailyAvg - prevDailyRef) / prevDailyRef) * 100 : 0;
  const dailyDiffLabel = `${dailyDiffPct >= 0 ? '+' : ''}${dailyDiffPct.toFixed(1)}% vs mês ant.`;

  const highlightMap: Record<ReportPeriod, { badge: string; label: string; delta: string }> = {
    mes: {
      badge: `${formattedDelta} vs mês anterior`,
      label: `Poupança em ${currentMonthName}:`,
      delta: dailyDiffLabel,
    },
    trimestre: {
      badge: `${summary.savingRate}% poupados`,
      label: 'Poupança no Trimestre:',
      delta: `${activeSet.length} lançamentos`,
    },
    ano: {
      badge: `${summary.savingRate}% poupados em ${year}`,
      label: `Poupança em ${year}:`,
      delta: `${activeSet.length} lançamentos`,
    },
    custom: {
      badge: `${activeSet.length} lançamentos`,
      label: 'Poupança no Período:',
      delta: `${summary.pendingCount} pendentes`,
    },
  };

  return {
    trendBadge: highlightMap[period].badge,
    netSavings: summary.netBalance,
    savingsRate: `${summary.savingRate}%`,
    topExpenseTitle,
    topExpenseAmount,
    topExpenseShare,
    dailyAvg,
    dailyDelta: highlightMap[period].delta,
    highlightMonthText: highlightMap[period].label,
    incomeTotal: summary.totalIncome,
    expenseTotal: summary.totalExpense,
  };
}

export const CATEGORY_STYLE_META: Record<
  string,
  { icon: string; bg: string; color: string }
> = {
  Alimentação: { icon: 'restaurant', bg: 'bg-orange-500/10', color: 'text-orange-600' },
  Transporte: { icon: 'directions_car', bg: 'bg-blue-500/10', color: 'text-blue-600' },
  Moradia: { icon: 'home', bg: 'bg-indigo-500/10', color: 'text-indigo-600' },
  'Energia & Água': { icon: 'bolt', bg: 'bg-amber-500/10', color: 'text-amber-600' },
  Comunicação: { icon: 'wifi', bg: 'bg-sky-500/10', color: 'text-sky-600' },
  Lazer: { icon: 'celebration', bg: 'bg-pink-500/10', color: 'text-pink-600' },
  Saúde: { icon: 'favorite', bg: 'bg-tertiary-fixed', color: 'text-tertiary' },
  Salário: { icon: 'payments', bg: 'bg-secondary-container/70', color: 'text-secondary' },
  'Consultoria & Freelance': { icon: 'work', bg: 'bg-secondary-container/70', color: 'text-secondary' },
  'Negócio / Vendas': { icon: 'storefront', bg: 'bg-secondary-container/70', color: 'text-secondary' },
  'Subsídios / Bónus': { icon: 'redeem', bg: 'bg-secondary-container/70', color: 'text-secondary' },
  Investimentos: { icon: 'trending_up', bg: 'bg-purple-500/10', color: 'text-purple-600' },
  Educação: { icon: 'school', bg: 'bg-primary-fixed', color: 'text-primary' },
  Vestuário: { icon: 'checkroom', bg: 'bg-primary-fixed', color: 'text-primary' },
  Assinaturas: { icon: 'subscriptions', bg: 'bg-primary-fixed', color: 'text-primary' },
  Pets: { icon: 'pets', bg: 'bg-primary-fixed', color: 'text-primary' },
  Outros: { icon: 'receipt', bg: 'bg-surface-container', color: 'text-on-surface-variant' },
};
