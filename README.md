# FinTrack (FinPro) — Finanças Pessoais Moçambique

Aplicação web full-stack para controlo de finanças pessoais em **Meticais (MZN)** e **USD**, com suporte a carteiras móveis (M-Pesa, e-Mola, mKesh), bancos, orçamentos mensais, metas, alertas em tempo real e exportação CSV/PDF.

## Estado das Capacidades (O que Foi Provado)

| Capacidade | Estado | Evidência / Como Conferir |
|---|---|---|
| Cálculos financeiros, moedas MZN/USD, orçamentos, alertas e CSV/PDF | Provado por testes unitários | `npm run test` ([src/utils/finance.test.ts](src/utils/finance.test.ts)) |
| Autenticação, sessões em Postgres e proteção contra força bruta por IP/64 | Provado por testes + execução local | [rateLimit.test.ts](rateLimit.test.ts) e `POST /api/auth/login` em [server.ts](server.ts) |
| Persistência em Neon Postgres com migrations por carimbo de tempo | Provado em banco real | [db.ts](db.ts), [migrations/20261126143000_initial_schema.sql](migrations/20261126143000_initial_schema.sql) |
| Upload de avatar para Neon Object Storage (S3) com URL assinada | Provado contra bucket `financa` | [storage.ts](storage.ts) |
| Integração contínua (CI) no GitHub Actions | Configurado, ainda não executado no GitHub | [.github/workflows/ci.yml](.github/workflows/ci.yml) |

## Pré-requisitos e Instalação Local

1. Instale as dependências:
   ```powershell
   npm install
   ```
2. Copie `.env.example` para `.env` e preencha `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `SESSION_SECRET` e (opcionalmente, para avatares em S3) as variáveis `AWS_*` + `S3_BUCKET`:
   ```powershell
   Copy-Item .env.example .env
   ```
3. Inicie o servidor de desenvolvimento (`http://localhost:3000`):
   ```powershell
   npm run dev
   ```

## Verificação (`npm run check`)

```powershell
npm run check
```

Executa em sequência: `tsc --noEmit`, testes unitários (`src/utils/finance.test.ts` e `rateLimit.test.ts`), cercas de conformidade em `fences/` e `vite build`.

## App Mobile (PWA, Android APK e iOS)

- **PWA (Android e iPhone sem loja):** Acesse `https://fin-pro-livid.vercel.app/` no telemóvel e toque em **Instalar app** (Chrome no Android) ou **Partilhar → Adicionar ao Ecrã Principal** (Safari no iPhone).
- **Android (`.apk` instalável):** Cada push em `main` executa o workflow [android-apk.yml](.github/workflows/android-apk.yml) no GitHub Actions e gera o artefato **`FinTrack-Android-APK`** (`app-debug.apk`).
- **iOS (Xcode no macOS):**
  ```powershell
  npm run build:mobile
  npx cap add ios
  npx cap sync ios
  npx cap open ios
  ```

## Documentação e Conformidade

- Visão e antiobjetivos: [VISION.md](VISION.md)
- Documento de autoridade para desenvolvimento: [AGENTS.md](AGENTS.md)
- Segurança e limites conhecidos: [SECURITY.md](SECURITY.md)
- Decisão de arquitetura (Neon Postgres + S3): [docs/decisions/0001-neon-postgres-e-object-storage.md](docs/decisions/0001-neon-postgres-e-object-storage.md)
- Auditoria pela Fábrica DeskLabs: [docs/fundacao/conformidade-2026-11-26.md](docs/fundacao/conformidade-2026-11-26.md)
- Pedidos de decisão ao dono: [docs/fundacao/pedidos-de-decisao.md](docs/fundacao/pedidos-de-decisao.md)
