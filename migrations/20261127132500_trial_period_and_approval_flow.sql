-- 20261127132500_trial_period_and_approval_flow.sql
-- Adiciona suporte estrito a período de teste de 7 dias e aprovação manual de pagamentos

-- 1. Alterar valor padrão do status de subscrições para 'trialing'
ALTER TABLE subscriptions ALTER COLUMN status SET DEFAULT 'trialing';

-- 2. Atribuir período de teste de 7 dias a contas existentes no plano 'free' sem prazo de expiração
UPDATE subscriptions
SET expires_at = created_at + INTERVAL '7 days'
WHERE plan = 'free' AND expires_at IS NULL;

-- 3. Atualizar status de contas gratuitas cujo teste já expirou para 'past_due'
UPDATE subscriptions
SET status = 'past_due'
WHERE plan = 'free' AND expires_at IS NOT NULL AND expires_at < NOW();

-- 4. Atualizar status de contas gratuitas ainda dentro do prazo para 'trialing'
UPDATE subscriptions
SET status = 'trialing'
WHERE plan = 'free' AND expires_at IS NOT NULL AND expires_at >= NOW();
