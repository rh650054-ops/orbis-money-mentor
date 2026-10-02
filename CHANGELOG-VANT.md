# CHANGELOG — VANT

Registro do que mudou no app, em português, do mais novo pro mais antigo.

## 02/10/2026 — Open Finance, etapa 2: Vant Pro, paywall e selo

**O que mudou pro vendedor**
- **Paywall do Vant Pro** (aba Vender, pra quem não é Pro): Anual R$ 359,90 já marcado (R$ 29,99/mês, economiza R$ 238), Mensal R$ 49,90, tabela "Os dois têm / Só no Pro" com 7 benefícios, botão direto pro checkout da Hotmart.
- **Tela Vant Pro** reorganizada: seu nome com o selo em cima, bancos em linhas, "Hoje pelos seus bancos" (Pix do dia), carteiras embaixo com "não dão selo". Pro sem banco vê uma tela só pra ligar o banco.
- **Selo estilo Instagram** (estrela azul com check) ao lado do nome: ranking, pódio, perfil e escolha de oponente do X1.
- **Card do calote** no fim do DEFCON: só aparece com calote de verdade, embaixo do "como entrou". Com banco ligado diz **"Ainda não caiu"** (Pix atrasado entra até 23:59) em vez de chamar de calote.
- **Ranking misto só pra Pro**: o Pix do banco substitui o lançado apenas pra quem tem Vant Pro ativo. Hoje: Rick e Mohamed.

**Por dentro**
- `hotmart-webhook` v41: ofertas `5y86n311` (Pro mensal, 30 dias) e `6vkxbh8c` (Pro anual, 365 dias) ligam o Pro via `pro_conceder`; cancelamento/estorno/chargeback chamam `pro_revogar`. O anual deixou de bloquear em 33 dias. Publicado antes do app.
- Checkout do Pro leva só o `sck` do parceiro (cupom trocaria a oferta por um código que o webhook não conhece como Pro).
- Migration `20261002210000_ranking_misto_so_pro.sql` (aplicada 02/10 ~18h45): CTE `bancos` filtra `orbis_pro_ativo(user)`. Comparação antigo × novo, todos os vendedores, semana e mês, ao vivo e extrato: só Rick e Mohamed mudam.
- `SeloVerificado` (AvatarRanking.tsx) virou SVG da estrela; `PaywallPro.tsx` novo; `Verificar.tsx` reescrita nos três estados.
- App: PR #21 (merge `ab849a8`), deploy de produção na Vercel READY.
- Ficou pra etapa 3: Corre/Casa por banco (ainda não tem onde gravar).

## 02/10/2026 — Open Finance, etapa 1: Pix travado

**O que mudou pro vendedor**
- **DEFCON**: quem tem banco ligado vê uma linha discreta **"Pix na conta R$ X · hh:mm"** durante o turno.
- **Relatório do dia**: o Pix vem **travado do banco** (cadeado, não dá pra editar), card **"Vai pro ranking · só Pix conferido"** e seis métricas do dia.
- **Ranking misto** (vale a partir de 02/10/2026): quem tem banco ligado conta **só o Pix que caiu no banco** naquele dia; quem não tem continua como antes (o que lançou no DEFCON). Se o banco cair e não houver Pix lido no dia, o dia volta a usar o lançado.
- O vendedor pode fechar o app: o servidor lê o banco de hora em hora, então o Pix das 21h ainda entra no dia certo.
- Transferência entre contas do próprio vendedor (mesmo CPF) não conta como venda.

**Por dentro**
- Migration `20261002200000_pix_travado.sql` (aplicada 02/10 ~16h10): colunas `is_pix`, `transacted_at`, `own_transfer` em `auto_detected_sales`; função interna `banco_pix_por_dia`; `banco_pix_do_dia` e `get_weekly_ranking_verified` reescritas com as mesmas assinaturas. O dia do Pix é o dia em Brasília.
- Importador único `supabase/functions/_shared/pluggy-entradas.ts`. `pluggy-sync` (v11) passou a usá-lo; `pluggy-hora` (v1, nova, `verify_jwt = false`, protegida pelo cabeçalho `x-orbis-cron` com o token de `painel_tokens`, igual ao `mp-sync`). `pluggy-item` e `pluggy-webhook` não mudaram.
- Cron (`20261002201000_pluggy_hora_cron.sql`): `pluggy-hora` no minuto 7, das 8h às 23h BRT; `pluggy-fecha-dia` às 0h02 BRT (3 min antes da liquidação do X1).
- App: PR #20 (merge `2ff4515`), deploy de produção na Vercel READY.
- Conferência no ar: 2 jobs no `cron.job`; disparo manual da `pluggy-hora` → `{conexoes: 3, lidas: 73, pix: 84, pedidos: 2, falhas: 0}`; ranking de outubro: só Rick (150 → 170) e Mohamed (1.677 → 1.433) mudaram por causa da regra nova.
- Pendências conhecidas: a conexão antiga **MeuPluggy** do Rick (de 10/09, sandbox) responde 404 `ITEM_NOT_FOUND` na Pluggy a cada leitura — inofensivo, mas vale marcar como `deleted`. O contador `pix` do log conta também créditos fora da janela de datas (por isso pode passar de `lidas`).

## 02/10/2026 — Sala de Competição: versões A e B unificadas

**O que mudou pro vendedor**
- Arena: dois botões lado a lado, **DESAFIAR 1×1** e **ABRIR SALA**.
- **SUAS LUTAS DE HOJE · N ROLANDO** mostra tudo de uma vez: chamados pra sala, salas em que você está e todos os X1 ativos do dia.
- Salas abertas da galera aparecem no feed **LUTAS AO VIVO** com o chip **ENTRAR**.
- Novo modo **Chamar mais** (`/x1/sala/:id/chamar`): grade de vendedores sem quem já está na sala ou já foi chamado, com botão de **link** pra copiar/compartilhar.
- Placar da sala: saldo da carteira no topo, linha treme quando alguém vende, quem te chamou, lista de chamados que ainda não entraram, card "VOCÊ LEVOU R$ X" quando a sala fecha, confirmação antes de sair.
- Textos corrigidos: "1 golpe" no singular; quando você é o 2º, a frase não repete a mesma diferença duas vezes.

**Por dentro**
- Uma lib só: `src/components/x1/x1-sala-lib.ts` (a `sala-lib.ts` da versão B não entrou). Ganhou `horaBRT`, `aindaEntra`, `aindaSai`; erro de rede agora aparece como mensagem em vez de "sala não existe"; sala fechada usa a posição gravada pelo banco.
- Telas `X1.tsx`, `X1Sala.tsx`, `X1SalaNova.tsx` vieram da versão B, adaptadas pra lib da A (+ rótulos de acessibilidade da A).
- Rota nova `/x1/sala/:id/chamar` no `router.tsx`.
- Migration única `20261002180000_x1_sala.sql`: texto alinhado com o que já está no banco (`coalesce(ver,false)` / `coalesce(bal,0)` em `x1_sala_criar` e `x1_sala_entrar`). **Já aplicada — não reaplicar.** A `20261002120000_x1_salas.sql` da B não entrou.
- Testes: 5 passando em `x1-sala-lib.test.ts` (novo: posição do banco vale na sala fechada). `tsc`: 67 erros, igual à base, nenhum nos arquivos da Sala. `eslint`: 0 erros.
