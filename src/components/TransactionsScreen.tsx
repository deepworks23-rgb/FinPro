import { useMemo, useState } from 'react';
import { CATEGORY_STYLE_META } from '../data/seed';
import type { CurrencyCode, Transaction } from '../types/finance';
import {
  computeTransactionSummary,
  filterTransactions,
  filterTransactionsByMonth,
  formatMoney,
  getMonthYearLabel,
  getShortMonthLabel,
  groupTransactionsByDate,
} from '../utils/finance';

interface TransactionsScreenProps {
  transactions: Transaction[];
  currency: CurrencyCode;
  onOpenNew: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

const FILTER_PILLS = [
  { id: 'all', label: 'Todos' },
  { id: 'income', label: 'Receitas' },
  { id: 'expense', label: 'Despesas' },
  { id: 'pending', label: 'Pendentes' },
  { id: 'Alimentação', label: 'Alimentação' },
  { id: 'Transporte', label: 'Transporte' },
  { id: 'Moradia', label: 'Moradia' },
  { id: 'Lazer', label: 'Lazer' },
  { id: 'Saúde', label: 'Saúde' },
  { id: 'Salário', label: 'Salário' },
  { id: 'Investimentos', label: 'Investimentos' },
  { id: 'Outros', label: 'Outros' },
];

export function TransactionsScreen({
  transactions,
  currency,
  onOpenNew,
  onEditTransaction,
  onDeleteTransaction,
}: TransactionsScreenProps) {
  const now = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState(() => now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => now.getMonth());
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingDeleteTx, setPendingDeleteTx] = useState<Transaction | null>(null);

  const monthTransactions = useMemo(
    () => filterTransactionsByMonth(transactions, selectedYear, selectedMonth),
    [transactions, selectedYear, selectedMonth]
  );
  const summary = useMemo(() => computeTransactionSummary(monthTransactions), [monthTransactions]);
  const filtered = useMemo(
    () => filterTransactions(monthTransactions, activeFilter, searchQuery),
    [monthTransactions, activeFilter, searchQuery]
  );
  const grouped = useMemo(() => groupTransactionsByDate(filtered), [filtered]);

