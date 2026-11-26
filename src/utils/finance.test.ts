import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSimplePDF,
  buildStyledReportCSV,
  buildStyledReportPDF,
  buildTransactionsCSV,
  computeBudgetTotals,
  computeDynamicSixMonthSeries,
  computeExpenseBreakdown,
  computeMonthOverMonthDelta,
  computeRealTimeAlerts,
  computeTransactionSummary,
  evaluateBudgetStatus,
  filterTransactions,
  filterTransactionsByDropdowns,
  filterTransactionsByMonth,
  formatHeaderDateLabel,
  formatMoney,
  getDateGroupLabel,
  getMonthCycleInfo,
  getMonthDropdownOptions,
  getMonthYearLabel,
  getUserInitials,
  isValidEmail,
  isValidPhoneMZ,
  maskCurrencyDigits,
  parseCurrencyInput,
  syncBudgetsWithTransactions,
  toLocalISODate,
} from './finance';
import {
  DASHBOARD_BASELINE_HISTORY,
  DEFAULT_ALERT_SETTINGS,
  INITIAL_BUDGET_CATEGORIES,
  INITIAL_GOALS,
  INITIAL_TRANSACTIONS,
  REPORTS_BASELINE_HISTORY,
} from '../data/seed';
import type { BudgetCategory, FinancialGoal, Transaction } from '../types/finance';

function buildSampleTransactions(ref: Date = new Date('2026-11-26T10:00:00')): Transaction[] {
  const ym = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
  const d0 = `${ym}-${String(ref.getDate()).padStart(2, '0')}`;
  const d1 = `${ym}-${String(Math.max(1, ref.getDate() - 1)).padStart(2, '0')}`;
  const d2 = `${ym}-${String(Math.max(1, ref.getDate() - 2)).padStart(2, '0')}`;
  const d6 = `${ym}-${String(Math.max(1, ref.getDate() - 6)).padStart(2, '0')}`;
  const d8 = `${ym}-${String(Math.max(1, ref.getDate() - 8)).padStart(2, '0')}`;
  return [
    {
      id: 'tx_1',
      type: 'income',
      description: 'Salário Mensal — Maputo',
      amount: 45000,
      category: 'Salário',
      date: d0,
      time: '09:30',
      account: 'Millennium bim',
      status: 'completed',
    },
    {
      id: 'tx_2',
      type: 'expense',
      description: 'Supermercado Shoprite',
      amount: 3450,
      category: 'Alimentação',
      date: d0,
      time: '11:15',
      account: 'M-Pesa',
      status: 'completed',
    },
    {
      id: 'tx_3',
      type: 'expense',
      description: 'Renda de Apartamento (Polana)',
      amount: 18000,
      category: 'Moradia',
      date: d1,
      time: '14:00',
      account: 'BCI',
      status: 'completed',
    },
    {
      id: 'tx_4',
      type: 'income',
      description: 'Consultoria & Freelance',
      amount: 12500,
      category: 'Investimentos',
      date: d1,
      time: '10:20',
      account: 'e-Mola',
      status: 'completed',
    },
    {
      id: 'tx_5',
      type: 'expense',
      description: 'Yango & Transporte Urbano',
      amount: 650,
      category: 'Transporte',
      date: d2,
      time: '18:45',
      account: 'M-Pesa',
      status: 'completed',
    },
    {
      id: 'tx_6',
      type: 'expense',
      description: 'TVCabo & Internet Vodacom',
      amount: 2400,
      category: 'Lazer',
      date: d6,
      time: '08:10',
      account: 'Millennium bim',
      status: 'pending',
    },
    {
      id: 'tx_7',
      type: 'expense',
      description: 'Energia EDM (Credelec) & Farmácia',
      amount: 1850,
      category: 'Saúde',
      date: d8,
      time: '16:20',
      account: 'mKesh',
      status: 'completed',
    },
  ];
}

const SAMPLE_TRANSACTIONS: Transaction[] = buildSampleTransactions();

