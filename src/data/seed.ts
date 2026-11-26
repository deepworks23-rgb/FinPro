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
  daysAgoISODate,
  filterTransactionsByMonth,
  getFullMonthName,
  toLocalISODate,
} from '../utils/finance';

export const ASSETS = {
  logo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCOM05_l28W1zIFxSr__O_naFptH8nuezafpBijO5vL3JrFjTHA-Hk774tpNkav6dvo5WLGaqS2VCNJ7BnFzfRPEYBtWPDqFOEAutUawNW2rZJFPepoeif1hvfKe-0dkHnjyaJoZSgcpa8Bw2AiE03iTVqgn0x6GLsUu5wSjjmz0E-FtKKhZia8JQIXs2CpvGlpjd-QZYyvZaVvvaJ5Otby4S5Oi0KuaYPkUm037Eo',
  avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCMTMN3Gp0GSjpix076C38vMsFYmMSygxjziqQAlFiOcKWhMwNcL3qt78AYJMH7LpAz2l5vTRrc6c2MUcMO5m-Q_nfGB_tqlKhw7TaL8hWu7nBFeemh3040D8Sk-6Tau0Bqkeaj-S5eBi3ygxc4mOa34z1sX1JQ6cVIsOBQ2FUETFiOeotkzfq2N-qkGTzLx5xTkrjb2A9Bft3h8WOQukI-XEhnGVkd8VmhrFk7dvg',
  goalEmergency: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCYrXbRvELOAegfYeEjd6lrKdMHmSoGBgIJrl5FDMHae36IVf8fpoTl59PmKahF9qdSfn3qK37B19aUEjWXn16O35ELvddA53pWG6ad-c_3qO0Uz02tfTjpxaAQf3ATyDryf2CEx6GpX50bGoVXsXog0I_zhLQeNueJctPCzv8VFEmO1No6DLpzFUhW2TeVi4l7mDvDdNPzryx_2FDKEkKIaxag2LITioeBX9YB9bw',
  goalEurope: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCXy907F4qluif9HZe-pCWY3zenIvxJZfQQZI5SOpuCJw6ELGoQ9rnIlbTL3YiH745SsGWTpZGj1C3HdGlOk-O4fzIY6I4Rsc7RcmGShoVZT3XHOS66w29tnN_RDSw-fGkuMNfKp7VCUiDbrD7-M_wQiSPbVTuj8Ok8gYDuOaG4tM_QtZuHUeRiocb4U2xzb4UFQvXNyZbPrKS_Fr4hMs-gj5Sc3vhLHdwtD3NRKgs',
  goalInvest: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBXj2kTwXM6yTpHTgV87ZmCmxQjzO3VIcYa0NzPE7lsFFxkTBfx0IjnkUJ8mCkXKXjlsv7_A1LXZVHKjNsqnUgauikviKu5qAOEsptgDAffD2OountbgtAxrI2j3lhg86I0krv1D5Un-HBM-2ra3EoEhh2aixXzK1IUs5gek3Jr2NhK0a-DeKp7l_Hg0C3ZBbMfL8z_2gjlL-CwHUq3x25wBWPvhZ30Pvw43V2wyuo',
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

function currentMonthOffsetDate(daysAgo: number, ref: Date = new Date()): string {
  const targetDay = ref.getDate() - daysAgo;
  if (targetDay >= 1) {
    return daysAgoISODate(daysAgo, ref);
  }
  return toLocalISODate(new Date(ref.getFullYear(), ref.getMonth(), 1));
}

export function getInitialTransactions(referenceDate: Date = new Date()): Transaction[] {
  return [
    {
      id: 'tx_1',
      type: 'income',
      description: 'Salário Mensal — Maputo',
      amount: 45000.0,
      category: 'Salário',
      date: currentMonthOffsetDate(0, referenceDate),
      time: '09:30',
      account: 'Millennium bim',
      status: 'completed',
    },
    {
      id: 'tx_2',
      type: 'expense',
      description: 'Supermercado Shoprite',
      amount: 3450.0,
      category: 'Alimentação',
      date: currentMonthOffsetDate(0, referenceDate),
      time: '11:15',
      account: 'M-Pesa',
      status: 'completed',
    },
    {
      id: 'tx_3',
      type: 'expense',
      description: 'Renda de Apartamento (Polana)',
      amount: 18000.0,
      category: 'Moradia',
      date: currentMonthOffsetDate(1, referenceDate),
      time: '14:00',
      account: 'BCI',
      status: 'completed',
    },
    {
      id: 'tx_4',
      type: 'income',
      description: 'Consultoria & Freelance',
      amount: 12500.0,
      category: 'Investimentos',
      date: currentMonthOffsetDate(1, referenceDate),
      time: '10:20',
      account: 'e-Mola',
      status: 'completed',
    },
    {
      id: 'tx_5',
      type: 'expense',
      description: 'Yango & Transporte Urbano',
      amount: 650.0,
      category: 'Transporte',
      date: currentMonthOffsetDate(2, referenceDate),
      time: '18:45',
      account: 'M-Pesa',
      status: 'completed',
    },
    {
      id: 'tx_6',
      type: 'expense',
      description: 'TVCabo & Internet Vodacom',
      amount: 2400.0,
      category: 'Lazer',
      date: currentMonthOffsetDate(6, referenceDate),
      time: '08:10',
      account: 'Millennium bim',
      status: 'pending',
    },
    {
      id: 'tx_7',
      type: 'expense',
      description: 'Energia EDM (Credelec) & Farmácia',
      amount: 1850.0,
      category: 'Saúde',
      date: currentMonthOffsetDate(8, referenceDate),
      time: '16:20',
      account: 'mKesh',
      status: 'completed',
    },
  ];
}

export const INITIAL_TRANSACTIONS: Transaction[] = getInitialTransactions();

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

export const INITIAL_BUDGET_CATEGORIES: BudgetCategory[] = [
  {
    id: 'cat_alimentacao',
    category: 'Alimentação',
    limit: 8000,
    spent: 3450,
    icon: 'restaurant',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-700',
  },
  {
    id: 'cat_transporte',
    category: 'Transporte',
    limit: 3000,
    spent: 650,
    icon: 'directions_car',
    iconBg: 'bg-secondary-fixed',
    iconColor: 'text-on-secondary-container',
  },
  {
    id: 'cat_moradia',
    category: 'Moradia & Contas',
    limit: 20000,
    spent: 18000,
    icon: 'home',
    iconBg: 'bg-surface-container',
    iconColor: 'text-primary',
  },
  {
    id: 'cat_lazer',
    category: 'Lazer & Entretenimento',
    limit: 2500,
    spent: 0,
    icon: 'movie',
    iconBg: 'bg-tertiary-fixed',
    iconColor: 'text-tertiary',
  },
  {
    id: 'cat_saude',
    category: 'Saúde & Bem-estar',
    limit: 4000,
    spent: 1850,
    icon: 'favorite',
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-800',
  },
];

export function getInitialGoals(referenceDate: Date = new Date()): FinancialGoal[] {
  const year = referenceDate.getFullYear();
  return [
    {
      id: 'goal_1',
      title: 'Reserva de Emergência',
      current: 65000,
      target: 120000,
      imageUrl: ASSETS.goalEmergency,
      barColor: 'bg-secondary',
      accentColor: 'text-secondary',
    },
    {
      id: 'goal_2',
      title: `Férias em Vilankulo & Tofo ${year}`,
      current: 28000,
      target: 50000,
      imageUrl: ASSETS.goalEurope,
      barColor: 'bg-primary',
      accentColor: 'text-primary',
    },
    {
      id: 'goal_3',
      title: `Investimento em Negócio ${year}`,
      current: 45000,
      target: 150000,
      imageUrl: ASSETS.goalInvest,
      barColor: 'bg-primary-container',
      accentColor: 'text-primary',
    },
  ];
}

export const INITIAL_GOALS: FinancialGoal[] = getInitialGoals();

export const DASHBOARD_BASELINE_HISTORY: Array<{ income: number; expense: number }> = [
  { income: 48000, expense: 25400 },
  { income: 45000, expense: 23900 },
  { income: 54000, expense: 28100 },
  { income: 51500, expense: 24800 },
  { income: 56000, expense: 27200 },
  { income: 57500, expense: 26350 },
];

export const REPORTS_BASELINE_HISTORY: Array<{ income: number; expense: number }> = [
  { income: 48000, expense: 25400 },
  { income: 45000, expense: 23900 },
  { income: 54000, expense: 28100 },
  { income: 51500, expense: 24800 },
  { income: 56000, expense: 27200 },
  { income: 57500, expense: 26350 },
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
    income: 56000,
    expense: 27200,
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
