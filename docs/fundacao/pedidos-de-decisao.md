# Pedidos de Decisão ao Dono

## Decisão 1: Qual licença open source o projeto adota?

**Quem decide:** dono do projeto
**O que está parado esperando:** publicação pública do repositório e criação de `LICENSE` / `GOVERNANCE.md` / `CONTRIBUTING.md`.

### Opções

- **A.** Licença MIT. Custo: qualquer pessoa pode reutilizar o código inclusive em produtos fechados sem devolver melhorias.
- **B.** Licença AGPL-3.0. Custo: reduz adoção por terceiros que não queiram abrir código derivado em SaaS.
- **C.** Não definir licença (repositório privado/proprietário). Custo: não cumpre os itens open source da Fábrica (seção 10).

### Recomendação

**A (MIT)** se o objetivo for adoção rápida e contribuições simples, ou **C** se o produto for comercial fechado.

### Se ninguém responder em 7 dias, vale: Opção C (manter privado até decisão explícita).

### Não medido

Não foi conferido se já existe licença definida na organização `deepworks23-rgb` no GitHub.

---

## Decisão 2: O projeto terá parceiro de VPS e instalador próprio em contêineres, ou continuará como app gerido em PaaS + Neon?

**Quem decide:** dono do projeto
**O que está parado esperando:** itens das seções 2, 11 e 12 de conformidade (guia de custos, kit de instalação em VPS, imagens Docker).

### Opções

- **A.** Manter modelo atual (Node/Express + Vite + Neon Postgres/S3). Custo: exige conta Neon e não sobe em instalação limpa offline (divergência registada em [0001-neon-postgres-e-object-storage.md](../decisions/0001-neon-postgres-e-object-storage.md)).
- **B.** Construir kit de instalação Docker + Postgres local para VPS (modelo completo da Fábrica). Custo: esforço alto de empacotamento, proxy reverso, backup e atualizador.
- **C.** Não fazer agora (manter A e registrar seções 11–12 como decididas diferente). Custo: impossibilidade de instalação em uma linha em qualquer VPS.

### Recomendação

**C** no curto prazo, porque o produto já está funcional em Node + Neon e o foco atual é uso pessoal em Moçambique, não distribuição multi-servidor.

### Se ninguém responder em 7 dias, vale: Opção C.

### Não medido

Não foi medida memória/disco numa VPS real nem testada a criação de imagens Docker multi-arquitetura.

---

## Decisão 3: O design system atual deve eliminar todas as cores `amber` e hex literais nos 6 componentes de UI?

**Quem decide:** dono do projeto
**O que está parado esperando:** conformidade estrita dos itens 4.3 (tokens semânticos) e 4.5 (fontes locais versionadas).

### Opções

- **A.** Criar tokens semânticos `--color-warning` / `--color-chart-*` em `src/index.css` e substituir os valores `amber-*` e `#...` em `DashboardScreen.tsx`, `ReportsScreen.tsx`, `BudgetsScreen.tsx`, `ConfirmDialog.tsx`, `Header.tsx` e `Overlays.tsx`, além de empacotar fontes localmente. Custo: alteração visual leve e aumento do bundle estático com arquivos de fonte.
- **B.** Manter como está por agora e aceitar a divergência documentada. Custo: dependência de Google Fonts CDN para carregar tipografia e ícones (`Material Symbols Outlined`) e mistura de cores fora de `@theme`.

### Recomendação

**A** antes de um lançamento público, começando pelos tokens semânticos de alerta (`warning`).

### Se ninguém responder em 7 dias, vale: Opção B (mantém aparência atual sem quebrar ícones offline).

### Não medido

Não foi testada a renderização offline sem acesso a `fonts.googleapis.com`.
