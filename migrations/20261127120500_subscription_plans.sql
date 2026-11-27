CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  price_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_yearly NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'MZN',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscription_plans_active_order_idx
  ON subscription_plans (is_active, display_order ASC);

INSERT INTO subscription_plans (id, name, slug, description, price_monthly, price_yearly, currency, features, is_popular, is_active, display_order)
VALUES
  (
    'plan_free',
    'Gratuito',
    'free',
    'Ideal para começar a organizar as suas finanças pessoais sem custos.',
    0,
    0,
    'MZN',
    '["Até 25 transações mensais", "1 conta financeira básica", "Até 3 orçamentos por categoria", "Relatórios mensais em tela", "Exportação simples"]'::jsonb,
    FALSE,
    TRUE,
    1
  ),
  (
    'plan_pro',
    'FinPro Pessoal',
    'pro',
    'Controle total, contas ilimitadas e inteligência financeira para indivíduos.',
    499,
    4990,
    'MZN',
    '["Transações ilimitadas", "Contas bancárias e carteiras móveis ilimitadas", "Orçamentos e metas ilimitados", "Relatórios detalhados com exportação em PDF e CSV", "Análise de fluxo de caixa e projeções financeiras", "Suporte prioritário via WhatsApp"]'::jsonb,
    TRUE,
    TRUE,
    2
  ),
  (
    'plan_business',
    'FinPro Negócios',
    'business',
    'Para empreendedores, PMEs e negócios que exigem gestão de receitas e despesas com alta precisão.',
    1499,
    14990,
    'MZN',
    '["Tudo incluído no Plano Pro", "Múltiplos centros de custos e categorias personalizadas", "Relatórios executivos e auditoria para contabilidade", "Exportações completas avançadas", "Gestão de fluxo de caixa e comprovativos", "Atendimento VIP com gestor dedicado"]'::jsonb,
    FALSE,
    TRUE,
    3
  )
ON CONFLICT (slug) DO NOTHING;
