import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  });

  try {
    console.log('Clearing database tables...');
    await pool.query('DELETE FROM support_tickets;');
    await pool.query('DELETE FROM subscriptions;');
    await pool.query('DELETE FROM workspaces;');
    await pool.query('DELETE FROM sessions;');
    await pool.query('DELETE FROM announcements;');
    await pool.query('DELETE FROM users;');

    // Garantir planos de subscrição padrão ativos
    await pool.query(`
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
      ON CONFLICT (slug) DO UPDATE SET
        is_active = EXCLUDED.is_active,
        name = EXCLUDED.name,
        price_monthly = EXCLUDED.price_monthly,
        price_yearly = EXCLUDED.price_yearly;
    `);

    const uRes = await pool.query('SELECT count(*) FROM users;');
    const pRes = await pool.query('SELECT count(*) FROM subscription_plans WHERE is_active = TRUE;');
    console.log('SUCCESS: All users, sessions, tickets, workspaces wiped clean.');
    console.log('Users count:', uRes.rows[0].count);
    console.log('Active subscription plans count:', pRes.rows[0].count);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Failed to wipe db:', err);
  process.exit(1);
});
