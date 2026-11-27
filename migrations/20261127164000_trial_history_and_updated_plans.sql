-- 20261127164000_trial_history_and_updated_plans.sql
-- Histórico e prevenção de abuso do plano gratuito (trial único de 7 dias)
-- e atualização dos planos de subscrição com preços e textos oficiais.

-- 1. Colunas de controlo de trial único na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ended_at TIMESTAMPTZ;

-- 2. Tabela de auditoria e histórico de trials por utilizador e telefone
CREATE TABLE IF NOT EXISTS trial_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_normalized TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trial_audit_phone_idx ON trial_audit_log (phone_normalized);
CREATE INDEX IF NOT EXISTS trial_audit_user_idx ON trial_audit_log (user_id);

-- 3. Atualizar utilizadores existentes com base nas subscrições existentes
UPDATE users u
SET trial_used = TRUE,
    trial_started_at = s.started_at,
    trial_ended_at = COALESCE(s.expires_at, s.started_at + INTERVAL '7 days')
FROM subscriptions s
WHERE s.user_id = u.id AND (s.plan = 'free' OR s.status = 'trialing');

-- 4. Atualização dos 3 Planos Oficiais na tabela subscription_plans
INSERT INTO subscription_plans (
  id, name, slug, description, price_monthly, price_yearly, currency, features, is_popular, is_active, display_order
)
VALUES
  (
    'plan_free',
    'Gratuito',
    'free',
    'Para quem quer dar os primeiros passos no controle financeiro.',
    0,
    0,
    'MZN',
    '["Até 25 lançamentos / mês", "3 categorias de orçamento", "2 metas financeiras", "Sem suporte prioritário"]'::jsonb,
    FALSE,
    TRUE,
    1
  ),
  (
    'plan_pro',
    'FinPro Pessoal',
    'pro',
    'Liberdade total para organizar todas as suas finanças pessoais e poupança.',
    299,
    2870,
    'MZN',
    '["Lançamentos ilimitados", "Orçamentos e Metas ilimitados", "Multimoeda em tempo real (MZN & USD)", "Relatórios PDF/CSV com carimbo profissional", "Sincronização em nuvem e APK Android"]'::jsonb,
    TRUE,
    TRUE,
    2
  ),
  (
    'plan_business',
    'FinPro Negócios',
    'business',
    'Para comerciantes, prestadores de serviços, oficinas e pequenas empresas.',
    799,
    7670,
    'MZN',
    '["Tudo do FinPro Pessoal", "Gestão de fluxo de caixa empresarial", "Anexos de faturas e recibos S3", "Exportação contábil para o contabilista", "Suporte prioritário via WhatsApp"]'::jsonb,
    FALSE,
    TRUE,
    3
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  currency = EXCLUDED.currency,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();
