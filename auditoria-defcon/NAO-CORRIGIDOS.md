# DEFCON 4 — NÃO corrigidos (ainda) — 07/07/2026

Achados reais que **deixei de corrigir de propósito** porque exigem mudança de banco de
dados ou refatoração do caminho de sincronização de dinheiro — arriscado durante o
lançamento com dinheiro real no ar. Cada um traz o risco atual e a correção recomendada.
Nenhum destes perde DINHEIRO; os efeitos são em contadores/estoque secundários.

---

## A. [ALTO] Contagem de vendidos/estoque (`incrementSold`) não é atômica
**Arquivo:** `src/hooks/useDefconLoadout.ts` (`incrementSold`, linhas ~83 e ~137-153)

**Risco:** `qty_sold` e o custo de mercadoria (`daily_sales.cost`) são lidos do estado em
memória e reescritos (read-modify-write). Dois toques MUITO rápidos no mesmo produto (ou
duplo-toque) antes do `load()` terminar podem ler o mesmo valor e um sobrescrever o outro
→ "vendidos X/Y" e CMV contados **a menos**. Não afeta o faturamento (esse vem dos blocos),
só a contagem de unidades e o custo.

**Por que não corrigi agora:** o fix correto é um incremento **atômico no servidor** (RPC
`increment` ou `UPDATE ... SET qty_sold = qty_sold + 1`), que é mudança de banco. Fazer no
meio do lançamento arrisca o fluxo de estoque.

**Recomendação:** criar RPC `defcon_increment_sold(product_id, qty)` que faz o incremento
atômico de `qty_sold`, `products.stock_quantity` e `daily_sales.cost` numa transação. Baixa
urgência (frequência de duplo-toque no mesmo produto é baixa).

---

## B. [MÉDIO] Vendas feitas 100% OFFLINE podem perder a CONTAGEM (não o dinheiro)
**Arquivo:** `src/hooks/useDefconChallenge.ts` (`addSale` / `addApproach` / `queueBlockOffline`)

**Como funciona hoje:** offline, `addSale` enfileira só o **estado de dinheiro do bloco**
(`hourly_goal_blocks`) via `queueBlockOffline` — que é idempotente e **preserva o dinheiro**.
Mas `saveBlockApproaches` (que grava `challenge_blocks.approaches_count` e `sales_count`)
fica **depois** do early-return de offline, então a *contagem* de vendas/abordagens daquele
toque offline não é enfileirada.

**Auto-cura parcial:** como o estado de contagem é otimista (cumulativo em memória), o
**próximo toque ONLINE no mesmo bloco** grava a contagem cheia (inclui os offline). Ou seja,
só há perda permanente se o vendedor fizer vendas offline num bloco e **nunca** fizer uma
venda online nesse mesmo bloco (ex.: encerrar o dia ainda offline).

**Risco real:** dinheiro do dia = correto. Contadores "vendas/abordagens" e taxa de conversão
podem ficar subestimados só no cenário "bloco inteiro offline até encerrar".

**Recomendação:** estender o registro do `queueBlockOffline` pra carregar também
`session_id`, `block_index`, `approaches_count`, `sales_count`, e no `syncSaleRecord`
(offline-sync) fazer também o upsert em `challenge_blocks`. Requer testar o caminho de sync
com cuidado — por isso ficou de fora agora.

---

## C. [MÉDIO] Notificação da tela bloqueada: "venda rápida" sem valor + contadores defasados
**Arquivos:** `src/hooks/useDefconQuickNotification.ts` + `public/sw.js`

**Sintoma:** a notificação de ação rápida é emitida UMA vez ao ativar, com `quickValue` do
momento (0 antes da 1ª venda). O effect não depende de `quickValue`, então nunca reemite →
o botão "Venda" da tela bloqueada sempre abre o app em vez de registrar direto. E os
contadores na notificação só sobem via toque na própria notificação — vendas feitas dentro
do app não atualizam o número exibido.

**Por que não corrigi agora:** reemitir a notificação toca no comportamento delicado de
duplicação no iOS (o iOS empilha em vez de substituir pela tag). Mexer nisso sem um device
iPhone real pra testar arrisca gerar spam de notificação no bolso do vendedor.

**Recomendação:** incluir `quickValue` nas deps do effect 4 e reemitir `orbis-defcon-show`
quando ele passar de 0→>0, com throttle e SÓ no Android (que substitui pela tag). Testar em
iPhone real antes de ligar no iOS.

---

## D. [BAIXO] "Tempo trabalhado" no relatório de bloco mostra `blockIndex+1 h` fixo
**Arquivo:** `src/components/defcon/DefconBlockReport.tsx:255`

**Sintoma:** o rótulo diz "Tempo trabalhado" mas exibe o índice do bloco+1 como horas
cheias (ex.: "2h" no 2º bloco mesmo tendo rodado poucos minutos). Vai também pra arte
compartilhada.

**Por que não corrigi agora:** precisa plumbar os minutos reais decorridos até o
componente (o EndScreen já faz isso com `workedMinutes`, mas o BlockReport não recebe).
Baixo impacto; fica pra um passe de UX.

---

## E. [BAIXO] Código morto grande no EndScreen (share interno não usado)
**Arquivo:** `src/components/defcon/DefconEndScreen.tsx` (~230 linhas: buildCanvas/openShare/
handleShare/previews)

O mecanismo interno de compartilhamento não é referenciado no JSX — o share real usa
`<DefconShareCarousel>`. É código morto que confunde manutenção (e tem 3 templates vs 5 no
carousel real). Recomendo remover num passe de limpeza dedicado (não removi agora pra não
misturar limpeza grande com correções de bug num commit só).

---

## F. [BAIXO] Textos fixos e read-modify-write não-atômicos no DefconHub
- `DefconStartScreen`: "Blocos × 60min" e "Pausa 5 min" são hardcoded — se `BLOCK_DURATION`
  mudar, o card mente. Cosmético.
- `DefconHub` (`handleAddCost`, `LatePixSection`, `savePayEdit`): escritas read-modify-write
  em `daily_sales` como o item A, mas de baixíssima concorrência (ações manuais isoladas).

---

## Resumo de prioridade (quando houver tempo/estabilidade)
1. **A** — incremento atômico de estoque/CMV (RPC).
2. **B** — persistir contagem de vendas/abordagens feitas offline.
3. **C** — venda rápida da tela bloqueada com valor (testar em iPhone).
4. **D, E, F** — polimento/limpeza.

Nenhum destes perde dinheiro do usuário. O núcleo financeiro do DEFCON (blocos →
`daily_sales` → ranking) está com upserts atômicos corretos e idempotência offline no
dinheiro.
