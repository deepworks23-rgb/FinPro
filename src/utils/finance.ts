import { CURRENCY_CONFIG } from '../data/seed';
import type { BudgetCategory, CurrencyCode, Transaction } from '../types/finance';

export function formatMoney(
  amountBase: number,
  currency: CurrencyCode = 'MZN',
  convert = true
): string {
  const cfg = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.MZN;
  const converted = convert ? amountBase * cfg.rateFromBase : amountBase;
  const formatted = Math.abs(converted).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return cfg.position === 'left' ? `${cfg.symbol} ${formatted}` : `${formatted} ${cfg.symbol}`;
}

export function formatNumberBR(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseCurrencyInput(raw: string): number {
  const normalized = raw.trim();
  if (!normalized) return NaN;
  // Support both "1.234,56" (BR) and "1234.56" (dot decimal)
  if (normalized.includes(',')) {
    return parseFloat(normalized.replace(/\./g, '').replace(',', '.'));
  }
  return parseFloat(normalized);
}

export function maskCurrencyDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const floatVal = parseInt(digits, 10) / 100;
  return formatNumberBR(floatVal);
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  savingRate: string;
  incomeCount: number;
  expenseCount: number;
}

export function computeTransactionSummary(transactions: Transaction[]): TransactionSummary {
  let totalIncome = 0;
  let totalExpense = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const t of transactions) {
    if (t.type === 'income') {
      totalIncome += Number(t.amount);
      incomeCount += 1;
    } else if (t.type === 'expense') {
      totalExpense += Number(t.amount);
      expenseCount += 1;
    }
  }

  const netBalance = totalIncome - totalExpense;
  const savingRate =
    totalIncome > 0 ? (((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1) : '0.0';

  return {
    totalIncome,
    totalExpense,
    netBalance,
    savingRate,
    incomeCount,
    expenseCount,
  };
}

export function filterTransactions(
  transactions: Transaction[],
  filter: string,
  searchQuery: string
): Transaction[] {
  const q = searchQuery.toLowerCase().trim();
  return transactions
    .filter((t) => {
      if (q) {
        const matchDesc = t.description.toLowerCase().includes(q);
        const matchCat = t.category.toLowerCase().includes(q);
        const matchAccount = t.account.toLowerCase().includes(q);
        if (!matchDesc && !matchCat && !matchAccount) return false;
      }
      if (filter === 'income' && t.type !== 'income') return false;
      if (filter === 'expense' && t.type !== 'expense') return false;
      if (filter === 'pending' && t.status !== 'pending') return false;
      if (!['all', 'income', 'expense', 'pending'].includes(filter)) {
        if (t.category !== filter) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aKey = `${a.date}T${a.time ?? '00:00'}`;
      const bKey = `${b.date}T${b.time ?? '00:00'}`;
      return bKey.localeCompare(aKey);
    });
}

export function toLocalISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysAgoISODate(daysAgo: number, referenceDate: Date = new Date()): string {
  const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  d.setDate(d.getDate() - daysAgo);
  return toLocalISODate(d);
}

const PT_MONTHS_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const PT_MONTHS_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export function getMonthYearLabel(year: number, monthIndex: number): string {
  const normalizedMonth = ((monthIndex % 12) + 12) % 12;
  return `${PT_MONTHS_FULL[normalizedMonth]} ${year}`;
}

export function getShortMonthLabel(monthIndex: number): string {
  const normalizedMonth = ((monthIndex % 12) + 12) % 12;
  return PT_MONTHS_SHORT[normalizedMonth];
}

export function getFullMonthName(monthIndex: number): string {
  const normalizedMonth = ((monthIndex % 12) + 12) % 12;
  return PT_MONTHS_FULL[normalizedMonth];
}

export function getMonthCycleInfo(referenceDate: Date = new Date()) {
  const year = referenceDate.getFullYear();
  const monthIndex = referenceDate.getMonth();
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const currentDay = referenceDate.getDate();
  const daysRemaining = Math.max(lastDay - currentDay, 0);
  const shortMonth = getShortMonthLabel(monthIndex);
  const fullMonth = getFullMonthName(monthIndex);

  return {
    year,
    monthIndex,
    lastDay,
    daysRemaining,
    cycleLabel: `Ciclo atual: 01 ${shortMonth} - ${String(lastDay).padStart(2, '0')} ${shortMonth}`,
    daysRemainingLabel:
      daysRemaining === 0
        ? 'Último dia do ciclo'
        : daysRemaining === 1
          ? '1 dia restante'
          : `${daysRemaining} dias restantes`,
    monthYearLabel: `${fullMonth} ${year}`,
    shortMonth,
    fullMonth,
  };
}

export function filterTransactionsByMonth(
  transactions: Transaction[],
  year: number,
  monthIndex: number
): Transaction[] {
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  return transactions.filter((t) => t.date.startsWith(prefix));
}

export function filterTransactionsByDateRange(
  transactions: Transaction[],
  startDate: string,
  endDate: string
): Transaction[] {
  return transactions.filter((t) => {
    if (startDate && t.date < startDate) return false;
    if (endDate && t.date > endDate) return false;
    return true;
  });
}

export interface MonthlyCashFlowItem {
  key: string;
  year: number;
  monthIndex: number;
  month: string;
  label: string;
  income: number;
  expense: number;
  savePct: string;
  highlight: boolean;
}

export function computeDynamicSixMonthSeries(
  transactions: Transaction[],
  baselineOffsets: Array<{ income: number; expense: number }>,
  referenceDate: Date = new Date()
): MonthlyCashFlowItem[] {
  const curYear = referenceDate.getFullYear();
  const curMonth = referenceDate.getMonth();
  const items: MonthlyCashFlowItem[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(curYear, curMonth - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const short = getShortMonthLabel(m);
    const isCurrent = i === 0;
    const monthTxs = filterTransactionsByMonth(transactions, y, m);
    const realSummary = computeTransactionSummary(monthTxs);
    const base = baselineOffsets[5 - i] ?? { income: 0, expense: 0 };

    const income = monthTxs.length > 0 ? realSummary.totalIncome : isCurrent ? 0 : base.income;
    const expense = monthTxs.length > 0 ? realSummary.totalExpense : isCurrent ? 0 : base.expense;
    const pct = income > 0 ? Math.max(Math.round(((income - expense) / income) * 100), 0) : 0;

    items.push({
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      year: y,
      monthIndex: m,
      month: short,
      label: isCurrent ? `${short} (Atual)` : short,
      income,
      expense,
      savePct: `${pct}%`,
      highlight: isCurrent,
    });
  }

  return items;
}

export interface CategoryBreakdownItem {
  name: string;
  amount: number;
  percentage: number;
  strokeColor: string;
  dotClass: string;
  barClass: string;
}

const CATEGORY_COLORS: Array<{ stroke: string; dot: string; bar: string }> = [
  { stroke: '#3525cd', dot: 'bg-primary', bar: 'bg-primary' },
  { stroke: '#4f46e5', dot: 'bg-primary-container', bar: 'bg-tertiary-container' },
  { stroke: '#6cf8bb', dot: 'bg-secondary-container', bar: 'bg-secondary' },
  { stroke: '#e2dfff', dot: 'bg-primary-fixed', bar: 'bg-surface-tint' },
  { stroke: '#ffdad6', dot: 'bg-error-container', bar: 'bg-outline' },
];

export function computeExpenseBreakdown(transactions: Transaction[]): CategoryBreakdownItem[] {
  const expenses = transactions.filter((t) => t.type === 'expense');
  const total = expenses.reduce((sum, t) => sum + t.amount, 0);
  if (total <= 0) return [];

  const byCategory = new Map<string, number>();
  for (const tx of expenses) {
    byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) + tx.amount);
  }

  const sorted = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return sorted.map(([name, amount], idx) => {
    const palette = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
    return {
      name,
      amount,
      percentage: Math.round((amount / total) * 100),
      strokeColor: palette.stroke,
      dotClass: palette.dot,
      barClass: palette.bar,
    };
  });
}

export function getDateGroupLabel(dateStr: string, referenceDate = new Date()): string {
  const txDate = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(txDate.getTime())) return dateStr;

  const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const txDay = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
  const diffDays = Math.round((ref.getTime() - txDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';

  return txDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function groupTransactionsByDate(
  transactions: Transaction[],
  referenceDate = new Date()
): Array<{ label: string; items: Transaction[] }> {
  const groups = new Map<string, Transaction[]>();
  for (const item of transactions) {
    const label = getDateGroupLabel(item.date, referenceDate);
    const arr = groups.get(label);
    if (arr) {
      arr.push(item);
    } else {
      groups.set(label, [item]);
    }
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

export interface BudgetStatusInfo {
  percentage: number;
  remaining: number;
  status: 'healthy' | 'warning' | 'critical';
  barColor: string;
  tagBg: string;
  tagText: string;
  amountColor: string;
}

export function evaluateBudgetStatus(
  spent: number,
  limit: number,
  currency: CurrencyCode = 'MZN',
  convert = true
): BudgetStatusInfo {
  const safeLimit = limit > 0 ? limit : 1;
  const percentage = Math.min(Math.round((spent / safeLimit) * 100), 100);
  const remaining = Math.max(limit - spent, 0);
  const formattedRemaining = formatMoney(remaining, currency, convert);

  if (percentage >= 90) {
    return {
      percentage,
      remaining,
      status: 'critical',
      barColor: percentage >= 95 ? 'bg-tertiary-container' : 'bg-amber-500',
      tagBg:
        percentage >= 95
          ? 'bg-error-container text-on-error-container'
          : 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
      tagText:
        percentage >= 100
          ? 'Limite Excedido!'
          : percentage >= 95
            ? 'Limite Quase Atingido'
            : `Resta ${formattedRemaining}`,
      amountColor: 'text-tertiary',
    };
  }

  if (percentage >= 70) {
    return {
      percentage,
      remaining,
      status: 'warning',
      barColor: 'bg-amber-500',
      tagBg: 'bg-amber-100 text-amber-900',
      tagText: `Resta ${formattedRemaining}`,
      amountColor: 'text-on-surface',
    };
  }

  return {
    percentage,
    remaining,
    status: 'healthy',
    barColor: 'bg-secondary',
    tagBg: 'bg-secondary-fixed text-on-secondary-fixed-variant',
    tagText: `Resta ${formattedRemaining}`,
    amountColor: 'text-secondary',
  };
}

export function computeBudgetTotals(budgets: BudgetCategory[]) {
  const totalLimit = budgets.reduce((sum, b) => sum + b.limit, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const available = Math.max(totalLimit - totalSpent, 0);
  const percentage = totalLimit > 0 ? Math.min(Math.round((totalSpent / totalLimit) * 100), 100) : 0;
  return { totalLimit, totalSpent, available, percentage };
}

export function buildTransactionsCSV(
  transactions: Transaction[],
  options: { includeIncome?: boolean; includeExpense?: boolean; includeInvestments?: boolean } = {}
): string {
  const { includeIncome = true, includeExpense = true, includeInvestments = true } = options;

  const filtered = transactions.filter((t) => {
    if (t.type === 'income' && t.category === 'Investimentos' && !includeInvestments) return false;
    if (t.type === 'income' && t.category !== 'Investimentos' && !includeIncome) return false;
    if (t.type === 'expense' && !includeExpense) return false;
    return true;
  });

  const headers = ['Data', 'Tipo', 'Categoria', 'Descricao', 'Conta', 'Valor (MZN)', 'Status'];
  const rows = filtered.map((t) => {
    const tipo = t.type === 'income' ? 'Receita' : 'Despesa';
    const signed = t.type === 'income' ? t.amount : -t.amount;
    const status = t.status === 'completed' ? 'Liquidado' : 'Pendente';
    return [
      `"${t.date}"`,
      `"${tipo}"`,
      `"${t.category}"`,
      `"${t.description.replace(/"/g, '""')}"`,
      `"${t.account.replace(/"/g, '""')}"`,
      signed.toFixed(2),
      `"${status}"`,
    ].join(';');
  });

  return '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
}

function sanitizePdfText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function buildSimplePDF(title: string, lines: string[]): Blob {
  const contentOps = [
    'BT',
    '/F1 16 Tf',
    '50 760 Td',
    `(${sanitizePdfText(title)}) Tj`,
    '/F1 11 Tf',
    '0 -28 Td',
    ...lines.flatMap((line) => [`(${sanitizePdfText(line)}) Tj`, '0 -18 Td']),
    'ET',
  ].join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${contentOps.length} >>\nstream\n${contentOps}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
