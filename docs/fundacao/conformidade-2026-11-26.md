# Auditoria de Conformidade pela Fábrica DeskLabs

- **Data:** 2026-11-26
- **Commit base medido:** `555513b2995faf32331f2af680fe5cbf8b5e7ff7` (com convergência aplicada localmente após o commit)
- **Régua:** `conformidade.md` da Fábrica DeskLabs

## Resumo de Contagem

| Resultado | Quantidade |
|---|---|
| **Conforme** | 23 |
| **Não conforme** | 21 |
| **Decidido diferente** | 5 |
| **Não se aplica** | 38 |
| **Não medido** | 8 |

---

## 1. Visão — capítulo 01

| Nº | Resultado | Evidência / Observação |
|---|---|---|
| 1.1 | Conforme | [VISION.md](../../VISION.md) criado na raiz com tese, nome, crenças, públicos, modelo, antiobjetivos, norte e tipos de "não". |
| 1.2 | Conforme | A tese em [VISION.md](../../VISION.md) foca no resultado para o utilizador (clareza sobre saldo, M-Pesa, orçamentos), não na stack. |
| 1.3–1.5 | Conforme | Antiobjetivos apontam para [src/utils/finance.test.ts](../../src/utils/finance.test.ts), [rateLimit.ts](../../rateLimit.ts) e `fences/`; três tipos de "não" separados. |
| 1.6 | Não se aplica | Não há produtos irmãos na mesma família DeskLabs neste repositório. |
| 1.7 | Conforme | [README.md](../../README.md) declara por capacidade o que foi provado por teste, execução ou apenas configurado. |

## 2. Modelo de negócio — capítulo 02

| Nº | Resultado | Evidência / Observação |
|---|---|---|
| 2.1–2.5, 2.11–2.19 | Não se aplica / Não conforme | Produto ainda sem parceiro de VPS definido nem guia de custos/implementador; aberto em [pedidos-de-decisao.md](pedidos-de-decisao.md). |
| 2.6–2.7 | Conforme | Sem telemetria automática para terceiros no código de [server.ts](../../server.ts) ou [src/App.tsx](../../src/App.tsx). |

## 3. Stack — capítulo 03

| Nº | Resultado | Evidência / Observação |
|---|---|---|
| 3.1 | Conforme | Decisão de Neon Postgres + Object Storage registrada em [0001-neon-postgres-e-object-storage.md](../decisions/0001-neon-postgres-e-object-storage.md). |
| 3.2 | Decidido diferente | Requer conta Neon (`DATABASE_URL`); decisão e custo registrados em [0001-neon-postgres-e-object-storage.md](../decisions/0001-neon-postgres-e-object-storage.md). |
| 3.3 | Conforme | Versões travadas via `package-lock.json` e `package.json`. |
| 3.4–3.5 | Não medido | Não há VPS de produção provisionada para medir memória/disco em repouso fora do ambiente local. |

## 4. Design system — capítulo 04

| Nº | Resultado | Evidência / Observação |
|---|---|---|
| 4.1–4.2 | Não conforme | Não há documento dedicado de design system nem cerca bloqueando cores fora de token. |
| 4.3 | Não conforme | Busca em `src/components/*.tsx` encontrou classes `amber-*` e hex literais (`#006c49`, `#bc1d25`, `#f2f3ff`, `#eaedff`, `#ba1a1a`, `#3525cd`, `#777587`) em `BudgetsScreen.tsx`, `ConfirmDialog.tsx`, `DashboardScreen.tsx`, `Header.tsx`, `Overlays.tsx` e `ReportsScreen.tsx`. Pedido aberto em [pedidos-de-decisao.md](pedidos-de-decisao.md). |
| 4.4–4.5 | Não conforme | `index.html` carrega fontes e ícones (`Inter`, `Plus Jakarta Sans`, `Material Symbols Outlined`) via `fonts.googleapis.com` em vez de versionados no repositório. |
| 4.6–4.9 | Não conforme | Textos estão inline em português nos componentes (sem dicionário separado) e não há pasta de marca vetorial/site (nível L). |

## 5. Engenharia — capítulo 05

| Nº | Resultado | Evidência / Observação |
|---|---|---|
| 5.1–5.4 | Conforme | [AGENTS.md](../../AGENTS.md) criado como documento único com convenções ligadas a cercas, antipadrões com origem e DoD em duas listas. |
| 5.5 | Conforme | Schema único via migrations com carimbo de tempo em [migrations/20261126143000_initial_schema.sql](../../migrations/20261126143000_initial_schema.sql), runner em [db.ts](../../db.ts) e cerca [fences/migrations-are-timestamped-and-unique.test.ts](../../fences/migrations-are-timestamped-and-unique.test.ts). |
| 5.6–5.8 | Não conforme | Sem cerca de "um arquivo por peça" ou "variáveis sem padrão"; `DATABASE_URL` não possui valor padrão por segurança. |
| 5.9–5.10 | Conforme | Todas as 5 cercas em `fences/` declaram `@owner`, `@reason` e `@review-date`, cobrado por [fences/fences-have-owner-and-review-date.test.ts](../../fences/fences-have-owner-and-review-date.test.ts). |
| 5.11–5.15 | Conforme | [.github/workflows/ci.yml](../../.github/workflows/ci.yml) criado com `concurrency.cancel-in-progress: true`, passos com diagnóstico de causa e `npm run check`. |
| 5.16, 5.20–5.22 | Não conforme / Não medido | Não há construção de imagens Docker, testes E2E de navegador (Playwright) nem job de atualização entre versões. |
| 5.17 | Conforme | [fences/no-secrets-in-tracked-files.test.ts](../../fences/no-secrets-in-tracked-files.test.ts) verifica arquivos rastreados no Git. |
| 5.18 | Conforme | [README.md](../../README.md) e [AGENTS.md](../../AGENTS.md) apontam apenas para comandos e jobs existentes. |
| 5.19 | Conforme | Removido `new Date()` de `src/utils/finance.test.ts`; [rateLimit.test.ts](../../rateLimit.test.ts) usa relógio injetável; cobrado por [fences/tests-no-real-clock.test.ts](../../fences/tests-no-real-clock.test.ts). |

