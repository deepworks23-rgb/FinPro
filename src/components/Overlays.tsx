import { AppIcon } from './AppIcon';
import { useEffect, useState, type FormEvent } from 'react';
import { CURRENCY_CONFIG } from '../data/seed';
import type { AdminAnnouncement, AlertSettings, AppScreen, CurrencyCode, RealTimeAlert } from '../types/finance';
import { formatMoney } from '../utils/finance';
import type { ConfirmDialogRequest } from './ConfirmDialog';

interface NotificationsModalProps {
  isOpen: boolean;
  alerts: RealTimeAlert[];
  readSignatures: string[];
  alertSettings: AlertSettings;
  currency: CurrencyCode;
  netBalanceBase: number;
  isBalanceHidden?: boolean;
  announcements?: AdminAnnouncement[];
  onUpdateAlertSettings: (next: AlertSettings) => void;
  onMarkAllRead: () => void;
  onMarkAlertRead: (signature: string) => void;
  onClose: () => void;
  onNavigate: (screen: AppScreen) => void;
  onRequestConfirm: (req: ConfirmDialogRequest) => void;
}

function maskCurrencyInText(text: string): string {
  return text.replace(/-?\d[\d.,]*\s*MT|-?\$\s*\d[\d.,]*/g, '••••');
}

const SEVERITY_STYLES: Record<
  RealTimeAlert['severity'],
  { bg: string; iconBg: string; iconColor: string; badgeBg: string; badgeLabel: string }
> = {
  critical: {
    bg: 'bg-error-container/35 ring-1 ring-error/25',
    iconBg: 'bg-error-container',
    iconColor: 'text-tertiary',
    badgeBg: 'bg-tertiary-container text-on-tertiary',
    badgeLabel: 'Crítico',
  },
  warning: {
    bg: 'bg-amber-50 ring-1 ring-amber-300/60',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-800',
    badgeBg: 'bg-amber-200 text-amber-950',
    badgeLabel: 'Atenção',
  },
  info: {
    bg: 'bg-surface-container-low',
    iconBg: 'bg-primary-fixed',
    iconColor: 'text-primary',
    badgeBg: 'bg-primary-fixed text-primary',
    badgeLabel: 'Info',
  },
  success: {
    bg: 'bg-secondary/5 ring-1 ring-secondary/20',
    iconBg: 'bg-secondary-container/70',
    iconColor: 'text-secondary',
    badgeBg: 'bg-secondary-container text-on-secondary-container',
    badgeLabel: 'Concluída',
  },
};

