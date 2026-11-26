# AGENTS.md — Documento de Autoridade do FinTrack (FinPro)

Este é o único documento de autoridade do repositório para humanos e assistentes de código.

## Stack e Arquitetura

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4 ([src/App.tsx](src/App.tsx), [vite.config.ts](vite.config.ts)).
- **Backend:** Express 4 em [server.ts](server.ts).
- **Banco de dados:** Neon Postgres via `pg` ([db.ts](db.ts)) com migrations SQL por carimbo de tempo em [migrations/](migrations/20261126143000_initial_schema.sql).
- **Armazenamento de objetos:** Neon Object Storage (compatível com S3) via `@aws-sdk/client-s3` em [storage.ts](storage.ts).
- **Segurança de autenticação:** Limitador de tentativas por identificador + IP/64 em [rateLimit.ts](rateLimit.ts).

*(As versões exatas das dependências moram em [package.json](package.json).)*

## Comandos Principais

```powershell
npm install       # instala dependências
npm run dev       # inicia Express + Vite em http://localhost:3000
npm run check     # executa lint, testes unitários, cercas e build de produção
```

## Convenções e Como São Cobradas

1. **Um caminho único de schema:** Toda alteração de tabela nasce como migration `.sql` em `migrations/` com prefixo `YYYYMMDDHHMMSS_`. Cobrado por [fences/migrations-are-timestamped-and-unique.test.ts](fences/migrations-are-timestamped-and-unique.test.ts).
2. **Testes determinísticos:** Nenhum teste unitário usa `new Date()` sem timestamp explícito; temporizadores usam relógio injetável. Cobrado por [fences/tests-no-real-clock.test.ts](fences/tests-no-real-clock.test.ts) e [rateLimit.test.ts](rateLimit.test.ts).
3. **Zero segredos rastreados:** Chaves reais (`nak_live_`, `nsk_live_`, `npg_`, URLs com senha) ficam apenas em `.env` (ignorado pelo Git). Cobrado por [fences/no-secrets-in-tracked-files.test.ts](fences/no-secrets-in-tracked-files.test.ts).
4. **Links de documentação válidos:** Todo link relativo em `.md` aponta para arquivo existente. Cobrado por [fences/docs-point-to-existing-files.test.ts](fences/docs-point-to-existing-files.test.ts).
5. **Cercas governadas:** Toda cerca em `fences/` declara `@owner`, `@reason` e `@review-date`. Cobrado por [fences/fences-have-owner-and-review-date.test.ts](fences/fences-have-owner-and-review-date.test.ts).
6. **Limites de autenticação:** Toda rota autenticada valida o token no servidor (`requireAuth`), e a troca de senha revoga as demais sessões. Cobrado na revisão de [server.ts](server.ts).

## Antipadrões Registrados

- **Mudar schema direto no código sem migration:** Diverge bancos existentes do código novo (origem: Lição A1/A2 da Fábrica).
- **Rate limit por e-mail sem IP ou por IPv6 completo:** Permite bloquear terceiros ou contornar o limite girando hosts num `/64` (origem: Lição K27 da Fábrica).
- **Testes com `new Date()` solto:** Quebram conforme o relógio/fuso da máquina (origem: Lição D1 da Fábrica).

## Definição de Pronto (Definition of Done)

### O que o CI reprova (`npm run check`)
- Erros de tipo (`npm run lint`).
- Falha em testes unitários (`npm run test`).
- Violação de qualquer cerca (`npm run fences`).
- Falha no build de produção (`npm run build`).

### O que o CI não vê (conferir na revisão)
- Fluxos de UI e responsividade mobile no navegador.
- Coerência de tokens semânticos em novos componentes (ver auditoria em [docs/fundacao/conformidade-2026-11-26.md](docs/fundacao/conformidade-2026-11-26.md)).
- Validação de credenciais reais em `.env` contra Neon Postgres e bucket S3.
