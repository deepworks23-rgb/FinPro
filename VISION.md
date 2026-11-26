# VISION.md — FinTrack (FinPro)

## Tese

O **FinTrack** existe para que pessoas e famílias em Moçambique saibam, em segundos e com clareza, quanto entrou, quanto saiu, onde o dinheiro está a ir (M-Pesa, e-Mola, mKesh, bancos) e se o mês vai fechar positivo ou em alerta — antes de o saldo acabar.

## Nome e Crenças

- **Nome:** FinTrack (repositório `FinPro`).
- **Crença 1 — Realidade local primeiro:** Moçambique opera em Meticais (`MZN`) e USD, com carteiras móveis (M-Pesa, e-Mola, mKesh) ao lado de bancos tradicionais. O app trata essas contas como cidadãs de primeira classe.
- **Crença 2 — Dados reais desde o primeiro dia:** Nenhuma conta começa com transações fictícias de demonstração; o painel reflete apenas o que o utilizador registou (testado em [src/utils/finance.test.ts](src/utils/finance.test.ts)).
- **Crença 3 — Segurança sem atrito invisível:** Sessões validadas no servidor, proteção contra força bruta por IP/64 ([rateLimit.ts](rateLimit.ts)) e dados persistidos em Postgres e Object Storage.

## Públicos

- Utilizadores individuais e profissionais independentes em Moçambique que controlam receitas, despesas, orçamentos mensais e metas de poupança.

## Modelo

- Aplicação web mobile-first (React + Express + Neon Postgres + Neon Object Storage) com suporte a exportação CSV e relatórios PDF.

## Antiobjetivos (e onde são guardados)

1. **Nunca começar com dados falsos misturados aos reais** — guardado pelo teste de seed zerado em [src/utils/finance.test.ts](src/utils/finance.test.ts).
2. **Nunca permitir enumeração trivial ou bloqueio de conta alheia por tentativas falhadas** — guardado por `LoginRateLimiter` em [rateLimit.ts](rateLimit.ts) e [rateLimit.test.ts](rateLimit.test.ts).
3. **Nunca vazar credenciais no repositório** — guardado pela cerca [fences/no-secrets-in-tracked-files.test.ts](fences/no-secrets-in-tracked-files.test.ts).
4. **Nunca depender de relógio ou fuso da máquina em testes** — guardado pela cerca [fences/tests-no-real-clock.test.ts](fences/tests-no-real-clock.test.ts).

## Os Três Tipos de "Não"

- **Fora da fundação (agora):** Multi-empresa / equipas partilhadas, sincronização bancária automática via open banking e aplicativo nativo iOS/Android.
- **Fora do horizonte (próximas fases):** Contabilidade fiscal empresarial completa (IVA/IRPC) e emissão de faturas certificadas.
- **Fora para sempre:** Venda ou partilha de dados financeiros dos utilizadores com terceiros para publicidade ou scoring de crédito.

## Norte

Qualquer utilizador consegue registar uma transação em menos de 10 segundos, ver o impacto imediato nos orçamentos do mês e exportar o seu extrato em PDF/CSV sem depender de planilhas.
