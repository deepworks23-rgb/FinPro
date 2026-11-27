import { AppIcon } from './AppIcon';
import { useState, type FormEvent } from 'react';
import type {
  CurrencyCode,
  SubscriptionPlan,
  UserSubscription,
} from '../types/finance';
import { subscriptionApi } from '../services/api';
import { isValidPhoneMZ } from '../utils/finance';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSubscription?: UserSubscription | null;
  authToken?: string | null;
  currency: CurrencyCode;
  onSubscriptionUpdated?: (updated: UserSubscription) => void;
  onNotify?: (msg: string) => void;
}

export function PricingModal({
  isOpen,
  onClose,
  currentSubscription,
  authToken,
  currency: _currency,
  onSubscriptionUpdated,
  onNotify,
}: PricingModalProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'emola' | 'card'>('mpesa');
  const [phone, setPhone] = useState(currentSubscription?.paymentPhone ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    plan: SubscriptionPlan;
    ref: string;
    msg: string;
  } | null>(null);

  if (!isOpen) return null;

  const currentPlan = currentSubscription?.plan ?? 'free';

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setErrorMsg(null);
    setSuccessInfo(null);
  };

  const handleCheckoutSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    if (!authToken) {
      setErrorMsg('Inicie sessão ou crie uma conta para assinar o plano.');
      return;
    }

    if (paymentMethod !== 'card' && !isValidPhoneMZ(phone)) {
      setErrorMsg('Informe um número de telemóvel válido para cobrança (+258 84/85/86/87...).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await subscriptionApi.upgradeSubscription(authToken, {
        plan: selectedPlan,
        paymentMethod,
        phone: phone.trim(),
        billingCycle,
      });

      onSubscriptionUpdated?.(res.subscription);
      setSuccessInfo({
        plan: selectedPlan,
        ref: res.subscription.paymentReference || 'CONFIRMADO',
        msg: res.message,
      });
      onNotify?.(res.message);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao processar pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      aria-labelledby="pricing-modal-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in"
      role="dialog"
    >
      <div className="w-full max-w-4xl bg-surface-container-lowest rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-surface-container pb-4">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary text-[11px] font-bold uppercase tracking-wider mb-1.5">
              <AppIcon name="verified" className="text-[13px]" /> FinTrack SaaS Plans
            </div>
            <h2
              className="text-[20px] sm:text-[24px] font-bold text-on-surface tracking-tight"
              id="pricing-modal-title"
            >
              Escolha o Plano Ideal para o Seu Bolso ou Empresa
            </h2>
            <p className="text-[12.5px] text-on-surface-variant mt-0.5">
              Assine com M-Pesa, e-Mola ou Cartão. Cancele ou mude de plano a qualquer momento.
            </p>
          </div>
          <button
            aria-label="Fechar"
            className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-surface cursor-pointer shrink-0 transition-colors"
            onClick={onClose}
            type="button"
          >
            <AppIcon name="close" className="text-[20px]" />
          </button>
        </div>

        {/* Success / Pending Approval Screen */}
        {successInfo ? (
          <div className="py-8 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 flex items-center justify-center shadow-lg">
              <AppIcon name="pending_actions" className="text-[36px]" />
            </div>
            <div>
              <h3 className="text-[20px] font-bold text-on-surface">
                Pedido de Subscrição Enviado!
              </h3>
              <p className="text-[13px] text-on-surface-variant max-w-md mx-auto mt-1">
                {successInfo.msg}
              </p>
              <div className="inline-flex items-center gap-2 mt-3 px-3.5 py-2 rounded-xl bg-surface-container-low text-[12px] font-mono text-on-surface font-semibold border border-surface-container">
                <span>Referência:</span>
                <span className="text-primary font-bold">{successInfo.ref}</span>
              </div>
              <p className="text-[12px] text-on-surface-variant max-w-sm mx-auto mt-2.5">
                O seu pagamento será conferido pela administração e o seu plano ativado em instantes. A tela atualizará automaticamente!
              </p>
            </div>
            <button
              className="h-11 px-6 rounded-xl bg-primary text-on-primary text-[13px] font-semibold hover:bg-primary-container cursor-pointer shadow-md"
              onClick={onClose}
              type="button"
            >
              Compreendi, Voltar
            </button>
          </div>
        ) : (
          <>
            {/* Billing Cycle Toggle */}
            <div className="flex items-center justify-center gap-3 py-4">
              <span
                className={`text-[12.5px] font-semibold cursor-pointer ${
                  billingCycle === 'monthly' ? 'text-primary' : 'text-on-surface-variant'
                }`}
                onClick={() => setBillingCycle('monthly')}
              >
                Cobrança Mensal
              </span>
              <button
                aria-label="Alternar ciclo de faturação"
                className="w-12 h-6 rounded-full bg-surface-container-high p-1 relative transition-colors cursor-pointer"
                onClick={() =>
                  setBillingCycle((prev) => (prev === 'monthly' ? 'yearly' : 'monthly'))
                }
                type="button"
              >
                <div
                  className={`w-4 h-4 rounded-full bg-primary transition-transform ${
                    billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
              <span
                className={`text-[12.5px] font-semibold flex items-center gap-1.5 cursor-pointer ${
                  billingCycle === 'yearly' ? 'text-primary' : 'text-on-surface-variant'
                }`}
                onClick={() => setBillingCycle('yearly')}
              >
                <span>Cobrança Anual</span>
                <span className="px-1.5 py-0.5 rounded-full bg-secondary-container text-secondary text-[10.5px] font-bold">
                  -20% OFF
                </span>
              </span>
            </div>

            {/* 3 Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1 pb-4">
              {/* Plano 1: Gratuito */}
              <div
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  currentPlan === 'free'
                    ? 'border-primary/40 bg-surface-container-low/50 shadow-sm'
                    : 'border-surface-container bg-surface-container-lowest'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold text-on-surface">Gratuito</span>
                    {currentPlan === 'free' && (
                      <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-bold">
                        Plano Atual
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[26px] font-extrabold text-on-surface">0</span>
                    <span className="text-[12px] font-bold text-on-surface-variant">MT / mês</span>
                  </div>
                  <p className="text-[11.5px] text-on-surface-variant">
                    Para quem quer dar os primeiros passos no controle financeiro.
                  </p>
                  <ul className="space-y-2 text-[12px] text-on-surface-variant pt-2 border-t border-surface-container/60">
                    <li className="flex items-center gap-2">
                      <AppIcon name="check" className="text-secondary text-[16px] shrink-0" />
                      <span>Até 25 lançamentos / mês</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <AppIcon name="check" className="text-secondary text-[16px] shrink-0" />
                      <span>3 categorias de orçamento</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <AppIcon name="check" className="text-secondary text-[16px] shrink-0" />
                      <span>2 metas financeiras</span>
                    </li>
                    <li className="flex items-center gap-2 text-on-surface-variant/60">
                      <AppIcon name="close" className="text-[16px] shrink-0" />
                      <span>Sem suporte prioritário</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4">
                  <button
                    className="w-full h-10 rounded-xl bg-surface-container-high text-on-surface text-[12.5px] font-semibold cursor-default opacity-80"
                    disabled
                    type="button"
                  >
                    {currentPlan === 'free' ? 'Plano Ativo' : 'Plano Básico'}
                  </button>
                </div>
              </div>

              {/* Plano 2: FinPro Pessoal (Destaque) */}
              <div
                className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between relative ${
                  selectedPlan === 'pro'
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                    : currentPlan === 'pro'
                      ? 'border-secondary bg-secondary/5'
                      : 'border-primary/60 bg-surface-container-lowest shadow-md'
                }`}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-on-primary text-[10.5px] font-bold uppercase tracking-wider shadow-xs">
                  Mais Popular ⭐
                </div>

                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold text-primary">FinPro Pessoal</span>
                    {currentPlan === 'pro' && (
                      <span className="px-2 py-0.5 rounded-full bg-secondary-container text-secondary text-[10px] font-bold">
                        Seu Plano Ativo
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[26px] font-extrabold text-on-surface">
                      {billingCycle === 'monthly' ? '299' : '207'}
                    </span>
                    <span className="text-[12px] font-bold text-on-surface-variant">MT / mês</span>
                    {billingCycle === 'yearly' && (
                      <span className="text-[10px] text-secondary font-bold block">
                        (2.490 MT / ano)
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-on-surface-variant">
                    Liberdade total para organizar todas as suas finanças pessoais e poupança.
                  </p>
                  <ul className="space-y-2 text-[12px] text-on-surface pt-2 border-t border-surface-container/60">
                    <li className="flex items-center gap-2">
                      <AppIcon name="check" className="text-secondary text-[16px] shrink-0" />
                      <span className="font-semibold">Lançamentos ilimitados</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <AppIcon name="check" className="text-secondary text-[16px] shrink-0" />
                      <span>Orçamentos e Metas ilimitados</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <AppIcon name="check" className="text-secondary text-[16px] shrink-0" />
                      <span>Multimoeda em tempo real (MZN & USD)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <AppIcon name="check" className="text-secondary text-[16px] shrink-0" />
                      <span>Relatórios PDF/CSV com carimbo profissional</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <AppIcon name="check" className="text-secondary text-[16px] shrink-0" />
                      <span>Sincronização em nuvem e APK Android</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4">
                  <button
                    className={`w-full h-10 rounded-xl text-[12.5px] font-semibold transition-all cursor-pointer shadow-sm ${
                      selectedPlan === 'pro'
                        ? 'bg-primary text-on-primary ring-2 ring-primary'
                        : 'bg-primary text-on-primary hover:bg-primary-container'
                    }`}
                    onClick={() => handleSelectPlan('pro')}
                    type="button"
                  >
                    {currentPlan === 'pro' ? 'Renovar / Manter Pro' : 'Escolher FinPro Pessoal'}
                  </button>
                </div>
              </div>

              {/* Plano 3: FinPro Negócios / PME */}
              <div
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  selectedPlan === 'business'
                    ? 'border-tertiary ring-2 ring-tertiary/20 bg-tertiary/5'
                    : currentPlan === 'business'
                      ? 'border-secondary bg-secondary/5'
                      : 'border-surface-container bg-surface-container-lowest'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold text-on-surface">FinPro Negócios</span>
                    {currentPlan === 'business' && (
                      <span className="px-2 py-0.5 rounded-full bg-secondary-container text-secondary text-[10px] font-bold">
                        Plano Ativo
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[26px] font-extrabold text-on-surface">
                      {billingCycle === 'monthly' ? '799' : '582'}
                    </span>
                    <span className="text-[12px] font-bold text-on-surface-variant">MT / mês</span>
                    {billingCycle === 'yearly' && (
                      <span className="text-[10px] text-secondary font-bold block">
                        (6.990 MT / ano)
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-on-surface-variant">
                    Para comerciantes, prestadores de serviços, oficinas e pequenas empresas.
                  </p>
                  <ul className="space-y-2 text-[12px] text-on-surface pt-2 border-t border-surface-container/60">
                    <li className="flex items-center gap-2">
                      <AppIcon name="check" className="text-secondary text-[16px] shrink-0" />
                      <span className="font-semibold">Tudo do FinPro Pessoal</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <AppIcon name="check" className="text-secondary text-[16px] shrink-0" />
                      <span>Gestão de fluxo de caixa empresarial</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <AppIcon name="check" className="text-secondary text-[16px] shrink-0" />
                      <span>Anexos de faturas e recibos S3</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <AppIcon name="check" className="text-secondary text-[16px] shrink-0" />
                      <span>Exportação contábil para o contabilista</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <AppIcon name="check" className="text-secondary text-[16px] shrink-0" />
                      <span>Suporte prioritário via WhatsApp</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4">
                  <button
                    className={`w-full h-10 rounded-xl text-[12.5px] font-semibold transition-all cursor-pointer shadow-sm ${
                      selectedPlan === 'business'
                        ? 'bg-on-surface text-surface'
                        : 'bg-surface-container-high text-on-surface hover:bg-surface-container'
                    }`}
                    onClick={() => handleSelectPlan('business')}
                    type="button"
                  >
                    {currentPlan === 'business'
                      ? 'Renovar / Manter Negócios'
                      : 'Escolher FinPro Negócios'}
                  </button>
                </div>
              </div>
            </div>

            {/* Checkout Drawer (se plano selecionado) */}
            {selectedPlan && (
              <form
                className="mt-2 p-4 rounded-2xl bg-surface-container-low/70 border border-primary/20 space-y-3 animate-fade-in"
                onSubmit={handleCheckoutSubmit}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-on-surface">
                    Confirmar Assinatura: {selectedPlan === 'pro' ? 'FinPro Pessoal' : 'FinPro Negócios'} (
                    {billingCycle === 'yearly' ? 'Anual' : 'Mensal'})
                  </span>
                  <span className="text-[14px] font-bold text-primary tabular-nums">
                    {selectedPlan === 'pro'
                      ? billingCycle === 'yearly'
                        ? '2.490,00 MT'
                        : '299,00 MT'
                      : billingCycle === 'yearly'
                        ? '6.990,00 MT'
                        : '799,00 MT'}
                  </span>
                </div>

                {/* Seletor de Método de Pagamento */}
                <div className="space-y-1.5">
                  <label className="text-[11.5px] font-semibold text-on-surface-variant block">
                    Forma de Pagamento
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      className={`h-11 rounded-xl flex items-center justify-center gap-2 text-[12px] font-semibold border transition-all cursor-pointer ${
                        paymentMethod === 'mpesa'
                          ? 'border-error bg-error/10 text-error font-bold shadow-xs'
                          : 'border-surface-container bg-surface-container-lowest text-on-surface'
                      }`}
                      onClick={() => setPaymentMethod('mpesa')}
                      type="button"
                    >
                      <AppIcon name="phone_iphone" className="text-[16px]" />
                      <span>M-Pesa</span>
                    </button>

                    <button
                      className={`h-11 rounded-xl flex items-center justify-center gap-2 text-[12px] font-semibold border transition-all cursor-pointer ${
                        paymentMethod === 'emola'
                          ? 'border-amber-600 bg-amber-500/10 text-amber-700 font-bold shadow-xs'
                          : 'border-surface-container bg-surface-container-lowest text-on-surface'
                      }`}
                      onClick={() => setPaymentMethod('emola')}
                      type="button"
                    >
                      <AppIcon name="payments" className="text-[16px]" />
                      <span>e-Mola</span>
                    </button>

                    <button
                      className={`h-11 rounded-xl flex items-center justify-center gap-2 text-[12px] font-semibold border transition-all cursor-pointer ${
                        paymentMethod === 'card'
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                          : 'border-surface-container bg-surface-container-lowest text-on-surface'
                      }`}
                      onClick={() => setPaymentMethod('card')}
                      type="button"
                    >
                      <AppIcon name="credit_card" className="text-[16px]" />
                      <span>Cartão Bancário</span>
                    </button>
                  </div>
                </div>

                {/* Telefone para Carteira Móvel */}
                {paymentMethod !== 'card' ? (
                  <div className="space-y-1">
                    <label
                      className="text-[11.5px] font-semibold text-on-surface-variant block"
                      htmlFor="subPhoneInput"
                    >
                      Nº de Telemóvel para Confirmação ({paymentMethod === 'mpesa' ? 'M-Pesa Vodacom' : 'e-Mola Movitel'})
                    </label>
                    <input
                      className="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/25"
                      id="subPhoneInput"
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex: 84 123 4567 ou 86 987 6543"
                      required
                      type="tel"
                      value={phone}
                    />
                    <p className="text-[10.5px] text-on-surface-variant">
                      Você receberá uma notificação na tela do telemóvel para autorizar a operação com o PIN.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11.5px] text-on-surface-variant bg-surface-container-lowest p-2.5 rounded-xl border border-surface-container">
                    Ambiente seguro e encriptado com suporte a VISA, Mastercard e cartões de débito internacionais.
                  </p>
                )}

                {errorMsg && (
                  <div className="p-2.5 rounded-xl bg-error-container text-on-error-container text-[12px] font-semibold">
                    {errorMsg}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    className="flex-1 h-11 rounded-xl bg-secondary hover:bg-secondary/90 text-on-secondary text-[13px] font-bold transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                    disabled={isSubmitting}
                    type="submit"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    ) : (
                      <>
                        <AppIcon name="lock" className="text-[16px]" />
                        <span>Confirmar e Ativar Assinatura</span>
                      </>
                    )}
                  </button>
                  <button
                    className="h-11 px-4 rounded-xl bg-surface-container text-on-surface text-[12.5px] font-semibold hover:bg-surface-container-high cursor-pointer"
                    onClick={() => setSelectedPlan(null)}
                    type="button"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
