import { useMemo, useState } from 'react';
import {
  CATEGORY_STYLE_META,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  MOZAMBIQUE_ACCOUNTS,
} from '../data/seed';
import type { CurrencyCode, Transaction } from '../types/finance';
import {
  computeTransactionSummary,
  filterTransactionsByDropdowns,
  filterTransactionsByMonth,
  formatMoney,
  getMonthDropdownOptions,
  getMonthYearLabel,
  groupTransactionsByDate,
  type TransactionDropdownFilters,
} from '../utils/finance';
import type { ConfirmDialogRequest } from './ConfirmDialog';

interface TransactionsScreenProps {
  transactions: Transaction[];
  currency: CurrencyCode;
  isBalanceHidden?: boolean;
  onOpenNew: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onToggleStatus: (id: string) => void;
  onDeleteTransaction: (id: string) => void;
  onRequestConfirm: (req: ConfirmDialogRequest) => void;
}

const RECURRENCE_LABEL: Record<string, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

export function TransactionsScreen({
  transactions,
  currency,
  isBalanceHidden = false,
  onOpenNew,
  onEditTransaction,
  onToggleStatus,
  onDeleteTransaction,
  onRequestConfirm,
}: TransactionsScreenProps) {
  const now = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(() => now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(() => now.getMonth());
  const [typeStatusFilter, setTypeStatusFilter] =
    useState<TransactionDropdownFilters['typeStatus']>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const monthDropdownOptions = useMemo(() => getMonthDropdownOptions(), []);

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    const curY = now.getFullYear();
    for (let y = curY - 3; y <= curY + 2; y++) years.add(y);
    for (const tx of transactions) {
      const yr = parseInt(tx.date.slice(0, 4), 10);
      if (!Number.isNaN(yr)) years.add(yr);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, now]);

  const monthTransactions = useMemo(() => {
    if (selectedYear === 'all' && selectedMonth === 'all') return transactions;
    if (selectedYear !== 'all' && selectedMonth !== 'all') {
      return filterTransactionsByMonth(transactions, selectedYear, selectedMonth);
    }
    return transactions.filter((t) => {
      const yrMatch = selectedYear === 'all' || t.date.startsWith(`${selectedYear}-`);
      const moStr =
        selectedMonth === 'all' ? '' : `-${String(selectedMonth + 1).padStart(2, '0')}-`;
      const moMatch = selectedMonth === 'all' || t.date.slice(4, 8) === moStr;
      return yrMatch && moMatch;
    });
  }, [transactions, selectedYear, selectedMonth]);

  const summary = useMemo(() => computeTransactionSummary(monthTransactions), [monthTransactions]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]);
    for (const tx of transactions) {
      set.add(tx.category);
    }
    return Array.from(set);
  }, [transactions]);

  const accountOptions = useMemo(() => {
    const set = new Set<string>([...MOZAMBIQUE_ACCOUNTS]);
    for (const tx of transactions) {
      set.add(tx.account);
    }
    return Array.from(set);
  }, [transactions]);

  const filtered = useMemo(
    () =>
      filterTransactionsByDropdowns(monthTransactions, {
        typeStatus: typeStatusFilter,
        category: categoryFilter,
        account: accountFilter,
        searchQuery,
      }),
    [monthTransactions, typeStatusFilter, categoryFilter, accountFilter, searchQuery]
  );
  const grouped = useMemo(() => groupTransactionsByDate(filtered), [filtered]);

  const periodTitleLabel = useMemo(() => {
    if (selectedMonth === 'all' && selectedYear === 'all') return 'Todo o Histórico';
    if (selectedMonth === 'all') return `Ano ${selectedYear}`;
    if (selectedYear === 'all') {
      return `${monthDropdownOptions[selectedMonth]?.label ?? ''} (Todos os anos)`;
    }
    return getMonthYearLabel(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth, monthDropdownOptions]);

  const isCurrentMonth =
    selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  const hasActiveFilters =
    typeStatusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    accountFilter !== 'all' ||
    searchQuery.trim() !== '';

  const handleClearFilters = () => {
    setTypeStatusFilter('all');
    setCategoryFilter('all');
    setAccountFilter('all');
    setSearchQuery('');
  };

  const handleResetToCurrentMonth = () => {
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
    handleClearFilters();
  };

  return (
    <div className="flex flex-col w-full pb-2">
      {/* Top Balance Quick View & Month/Year Dropdowns */}
      <section className="px-3 pt-2 pb-2.5">
        <div className="bg-surface-container-lowest rounded-2xl p-3 shadow-sm space-y-2.5">
          {/* Date Period Dropdown Controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <label className="sr-only" htmlFor="filterMonthSelect">
                Selecionar mês
              </label>
              <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-primary">
                calendar_month
              </span>
              <select
                className="w-full h-9 pl-9 pr-6 rounded-xl bg-surface-container-low text-on-surface text-[12.5px] font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-primary/25 cursor-pointer"
                id="filterMonthSelect"
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedMonth(val === 'all' ? 'all' : Number(val));
                }}
                value={selectedMonth}
              >
                <option value="all">Todos os meses</option>
                {monthDropdownOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant">
                expand_more
              </span>
            </div>

            <div className="relative w-24 shrink-0">
              <label className="sr-only" htmlFor="filterYearSelect">
                Selecionar ano
              </label>
              <select
                className="w-full h-9 pl-3 pr-6 rounded-xl bg-surface-container-low text-on-surface text-[12.5px] font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-primary/25 cursor-pointer tabular-nums"
                id="filterYearSelect"
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedYear(val === 'all' ? 'all' : Number(val));
                }}
                value={selectedYear}
              >
                <option value="all">Todos</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant">
                expand_more
              </span>
            </div>

            {!isCurrentMonth && (
              <button
                className="h-9 px-2.5 rounded-xl bg-primary-fixed text-primary text-[11.5px] font-bold hover:opacity-85 cursor-pointer whitespace-nowrap shrink-0"
                onClick={handleResetToCurrentMonth}
                type="button"
              >
                Hoje
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <div className="flex-1 min-w-0 bg-secondary/5 rounded-xl p-2.5 flex flex-col justify-between gap-0.5">
              <div className="flex items-center gap-1 text-secondary">
                <span className="material-symbols-outlined text-[15px] shrink-0">
                  arrow_downward_alt
                </span>
                <span className="text-[11.5px] font-semibold whitespace-nowrap">Entradas</span>
              </div>
              <span className="text-[14.5px] leading-snug text-secondary font-bold tabular-nums tracking-tight break-words">
                {isBalanceHidden ? '+••••' : `+${formatMoney(summary.totalIncome, currency)}`}
              </span>
              <span className="text-[10.5px] text-on-surface-variant">
                {summary.incomeCount} recebidas
              </span>
            </div>

            <div className="flex-1 min-w-0 bg-tertiary-container/10 rounded-xl p-2.5 flex flex-col justify-between gap-0.5">
              <div className="flex items-center gap-1 text-tertiary">
                <span className="material-symbols-outlined text-[15px] shrink-0">
                  arrow_upward_alt
                </span>
                <span className="text-[11.5px] font-semibold whitespace-nowrap">Saídas</span>
              </div>
              <span className="text-[14.5px] leading-snug text-tertiary font-bold tabular-nums tracking-tight break-words">
                {isBalanceHidden ? '-••••' : `-${formatMoney(summary.totalExpense, currency)}`}
              </span>
              <span className="text-[10.5px] text-on-surface-variant">
                {summary.expenseCount} registadas
                {summary.pendingCount > 0 ? ` · ${summary.pendingCount} pendente` : ''}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Action Bar, Search & Dropdown Filters */}
      <section className="px-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <label className="sr-only" htmlFor="searchTransactionsInput">
              Buscar por descrição
            </label>
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </span>
            <input
              className="w-full h-11 pl-10 pr-10 bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/60 rounded-xl text-[14px] shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              id="searchTransactionsInput"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar no extrato..."
              type="text"
              value={searchQuery}
            />
            {searchQuery && (
              <button
                aria-label="Limpar busca"
                className="absolute inset-y-0 right-3 flex items-center text-on-surface-variant hover:text-on-surface cursor-pointer"
                onClick={() => setSearchQuery('')}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">cancel</span>
              </button>
            )}
          </div>
          <button
            className="h-11 px-3.5 rounded-xl bg-primary text-on-primary text-[13px] font-semibold flex items-center justify-center gap-1 shadow-md shadow-primary/20 active:scale-95 transition-all shrink-0 cursor-pointer whitespace-nowrap"
            onClick={onOpenNew}
            type="button"
          >
            <span className="material-symbols-outlined text-[19px]">add</span>
            <span>Nova</span>
          </button>
        </div>

        {/* Dropdown Filter Controls */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[148px]">
            <label className="sr-only" htmlFor="filterTypeStatus">
              Filtrar por tipo ou estado
            </label>
            <select
              className="w-full h-9 pl-3 pr-7 rounded-xl bg-surface-container-lowest text-on-surface text-[12px] font-semibold shadow-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/25 cursor-pointer"
              id="filterTypeStatus"
              onChange={(e) =>
                setTypeStatusFilter(e.target.value as TransactionDropdownFilters['typeStatus'])
              }
              value={typeStatusFilter}
            >
              <option value="all">Estado: Todos</option>
              <option value="income">Apenas Receitas</option>
              <option value="expense">Apenas Despesas</option>
              <option value="completed">Liquidados (Pago/Recebido)</option>
              <option value="pending">Pendentes / A Receber</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant">
              expand_more
            </span>
          </div>

          <div className="relative flex-1 min-w-[148px]">
            <label className="sr-only" htmlFor="filterCategorySelect">
              Filtrar por categoria
            </label>
            <select
              className="w-full h-9 pl-3 pr-7 rounded-xl bg-surface-container-lowest text-on-surface text-[12px] font-semibold shadow-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/25 cursor-pointer"
              id="filterCategorySelect"
              onChange={(e) => setCategoryFilter(e.target.value)}
              value={categoryFilter}
            >
              <option value="all">Categoria: Todas</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant">
              expand_more
            </span>
          </div>

          <div className="relative flex-1 min-w-[148px]">
            <label className="sr-only" htmlFor="filterAccountSelect">
              Filtrar por conta ou carteira
            </label>
            <select
              className="w-full h-9 pl-3 pr-7 rounded-xl bg-surface-container-lowest text-on-surface text-[12px] font-semibold shadow-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/25 cursor-pointer"
              id="filterAccountSelect"
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
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between px-1 text-[11.5px]">
            <span className="text-on-surface-variant font-medium">
              {filtered.length} lançamento{filtered.length === 1 ? '' : 's'} encontrado
              {filtered.length === 1 ? '' : 's'}
            </span>
            <button
              className="text-primary font-semibold hover:underline cursor-pointer flex items-center gap-0.5"
              onClick={handleClearFilters}
              type="button"
            >
              <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
              <span>Limpar filtros</span>
            </button>
          </div>
        )}
      </section>

      {/* Transactions Stream Grouped or Empty State */}
      {grouped.length === 0 ? (
        <section className="px-3 py-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-primary-fixed flex items-center justify-center mb-3 shadow-inner text-primary">
            <span className="material-symbols-outlined text-[32px]">savings</span>
          </div>
          <h3 className="text-[15.5px] font-bold text-on-surface mb-1">
            Nenhuma movimentação encontrada
          </h3>
          <p className="text-[12.5px] text-on-surface-variant max-w-xs mb-4">
            Não há transações para {periodTitleLabel} com os filtros selecionados.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {hasActiveFilters && (
              <button
                className="h-10 px-4 rounded-xl bg-surface-container text-on-surface text-[12.5px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                onClick={handleClearFilters}
                type="button"
              >
                <span>Limpar Filtros</span>
              </button>
            )}
            {!isCurrentMonth && (
              <button
                className="h-10 px-4 rounded-xl bg-surface-container text-on-surface text-[12.5px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                onClick={handleResetToCurrentMonth}
                type="button"
              >
                <span>Voltar para Mês Atual</span>
              </button>
            )}
            <button
              className="h-10 px-4 rounded-xl bg-primary text-on-primary text-[12.5px] font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              onClick={onOpenNew}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Adicionar Transação</span>
            </button>
          </div>
        </section>
      ) : (
        <section
          className="px-3 mt-3 flex flex-col gap-3"
          data-testid="transactions-groups"
        >
          {grouped.map((group) => (
            <div key={group.label} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-bold">
                  {group.label}
                </span>
                <span className="text-[11px] text-on-surface-variant/80">
                  {group.items.length} transaç{group.items.length > 1 ? 'ões' : 'ão'}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {group.items.map((tx) => {
                  const meta = CATEGORY_STYLE_META[tx.category] ?? CATEGORY_STYLE_META.Outros;
                  const isIncome = tx.type === 'income';
                  const isPending = tx.status === 'pending';
                  const statusText = isPending
                    ? isIncome
                      ? 'A Receber'
                      : 'Pendente'
                    : isIncome
                      ? 'Recebido'
                      : 'Pago';
                  const hasExtraDetails = Boolean(
                    tx.reference ||
                      tx.notes ||
                      (tx.recurrence && tx.recurrence !== 'none') ||
                      (isPending && tx.dueDate)
                  );

                  return (
                    <article
                      key={tx.id}
                      className="bg-surface-container-lowest rounded-2xl p-3 shadow-sm flex flex-col gap-2 hover:shadow-md transition-shadow"
                    >
                      {/* Top Row: Icon + Title/Meta + Amount */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl ${meta.bg} ${meta.color} flex items-center justify-center shrink-0`}
                        >
                          <span className="material-symbols-outlined text-[20px]">{meta.icon}</span>
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <span className="text-[14px] leading-snug text-on-surface font-semibold break-words">
                            {tx.description}
                          </span>
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-on-surface-variant">
                            <span className="font-medium text-on-surface/80">{tx.account}</span>
                            <span aria-hidden="true">·</span>
                            <span>{tx.category}</span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right flex flex-col items-end gap-0.5">
                          <span
                            className={`text-[14.5px] leading-snug font-bold tabular-nums whitespace-nowrap ${
                              isIncome ? 'text-secondary' : 'text-tertiary'
                            }`}
                          >
                            {isBalanceHidden
                              ? `${isIncome ? '+' : '-'}••••`
                              : `${isIncome ? '+' : '-'}${formatMoney(tx.amount, currency)}`}
                          </span>
                          {(tx.time || tx.paymentMethod) && (
                            <span className="text-[10.5px] text-on-surface-variant tabular-nums whitespace-nowrap">
                              {tx.time && tx.paymentMethod
                                ? `${tx.time} · ${tx.paymentMethod}`
                                : tx.time || tx.paymentMethod}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Optional Extra Details Strip */}
                      {hasExtraDetails && (
                        <div className="rounded-xl bg-surface-container-low/80 px-2.5 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-on-surface-variant">
                          {tx.recurrence && tx.recurrence !== 'none' && (
                            <span className="inline-flex items-center gap-1 text-primary font-semibold">
                              <span className="material-symbols-outlined text-[13px]">repeat</span>
                              {RECURRENCE_LABEL[tx.recurrence] ?? tx.recurrence}
                            </span>
                          )}
                          {isPending && tx.dueDate && (
                            <span className="inline-flex items-center gap-1 text-amber-800 font-medium">
                              <span className="material-symbols-outlined text-[13px]">event</span>
                              Venc: {tx.dueDate.split('-').reverse().slice(0, 2).join('/')}
                            </span>
                          )}
                          {tx.reference && <span>Ref: {tx.reference}</span>}
                          {tx.notes && <span className="break-words">{tx.notes}</span>}
                        </div>
                      )}

                      {/* Footer Row: Status Toggle + Actions */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-surface-container/60">
                        <button
                          aria-label={`Alterar status de ${tx.description} (atual: ${statusText})`}
                          className={`h-7 px-2.5 rounded-lg text-[11.5px] font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                            isPending
                              ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                              : isIncome
                                ? 'bg-secondary-container/70 text-secondary hover:bg-secondary-container'
                                : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                          }`}
                          onClick={() => onToggleStatus(tx.id)}
                          title="Clique para alterar o status em tempo real"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {isPending ? 'schedule' : 'check_circle'}
                          </span>
                          <span>{statusText}</span>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            aria-label={`Editar ${tx.description}`}
                            className="h-7 px-2.5 rounded-lg bg-surface-container-low text-on-surface-variant hover:text-primary hover:bg-primary-fixed/60 text-[11.5px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                            onClick={() => onEditTransaction(tx)}
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                            <span>Editar</span>
                          </button>
                          <button
                            aria-label={`Excluir ${tx.description}`}
                            className="w-7 h-7 rounded-lg bg-surface-container-low text-on-surface-variant hover:text-tertiary hover:bg-error-container/60 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                            onClick={() =>
                              onRequestConfirm({
                                variant: 'danger',
                                icon: 'delete_forever',
                                title: 'Excluir Transação?',
                                message: 'Tem certeza que deseja excluir este registo? Esta ação não poderá ser desfeita.',
                                details: `${tx.description} · ${isIncome ? '+' : '-'}${formatMoney(tx.amount, currency)}`,
                                confirmLabel: 'Sim, Excluir',
                                cancelLabel: 'Voltar',
                                onConfirm: () => onDeleteTransaction(tx.id),
                              })
                            }
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
