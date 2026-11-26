# SECURITY.md — Política e Decisões de Segurança

## Tabela de Decisões de Autenticação e Sessão

| Mecanismo | Estado Atual | Onde Mora |
|---|---|---|
| Hash de senha | `crypto.scryptSync` com salt aleatório de 16 bytes + `timingSafeEqual` | [server.ts](server.ts) |
| Sessões | Token aleatório assinado via HMAC-SHA256 (`SESSION_SECRET`) e validado na tabela `sessions` a cada requisição (`requireAuth`) | [server.ts](server.ts), [migrations/20261126143000_initial_schema.sql](migrations/20261126143000_initial_schema.sql) |
| Anti-enumeração no login | Resposta genérica `401` + execução de `scryptSync` mesmo quando o utilizador não existe | [server.ts](server.ts) |
| Proteção contra força bruta | `LoginRateLimiter` por `(identificador + IP/64)` com janela de 15 min, limpeza automática e resposta `429` + `Retry-After` | [rateLimit.ts](rateLimit.ts), [rateLimit.test.ts](rateLimit.test.ts) |
| Troca de senha | Exige senha atual e revoga todas as outras sessões ativas do utilizador | [server.ts](server.ts) |
| Cabeçalhos HTTP de segurança | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` | [server.ts](server.ts) |
| Varredura de segredos | Cerca automática bloqueia tokens `nak_live_`, `nsk_live_`, `npg_`, chaves privadas e URLs com senha em arquivos rastreados | [fences/no-secrets-in-tracked-files.test.ts](fences/no-secrets-in-tracked-files.test.ts) |
| **Segundo fator (2FA / MFA)** | **Não existe** (planeado apenas se houver pedido do dono) | — |
| **Recuperação de senha por e-mail/SMS** | **Não existe** na interface atual | — |
| **Tokens públicos de API** | **Não existe** (apenas sessões Bearer de login) | — |

## Limites Conhecidos

- O `LoginRateLimiter` atual vive em memória do processo Node (`Map`). Em múltiplas réplicas simultâneas sem sticky sessions, cada instância mantém sua própria contagem.
- O token Bearer da sessão é guardado em `localStorage` no frontend ([src/App.tsx](src/App.tsx)) e revalidado no servidor via `GET /api/auth/me` ao recarregar a página (sendo limpo automaticamente se estiver expirado ou revogado).
- A aplicação ainda não possui papéis multi-organização; cada utilizador acessa exclusivamente o seu próprio `workspace` via `req.authUser.id`.

## Como Reportar Vulnerabilidades

Não abra issues públicas com detalhes de falhas de segurança ou credenciais. Reporte diretamente aos mantenedores do repositório privado/organização antes de qualquer divulgação.
