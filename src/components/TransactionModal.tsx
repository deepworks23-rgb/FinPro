import { AppIcon } from './AppIcon';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CURRENCY_CONFIG,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  MOZAMBIQUE_ACCOUNTS,
} from '../data/seed';
import type {
  BudgetCategory,
  CurrencyCode,
  Transaction,
  TransactionRecurrence,
  TransactionStatus,
  TransactionType,
} from '../types/finance';
import {
  formatMoney,
  formatNumberBR,
  mapTransactionCategoryToBudget,
  maskCurrencyDigits,
  parseCurrencyInput,
  toLocalISODate,
} from '../utils/finance';
import type { ConfirmDialogRequest } from './ConfirmDialog';

interface TransactionModalProps {
  isOpen: boolean;
  initialType?: TransactionType;
  editingTransaction?: Transaction | null;
  budgets?: BudgetCategory[];
  currency: CurrencyCode;
  onClose: () => void;
  onSave: (tx: Omit<Transaction, 'id'> & { id?: string }) => void;
  onRequestConfirm: (req: ConfirmDialogRequest) => void;
}

const QUICK_TEMPLATES: Record<
  TransactionType,
  Array<{ label: string; description: string; category: string; account: string }>
> = {
  expense: [
    {
      label: 'Credelec EDM',
      description: 'Recarga Energia EDM (Credelec)',
      category: 'Energia & Água',
      account: 'M-Pesa',
    },
    {
      label: 'Shoprite',
      description: 'Supermercado Shoprite',
      category: 'Alimentação',
      account: 'M-Pesa',
    },
    {
      label: 'Yango',
      description: 'Viagem Yango Maputo',
      category: 'Transporte',
      account: 'M-Pesa',
    },
    {
      label: 'Recarga Vodacom',
      description: 'Pacote Internet Vodacom',
      category: 'Comunicação',
      account: 'M-Pesa',
    },
    {
      label: 'Renda',
      description: 'Renda Mensal de Casa',
      category: 'Moradia',
      account: 'Millennium bim',
    },
  ],
  income: [
    {
      label: 'Salário',
      description: 'Salário Mensal',
      category: 'Salário',
      account: 'Millennium bim',
    },
    {
      label: 'Freelance',
      description: 'Serviço de Consultoria',
      category: 'Consultoria & Freelance',
      account: 'e-Mola',
    },
    {
      label: 'Venda M-Pesa',
      description: 'Recebimento de Venda',
      category: 'Negócio / Vendas',
      account: 'M-Pesa',
    },
  ],
};

const PAYMENT_METHODS = [
  'Carteira Móvel',
  'Cartão Débito / POS',
  'Transferência Bancária',
  'Cartão de Crédito',
  'Numerário',
];

function inferPaymentMethod(acc: string): string {
  if (acc === 'M-Pesa' || acc === 'e-Mola' || acc === 'mKesh') return 'Carteira Móvel';
  if (acc === 'Numerário') return 'Numerário';
  return 'Transferência Bancária';
}

function isMobileWallet(acc: string): boolean {
  return acc === 'M-Pesa' || acc === 'e-Mola' || acc === 'mKesh';
}

