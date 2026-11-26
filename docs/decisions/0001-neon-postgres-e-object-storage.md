# 0001: Usar Neon Postgres e Neon Object Storage (S3) para persistência

- **Estado:** aceita
- **Data:** 2026-11-26
- **Quem decidiu:** dono do projeto (credenciais fornecidas) + construtor da fundação

## Contexto

O projeto nasceu com persistência em arquivo JSON local (`.data/fintrack-db.json`), que não suporta múltiplas instâncias, não oferece garantias transacionais e armazena imagens de perfil em base64 dentro do próprio JSON. O método da Fábrica (Lição A4) alerta que serviços em nuvem trazem dependência de rede, cota e latência, mas o dono solicitou explicitamente a ligação ao Neon Postgres e ao Neon Object Storage (bucket `financa`).

## Decisão

Adotar **Neon Postgres** (via `pg` com URL pooled para a aplicação e URL direta para migrations em [db.ts](../../db.ts)) como banco de dados principal e **Neon Object Storage** (via `@aws-sdk/client-s3` com `forcePathStyle: true` em [storage.ts](../../storage.ts)) para armazenamento de avatares no bucket `financa`, mantendo fallback para `avatar_data_url` caso as credenciais S3 não estejam presentes.

## Alternativas descartadas

| Alternativa | Por que não |
|---|---|
| Manter arquivo JSON local (`.data/fintrack-db.json`) | Sem concorrência segura, sem transações ACID e acoplado ao disco local. |
| Postgres local em contêiner na VPS | Exigiria provisionamento e manutenção de VPS/Docker antes do pedido atual do dono. |

## Consequências

**Boas:**

- Persistência relacional com transações, chaves estrangeiras e migrations rastreadas em `schema_migrations`.
- Imagens de perfil servidas via URLs assinadas (`getSignedUrl`) fora da tabela principal.

**Custos:**

- O sistema passa a exigir `DATABASE_URL` acessível na rede para subir (diverge da regra 3.2 da Fábrica de subir sem conta externa).
- Sujeito a limites de cota/compute do plano Neon e latência de rede para `us-east-2`.
- Requer manutenção segura das variáveis em `.env` fora do Git.

## Quando rever

Se o custo ou latência do Neon no plano atual atingir limites em produção, ou se o dono decidir empacotar o produto para instalação autónoma em VPS própria com Postgres local.
