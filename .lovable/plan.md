
## Remodelar /daily-goals → Hub DEFCON 4

A aba "Ritmo" deixa de existir como hoje (blocos de hora, planejamento ritmo). Vira o **Hub DEFCON 4**: ponto único pra ver a meta, iniciar o desafio e ver o resumo do dia. Toda a inteligência de bloco/hora migra pra dentro do próprio fluxo do DEFCON 4 (já existe).

---

### 1. Nova tela `/daily-goals` (DEFCON 4 Hub)

Estrutura única (mobile-first, dark cinematic):

```
[ Header: DEFCON 4 — Modo Desafio ]

[ Card META DO DIA — grande, dourado ]
  R$ XXX,XX   |   ▓▓▓▓▓░░ 62%
  Vendido: R$ ... · Falta: R$ ...

[ BOTÃO INICIAR DEFCON 4 — gigante, vermelho pulsante ]
  (vai pra /defcon)

[ Seção: Produtos de hoje ]  ← NOVA
  "O que você vai vender hoje?"
  Lista de produtos ativos (do estoque) com input de qty
  Ex: ☑ Kit Fine    [15]
      ☑ Tortinha    [12]
      ☐ Brigadeiro
  Salva em nova tabela `defcon_daily_loadout`
  Esse loadout alimenta o seletor de produto durante a venda no DEFCON 4
  e debita estoque automaticamente

[ Resumo do dia ]  (só aparece se já vendeu hoje)
  3 cards bonitos:
   💵 Dinheiro  R$ ...
   💳 Cartão    R$ ...
   📱 Pix       R$ ...
  + Total · Lucro · Calotes

[ Vendas por hora ]  (collapse, reutiliza HourlyBreakdown)

[ Custos do dia ] ← NOVO inline
  Input rápido: "Gasto de mercadoria/transporte hoje"
  Sub-link: "Ver custos 3d / 7d" → navega pra /history ou modal

[ Ações ]
  📄 Baixar PDF do dia  (com links wa.me dos clientes)
  📊 Ver histórico completo →
```

Remove dessa tela: planejamento de horas, mood, criação de blocos manual.

### 2. Loadout de produtos do dia

- Nova tabela `defcon_daily_loadout` (user_id, date, product_id, qty_initial, qty_sold)
- Editada no hub antes de iniciar
- Durante DEFCON 4, ao clicar "+" pra vender:
  - Se loadout tem 2+ produtos → mostra seletor rápido (cards Kit Fine / Tortinha)
  - Se loadout tem 1 produto → pula seletor, vai direto pro valor
  - Se loadout vazio → comportamento atual (livre)
- Ao confirmar venda → incrementa qty_sold, debita `products.stock_quantity`
- Mostra contador "Restam X" no card do produto durante o desafio

### 3. PDF do dia com WhatsApp

- Função client-side com `jspdf` (já no projeto? checar; senão `bun add jspdf`)
- Conteúdo:
  - Cabeçalho com data + nickname + total
  - Resumo por método (dinheiro/cartão/pix)
  - Tabela de vendas por hora
  - Lista de clientes anotados (de `defcon_clients`) com link `https://wa.me/55XXXXXXXXX` clicável
  - Custos do dia
- Botão "Baixar PDF" no hub

### 4. Custos rápidos

- Reusa `personal_expenses` (já existe) com `category='mercadoria'`
- Input inline no hub salva direto
- Agregação 3d/7d já fica disponível em /history (avisar usuário)

### 5. DEFCON 4 — pequenos ajustes

- `DefconRunning`: ao adicionar venda, se houver loadout com 2+ produtos, abrir mini-seletor antes do valor
- `DefconEndScreen`: card extra de "Parabéns! Você bateu Xx a meta" se total > meta
- Estoque debitado via `product_sales_log` + update em `products`

---

### Mudanças técnicas

- **Migration**: criar `defcon_daily_loadout` (id, user_id, date, product_id, qty_initial, qty_sold, created_at) com RLS por user_id e unique(user_id, date, product_id)
- **Novo componente** `src/components/defcon/DefconHub.tsx` — substitui o conteúdo principal de `/daily-goals`
- **Novo componente** `src/components/defcon/DefconLoadoutSelector.tsx` — seleção de produtos no hub
- **Novo componente** `src/components/defcon/DefconSaleProductPicker.tsx` — seletor rápido na venda
- **Novo hook** `src/hooks/useDefconLoadout.ts`
- **Novo util** `src/utils/generateDefconDayPDF.ts` (usa jspdf)
- **Edit** `src/pages/DailyGoals.tsx` — vira shell que renderiza DefconHub
- **Edit** `src/components/defcon/DefconRunning.tsx` — integrar product picker no fluxo "adicionar venda"
- **Edit** `src/components/defcon/DefconEndScreen.tsx` — celebração ao bater meta
- **Edit** `useDefconChallenge` — `addSale(amount, productId?)` debita loadout/estoque

### Preservado
- Visual identity (dark, #F4A100, #6B21A8, 12px radius)
- Fluxo DEFCON 4 existente (start/running/break/end)
- Tabelas existentes: `daily_sales`, `defcon_clients`, `hourly_goal_blocks`, `products`

### Fora do escopo desta entrega
- Custos 3d/7d em nova tela (só link pro /history existente)
- Edição avançada do loadout durante o desafio (só visualização)

Confirma que posso seguir?
