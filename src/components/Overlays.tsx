import { useEffect, useState, type FormEvent } from 'react';
import { ASSETS } from '../data/seed';
import type { BudgetCategory, CurrencyCode } from '../types/finance';
import { evaluateBudgetStatus } from '../utils/finance';

interface NotificationsModalProps {
  isOpen: boolean;
  budgets: BudgetCategory[];
  currency: CurrencyCode;
  onClose: () => void;
  onGoToBudgets: () => void;
}

export function NotificationsModal({
  isOpen,
  budgets,
  currency,
  onClose,
  onGoToBudgets,
}: NotificationsModalProps) {
  if (!isOpen) return null;

  const alerts = budgets
    .map((b) => ({ ...b, statusInfo: evaluateBudgetStatus(b.spent, b.limit, currency) }))
    .filter((b) => b.statusInfo.percentage >= 75);

  return (
    <div
      aria-labelledby="notifTitle"
      aria-modal="true"
      className="fixed inset-0 z-[60] bg-inverse-surface/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
    >
      <div className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-surface-container pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary-fixed text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">notifications_active</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface" id="notifTitle">
                Alertas Inteligentes
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Monitoramento de limites em tempo real
              </p>
            </div>
          </div>
          <button
            aria-label="Fechar notificações"
            className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="space-y-2.5 max-h-72 overflow-y-auto">
          {alerts.length === 0 ? (
            <p className="font-body-md text-body-md text-on-surface-variant py-6 text-center">
              Nenhum alerta de orçamento no momento.
            </p>
          ) : (
            alerts.map((a) => (
              <button
                key={a.id}
                className="w-full text-left p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors flex items-center justify-between gap-3 cursor-pointer"
                onClick={() => {
                  onClose();
                  onGoToBudgets();
                }}
                type="button"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl ${a.iconBg} ${a.iconColor} flex items-center justify-center shrink-0`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{a.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-label-md text-label-md text-on-surface truncate">
                      {a.category} em {a.statusInfo.percentage}%
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                      {a.statusInfo.tagText}
                    </p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                  chevron_right
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface ProfileModalProps {
  isOpen: boolean;
  userName: string;
  userEmail: string;
  currency: CurrencyCode;
  onChangeCurrency: (c: CurrencyCode) => void;
  onUpdateName: (name: string) => void;
  onClose: () => void;
  onOpenLogin: () => void;
  onResetDemo: () => void;
}

export function ProfileModal({
  isOpen,
  userName,
  userEmail,
  currency,
  onChangeCurrency,
  onUpdateName,
  onClose,
  onOpenLogin,
  onResetDemo,
}: ProfileModalProps) {
  const [nameInput, setNameInput] = useState(userName);

  useEffect(() => {
    if (isOpen) {
      setNameInput(userName);
    }
  }, [isOpen, userName]);

  if (!isOpen) return null;

  const handleSaveName = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    onUpdateName(trimmed);
  };

  return (
    <div
      aria-labelledby="profileTitle"
      aria-modal="true"
      className="fixed inset-0 z-[60] bg-inverse-surface/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
    >
      <div className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between gap-3 border-b border-surface-container pb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <img
              alt={userName}
              className="w-11 h-11 rounded-full object-cover ring-2 ring-primary/20 shrink-0"
              src={ASSETS.avatar}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3
                  className="text-[16px] font-bold text-on-surface truncate"
                  id="profileTitle"
                >
                  {userName}
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-secondary-container text-on-secondary-container text-[10px] uppercase font-bold shrink-0">
                  PRO
                </span>
              </div>
              <p className="text-[12px] text-on-surface-variant truncate">{userEmail}</p>
            </div>
          </div>
          <button
            aria-label="Fechar perfil"
            className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form className="space-y-2" onSubmit={handleSaveName}>
          <label
            className="font-label-sm text-label-sm text-on-surface-variant block"
            htmlFor="profileNameInput"
          >
            Nome de Exibição
          </label>
          <div className="flex gap-2">
            <input
              className="flex-1 min-w-0 h-11 px-3 rounded-xl bg-surface-container-low text-on-surface text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/30"
              id="profileNameInput"
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Seu nome"
              type="text"
              value={nameInput}
            />
            <button
              className="px-4 h-11 rounded-xl bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary-container transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              type="submit"
            >
              Salvar
            </button>
          </div>
        </form>

        <div className="space-y-2">
          <label
            className="font-label-sm text-label-sm text-on-surface-variant block"
            htmlFor="profileCurrencySelect"
          >
            Moeda Padrão
          </label>
          <select
            className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
            id="profileCurrencySelect"
            onChange={(e) => onChangeCurrency(e.target.value as CurrencyCode)}
            value={currency}
          >
            <option value="MZN">MZN (MT) — Metical Moçambicano</option>
            <option value="USD">USD ($) — Dólar Americano</option>
          </select>
        </div>

        <div className="grid grid-cols-1 gap-2.5 pt-1">
          <button
            className="w-full h-11 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors flex items-center justify-center gap-2 cursor-pointer"
            onClick={() => {
              onResetDemo();
              onClose();
            }}
            type="button"
          >
            <span className="material-symbols-outlined text-[19px]">restart_alt</span>
            <span>Restaurar Dados de Demonstração</span>
          </button>
          <button
            className="w-full h-11 rounded-xl bg-primary-container text-on-primary font-label-md text-label-md hover:opacity-95 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
            onClick={() => {
              onClose();
              onOpenLogin();
            }}
            type="button"
          >
            <span className="material-symbols-outlined text-[19px]">logout</span>
            <span>Trocar Conta / Tela de Login</span>
          </button>
        </div>
      </div>
    </div>
  );
}
