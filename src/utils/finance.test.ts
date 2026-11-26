import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSimplePDF,
  buildTransactionsCSV,
  computeBudgetTotals,
  computeDynamicSixMonthSeries,
  computeExpenseBreakdown,
  computeTransactionSummary,
  evaluateBudgetStatus,
  filterTransactions,
  filterTransactionsByMonth,
  formatMoney,
  getDateGroupLabel,
  getMonthCycleInfo,
  getMonthYearLabel,
  isValidEmail,
  maskCurrencyDigits,
  parseCurrencyInput,
  toLocalISODate,
} from './finance';
import {
  DASHBOARD_BASELINE_HISTORY,
  getInitialTransactions,
  INITIAL_BUDGET_CATEGORIES,
  INITIAL_TRANSACTIONS,
} from '../data/seed';

test('formatMoney places MT on the right for MZN and $ on the left for USD', () => {
  assert.equal(formatMoney(1234.5, 'MZN'), '1.234,50 MT');
  assert.equal(formatMoney(6400, 'USD'), '$ 100,00');
  assert.equal(formatMoney(1234.5, 'USD', false), '$ 1.234,50');
});

test('computeTransactionSummary computes totals and saving rate accurately', () => {
  const summary = computeTransactionSummary(INITIAL_TRANSACTIONS);
  assert.equal(summary.totalIncome, 12300);
  assert.equal(Math.round(summary.totalExpense * 100) / 100, 3340.8);
  assert.equal(Math.round(summary.netBalance * 100) / 100, 8959.2);
  assert.equal(summary.incomeCount, 2);
  assert.equal(summary.expenseCount, 5);
  assert.equal(summary.savingRate, '72.8');
});

test('filterTransactions filters by type, status, category, and search query', () => {
  const onlyIncome = filterTransactions(INITIAL_TRANSACTIONS, 'income', '');
  assert.equal(onlyIncome.length, 2);

  const onlyPending = filterTransactions(INITIAL_TRANSACTIONS, 'pending', '');
  assert.equal(onlyPending.length, 1);
  assert.equal(onlyPending[0].id, 'tx_6');

  const searchUber = filterTransactions(INITIAL_TRANSACTIONS, 'all', 'uber');
  assert.equal(searchUber.length, 1);
  assert.equal(searchUber[0].category, 'Transporte');
});

test('getDateGroupLabel formats Hoje, Ontem, and short dates', () => {
  const ref = new Date('2026-11-26T12:00:00');
  assert.equal(getDateGroupLabel('2026-11-26', ref), 'Hoje');
  assert.equal(getDateGroupLabel('2026-11-25', ref), 'Ontem');
  assert.match(getDateGroupLabel('2026-11-20', ref), /20/);
});

test('dynamic month cycle, seed transactions, and 6-month series adapt to reference date', () => {
  const ref = new Date('2026-11-26T10:00:00');
  const cycle = getMonthCycleInfo(ref);
  assert.equal(cycle.monthYearLabel, 'Novembro 2026');
  assert.equal(cycle.cycleLabel, 'Ciclo atual: 01 Nov - 30 Nov');
  assert.equal(cycle.daysRemainingLabel, '4 dias restantes');
  assert.equal(getMonthYearLabel(2026, 10), 'Novembro 2026');
  assert.equal(toLocalISODate(ref), '2026-11-26');

  const seeded = getInitialTransactions(ref);
  const novTxs = filterTransactionsByMonth(seeded, 2026, 10);
  assert.equal(novTxs.length, 7);

  const series = computeDynamicSixMonthSeries(seeded, DASHBOARD_BASELINE_HISTORY, ref);
  assert.equal(series.length, 6);
  assert.equal(series[5].month, 'Nov');
  assert.equal(series[5].year, 2026);
  assert.equal(series[5].income, 12300);

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
  const healthy = evaluateBudgetStatus(380, 600, 'MZN');
  assert.equal(healthy.status, 'healthy');
  assert.equal(healthy.percentage, 63);
  assert.equal(healthy.tagText, 'Resta 220,00 MT');

  const healthyUsd = evaluateBudgetStatus(320, 640, 'USD');
  assert.equal(healthyUsd.tagText, 'Resta $ 5,00');

  const critical = evaluateBudgetStatus(480, 500, 'MZN');
  assert.equal(critical.status, 'critical');
  assert.equal(critical.percentage, 96);
  assert.equal(critical.tagText, 'Limite Quase Atingido');
});

test('computeBudgetTotals sums limits and spent correctly', () => {
  const totals = computeBudgetTotals(INITIAL_BUDGET_CATEGORIES);
  assert.equal(totals.totalLimit, 5000);
  assert.equal(Math.round(totals.totalSpent * 100) / 100, 3849.8);
  assert.equal(Math.round(totals.available * 100) / 100, 1150.2);
  assert.equal(totals.percentage, 77);
});

test('buildTransactionsCSV honors inclusion toggles and buildSimplePDF produces valid PDF structure', async () => {
  const csvAll = buildTransactionsCSV(INITIAL_TRANSACTIONS);
  assert.ok(csvAll.includes('Salário Tech Corp'));
  assert.ok(csvAll.includes('Supermercado St. Marche'));

  const csvNoExpense = buildTransactionsCSV(INITIAL_TRANSACTIONS, {
    includeIncome: true,
    includeExpense: false,
    includeInvestments: true,
  });
  assert.ok(csvNoExpense.includes('Salário Tech Corp'));
  assert.ok(!csvNoExpense.includes('Supermercado St. Marche'));

  const pdfBlob = buildSimplePDF('FinTrack Resumo', ['Linha 1: Teste']);
  const pdfText = await pdfBlob.text();
  assert.ok(pdfText.startsWith('%PDF-1.4'));
  assert.ok(pdfText.includes('xref'));
  assert.ok(pdfText.endsWith('%%EOF'));
});

test('isValidEmail validates email syntax', () => {
  assert.equal(isValidEmail('lucas@fintrack.com'), true);
  assert.equal(isValidEmail('invalid-email'), false);
});