export function NotificationsModal({
  isOpen,
  alerts,
  readSignatures,
  alertSettings,
  currency,
  netBalanceBase,
  isBalanceHidden = false,
  announcements = [],
  onUpdateAlertSettings,
  onMarkAllRead,
  onMarkAlertRead,
  onClose,
  onNavigate,
  onRequestConfirm,
}: NotificationsModalProps) {
  const [activeTab, setActiveTab] = useState<'alerts' | 'settings'>('alerts');
  const [lowBalanceInput, setLowBalanceInput] = useState('');
  const [negativeLimitInput, setNegativeLimitInput] = useState('');

  const cfg = CURRENCY_CONFIG[currency] ?? CURRENCY_CONFIG.MZN;

  useEffect(() => {
    if (isOpen) {
      setLowBalanceInput(String(Math.round(alertSettings.lowBalanceThreshold * cfg.rateFromBase * 100) / 100));
      setNegativeLimitInput(
        String(Math.round(alertSettings.negativeAlertThreshold * cfg.rateFromBase * 100) / 100)
      );
    }
  }, [isOpen, alertSettings, cfg.rateFromBase]);

  if (!isOpen) return null;

  const unreadCount = alerts.filter((a) => !readSignatures.includes(a.signature)).length;

  const handleSaveThresholds = (e: FormEvent) => {
    e.preventDefault();
    const parsedLow = parseFloat(lowBalanceInput.replace(',', '.'));
    const parsedNeg = parseFloat(negativeLimitInput.replace(',', '.'));
    const nextLowBase = Number.isNaN(parsedLow)
      ? alertSettings.lowBalanceThreshold
      : Math.round((parsedLow / cfg.rateFromBase) * 100) / 100;
    const nextNegBase = Number.isNaN(parsedNeg)
      ? alertSettings.negativeAlertThreshold
      : Math.round((parsedNeg / cfg.rateFromBase) * 100) / 100;

    const nextSettings: AlertSettings = {
      ...alertSettings,
      lowBalanceThreshold: nextLowBase,
      negativeAlertThreshold: nextNegBase,
    };
    const negFormatted = `${nextNegBase < 0 ? '-' : ''}${formatMoney(Math.abs(nextNegBase), currency)}`;
    onRequestConfirm({
      variant: 'primary',
      icon: 'tune',
      title: 'Guardar Limites de Alerta?',
      message: 'Deseja aplicar estes limites para os alertas em tempo real?',
      details: `Saldo a esgotar: ${formatMoney(nextLowBase, currency)} · Negativo: ${negFormatted}`,
      confirmLabel: 'Sim, Guardar',
      cancelLabel: 'Voltar',
      onConfirm: () => {
        onUpdateAlertSettings(nextSettings);
        setActiveTab('alerts');
      },
    });
  };

  const signedNetText = `${netBalanceBase < 0 ? '-' : ''}${formatMoney(Math.abs(netBalanceBase), currency)}`;
  const signedNegPreview = `${
    parseFloat(negativeLimitInput.replace(',', '.')) < 0 ? '-' : ''
  }${formatMoney(Math.abs(parseFloat(negativeLimitInput.replace(',', '.')) || 0), currency, false)}`;

  return (
    <div
      aria-labelledby="notifTitle"
      aria-modal="true"
      className="fixed inset-0 z-[60] bg-inverse-surface/45 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
    >
      <div className="w-full max-w-md bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3 max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-surface-container pb-2.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary-fixed text-primary flex items-center justify-center shrink-0">
              <AppIcon name="notifications_active" className="text-[20px]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] font-bold text-on-surface" id="notifTitle">
                Central de Alertas
              </h3>
              <p className="text-[11.5px] text-on-surface-variant">
                Saldo atual:{' '}
                <strong className="text-on-surface tabular-nums">
                  {isBalanceHidden ? '••••••••' : signedNetText}
                </strong>
              </p>
            </div>
          </div>
          <button
            aria-label="Fechar notificações"
            className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0"
            onClick={onClose}
            type="button"
          >
            <AppIcon name="close" className="text-[19px]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-1.5 bg-surface-container-low p-1 rounded-xl shrink-0">
          <button
            className={`h-8 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'alerts'
                ? 'bg-surface-container-lowest text-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            onClick={() => setActiveTab('alerts')}
            type="button"
          >
            <AppIcon name="campaign" className="text-[16px]" />
            <span>Alertas ({alerts.length})</span>
          </button>
          <button
            className={`h-8 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-surface-container-lowest text-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            onClick={() => setActiveTab('settings')}
            type="button"
          >
            <AppIcon name="tune" className="text-[16px]" />
            <span>Configurar Limites</span>
          </button>
        </div>

        {activeTab === 'alerts' ? (
          <>
            {alerts.length > 0 && unreadCount > 0 && (
              <div className="flex items-center justify-between px-1 text-[11.5px] shrink-0">
                <span className="text-on-surface-variant font-medium">
                  {unreadCount} alerta{unreadCount === 1 ? '' : 's'} não lido{unreadCount === 1 ? '' : 's'}
                </span>
                <button
                  className="text-primary font-semibold hover:underline cursor-pointer flex items-center gap-1"
                  onClick={onMarkAllRead}
                  type="button"
                >
                  <AppIcon name="done_all" className="text-[14px]" />
                  Marcar tudo como lido
                </button>
              </div>
            )}

            <div className="space-y-2 overflow-y-auto pr-0.5 flex-1">
              {/* Comunicados Oficiais da Plataforma SaaS FinTrack */}
              {announcements.length > 0 && (
                <div className="space-y-2 mb-3 pb-3 border-b border-surface-container">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider px-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    <span>Comunicados Oficiais FinTrack ({announcements.length})</span>
                  </div>
                  {announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className="p-3 rounded-[10px] bg-primary-fixed/20 border border-primary/25 space-y-1.5 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-bold text-on-surface leading-tight">
                          {ann.title}
                        </span>
                        <span
                          className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-[5px] uppercase ${
                            ann.severity === 'critical'
                              ? 'bg-rose-100 text-rose-800'
                              : ann.severity === 'warning'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {ann.severity === 'critical' ? 'Urgente' : ann.severity === 'warning' ? 'Atenção' : 'Aviso'}
                        </span>
                      </div>
                      <p className="text-[12px] text-on-surface-variant leading-relaxed whitespace-pre-line">
                        {ann.message}
                      </p>
                      <div className="text-[10px] opacity-65 font-medium pt-0.5">
                        {new Date(ann.createdAt).toLocaleString('pt-MZ', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {alerts.length === 0 && announcements.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-secondary-container/60 text-secondary flex items-center justify-center mx-auto">
                    <AppIcon name="verified" className="text-[24px]" />
                  </div>
                  <p className="text-[13.5px] font-semibold text-on-surface">
                    Tudo sob controlo em tempo real!
                  </p>
                  <p className="text-[12px] text-on-surface-variant">
                    Nenhum alerta de saldo, meta, orçamento ou conta pendente no momento.
                  </p>
                </div>
              ) : (
                alerts.map((alert) => {
                  const style = SEVERITY_STYLES[alert.severity];
                  const isRead = readSignatures.includes(alert.signature);
                  return (
                    <button
                      key={alert.id}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 cursor-pointer ${
                        style.bg
                      } ${isRead ? 'opacity-65' : ''}`}
                      onClick={() => {
                        onMarkAlertRead(alert.signature);
                        onClose();
                        onNavigate(alert.targetScreen);
                      }}
                      type="button"
                    >
                      <div
                        className={`w-9 h-9 rounded-lg ${style.iconBg} ${style.iconColor} flex items-center justify-center shrink-0 mt-0.5`}
                      >
                        <AppIcon name={alert.icon} className="text-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-bold text-on-surface leading-snug break-words">
                            {alert.title}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 whitespace-nowrap ${style.badgeBg}`}
                          >
                            {isBalanceHidden && alert.metricBadge
                              ? maskCurrencyInText(alert.metricBadge)
                              : (alert.metricBadge ?? style.badgeLabel)}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-on-surface-variant leading-snug break-words">
                          {isBalanceHidden ? maskCurrencyInText(alert.description) : alert.description}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <form className="space-y-3 overflow-y-auto pr-0.5 flex-1" onSubmit={handleSaveThresholds}>
            <div className="p-3 rounded-xl bg-surface-container-low space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  className="text-[12px] font-bold text-on-surface"
                  htmlFor="lowBalanceThresholdInput"
                >
                  Alerta de Saldo a Esgotar ({cfg.symbol})
                </label>
                <span className="text-[10.5px] text-amber-800 font-semibold">Aviso preventivo</span>
              </div>
              <input
                className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface text-[14px] font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/25"
                id="lowBalanceThresholdInput"
                onChange={(e) => setLowBalanceInput(e.target.value)}
                step="any"
                type="number"
                value={lowBalanceInput}
              />
              <div className="flex flex-wrap gap-1.5">
                {[2500, 5000, 10000].map((valBase) => {
                  const displayVal = Math.round(valBase * cfg.rateFromBase * 100) / 100;
                  return (
                    <button
                      key={valBase}
                      className="px-2 py-0.5 rounded-md bg-surface-container-lowest text-[11px] font-semibold text-primary hover:bg-primary-fixed cursor-pointer"
                      onClick={() => setLowBalanceInput(String(displayVal))}
                      type="button"
                    >
                      {formatMoney(valBase, currency)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-error-container/25 ring-1 ring-error/15 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  className="text-[12px] font-bold text-on-surface"
                  htmlFor="negativeThresholdInput"
                >
                  Limite de Valor Negativo ({cfg.symbol})
                </label>
                <span className="text-[10.5px] text-tertiary font-semibold">Alerta crítico</span>
              </div>
              <input
                className="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface text-[14px] font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-error/30"
                id="negativeThresholdInput"
                onChange={(e) => setNegativeLimitInput(e.target.value)}
                placeholder="Ex: -2000 ou 0"
                step="any"
                type="number"
                value={negativeLimitInput}
              />
              <p className="text-[11px] text-on-surface-variant leading-snug">
                Dispara alerta crítico quando o saldo atingir ou ficar abaixo de{' '}
                <strong className="text-tertiary">{signedNegPreview}</strong> (pode usar valores
                negativos como -1.000 ou -5.000).
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[0, -1000, -2500, -5000].map((valBase) => {
                  const displayVal = Math.round(valBase * cfg.rateFromBase * 100) / 100;
                  const label = `${valBase < 0 ? '-' : ''}${formatMoney(Math.abs(valBase), currency)}`;
                  return (
                    <button
                      key={valBase}
                      className="px-2 py-0.5 rounded-md bg-surface-container-lowest text-[11px] font-semibold text-tertiary hover:bg-error-container cursor-pointer"
                      onClick={() => setNegativeLimitInput(String(displayVal))}
                      type="button"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low space-y-2">
              <span className="text-[11.5px] font-bold text-on-surface block">
                Monitoramento Ativo
              </span>
              {[
                {
                  key: 'enableLowBalanceAlerts' as const,
                  label: 'Saldo a esgotar & valor negativo',
                },
                {
                  key: 'enableGoalAlerts' as const,
                  label: 'Alertas de metas financeiras',
                },
                {
                  key: 'enableBudgetAlerts' as const,
                  label: 'Limites de orçamento (>= 75%)',
                },
                {
                  key: 'enablePendingAlerts' as const,
                  label: 'Contas e recebimentos pendentes',
                },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between gap-2 text-[12px] text-on-surface cursor-pointer py-0.5"
                >
                  <span>{item.label}</span>
                  <input
                    checked={alertSettings[item.key]}
                    className="w-4 h-4 accent-primary rounded cursor-pointer"
                    onChange={(e) =>
                      onUpdateAlertSettings({
                        ...alertSettings,
                        [item.key]: e.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                </label>
              ))}
            </div>

            <button
              className="w-full h-10 rounded-xl bg-primary text-on-primary text-[13px] font-semibold shadow-md shadow-primary/20 hover:bg-primary-container transition-colors cursor-pointer"
              type="submit"
            >
              Guardar Configurações de Alerta
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