  const monthYearLabel = getMonthYearLabel(selectedYear, selectedMonth);
  const shortMonth = getShortMonthLabel(selectedMonth);
  const isCurrentMonth =
    selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
    setActiveFilter('all');
    setSearchQuery('');
  };

  return (
    <div className="flex flex-col w-full pb-10">
      {/* Top Balance Quick View & Month Selector */}
      <section className="px-margin pt-space-sm pb-space-md">
        <div className="bg-surface-container-lowest rounded-2xl p-3.5 shadow-sm">
          <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-surface-container/60">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <span className="material-symbols-outlined text-primary text-[19px] shrink-0">
                calendar_month
              </span>
              <span className="text-[16px] leading-tight font-bold text-on-surface whitespace-nowrap">
                {monthYearLabel}
              </span>
              {!isCurrentMonth && (
                <button
                  className="ml-0.5 px-2 py-0.5 rounded-md bg-primary-fixed text-primary font-label-sm text-[11px] font-bold hover:opacity-80 cursor-pointer whitespace-nowrap shrink-0"
                  onClick={handleResetToCurrentMonth}
                  type="button"
                >
                  Hoje
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 bg-surface-container-low px-1.5 py-1 rounded-full shrink-0">
              <button
                aria-label="Mês Anterior"
                className="w-7 h-7 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                onClick={handlePrevMonth}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <span className="font-label-sm text-[12px] text-on-surface px-1 whitespace-nowrap">
                {shortMonth}
              </span>
              <button
                aria-label="Próximo Mês"
                className="w-7 h-7 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                onClick={handleNextMonth}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="flex gap-2.5">
            <div className="flex-1 min-w-0 bg-secondary/5 rounded-xl p-3 flex flex-col justify-between gap-0.5">
              <div className="flex items-center gap-1 text-secondary">
                <span className="material-symbols-outlined text-[16px] shrink-0">
                  arrow_downward_alt
                </span>
                <span className="text-[12px] font-semibold whitespace-nowrap">Entradas</span>
              </div>
              <span className="text-[15px] leading-snug text-secondary font-bold tabular-nums tracking-tight break-words">
                +{formatMoney(summary.totalIncome, currency)}
              </span>
              <span className="text-[11px] text-on-surface-variant">
                {summary.incomeCount} recebidas
              </span>
            </div>

            <div className="flex-1 min-w-0 bg-tertiary-container/10 rounded-xl p-3 flex flex-col justify-between gap-0.5">
              <div className="flex items-center gap-1 text-tertiary">
                <span className="material-symbols-outlined text-[16px] shrink-0">
                  arrow_upward_alt
                </span>
                <span className="text-[12px] font-semibold whitespace-nowrap">Saídas</span>
              </div>
              <span className="text-[15px] leading-snug text-tertiary font-bold tabular-nums tracking-tight break-words">
                -{formatMoney(summary.totalExpense, currency)}
              </span>
              <span className="text-[11px] text-on-surface-variant">
                {summary.expenseCount} registradas
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Action Bar & Search Filter */}
      <section className="px-margin flex flex-col gap-space-sm">
        <div className="flex items-center gap-space-sm">
          <div className="relative flex-1 min-w-0">
            <label className="sr-only" htmlFor="searchTransactionsInput">
              Buscar por descrição
            </label>
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </span>
            <input
              className="w-full h-11 pl-10 pr-10 bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/60 rounded-xl font-body-md text-[14px] shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              id="searchTransactionsInput"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por descrição..."
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
            className="h-11 px-3.5 rounded-xl bg-primary text-on-primary font-label-md text-[13px] flex items-center justify-center gap-1 shadow-md shadow-primary/20 active:scale-95 transition-all shrink-0 cursor-pointer whitespace-nowrap"
            onClick={onOpenNew}
            type="button"
          >
            <span className="material-symbols-outlined text-[19px]">add</span>
            <span>Nova</span>
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {FILTER_PILLS.map((pill) => {
            const isActive = activeFilter === pill.id;
            return (
              <button
                key={pill.id}
                aria-pressed={isActive}
                className={
                  isActive
                    ? 'px-3 py-1.5 rounded-lg font-label-sm text-[12px] bg-primary text-on-primary transition-colors shrink-0 shadow-sm cursor-pointer whitespace-nowrap'
                    : 'px-3 py-1.5 rounded-lg font-label-sm text-[12px] bg-surface-container-lowest text-on-surface-variant hover:text-on-surface transition-colors shrink-0 shadow-sm cursor-pointer whitespace-nowrap'
                }
                onClick={() => setActiveFilter(pill.id)}
                type="button"
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Transactions Stream Grouped or Empty State */}
      {grouped.length === 0 ? (
        <section className="px-margin py-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-primary-fixed flex items-center justify-center mb-space-md shadow-inner text-primary">
            <span className="material-symbols-outlined text-[40px]">savings</span>
          </div>
          <h3 className="text-[16px] font-bold text-on-surface mb-1">
            Nenhuma movimentação encontrada
          </h3>
          <p className="text-[13px] text-on-surface-variant max-w-xs mb-space-lg">
            Não há transações para {monthYearLabel} com os filtros ativos.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {!isCurrentMonth && (
              <button
                className="h-11 px-4 rounded-xl bg-surface-container text-on-surface text-[13px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                onClick={handleResetToCurrentMonth}
                type="button"
              >
                <span>Voltar para Mês Atual</span>
              </button>
            )}
            <button
              className="h-11 px-5 rounded-xl bg-primary text-on-primary text-[13px] font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
              onClick={onOpenNew}
              type="button"
            >
              <span className="material-symbols-outlined text-[19px]">add_circle</span>
              <span>Adicionar Transação</span>
            </button>
          </div>
        </section>
      ) : (
        <section
          className="px-margin mt-space-md flex flex-col gap-space-md"
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

              <div className="bg-surface-container-lowest rounded-2xl shadow-sm divide-y divide-surface-container/60 overflow-hidden">
                {group.items.map((tx) => {
                  const meta = CATEGORY_STYLE_META[tx.category] ?? CATEGORY_STYLE_META.Outros;
                  const isIncome = tx.type === 'income';
                  const isPending = tx.status === 'pending';

                  return (
                    <div
                      key={tx.id}
                      className="p-3.5 flex items-start gap-3 hover:bg-surface-container/30 transition-colors"
                    >
                      <div
                        className={`w-10 h-10 rounded-xl ${meta.bg} ${meta.color} flex items-center justify-center shrink-0 mt-0.5`}
                      >
                        <span className="material-symbols-outlined text-[20px]">{meta.icon}</span>
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[14px] leading-snug text-on-surface font-semibold truncate min-w-0 flex-1">
                            {tx.description}
                          </span>
                          <span
                            className={`text-[14px] leading-snug font-bold tabular-nums whitespace-nowrap shrink-0 ${
                              isIncome ? 'text-secondary' : 'text-tertiary'
                            }`}
                          >
                            {isIncome ? '+' : '-'}
                            {formatMoney(tx.amount, currency)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant min-w-0 truncate">
                            <span className="truncate">{tx.account}</span>
                            <span aria-hidden="true" className="shrink-0">
                              ·
                            </span>
                            <span className="shrink-0">{tx.category}</span>
                            <span aria-hidden="true" className="shrink-0">
                              ·
                            </span>
                            <span
                              className={`shrink-0 font-semibold ${
                                isPending
                                  ? 'text-amber-700'
                                  : isIncome
                                    ? 'text-secondary'
                                    : 'text-on-surface-variant'
                              }`}
                            >
                              {isPending ? 'Pendente' : isIncome ? 'Recebido' : 'Pago'}
                            </span>
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0 -mr-1">
                            <button
                              aria-label={`Editar ${tx.description}`}
                              className="w-8 h-8 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer"
                              onClick={() => onEditTransaction(tx)}
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[17px]">edit</span>
                            </button>
                            <button
                              aria-label={`Excluir ${tx.description}`}
                              className="w-8 h-8 rounded-full text-on-surface-variant hover:text-tertiary hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer"
                              onClick={() => setPendingDeleteTx(tx)}
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[17px]">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Delete Confirmation Prompt */}
      {pendingDeleteTx && (
        <div
          aria-labelledby="deleteConfirmTitle"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
        >
          <div className="bg-surface-container-lowest rounded-2xl p-space-md max-w-xs w-full shadow-2xl flex flex-col text-center">
            <div className="w-12 h-12 rounded-full bg-tertiary-container/15 text-tertiary flex items-center justify-center mx-auto mb-2">
              <span className="material-symbols-outlined text-[26px]">delete_forever</span>
            </div>
            <h4
              className="font-headline-sm text-headline-sm text-on-surface mb-1"
              id="deleteConfirmTitle"
            >
              Excluir Transação?
            </h4>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
              Tem certeza que deseja excluir &ldquo;{pendingDeleteTx.description}&rdquo;? Esta ação
              não poderá ser desfeita.
            </p>
            <div className="flex gap-2">
              <button
                className="flex-1 h-10 rounded-xl bg-surface-container text-on-surface font-label-sm text-label-sm cursor-pointer"
                onClick={() => setPendingDeleteTx(null)}
                type="button"
              >
                Voltar
              </button>
              <button
                className="flex-1 h-10 rounded-xl bg-tertiary-container text-on-tertiary font-label-sm text-label-sm shadow-sm cursor-pointer"
                onClick={() => {
                  onDeleteTransaction(pendingDeleteTx.id);
                  setPendingDeleteTx(null);
                }}
                type="button"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