export function TransactionModal({
  isOpen,
  initialType = 'expense',
  editingTransaction,
  budgets = [],
  currency,
  onClose,
  onSave,
  onRequestConfirm,
}: TransactionModalProps) {
  const [type, setType] = useState<TransactionType>(initialType);
  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('Alimentação');
  const [date, setDate] = useState(() => toLocalISODate());
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })
  );
  const [account, setAccount] = useState<string>('M-Pesa');
  const [paymentMethod, setPaymentMethod] = useState<string>('Carteira Móvel');
  const [status, setStatus] = useState<TransactionStatus>('completed');
  const [recurrence, setRecurrence] = useState<TransactionRecurrence>('none');
  const [reference, setReference] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const cfg = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.MZN;
  const symbol = cfg.symbol;
  const otherCurrency: CurrencyCode = currency === 'MZN' ? 'USD' : 'MZN';

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmountStr(formatNumberBR(editingTransaction.amount * cfg.rateFromBase));
      setDescription(editingTransaction.description);
      setCategory(editingTransaction.category);
      setDate(editingTransaction.date);
      setTime(
        editingTransaction.time ??
          new Date().toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' })
      );
      setAccount(editingTransaction.account);
      setPaymentMethod(
        editingTransaction.paymentMethod ?? inferPaymentMethod(editingTransaction.account)
      );
      setStatus(editingTransaction.status);
      setRecurrence(editingTransaction.recurrence ?? 'none');
      setReference(editingTransaction.reference ?? '');
      setDueDate(editingTransaction.dueDate ?? '');
      setNotes(editingTransaction.notes ?? '');
    } else {
      const now = new Date();
      setType(initialType);
      setAmountStr('');
      setDescription('');
      setCategory(initialType === 'income' ? 'Salário' : 'Alimentação');
      setDate(toLocalISODate(now));
      setTime(now.toLocaleTimeString('pt-MZ', { hour: '2-digit', minute: '2-digit' }));
      setAccount('M-Pesa');
      setPaymentMethod('Carteira Móvel');
      setStatus('completed');
      setRecurrence('none');
      setReference('');
      setDueDate(toLocalISODate(now));
      setNotes('');
    }
  }, [isOpen, initialType, editingTransaction, cfg.rateFromBase]);

  const categoryOptions = useMemo(() => {
    const base: string[] =
      type === 'income' ? [...INCOME_CATEGORIES] : [...EXPENSE_CATEGORIES];
    if (category && !base.includes(category)) {
      return [category, ...base];
    }
    return base;
  }, [type, category]);

  const numericDisplay = parseCurrencyInput(amountStr);
  const amountInBase =
    !Number.isNaN(numericDisplay) && numericDisplay > 0
      ? Math.round((numericDisplay / cfg.rateFromBase) * 100) / 100
      : 0;

  // Live budget impact calculation when entering an expense
  const budgetImpact = useMemo(() => {
    if (type !== 'expense') return null;
    const mappedCat = mapTransactionCategoryToBudget(category);
    const targetBudget = budgets.find((b) => b.category === mappedCat);
    if (!targetBudget) return null;

    const alreadyIncluded =
      editingTransaction &&
      editingTransaction.type === 'expense' &&
      editingTransaction.status === 'completed' &&
      mapTransactionCategoryToBudget(editingTransaction.category) === mappedCat
        ? editingTransaction.amount
        : 0;

    const adding = status === 'completed' ? amountInBase : 0;
    const projectedSpent = Math.max(targetBudget.spent - alreadyIncluded + adding, 0);
    const pct =
      targetBudget.limit > 0 ? Math.round((projectedSpent / targetBudget.limit) * 100) : 0;

    return {
      budgetName: targetBudget.category,
      limit: targetBudget.limit,
      projectedSpent,
      pct,
      exceeded: projectedSpent > targetBudget.limit,
    };
  }, [type, category, budgets, editingTransaction, status, amountInBase]);

  if (!isOpen) return null;

  const handleTypeSwitch = (nextType: TransactionType) => {
    setType(nextType);
    const validNext: readonly string[] =
      nextType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    if (!validNext.includes(category)) {
      setCategory(nextType === 'income' ? 'Salário' : 'Alimentação');
    }
  };

  const handleAccountChange = (nextAccount: string) => {
    setAccount(nextAccount);
    setPaymentMethod(inferPaymentMethod(nextAccount));
  };

  const applyTemplate = (tpl: {
    description: string;
    category: string;
    account: string;
  }) => {
    setDescription(tpl.description);
    setCategory(tpl.category);
    setAccount(tpl.account);
    setPaymentMethod(inferPaymentMethod(tpl.account));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg('Informe a descrição da transação.');
      return;
    }
    if (Number.isNaN(numericDisplay) || numericDisplay <= 0) {
      setErrorMsg('Digite um valor monetário válido maior que zero.');
      return;
    }

    const payload: Omit<Transaction, 'id'> & { id?: string } = {
      id: editingTransaction?.id,
      type,
      description: description.trim(),
      amount: amountInBase,
      category,
      date,
      time: time || '00:00',
      account,
      paymentMethod,
      status,
      recurrence,
      reference: reference.trim() || undefined,
      dueDate: status === 'pending' && dueDate ? dueDate : undefined,
      notes: notes.trim() || undefined,
    };

    const signedFormatted = `${type === 'income' ? '+' : '-'}${formatMoney(amountInBase, currency)}`;
    onRequestConfirm({
      variant: 'primary',
      icon: 'save',
      title: editingTransaction ? 'Confirmar Atualização?' : 'Confirmar Registo?',
      message: editingTransaction
        ? 'Deseja salvar as alterações feitas nesta transação?'
        : `Deseja guardar esta ${type === 'income' ? 'receita' : 'despesa'} no seu extrato?`,
      details: `${payload.description} · ${signedFormatted} · ${account}`,
      confirmLabel: editingTransaction ? 'Sim, Atualizar' : 'Sim, Salvar',
      cancelLabel: 'Voltar',
      onConfirm: () => {
        onSave(payload);
        onClose();
      },
    });
  };

  const templates = QUICK_TEMPLATES[type];

  return (
    <div
      aria-labelledby="modalTitle"
      aria-modal="true"
      className="fixed inset-0 z-[60] bg-inverse-surface/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
    >
      <div className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl flex flex-col max-h-[92dvh] overflow-y-auto">
        <div
          className="w-12 h-1.5 rounded-full bg-outline-variant/60 mx-auto mb-2.5 sm:hidden cursor-pointer shrink-0"
          onClick={onClose}
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-surface-container">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                type === 'income'
                  ? 'bg-secondary-container/70 text-secondary'
                  : 'bg-primary-fixed text-primary'
              }`}
            >
              <AppIcon name={editingTransaction ? 'edit_note' : type === 'income' ? 'add_card' : 'receipt_long'} className="text-[20px]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[16px] font-bold text-on-surface leading-tight" id="modalTitle">
                {editingTransaction
                  ? 'Editar Lançamento'
                  : type === 'income'
                    ? 'Nova Receita'
                    : 'Nova Despesa'}
              </h2>
              <p className="text-[11px] text-on-surface-variant">
                Sincronização automática em tempo real
              </p>
            </div>
          </div>
          <button
            aria-label="Fechar modal"
            className="w-9 h-9 rounded-full text-on-surface-variant hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer shrink-0"
            onClick={onClose}
            type="button"
          >
            <AppIcon name="close" className="text-[20px]" />
          </button>
        </div>

        <form className="flex flex-col gap-3.5 mt-3.5" onSubmit={handleSubmit}>
          {/* 1. Tipo da Operação */}
          <div className="grid grid-cols-2 p-1 bg-surface-container-low rounded-xl gap-1">
            <button
              className={
                type === 'expense'
                  ? 'h-10 rounded-lg flex items-center justify-center gap-1.5 text-[13px] font-semibold bg-tertiary-container text-on-tertiary shadow-sm transition-all cursor-pointer'
                  : 'h-10 rounded-lg flex items-center justify-center gap-1.5 text-[13px] font-semibold text-on-surface-variant hover:text-on-surface transition-all cursor-pointer'
              }
              onClick={() => handleTypeSwitch('expense')}
              type="button"
            >
              <AppIcon name="trending_down" className="text-[18px]" />
              <span>Despesa</span>
            </button>
            <button
              className={
                type === 'income'
                  ? 'h-10 rounded-lg flex items-center justify-center gap-1.5 text-[13px] font-semibold bg-secondary text-on-secondary shadow-sm transition-all cursor-pointer'
                  : 'h-10 rounded-lg flex items-center justify-center gap-1.5 text-[13px] font-semibold text-on-surface-variant hover:text-on-surface transition-all cursor-pointer'
              }
              onClick={() => handleTypeSwitch('income')}
              type="button"
            >
              <AppIcon name="trending_up" className="text-[18px]" />
              <span>Receita</span>
            </button>
          </div>

          {/* 2. Modelos Rápidos Dinâmicos */}
          {!editingTransaction && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-on-surface-variant">
                Preenchimento rápido ({type === 'expense' ? 'despesas comuns' : 'entradas comuns'})
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {templates.map((tpl) => (
                  <button
                    key={tpl.label}
                    className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-primary-fixed hover:text-primary text-[11px] font-semibold text-on-surface-variant transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    onClick={() => applyTemplate(tpl)}
                    type="button"
                  >
                    + {tpl.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Valor da Operação + Conversão em Tempo Real */}
          <div className="flex flex-col items-center justify-center bg-surface-container-low/70 py-3.5 px-3 rounded-2xl">
            <label
              className="text-[11px] font-semibold text-on-surface-variant mb-1"
              htmlFor="txAmountInput"
            >
              Valor da Operação ({currency})
            </label>
            <div className="flex items-center justify-center text-primary w-full">
              {cfg.position === 'left' && (
                <span className="text-[18px] mr-1.5 font-bold shrink-0">{symbol}</span>
              )}
              <input
                className="text-[28px] leading-[34px] text-center bg-transparent text-on-surface font-bold tabular-nums focus:outline-none w-full max-w-[220px] tracking-tight"
                id="txAmountInput"
                inputMode="decimal"
                onChange={(e) => setAmountStr(maskCurrencyDigits(e.target.value))}
                placeholder="0,00"
                required
                type="text"
                value={amountStr}
              />
              {cfg.position === 'right' && (
                <span className="text-[18px] ml-1.5 font-bold shrink-0">{symbol}</span>
              )}
            </div>
            {amountInBase > 0 && (
              <span className="text-[11px] font-medium text-on-surface-variant mt-1 tabular-nums">
                Equivalente em tempo real: ≈ {formatMoney(amountInBase, otherCurrency)}
              </span>
            )}
          </div>

          {/* 4. Impacto Dinâmico no Orçamento (apenas Despesa com orçamento ativo) */}
          {budgetImpact && (
            <div className="p-2.5 rounded-xl bg-surface-container-low flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-on-surface">
                  Orçamento: {budgetImpact.budgetName}
                </span>
                <span
                  className={`font-bold tabular-nums ${
                    budgetImpact.exceeded
                      ? 'text-tertiary'
                      : budgetImpact.pct >= 80
                        ? 'text-amber-700'
                        : 'text-secondary'
                  }`}
                >
                  {formatMoney(budgetImpact.projectedSpent, currency)} /{' '}
                  {formatMoney(budgetImpact.limit, currency)} ({budgetImpact.pct}%)
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    budgetImpact.exceeded
                      ? 'bg-tertiary-container'
                      : budgetImpact.pct >= 80
                        ? 'bg-amber-500'
                        : 'bg-secondary'
                  }`}
                  style={{ width: `${Math.min(budgetImpact.pct, 100)}%` }}
                />
              </div>
              {status === 'pending' && (
                <span className="text-[10.5px] text-on-surface-variant">
                  Como está Pendente, só entra no orçamento quando marcar como Pago.
                </span>
              )}
            </div>
          )}

          {/* 5. Descrição */}
          <div className="flex flex-col gap-1">
            <label
              className="text-[11.5px] font-semibold text-on-surface-variant"
              htmlFor="txDescInput"
            >
              Descrição / Estabelecimento
            </label>
            <input
              className="h-11 px-3 bg-surface-container-low text-on-surface rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              id="txDescInput"
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                type === 'income'
                  ? 'Ex: Salário Mensal / Transferência Cliente'
                  : 'Ex: Supermercado Shoprite / Energia Credelec'
              }
              required
              type="text"
              value={description}
            />
          </div>

          {/* 6. Categoria & Conta / Carteira */}
          <div className="flex gap-2.5">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <label
                className="text-[11.5px] font-semibold text-on-surface-variant"
                htmlFor="txCategorySelect"
              >
                Categoria
              </label>
              <select
                className="w-full h-11 px-2.5 bg-surface-container-low text-on-surface rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                id="txCategorySelect"
                onChange={(e) => setCategory(e.target.value)}
                value={category}
              >
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <label
                className="text-[11.5px] font-semibold text-on-surface-variant"
                htmlFor="txAccountSelect"
              >
                Conta / Carteira
              </label>
              <select
                className="w-full h-11 px-2.5 bg-surface-container-low text-on-surface rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                id="txAccountSelect"
                onChange={(e) => handleAccountChange(e.target.value)}
                value={account}
              >
                {MOZAMBIQUE_ACCOUNTS.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 7. Status Interativo (Segmented Switch) */}
          <div className="flex flex-col gap-1">
            <span className="text-[11.5px] font-semibold text-on-surface-variant">
              Status do Lançamento
            </span>
            <div className="grid grid-cols-2 p-1 bg-surface-container-low rounded-xl gap-1">
              <button
                className={
                  status === 'completed'
                    ? 'h-9 rounded-lg flex items-center justify-center gap-1.5 text-[12.5px] font-semibold bg-secondary-container text-on-secondary-container shadow-xs transition-all cursor-pointer'
                    : 'h-9 rounded-lg flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-on-surface-variant hover:text-on-surface transition-all cursor-pointer'
                }
                onClick={() => setStatus('completed')}
                type="button"
              >
                <AppIcon name="check_circle" className="text-[16px]" />
                <span>{type === 'income' ? 'Recebido' : 'Pago'}</span>
              </button>
              <button
                className={
                  status === 'pending'
                    ? 'h-9 rounded-lg flex items-center justify-center gap-1.5 text-[12.5px] font-semibold bg-amber-100 text-amber-900 shadow-xs transition-all cursor-pointer'
                    : 'h-9 rounded-lg flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-on-surface-variant hover:text-on-surface transition-all cursor-pointer'
                }
                onClick={() => setStatus('pending')}
                type="button"
              >
                <AppIcon name="schedule" className="text-[16px]" />
                <span>{type === 'income' ? 'A Receber' : 'Pendente'}</span>
              </button>
            </div>
          </div>

          {/* 8. Campo Condicional: Previsão / Vencimento quando Pendente */}
          {status === 'pending' && (
            <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 flex flex-col gap-1">
              <label
                className="text-[11.5px] font-semibold text-amber-900 flex items-center gap-1"
                htmlFor="txDueDateInput"
              >
                <AppIcon name="event" className="text-[15px]" />
                {type === 'income' ? 'Previsão de Recebimento' : 'Data de Vencimento'}
              </label>
              <input
                className="w-full h-10 px-2.5 bg-surface-container-lowest text-on-surface rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                id="txDueDateInput"
                onChange={(e) => setDueDate(e.target.value)}
                type="date"
                value={dueDate}
              />
            </div>
          )}

          {/* 9. Data & Hora */}
          <div className="flex gap-2.5">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <label
                className="text-[11.5px] font-semibold text-on-surface-variant"
                htmlFor="txDateInput"
              >
                Data
              </label>
              <input
                className="w-full h-11 px-2.5 bg-surface-container-low text-on-surface rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                id="txDateInput"
                onChange={(e) => setDate(e.target.value)}
                required
                type="date"
                value={date}
              />
            </div>
            <div className="w-28 shrink-0 flex flex-col gap-1">
              <label
                className="text-[11.5px] font-semibold text-on-surface-variant"
                htmlFor="txTimeInput"
              >
                Hora
              </label>
              <input
                className="w-full h-11 px-2.5 bg-surface-container-low text-on-surface rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                id="txTimeInput"
                onChange={(e) => setTime(e.target.value)}
                type="time"
                value={time}
              />
            </div>
          </div>

          {/* 10. Método de Pagamento & Recorrência */}
          <div className="flex gap-2.5">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <label
                className="text-[11.5px] font-semibold text-on-surface-variant"
                htmlFor="txMethodSelect"
              >
                Método
              </label>
              <select
                className="w-full h-11 px-2.5 bg-surface-container-low text-on-surface rounded-xl text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                id="txMethodSelect"
                onChange={(e) => setPaymentMethod(e.target.value)}
                value={paymentMethod}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <label
                className="text-[11.5px] font-semibold text-on-surface-variant"
                htmlFor="txRecurrenceSelect"
              >
                Frequência
              </label>
              <select
                className="w-full h-11 px-2.5 bg-surface-container-low text-on-surface rounded-xl text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                id="txRecurrenceSelect"
                onChange={(e) => setRecurrence(e.target.value as TransactionRecurrence)}
                value={recurrence}
              >
                <option value="none">Única</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
              </select>
            </div>
          </div>

          {/* 11. Referência Dinâmica (adaptada a Carteira Móvel vs Banco) & Observações */}
          <div className="flex flex-col gap-2.5">
            {account !== 'Numerário' && (
              <div className="flex flex-col gap-1">
                <label
                  className="text-[11.5px] font-semibold text-on-surface-variant"
                  htmlFor="txRefInput"
                >
                  {isMobileWallet(account)
                    ? `Nº Telefone (+258) / Código ${account} (opcional)`
                    : 'Nº Comprovativo / Referência (opcional)'}
                </label>
                <input
                  className="h-10 px-3 bg-surface-container-low text-on-surface rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                  id="txRefInput"
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={
                    isMobileWallet(account) ? 'Ex: 84 123 4567 ou MP9281' : 'Ex: TRF-2026-084'
                  }
                  type="text"
                  value={reference}
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label
                className="text-[11.5px] font-semibold text-on-surface-variant"
                htmlFor="txNotesInput"
              >
                Observações (opcional)
              </label>
              <input
                className="h-10 px-3 bg-surface-container-low text-on-surface rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                id="txNotesInput"
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Factura nº 204, compra do mês..."
                type="text"
                value={notes}
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-error-container text-on-error-container text-[12px] font-semibold">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center gap-space-sm pt-1.5">
            <button
              className="flex-1 h-11 rounded-xl bg-surface-container-high text-on-surface text-[13px] font-semibold hover:bg-surface-container transition-colors cursor-pointer"
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="flex-1 h-11 rounded-xl bg-primary text-on-primary text-[13px] font-semibold shadow-md shadow-primary/25 hover:bg-primary-container transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              type="submit"
            >
              <AppIcon name="check" className="text-[19px]" />
              <span>{editingTransaction ? 'Guardar Alterações' : 'Guardar Lançamento'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