const SAMPLE_BUDGETS: BudgetCategory[] = [
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

const SAMPLE_GOALS: FinancialGoal[] = [
  {
    id: 'goal_1',
    title: 'Reserva de Emergência',
    current: 65000,
    target: 120000,
    imageUrl: '',
    barColor: 'bg-secondary',
    accentColor: 'text-secondary',
  },
  {
    id: 'goal_2',
    title: 'Fundo de Férias',
    current: 45000,
    target: 50000,
    imageUrl: '',
    barColor: 'bg-primary',
    accentColor: 'text-primary',
  },
];

test('initial seed state and baseline histories start completely zeroed (no demo data)', () => {
  assert.equal(INITIAL_TRANSACTIONS.length, 0);
  assert.equal(INITIAL_BUDGET_CATEGORIES.length, 0);
  assert.equal(INITIAL_GOALS.length, 0);
  assert.ok(DASHBOARD_BASELINE_HISTORY.every((m) => m.income === 0 && m.expense === 0));
  assert.ok(REPORTS_BASELINE_HISTORY.every((m) => m.income === 0 && m.expense === 0));

  const emptyAlerts = computeRealTimeAlerts({
    transactions: [],
    budgets: [],
    goals: [],
    settings: DEFAULT_ALERT_SETTINGS,
    currency: 'MZN',
  });
  assert.equal(emptyAlerts.length, 0);
});

test('formatMoney places MT on the right for MZN and $ on the left for USD', () => {
  assert.equal(formatMoney(1234.5, 'MZN'), '1.234,50 MT');
  assert.equal(formatMoney(6400, 'USD'), '$ 100,00');
  assert.equal(formatMoney(1234.5, 'USD', false), '$ 1.234,50');
});

test('computeTransactionSummary computes totals and saving rate accurately', () => {
  const summary = computeTransactionSummary(SAMPLE_TRANSACTIONS);
  assert.equal(summary.totalIncome, 57500);
  assert.equal(summary.totalExpense, 26350);
  assert.equal(summary.netBalance, 31150);
  assert.equal(summary.incomeCount, 2);
  assert.equal(summary.expenseCount, 5);
  assert.equal(summary.savingRate, '54.2');
});

test('filterTransactions filters by type, status, category, and search query', () => {
  const onlyIncome = filterTransactions(SAMPLE_TRANSACTIONS, 'income', '');
  assert.equal(onlyIncome.length, 2);

  const onlyPending = filterTransactions(SAMPLE_TRANSACTIONS, 'pending', '');
  assert.equal(onlyPending.length, 1);
  assert.equal(onlyPending[0].id, 'tx_6');

  const searchYango = filterTransactions(SAMPLE_TRANSACTIONS, 'all', 'yango');
  assert.equal(searchYango.length, 1);
  assert.equal(searchYango[0].category, 'Transporte');
});

test('getDateGroupLabel formats Hoje, Ontem, and short dates', () => {
  const ref = new Date('2026-11-26T12:00:00');
  assert.equal(getDateGroupLabel('2026-11-26', ref), 'Hoje');
  assert.equal(getDateGroupLabel('2026-11-25', ref), 'Ontem');
  assert.match(getDateGroupLabel('2026-11-20', ref), /20/);
});

test('dynamic month cycle, sample transactions, and 6-month series adapt to reference date', () => {
  const ref = new Date('2026-11-26T10:00:00');
  const cycle = getMonthCycleInfo(ref);
  assert.equal(cycle.monthYearLabel, 'Novembro 2026');
  assert.equal(cycle.cycleLabel, 'Ciclo atual: 01 Nov - 30 Nov');
  assert.equal(cycle.daysRemainingLabel, '4 dias restantes');
  assert.equal(getMonthYearLabel(2026, 10), 'Novembro 2026');
  assert.equal(toLocalISODate(ref), '2026-11-26');

  const seeded = buildSampleTransactions(ref);
  const novTxs = filterTransactionsByMonth(seeded, 2026, 10);
  assert.equal(novTxs.length, 7);

  const series = computeDynamicSixMonthSeries(seeded, DASHBOARD_BASELINE_HISTORY, ref);
  assert.equal(series.length, 6);
  assert.equal(series[5].month, 'Nov');
  assert.equal(series[5].year, 2026);
  assert.equal(series[5].income, 57500);

  const breakdown = computeExpenseBreakdown(novTxs);
  assert.equal(breakdown[0].name, 'Moradia');
});

test('currency masking and parsing handle BR decimal strings', () => {
  assert.equal(maskCurrencyDigits('123450'), '1.234,50');
  assert.equal(parseCurrencyInput('1.234,50'), 1234.5);
  assert.equal(parseCurrencyInput('489.20'), 489.2);
  assert.ok(Number.isNaN(parseCurrencyInput('   ')));
});

test('evaluateBudgetStatus classifies thresholds and formats MZN right / USD left', () => {
  const healthy = evaluateBudgetStatus(1850, 3000, 'MZN');
  assert.equal(healthy.status, 'healthy');
  assert.equal(healthy.percentage, 62);
  assert.equal(healthy.tagText, 'Resta 1.150,00 MT');

  const healthyUsd = evaluateBudgetStatus(320, 640, 'USD');
  assert.equal(healthyUsd.tagText, 'Resta $ 5,00');

  const critical = evaluateBudgetStatus(3350, 3500, 'MZN');
  assert.equal(critical.status, 'critical');
  assert.equal(critical.percentage, 96);
  assert.equal(critical.tagText, 'Limite Quase Atingido');
});

test('computeBudgetTotals sums limits and spent correctly', () => {
  const totals = computeBudgetTotals(SAMPLE_BUDGETS);
  assert.equal(totals.totalLimit, 37500);
  assert.equal(totals.totalSpent, 23950);
  assert.equal(totals.available, 13550);
  assert.equal(totals.percentage, 64);
});

test('filterTransactionsByDropdowns filters by status/type, category, account, and reference/notes', () => {
  const byAccount = filterTransactionsByDropdowns(SAMPLE_TRANSACTIONS, {
    typeStatus: 'all',
    category: 'all',
    account: 'M-Pesa',
    searchQuery: '',
  });
  assert.equal(byAccount.length, 2);

  const byPending = filterTransactionsByDropdowns(SAMPLE_TRANSACTIONS, {
    typeStatus: 'pending',
    category: 'Lazer',
    account: 'Millennium bim',
    searchQuery: 'tvcabo',
  });
  assert.equal(byPending.length, 1);
  assert.equal(byPending[0].id, 'tx_6');

  const withRefAndNotes = [
    ...SAMPLE_TRANSACTIONS,
    {
      id: 'tx_extra',
      type: 'expense' as const,
      description: 'Compra de Energia',
      amount: 500,
      category: 'Energia & Água',
      date: SAMPLE_TRANSACTIONS[0].date,
      account: 'M-Pesa',
      status: 'completed' as const,
      reference: '+258 84 123 4567',
      notes: 'Contador Credelec casa',
    },
  ];
  const refMatch = filterTransactionsByDropdowns(withRefAndNotes, {
    typeStatus: 'completed',
    category: 'all',
    account: 'M-Pesa',
    searchQuery: '84 123',
  });
  assert.equal(refMatch.length, 1);
  assert.equal(refMatch[0].id, 'tx_extra');
});

test('syncBudgetsWithTransactions updates budget spent in real time when status toggles', () => {
  const ref = new Date('2026-11-26T10:00:00');
  const seeded = buildSampleTransactions(ref);
  const syncedBefore = syncBudgetsWithTransactions(SAMPLE_BUDGETS, seeded, ref);
  const lazerBefore = syncedBefore.find((b) => b.id === 'cat_lazer');
  assert.equal(lazerBefore?.spent, 0);

  const updatedTxs = seeded.map((t) =>
    t.id === 'tx_6' ? { ...t, status: 'completed' as const } : t
  );
  const syncedAfter = syncBudgetsWithTransactions(SAMPLE_BUDGETS, updatedTxs, ref);
  const lazerAfter = syncedAfter.find((b) => b.id === 'cat_lazer');
  assert.equal(lazerAfter?.spent, 2400);
  assert.equal(evaluateBudgetStatus(lazerAfter!.spent, lazerAfter!.limit, 'MZN').percentage, 96);
});

test('buildTransactionsCSV honors inclusion toggles and buildSimplePDF produces valid PDF structure', async () => {
  const csvAll = buildTransactionsCSV(SAMPLE_TRANSACTIONS);
  assert.ok(csvAll.includes('Salário Mensal — Maputo'));
  assert.ok(csvAll.includes('Supermercado Shoprite'));

  const csvNoExpense = buildTransactionsCSV(SAMPLE_TRANSACTIONS, {
    includeIncome: true,
    includeExpense: false,
    includeInvestments: true,
  });
  assert.ok(csvNoExpense.includes('Salário Mensal — Maputo'));
  assert.ok(!csvNoExpense.includes('Supermercado Shoprite'));

  const pdfBlob = buildSimplePDF('FinTrack Resumo', ['Linha 1: Teste']);
  const pdfText = await pdfBlob.text();
  assert.ok(pdfText.startsWith('%PDF-1.4'));
  assert.ok(pdfText.includes('xref'));
  assert.ok(pdfText.endsWith('%%EOF'));
});

test('isValidEmail validates email syntax', () => {
  assert.equal(isValidEmail('edson@fintrack.co.mz'), true);
  assert.equal(isValidEmail('invalid-email'), false);
});

test('getMonthDropdownOptions returns 12 months in Portuguese and computeMonthOverMonthDelta computes real variance', () => {
  const opts = getMonthDropdownOptions();
  assert.equal(opts.length, 12);
  assert.equal(opts[0].label, 'Janeiro');
  assert.equal(opts[11].label, 'Dezembro');

  const deltaUp = computeMonthOverMonthDelta([
    {
      key: '2026-09',
      year: 2026,
      monthIndex: 8,
      month: 'Out',
      label: 'Outubro',
      income: 30000,
      expense: 20000,
      savePct: '33.3%',
      highlight: false,
    },
    {
      key: '2026-10',
      year: 2026,
      monthIndex: 9,
      month: 'Nov',
      label: 'Novembro',
      income: 35000,
      expense: 20000,
      savePct: '42.9%',
      highlight: true,
    },
  ]);
  assert.equal(deltaUp.isPositive, true);
  assert.equal(deltaUp.pctText, '+50.0%');

  const deltaDown = computeMonthOverMonthDelta([
    {
      key: '2026-09',
      year: 2026,
      monthIndex: 8,
      month: 'Out',
      label: 'Outubro',
      income: 30000,
      expense: 10000,
      savePct: '66.7%',
      highlight: false,
    },
    {
      key: '2026-10',
      year: 2026,
      monthIndex: 9,
      month: 'Nov',
      label: 'Novembro',
      income: 20000,
      expense: 10000,
      savePct: '50.0%',
      highlight: true,
    },
  ]);
  assert.equal(deltaDown.isPositive, false);
  assert.equal(deltaDown.pctText, '-50.0%');
});

test('computeRealTimeAlerts handles custom negativeAlertThreshold, low balance, goals, budgets, and pending items', () => {
  const ref = new Date('2026-11-26T12:00:00');
  const seeded = buildSampleTransactions(ref);

  // Sample set has netBalance = 31150 -> raise lowBalanceThreshold to 35000 to trigger low balance
  const lowAlerts = computeRealTimeAlerts({
    transactions: seeded,
    budgets: SAMPLE_BUDGETS,
    goals: SAMPLE_GOALS,
    settings: { ...DEFAULT_ALERT_SETTINGS, lowBalanceThreshold: 35000 },
    currency: 'MZN',
    now: ref,
  });
  assert.ok(lowAlerts.some((a) => a.id === 'alert_balance_low'));
  assert.ok(lowAlerts.some((a) => a.category === 'budget'));
  assert.ok(lowAlerts.some((a) => a.category === 'goal'));
  assert.ok(lowAlerts.some((a) => a.category === 'pending'));

  // Negative balance of -1200 MT with custom threshold -2000 MT -> warning only (not critical yet)
  const negTxList = [
    ...seeded,
    {
      id: 'tx_huge',
      type: 'expense' as const,
      description: 'Compra Grande',
      amount: 32350,
      category: 'Outros',
      date: '2026-11-26',
      account: 'BCI',
      status: 'completed' as const,
    },
  ];
  const underMinus2k = computeRealTimeAlerts({
    transactions: negTxList,
    budgets: SAMPLE_BUDGETS,
    goals: SAMPLE_GOALS,
    settings: { ...DEFAULT_ALERT_SETTINGS, negativeAlertThreshold: -2000, lowBalanceThreshold: 5000 },
    currency: 'MZN',
    now: ref,
  });
  assert.ok(underMinus2k.some((a) => a.id === 'alert_balance_low'));
  assert.ok(!underMinus2k.some((a) => a.id === 'alert_balance_negative'));

  // With threshold -1000 MT, netBalance -1200 MT triggers critical negative balance alert
  const underMinus1k = computeRealTimeAlerts({
    transactions: negTxList,
    budgets: SAMPLE_BUDGETS,
    goals: SAMPLE_GOALS,
    settings: { ...DEFAULT_ALERT_SETTINGS, negativeAlertThreshold: -1000, lowBalanceThreshold: 5000 },
    currency: 'MZN',
    now: ref,
  });
  assert.ok(underMinus1k.some((a) => a.id === 'alert_balance_negative' && a.severity === 'critical'));
});

test('formatHeaderDateLabel formats Hoje, Weekday, dd/mm/yyyy', () => {
  const ref = new Date('2026-11-26T09:00:00');
  assert.equal(formatHeaderDateLabel(ref), 'Hoje, Quinta, 26/11/2026');
});

test('isValidPhoneMZ and getUserInitials validate Mozambique phones and initials', () => {
  assert.equal(isValidPhoneMZ('+258 84 123 4567'), true);
  assert.equal(isValidPhoneMZ('841234567'), true);
  assert.equal(isValidPhoneMZ('12345'), false);
  assert.equal(getUserInitials('Edson Machava'), 'EM');
  assert.equal(getUserInitials('Edson'), 'ED');
});

test('buildStyledReportCSV and buildStyledReportPDF generate structured styled outputs', async () => {
  const csv = buildStyledReportCSV({
    transactions: SAMPLE_TRANSACTIONS,
    currency: 'MZN',
    periodLabel: 'Mês Atual',
    userName: 'Edson Machava',
    userPhone: '+258 84 310 2200',
  });
  assert.ok(csv.includes('FINTRACK MOÇAMBIQUE — RELATÓRIO FINANCEIRO'));
  assert.ok(csv.includes('Edson Machava'));
  assert.ok(csv.includes('Salário Mensal — Maputo'));
  assert.ok(csv.includes('TOTAL'));

  const pdfBlob = buildStyledReportPDF({
    transactions: SAMPLE_TRANSACTIONS,
    currency: 'MZN',
    periodLabel: 'Mês Atual',
    userName: 'Edson Machava',
    userPhone: '+258 84 310 2200',
  });
  assert.equal(pdfBlob.type, 'application/pdf');
  const headText = await pdfBlob.slice(0, 16).text();
  assert.ok(headText.startsWith('%PDF-'));
  assert.ok(pdfBlob.size > 1500);
});