## 6. Autenticação — capítulo 06

| Nº | Resultado | Evidência / Observação |
|---|---|---|
| 6.1, 6.9 | Conforme | Tabela de decisões e limites conhecidos escritos em [SECURITY.md](../../SECURITY.md). |
| 6.2 | Não se aplica | App de finanças pessoais sem múltiplos papéis de autorização. |
| 6.3, 6.6 | Conforme | Tela de entrada direta; `POST /api/auth/login` retorna `401` genérico e executa `scryptSync` mesmo quando o utilizador não existe. |
| 6.5 | Conforme | Alteração de senha em [server.ts](../../server.ts) revoga todas as demais sessões do utilizador no Postgres. |
| 6.7 | Conforme | [rateLimit.ts](../../rateLimit.ts) aplica limite por `(identificador + IP/64)` com limpeza automática e cobertura em [rateLimit.test.ts](../../rateLimit.test.ts). |
| 6.8, 6.12 | Conforme | Senhas com `scryptSync` + `timingSafeEqual`; toda rota protegida valida sessão em `sessions` via `requireAuth`. |
| 6.10–6.11 | Não se aplica | Sem 2FA nem API pública com tokens de API (declarado em [SECURITY.md](../../SECURITY.md)). |
| 6.13–6.15 | Não se aplica / Não conforme | Sem toggles de segurança em tela nem estado de conta desativada; `6.4` (primeiro usuário via instalador) não se aplica a app com auto-registo. |

## 7. Multiempresa — capítulo 07

| Nº | Resultado | Evidência / Observação |
|---|---|---|
| 7.1–7.11 | Não se aplica / Decidido diferente | Produto pessoal single-user onde cada utilizador acessa exclusivamente o próprio `workspace` via `req.authUser.id` (decisão em [pedidos-de-decisao.md](pedidos-de-decisao.md)). |

## 8. Administração — capítulo 08

| Nº | Resultado | Evidência / Observação |
|---|---|---|
| 8.1, 8.3–8.4, 8.6–8.7, 8.10–8.12 | Não se aplica / Não conforme | App pessoal sem painel administrativo multi-equipa; `/api/health` responde `ok`, `database` e `storageConfigured` no terminal/HTTP. |
| 8.2, 8.5, 8.8–8.9 | Conforme | Transações, orçamentos e metas têm criação, edição e remoção com modal de confirmação ([src/components/ConfirmDialog.tsx](../../src/components/ConfirmDialog.tsx)) e mensagens explícitas em estado vazio/erro. |

## 9. Doutrinas — capítulo 09

| Nº | Resultado | Evidência / Observação |
|---|---|---|
| 9.1–9.11 | Não conforme | Doutrinas formais em `docs/doctrine/` e skill de doutrina ainda não criadas neste repositório. |

## 10. Contribuição — capítulo 10

| Nº | Resultado | Evidência / Observação |
|---|---|---|
| 10.1–10.13 | Não conforme / Não medido | Falta `LICENSE`, `CONTRIBUTING.md`, `GOVERNANCE.md`, `CREDITS.md`, `CODE_OF_CONDUCT.md` e proteção de ramo no GitHub; licença pendente em [pedidos-de-decisao.md](pedidos-de-decisao.md). |

## 11–15. Instalação, Distribuição, Método, Site e Equipe (nível F/L)

| Seção | Resultado | Observação |
|---|---|---|
| 11–12 (Instalação e Distribuição) | Decidido diferente / Não conforme | Produto roda diretamente com Node + Neon em vez de instalador Docker em VPS; decisão aberta em [pedidos-de-decisao.md](pedidos-de-decisao.md). |
| 13 (Método) | Parcial / Não conforme | Auditoria e ADR iniciados nesta sessão; faltam revisão fria independente e uso guiado registado. |
| 14–15 (Site e Equipe, nível L) | Não se aplica / Não conforme | Aplicam-se apenas antes da divulgação pública (nível L). |

---

## Para a Fábrica

- **Observação:** Em produtos pessoais single-user baseados em PaaS/Neon (sem multi-organização e sem VPS Docker), quase metade dos itens de `conformidade.md` (seções 7, 11, 12 e parte da 8) vira `Não se aplica` ou `Decidido diferente`. Um perfil leve na régua para "app pessoal / SaaS gerido" evitaria ruído na contagem.
