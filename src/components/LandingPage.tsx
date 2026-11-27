import { AppIcon } from './AppIcon';
import { useEffect, useState } from 'react';
import type { SubscriptionPlan, SubscriptionPlanItem } from '../types/finance';
import { publicApi } from '../services/api';

interface LandingPageProps {
  onGoToLogin: () => void;
  onGoToRegister: () => void;
  onSelectPlan?: (plan: SubscriptionPlan) => void;
  isAuthenticated?: boolean;
  onGoToDashboard?: () => void;
}

export function LandingPage({
  onGoToLogin,
  onGoToRegister,
  onSelectPlan,
  isAuthenticated = false,
  onGoToDashboard,
}: LandingPageProps) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [plans, setPlans] = useState<SubscriptionPlanItem[]>([]);

  useEffect(() => {
    publicApi
      .getPlans()
      .then((res) => {
        if (res.ok && Array.isArray(res.plans) && res.plans.length > 0) {
          setPlans(res.plans);
        }
      })
      .catch(() => {});
  }, []);

  const faqs = [
    {
      q: 'Preciso de cartão de crédito para começar?',
      a: 'Não! O plano Gratuito não exige cartão nem dados bancários. Para os planos PRO e Negócios, aceitamos pagamentos diretamente via M-Pesa (Vodacom) e e-Mola (Movitel).',
    },
    {
      q: 'O aplicativo funciona no telemóvel e no computador?',
      a: 'Sim, o FinTrack foi desenvolvido como aplicação responsiva de alta performance: no computador aproveita toda a tela a 100vh com navegação lateral, e no celular comporta-se como aplicativo móvel nativo, com suporte a APK Android instalável.',
    },
    {
      q: 'Os meus dados e saldos estão protegidos?',
      a: 'Sim, 100%. Utilizamos o banco de dados Neon Postgres com isolamento rigoroso por utilizador, palavras-passe encriptadas e conformidade de segurança onde nenhum utilizador tem acesso aos dados de outro.',
    },
    {
      q: 'Como funciona a exportação de relatórios?',
      a: 'Com um único clique você pode exportar relatórios estilizados em PDF (com cabeçalho executivo e gráficos) ou folhas de cálculo em CSV para entregar ao seu contabilista ou declarar contas.',
    },
    {
      q: 'Posso mudar de plano ou cancelar a qualquer momento?',
      a: 'Sim, sem fidelização ou multas. Você pode fazer upgrade ou gerir a sua assinatura a qualquer momento a partir do seu perfil.',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col font-sans selection:bg-primary selection:text-on-primary">
      {/* 1. Top Public Navigation Bar */}
      <header className="sticky top-0 z-40 w-full h-18 bg-surface/90 backdrop-blur-md border-b border-surface-container/70">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-md shadow-primary/25">
              <AppIcon name="account_balance_wallet" className="text-[22px]" filled />
            </div>
            <div>
              <span className="text-[19px] font-extrabold tracking-tight text-on-surface block leading-tight">
                FinTrack <span className="text-primary text-[14px] font-bold">SaaS</span>
              </span>
              <span className="text-[10.5px] font-medium text-on-surface-variant block leading-none">
                Finanças Inteligentes
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-[13.5px] font-semibold text-on-surface-variant">
            <a className="hover:text-primary transition-colors cursor-pointer" href="#recursos">
              Recursos
            </a>
            <a className="hover:text-primary transition-colors cursor-pointer" href="#planos">
              Planos & Preços
            </a>
            <a className="hover:text-primary transition-colors cursor-pointer" href="#depoimentos">
              Depoimentos
            </a>
            <a className="hover:text-primary transition-colors cursor-pointer" href="#faq">
              Perguntas Frequentes
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            {isAuthenticated ? (
              <button
                className="h-10 px-5 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-[13px] font-bold shadow-md shadow-primary/20 hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer flex items-center gap-2"
                onClick={onGoToDashboard}
                type="button"
              >
                <AppIcon name="dashboard" className="text-[18px]" />
                <span>Voltar ao Meu Painel</span>
              </button>
            ) : (
              <>
                <button
                  className="h-10 px-4 rounded-xl text-on-surface hover:bg-surface-container-low text-[13px] font-semibold transition-colors cursor-pointer"
                  onClick={onGoToLogin}
                  type="button"
                >
                  Iniciar Sessão
                </button>
                <button
                  className="h-10 px-5 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-[13px] font-bold shadow-md shadow-primary/20 hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                  onClick={onGoToRegister}
                  type="button"
                >
                  Começar Grátis
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-primary/10 via-secondary/5 to-transparent blur-3xl pointer-events-none" />

        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-fixed/60 border border-primary/25 text-primary text-[12px] font-bold uppercase tracking-wider mb-6 animate-fade-in shadow-xs">
            <AppIcon name="stars" className="text-[16px]" />
            <span>O SaaS Financeiro Nº 1 em Moçambique e no Mundo</span>
          </div>

          <h1 className="text-[34px] sm:text-[46px] lg:text-[58px] font-black tracking-tight text-on-surface leading-[1.12] max-w-4xl">
            Controle Total do Seu Dinheiro. <br className="hidden sm:inline" />
            <span className="text-primary bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Sem Planilhas Complicadas.
            </span>
          </h1>

          <p className="mt-5 text-[15px] sm:text-[17px] text-on-surface-variant max-w-2xl leading-relaxed">
            Acompanhe receitas, despesas, carteiras móveis (M-Pesa e e-Mola), contas bancárias, metas de poupança e emita relatórios fiscais em segundos.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
            <button
              className="w-full sm:w-auto h-12 px-8 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-[14.5px] font-bold shadow-lg shadow-primary/25 hover:shadow-xl transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
              onClick={onGoToRegister}
              type="button"
            >
              <AppIcon name="rocket_launch" className="text-[20px]" />
              <span>Experimentar Grátis Agora</span>
            </button>

            <a
              className="w-full sm:w-auto h-12 px-6 rounded-xl bg-surface-container-high hover:bg-surface-container text-on-surface text-[14px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
              href="#planos"
            >
              <AppIcon name="workspace_premium" className="text-[19px]" />
              <span>Ver Planos a partir de 0 MT</span>
            </a>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-[12.5px] text-on-surface-variant font-medium">
            <div className="flex items-center gap-2">
              <AppIcon name="check_circle" className="text-secondary text-[18px]" />
              <span>Sem necessidade de cartão de crédito</span>
            </div>
            <div className="flex items-center gap-2">
              <AppIcon name="check_circle" className="text-secondary text-[18px]" />
              <span>Pagamentos locais via M-Pesa & e-Mola</span>
            </div>
            <div className="flex items-center gap-2">
              <AppIcon name="check_circle" className="text-secondary text-[18px]" />
              <span>Disponível em Web e APK Android</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Interactive Metrics Bar */}
      <section className="border-y border-surface-container bg-surface-container-lowest py-8">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <span className="text-[28px] sm:text-[34px] font-black text-primary tabular-nums block">
              100%
            </span>
            <span className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Isolamento de Dados
            </span>
          </div>
          <div>
            <span className="text-[28px] sm:text-[34px] font-black text-secondary tabular-nums block">
              +15.000
            </span>
            <span className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Lançamentos Geridos
            </span>
          </div>
          <div>
            <span className="text-[28px] sm:text-[34px] font-black text-on-surface tabular-nums block">
              99.9%
            </span>
            <span className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Nuvem Neon Postgres
            </span>
          </div>
          <div>
            <span className="text-[28px] sm:text-[34px] font-black text-primary tabular-nums block">
              2 Moedas
            </span>
            <span className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Meticais (MT) e USD
            </span>
          </div>
        </div>
      </section>

      {/* 4. Core Features Bento Grid */}
      <section className="py-16 lg:py-24" id="recursos">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-[12px] font-bold uppercase tracking-wider text-primary block mb-2">
              Recursos Avançados
            </span>
            <h2 className="text-[28px] sm:text-[38px] font-black tracking-tight text-on-surface">
              Tudo o que você precisa para prosperar financeiramente
            </h2>
            <p className="mt-3 text-[14.5px] text-on-surface-variant">
              Desenvolvido com foco na realidade financeira prática: de despesas diárias com Credelec até faturas empresariais.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bento Card 1 */}
            <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container/70 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-error/10 text-error flex items-center justify-center mb-4">
                  <AppIcon name="phone_iphone" className="text-[24px]" />
                </div>
                <h3 className="text-[17px] font-bold text-on-surface mb-2">
                  M-Pesa e e-Mola Nativos
                </h3>
                <p className="text-[13px] text-on-surface-variant leading-relaxed">
                  Lançamento rápido com campos automáticos para códigos de referência e números de telemóvel (+258) com validação de operador.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-surface-container/60 flex items-center gap-2 text-[12px] font-semibold text-primary">
                <span>Rastreio imediato de comprovativos</span>
                <AppIcon name="arrow_forward" className="text-[14px]" />
              </div>
            </div>

            {/* Bento Card 2 */}
            <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container/70 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <AppIcon name="pie_chart" className="text-[24px]" />
                </div>
                <h3 className="text-[17px] font-bold text-on-surface mb-2">
                  Metas & Tetos de Orçamento
                </h3>
                <p className="text-[13px] text-on-surface-variant leading-relaxed">
                  Defina limites de gastos por categoria (Alimentação, Casa, Transporte) e receba alertas inteligentes antes de estourar o orçamento.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-surface-container/60 flex items-center gap-2 text-[12px] font-semibold text-primary">
                <span>Alertas em tempo real com regras de cor</span>
                <AppIcon name="arrow_forward" className="text-[14px]" />
              </div>
            </div>

            {/* Bento Card 3 */}
            <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container/70 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center mb-4">
                  <AppIcon name="picture_as_pdf" className="text-[24px]" />
                </div>
                <h3 className="text-[17px] font-bold text-on-surface mb-2">
                  Relatórios Fiscais em PDF & CSV
                </h3>
                <p className="text-[13px] text-on-surface-variant leading-relaxed">
                  Exporte relatórios estruturados com logotipo oficial, resumo executivo de poupança e detalhes de transações para o seu contabilista.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-surface-container/60 flex items-center gap-2 text-[12px] font-semibold text-primary">
                <span>Pronto para contabilidade e auditoria</span>
                <AppIcon name="arrow_forward" className="text-[14px]" />
              </div>
            </div>

            {/* Bento Card 4 */}
            <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container/70 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between md:col-span-2">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center mb-4">
                  <AppIcon name="devices" className="text-[24px]" />
                </div>
                <h3 className="text-[17px] font-bold text-on-surface mb-2">
                  Responsivo no Desktop & App Móvel Nativo
                </h3>
                <p className="text-[13px] text-on-surface-variant leading-relaxed max-w-xl">
                  No computador, desfrute de visão panorâmica total (100vh com scroll interno) para analisar centenas de movimentações. No telemóvel, lance despesas na hora pelo aplicativo APK Android ou PWA.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-surface-container/60 flex items-center gap-4 text-[12px] font-semibold text-primary">
                <span className="flex items-center gap-1">
                  <AppIcon name="desktop_windows" className="text-[16px]" /> Desktop Ultrawide
                </span>
                <span className="flex items-center gap-1">
                  <AppIcon name="android" className="text-[16px]" /> APK Android Incluso
                </span>
              </div>
            </div>

            {/* Bento Card 5 */}
            <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container/70 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <AppIcon name="currency_exchange" className="text-[24px]" />
                </div>
                <h3 className="text-[17px] font-bold text-on-surface mb-2">
                  Meticais & Dólares com 1 Toque
                </h3>
                <p className="text-[13px] text-on-surface-variant leading-relaxed">
                  Cotação e conversão automática entre Meticais (MT) e Dólares americanos (USD) para utilizadores que recebem valores do exterior.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-surface-container/60 flex items-center gap-2 text-[12px] font-semibold text-primary">
                <span>Câmbio transparente e preciso</span>
                <AppIcon name="arrow_forward" className="text-[14px]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Pricing Section */}
      <section className="py-16 lg:py-24 bg-surface-container-low/40 border-t border-surface-container" id="planos">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-[12px] font-bold uppercase tracking-wider text-primary block mb-2">
              Planos & Preços Transparentes
            </span>
            <h2 className="text-[28px] sm:text-[38px] font-black tracking-tight text-on-surface">
              Sem taxas escondidas. Comece gratuitamente.
            </h2>
            <p className="mt-2 text-[14.5px] text-on-surface-variant">
              Pague via M-Pesa, e-Mola ou cartão de crédito. Cancele quando quiser.
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center gap-3 mt-6 p-1 rounded-full bg-surface-container border border-surface-container-high">
              <button
                className={`px-4 py-1.5 rounded-full text-[12.5px] font-bold transition-all cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'text-on-surface-variant'
                }`}
                onClick={() => setBillingCycle('monthly')}
                type="button"
              >
                Faturação Mensal
              </button>
              <button
                className={`px-4 py-1.5 rounded-full text-[12.5px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  billingCycle === 'yearly'
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'text-on-surface-variant'
                }`}
                onClick={() => setBillingCycle('yearly')}
                type="button"
              >
                <span>Faturação Anual</span>
                <span className="px-2 py-0.5 rounded-full bg-secondary-container text-secondary text-[10.5px]">
                  -20% OFF
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(plans.length > 0
              ? plans
              : [
                  {
                    id: 'plan_free',
                    name: 'Gratuito',
                    slug: 'free',
                    description: 'Ideal para estudantes e pessoas físicas começarem a organizar suas receitas e despesas.',
                    priceMonthly: 0,
                    priceYearly: 0,
                    currency: 'MZN',
                    features: [
                      'Até 25 lançamentos / mês',
                      '3 categorias de orçamento',
                      '2 metas financeiras',
                      'Moeda local (Meticais)',
                    ],
                    isPopular: false,
                    isActive: true,
                    displayOrder: 1,
                  },
                  {
                    id: 'plan_pro',
                    name: 'FinPro Pessoal',
                    slug: 'pro',
                    description: 'Liberdade total para organizar todas as suas finanças pessoais e poupança.',
                    priceMonthly: 299,
                    priceYearly: 2870,
                    currency: 'MZN',
                    features: [
                      'Lançamentos ilimitados',
                      'Orçamentos e Metas ilimitados',
                      'Multimoeda em tempo real (MZN & USD)',
                      'Relatórios PDF/CSV com carimbo profissional',
                      'Sincronização em nuvem e APK Android',
                    ],
                    isPopular: true,
                    isActive: true,
                    displayOrder: 2,
                  },
                  {
                    id: 'plan_business',
                    name: 'FinPro Negócios',
                    slug: 'business',
                    description: 'Para comerciantes, prestadores de serviços, oficinas e pequenas empresas.',
                    priceMonthly: 799,
                    priceYearly: 7670,
                    currency: 'MZN',
                    features: [
                      'Tudo do FinPro Pessoal',
                      'Gestão de fluxo de caixa empresarial',
                      'Anexos de faturas e recibos S3',
                      'Exportação contábil para o contabilista',
                      'Suporte prioritário via WhatsApp',
                    ],
                    isPopular: false,
                    isActive: true,
                    displayOrder: 3,
                  },
                ]
            ).map((p) => {
              const monthlyPrice = Number(p.priceMonthly);
              const yearlyMonthlyEquiv = Math.round(Number(p.priceYearly) / 12);
              const priceDisplay = billingCycle === 'monthly' ? monthlyPrice : yearlyMonthlyEquiv;
              const isHighlight = p.isPopular;

              return (
                <div
                  key={p.id}
                  className={`p-6 rounded-[10px] bg-surface-container-lowest flex flex-col justify-between transition-all ${
                    isHighlight
                      ? 'border-2 border-primary shadow-xl relative ring-4 ring-primary/10'
                      : 'border border-surface-container shadow-sm'
                  }`}
                >
                  {isHighlight && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-[6px] bg-primary text-on-primary text-[11px] font-black uppercase tracking-wider shadow-sm">
                      Mais Escolhido ⭐
                    </div>
                  )}

                  <div>
                    <span
                      className={`text-[14px] font-bold block mb-1 ${
                        isHighlight ? 'text-primary' : 'text-on-surface'
                      }`}
                    >
                      {p.name}
                    </span>
                    <div className="flex items-baseline gap-1 my-3">
                      <span className="text-[36px] font-black text-on-surface">
                        {priceDisplay}
                      </span>
                      <span className="text-[13px] font-bold text-on-surface-variant">MT / mês</span>
                      {billingCycle === 'yearly' && Number(p.priceYearly) > 0 && (
                        <span className="text-[11px] text-secondary font-bold block ml-1">
                          ({Number(p.priceYearly).toLocaleString('pt-MZ')} MT / ano)
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-on-surface-variant mb-6">
                      {p.description}
                    </p>
                    <ul className="space-y-3 text-[12.5px] text-on-surface">
                      {p.features.map((feat, fIdx) => (
                        <li
                          key={fIdx}
                          className={`flex items-center gap-2.5 ${
                            isHighlight && fIdx === 0 ? 'font-bold text-primary' : ''
                          }`}
                        >
                          <AppIcon name="check" className="text-secondary text-[16px] shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8 pt-4">
                    <button
                      className={`w-full h-11 rounded-[10px] text-[13px] font-bold transition-all cursor-pointer ${
                        monthlyPrice === 0
                          ? 'bg-surface-container-high hover:bg-surface-container text-on-surface'
                          : isHighlight
                            ? 'bg-primary hover:bg-primary-container text-on-primary shadow-md shadow-primary/25 hover:shadow-lg active:scale-[0.98]'
                            : 'bg-on-surface text-surface hover:opacity-90'
                      }`}
                      onClick={() => {
                        if (monthlyPrice === 0) {
                          onGoToRegister();
                        } else if (onSelectPlan) {
                          onSelectPlan(p.slug === 'business' ? 'business' : 'pro');
                        } else {
                          onGoToRegister();
                        }
                      }}
                      type="button"
                    >
                      {monthlyPrice === 0 ? 'Criar Conta Grátis' : `Assinar ${p.name}`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. Testimonials */}
      <section className="py-16 lg:py-24" id="depoimentos">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-[12px] font-bold uppercase tracking-wider text-primary block mb-2">
              Depoimentos Reais
            </span>
            <h2 className="text-[28px] sm:text-[36px] font-black tracking-tight text-on-surface">
              Quem usa o FinTrack recomenda
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container/70 shadow-sm flex flex-col justify-between">
              <p className="text-[13.5px] text-on-surface leading-relaxed italic">
                “Antes eu perdia o controle de quanto saía no M-Pesa. Hoje registro cada saída com o código da mensagem e sei exatamente onde meu dinheiro está.”
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-fixed text-primary font-bold flex items-center justify-center text-[13px]">
                  AM
                </div>
                <div>
                  <span className="text-[13px] font-bold text-on-surface block">Alberto Macamo</span>
                  <span className="text-[11px] text-on-surface-variant block">Consultor Autônomo · Maputo</span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container/70 shadow-sm flex flex-col justify-between">
              <p className="text-[13.5px] text-on-surface leading-relaxed italic">
                “A exportação em PDF é fantástica. No final do mês só imprimo o relatório e envio para o contabilista da minha loja. Economiza dias de trabalho.”
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary-container text-secondary font-bold flex items-center justify-center text-[13px]">
                  FC
                </div>
                <div>
                  <span className="text-[13px] font-bold text-on-surface block">Fatima Cossa</span>
                  <span className="text-[11px] text-on-surface-variant block">Comerciante · Matola</span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-surface-container-lowest border border-surface-container/70 shadow-sm flex flex-col justify-between">
              <p className="text-[13.5px] text-on-surface leading-relaxed italic">
                “Uso no desktop no escritório e no celular na rua. É muito rápido, e as metas de orçamento me ajudaram a poupar mais de 40.000 MT este ano.”
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-800 font-bold flex items-center justify-center text-[13px]">
                  JN
                </div>
                <div>
                  <span className="text-[13px] font-bold text-on-surface block">Jorge Nhampossa</span>
                  <span className="text-[11px] text-on-surface-variant block">Engenheiro · Beira</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FAQ Section */}
      <section className="py-16 bg-surface-container-low/30 border-t border-surface-container" id="faq">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-[12px] font-bold uppercase tracking-wider text-primary block mb-1">
              Dúvidas Comuns
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-black text-on-surface">
              Perguntas Frequentes
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={faq.q}
                  className="rounded-2xl bg-surface-container-lowest border border-surface-container overflow-hidden transition-all"
                >
                  <button
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-[14px] sm:text-[15px] text-on-surface cursor-pointer"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    type="button"
                  >
                    <span>{faq.q}</span>
                    <AppIcon
                      name="expand_more"
                      className={`text-[20px] text-on-surface-variant transition-transform ${
                        isOpen ? 'rotate-180 text-primary' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-[13px] text-on-surface-variant leading-relaxed border-t border-surface-container/60 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. Bottom Final CTA */}
      <section className="py-16 bg-gradient-to-br from-primary to-primary-container text-on-primary text-center">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-[28px] sm:text-[40px] font-black tracking-tight leading-tight">
            Pronto para transformar a sua vida financeira?
          </h2>
          <p className="mt-3 text-[15px] opacity-90 max-w-xl mx-auto">
            Junte-se a centenas de utilizadores que conquistaram tranquilidade e controle com o FinTrack.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              className="h-12 px-8 rounded-xl bg-surface-container-lowest text-primary text-[14.5px] font-bold shadow-xl hover:bg-surface-container transition-all active:scale-[0.98] cursor-pointer"
              onClick={onGoToRegister}
              type="button"
            >
              Começar Agora (Grátis)
            </button>
            <button
              className="h-12 px-6 rounded-xl bg-primary-container border border-white/20 text-on-primary text-[14px] font-semibold hover:bg-primary-container/80 transition-all cursor-pointer"
              onClick={onGoToLogin}
              type="button"
            >
              Já tenho conta
            </button>
          </div>
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="bg-surface-container-lowest border-t border-surface-container py-10">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-[12.5px] text-on-surface-variant">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary text-on-primary flex items-center justify-center text-[14px]">
              <AppIcon name="account_balance_wallet" className="text-[16px]" filled />
            </div>
            <span className="font-bold text-on-surface">FinTrack (FinPro) SaaS</span>
            <span>· © 2026 Todos os direitos reservados.</span>
          </div>

          <div className="flex items-center gap-6">
            <a className="hover:text-primary transition-colors cursor-pointer" href="#recursos">
              Recursos
            </a>
            <a className="hover:text-primary transition-colors cursor-pointer" href="#planos">
              Planos
            </a>
            <button className="hover:text-primary transition-colors cursor-pointer" onClick={onGoToLogin} type="button">
              Aceder
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
