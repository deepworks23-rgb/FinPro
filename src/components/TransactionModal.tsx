import { useEffect, useState, type FormEvent } from 'react';
import { CURRENCY_CONFIG } from '../data/seed';
import type { CurrencyCode, Transaction, TransactionStatus, TransactionType } from '../types/finance';
import { formatNumberBR, maskCurrencyDigits, parseCurrencyInput, toLocalISODate } from '../utils/finance';

interface TransactionModalProps {
  isOpen: boolean;
  initialType?: TransactionType;
  editingTransaction?: Transaction | null;
  currency: CurrencyCode;
  onClose: () => void;
  onSave: (tx: Omit<Transaction, 'id'> & { id?: string }) => void;
}

const CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Lazer',
  'Saúde',
  'Salário',
  'Investimentos',
  'Outros',
];

const ACCOUNTS = [
  'Nubank Débito',
  'Itaú Corrente',
  'Cartão Mastercard Black',
  'Cartão de Crédito',
  'Carteira Móvel/Pix',
  'Carteira Física',
];

export function TransactionModal({
  isOpen,
  initialType = 'expense',
  editingTransaction,
  currency,
  onClose,
  onSave,
}: TransactionModalProps) {
  const [type, setType] = useState<TransactionType>(initialType);
  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Alimentação');
  const [date, setDate] = useState(() => toLocalISODate());
  const [account, setAccount] = useState('Nubank Débito');
  const [status, setStatus] = useState<TransactionStatus>('completed');
  const [errorMsg, setErrorMsg] = useState('');

  const cfg = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.MZN;
  const symbol = cfg.symbol;

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmountStr(formatNumberBR(editingTransaction.amount * cfg.rateFromBase));
      setDescription(editingTransaction.description);
      setCategory(editingTransaction.category);
      setDate(editingTransaction.date);
      setAccount(editingTransaction.account);
      setStatus(editingTransaction.status);
    } else {
      setType(initialType);
      setAmountStr('');
      setDescription('');
      setCategory(initialType === 'income' ? 'Salário' : 'Alimentação');
      setDate(toLocalISODate());
      setAccount('Nubank Débito');
      setStatus('completed');
    }
  }, [isOpen, initialType, editingTransaction, cfg.rateFromBase]);

  if (!isOpen) return null;

  const handleTypeSwitch = (nextType: TransactionType) => {
    setType(nextType);
    if (!editingTransaction) {
      setCategory(nextType === 'income' ? 'Salário' : 'Alimentação');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const numericAmount = parseCurrencyInput(amountStr);
    if (!description.trim()) {
      setErrorMsg('Informe a descrição da transação.');
      return;
    }
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMsg('Digite um valor monetário válido maior que zero.');
      return;
    }

    const amountInBase = Math.round((numericAmount / cfg.rateFromBase) * 100) / 100;

    onSave({
      id: editingTransaction?.id,
      type,
      description: description.trim(),
      amount: amountInBase,
      category,
      date,
      time:
        editingTransaction?.time ??
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      account,
      status,
    });
    onClose();
  };

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
      <div className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl flex flex-col max-h-[88dvh] overflow-y-auto">
        <div
          className="w-12 h-1.5 rounded-full bg-outline-variant/60 mx-auto mb-3 sm:hidden cursor-pointer"
          onClick={onClose}
        />

        <div className="flex items-center justify-between pb-3 border-b border-surface-container">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">edit_note</span>
            </div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface" id="modalTitle">
              {editingTransaction
                ? 'Editar Transação'
                : type === 'income'
                  ? 'Nova Receita'
                  : 'Nova Despesa'}
            </h2>
          </div>
          <button
            aria-label="Fechar modal"
            className="w-9 h-9 rounded-full text-on-surface-variant hover:bg-surface-container flex items-center justify-center transition-colors cursor-pointer"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form className="flex flex-col gap-4 mt-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 p-1 bg-surface-container-low rounded-xl gap-1">
            <button
              className={
                type === 'expense'
                  ? 'h-10 rounded-lg flex items-center justify-center gap-1 font-label-md text-label-md bg-tertiary-container text-on-tertiary shadow-sm transition-all cursor-pointer'
                  : 'h-10 rounded-lg flex items-center justify-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-all cursor-pointer'
              }
              onClick={() => handleTypeSwitch('expense')}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">trending_down</span>
              <span>Despesa</span>
            </button>
            <button
              className={
                type === 'income'
                  ? 'h-10 rounded-lg flex items-center justify-center gap-1 font-label-md text-label-md bg-secondary text-on-secondary shadow-sm transition-all cursor-pointer'
                  : 'h-10 rounded-lg flex items-center justify-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-all cursor-pointer'
              }
              onClick={() => handleTypeSwitch('income')}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">trending_up</span>
              <span>Receita</span>
            </button>
          </div>

          <div className="flex flex-col items-center justify-center bg-surface-container-low/60 py-4 px-3 rounded-2xl">
            <label
              className="font-label-sm text-label-sm text-on-surface-variant mb-1"
              htmlFor="txAmountInput"
            >
              Valor da Operação
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
          </div>

          <div className="flex flex-col gap-1">
            <label
              className="font-label-sm text-label-sm text-on-surface-variant"
              htmlFor="txDescInput"
            >
              Descrição / Estabelecimento
            </label>
            <input
              className="h-11 px-3 bg-surface-container-low text-on-surface rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              id="txDescInput"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Supermercado Pão de Açúcar"
              required
              type="text"
              value={description}
            />
          </div>

          <div className="flex gap-2.5">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <label
                className="font-label-sm text-label-sm text-on-surface-variant"
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
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <label
                className="font-label-sm text-label-sm text-on-surface-variant"
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
          </div>

          <div className="flex gap-2.5">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <label
                className="font-label-sm text-label-sm text-on-surface-variant"
                htmlFor="txAccountSelect"
              >
                Conta / Origem
              </label>
              <select
                className="w-full h-11 px-2.5 bg-surface-container-low text-on-surface rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                id="txAccountSelect"
                onChange={(e) => setAccount(e.target.value)}
                value={account}
              >
                {ACCOUNTS.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <label
                className="font-label-sm text-label-sm text-on-surface-variant"
                htmlFor="txStatusSelect"
              >
                Status
              </label>
              <select
                className="w-full h-11 px-2.5 bg-surface-container-low text-on-surface rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                id="txStatusSelect"
                onChange={(e) => setStatus(e.target.value as TransactionStatus)}
                value={status}
              >
                <option value="completed">Pago / Recebido</option>
                <option value="pending">Pendente</option>
              </select>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-error-container text-on-error-container font-label-sm text-label-sm">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center gap-space-sm pt-2">
            <button
              className="flex-1 h-12 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors cursor-pointer"
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="flex-1 h-12 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-md shadow-primary/25 hover:bg-primary-container transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              type="submit"
            >
              <span className="material-symbols-outlined text-[20px]">check</span>
              <span>Salvar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
