# CHANGELOG — VANT

Registro do que mudou no app, em português, do mais novo pro mais antigo.

## 03/10/2026 — Conta de trabalho × reserva + limite de bancos do Pro

**O que mudou pro vendedor**
- **Pra que serve cada conta?** Com 2 ou mais bancos ligados, Finanças pergunta uma vez: cada banco é **Trabalho** (fluxo de caixa do corre) ou **Reserva** (onde guarda). Dá pra mudar depois em Vant Pro → Gerenciar conexões. Sem precisar desconectar nada.
- **Quanto você tem agora** mostra o total e, embaixo, **💼 Fluxo de caixa** e **🛟 Reserva** separados. O fôlego continua contando tudo que você tem.
- **Limite de bancos:** o Vant Pro inclui 1 banco; cada banco a mais custa **+R$ 10/mês**. Quem tenta ligar o segundo sem ter contratado vê a tela "Mais um banco: +R$ 10 por mês" e o banco nem abre. Rick e Mohamed são isentos. O link da oferta na Hotmart ainda falta (até lá a tela pede pra falar com o suporte).

**Por dentro**
- Migration `20261003150000_conta_trabalho_reserva.sql`: `bank_connections.papel`, tabela `bancos_extra` (extras comprados + isento), `open_finance_limite()`, `financas_home()` com `saldo_trabalho`, `saldo_reserva`, `precisa_papel`, `contas`.
- Segurança: `bank_connections` só aceita INSERT do servidor (antes o app conseguia criar uma conexão sem banco e ganhar o selo).
- `pluggy-connect-token` v16: confere o limite antes de abrir o banco.

## 03/10/2026 — Cobrador completo (mockup cobrador.png)

**O que mudou pro vendedor**
- **Quem te deve**: numa lista só, quem levou hoje e não pagou + as cobranças abertas dos últimos 30 dias (esperando pagar, Pix vencido, hora de cobrar de novo).
- **COBRAR OS N DE UMA VEZ**: com 2 ou mais devendo, um toque cria todos os Pix na conta do vendedor e abre uma fila: "mandar pro José", "mandar pra Maria"… (o WhatsApp abre uma conversa por toque). Quem não tem WhatsApp ganha "copiar link". O mesmo botão aparece no card do fim do DEFCON.
- **Você recuperou R$ X esse mês** · "2 de 3 cobranças pagas", em cima da lista e na tela de "pagou".
- **Cobrar de novo daqui a 2 dias**: na cobrança esperando; no dia, ela sobe pro topo da lista com "hora de cobrar de novo".
- Pix vencido: tocar na pessoa monta uma cobrança nova com os mesmos dados.
- Depois que alguém paga: **VER QUEM AINDA DEVE** (antes o botão voltava pra mesma tela).

**Por dentro**
- Migration `20261003130000_cobrador_completo.sql`: coluna `cobrancas.lembrar_em` e `cobrancas_painel()`.
- `components/cobranca/QuemTeDeve.tsx` (Resumo, Lista, Fila, Lembrete) + teste.
## 03/10/2026 — Pix no DEFCON mais rápido

- Rick (11h41): o Pix de R$ 20 já tinha caído no C6 e o DEFCON mostrava "Pix na conta R$ 0 · 11:37".
- Causa: a Pluggy só libera 1 atualização por hora por banco, e o cron de 15 em 15 min com a regra de 61 min fazia 1 pedido a cada 75 min (10h37 → 11h52). E o "11:37" era a hora em que a Vant leu a Pluggy, não a hora em que o banco foi lido.
- Agora: leitura a cada 5 min (o pedido ao banco sai assim que completa 1 hora, no máximo ~65 min) e o DEFCON mostra "banco 10:37 · próx. 11:42", sem fingir que está atualizado.
- Migration `20261003140000_pix_mais_rapido.sql` (cron `*/5` + `banco_pix_do_dia.ultima_sync` = hora da leitura do banco).
- Com 2+ bancos, a hora mostrada é a do banco lido há mais tempo (12h41: aparecia "12:35" do Santander enquanto o C6 estava em 11:45 e 3 Pix ainda não tinham entrado). Migration `20261003160000_pix_lido_mais_antigo.sql`.

## 03/10/2026 — Rastreador de gastos + cada gasto do banco numa categoria

**O que mudou pro vendedor**
- **Rastreador de gastos** em Finanças (acima do Raio-X): quanto já saiu no mês, se está acima ou abaixo do **seu normal** (média dos seus últimos 3 meses) pra essa altura do mês, a projeção de fechamento, cada categoria contra o próprio normal e **um alerta** quando alguma dispara. Conta fixa (assinatura, aluguel, parcela) só alerta se passar do mês inteiro.
- Fonte: o que saiu do banco (Open Finance ou PDF) **+** o que você lança nos custos do dia e não aparece no banco (dinheiro vivo, outra conta).
- **Cada gasto do banco numa categoria**: o Piloto mandava toda saída pra "Entre minhas contas" (olhava o CPF de quem pagou, que é sempre o próprio vendedor). Agora olha quem recebeu: Pix pra 99 vira Transporte por app, Pix pra pessoa vira Pix pra pessoas, e "Débito de Cartão" (o banco não manda o nome da loja) vira **Compras no débito**. O que já tinha entrado errado foi corrigido sozinho. Rick: "Saiu" de outubro passou de R$ 0 pra R$ 100,67.
- **Compras do cartão de crédito** agora entram nos gastos; o pagamento da fatura deixa de contar em dobro.

**Por dentro**
- Migrations `20261003120000_rastreador_gastos.sql` (`rastreador_gastos_mes`, `financas_rastreador`) e `20261003121000_gasto_por_categoria_banco.sql` (categoria `compras_debito`, coluna `extrato_lancamentos.do_cartao`, `extrato_base` sem fatura em dobro).
- `_shared/pluggy-piloto.ts` (pluggy-hora v5): CPF de quem recebeu, cartão de crédito, conserto das linhas antigas.
- Função temporária `pluggy-olhar` (só com o token do cron) usada pra ver os dados crus da Pluggy; não está no repositório.

## 03/10/2026 — Ranking: Pix do banco volta pra quem é Pro

- Decisão do Rick (9h44): quem tem **Vant Pro ativo e banco ligado** conta no ranking o **Pix que caiu na conta**, atualizado sozinho pelo banco. O resto continua contando o que lançou. Religa o ranking misto que tinha sido desligado na madrugada de 03/10.
- Semana 28/09–04/10, só dois mudaram: Rick R$ 192 → R$ 332 (02/10 passou de R$ 30 lançados pra R$ 170 do banco); Mohamed R$ 3.946 → R$ 3.650 (02/10 passou de R$ 1.378 lançados pra R$ 1.082 de Pix: dinheiro e cartão não aparecem no banco).
- Migration `20261003110000_ranking_pix_pro_religado.sql` (mesmo corpo de `20261002210000_ranking_misto_so_pro.sql`). Ficou no banco a tabela `_tmp_rank_antes` (foto do ranking antes, com RLS e sem acesso pelo app); pode apagar pelo SQL Editor.

## 03/10/2026 — Vant Pro: Pix que faltava, tela nova e desconectar banco

**O que mudou pro vendedor**
- **Tela Vant Pro nova**, igual ao mockup "depois de conectar": escudo azul "Você é um vendedor VERIFICADO", **Comprovado hoje** (o que caiu na conta × o que você lançou, com o que ainda não caiu ou o que caiu a mais), "Onde você recebe" com bancos e carteiras ATIVO, e **Gerenciar conexões**.
- **Desconectar banco**: em Gerenciar conexões, "Desconectar" → "Confirmar". A Pluggy apaga o acesso na hora; o que já foi lido fica no histórico, mas não conta mais.
- **Pix que sumia**: o Pix das 10h de 02/10 (R$ 20) ia pro dia 01/10, porque o DEFCON de 02/10 só abriu às 13h52. Agora o dia de um DEFCON vai até as 6h da manhã seguinte; depois disso vale o dia do relógio. Rick em 02/10: R$ 170 (R$ 20 + R$ 150).
- **Pix em dobro**: o MeuPluggy espelha a conta do C6 e cada Pix contava duas vezes. Agora o mesmo Pix lido por duas conexões conta uma vez.
- **Leitura mais frequente**: o banco é lido a cada 15 min (antes 1 h). O pedido de atualização à Pluggy continua 1 por hora por banco, que é o limite deles. Antes o cron batia em 59min59s e metade dos pedidos voltava recusada (409).

**Por dentro**
- Migration `20261003100000_pix_janela_desconectar.sql`: `banco_pix_por_dia` (janela com teto às 6h, ignora conexão `deleted`, tira duplicata entre conexões), `vant_pro_hoje()`, coluna `bank_connections.pluggy_pedido_em`, Rick em `open_finance_testers`, cron `pluggy-hora` em `7,22,37,52`.
- Edge function nova `pluggy-desligar` (login obrigatório; só desliga conexão do próprio vendedor). `pluggy-hora` v4 e `pluggy-sync` v12 respeitam o limite de 1 pedido/hora. `pluggy-item` e `pluggy-webhook` intactos.
- O ranking **não** mudou: segue a regra de 03/10 do Mohamed (o que o vendedor lança).
## 02/10/2026 — Open Finance, etapa 4: Cartão, Dívidas e Guardado

**O que mudou pro vendedor** (só quem tem banco ligado)
- Embaixo da home de Finanças, três linhas que abrem uma tela cada:
  - **Cartão**: fatura atual, limite usado (com aviso quando passa do limite), vencimento, mínimo, e as **parcelas que ainda vêm** mês a mês, com quanto do mês que vem já está comprometido em "dias de rua".
  - **Dívidas**: empréstimos, cheque especial e fatura vencida numa **ordem de ataque** (o juros mais caro primeiro), com quanto ele paga de juros por mês convertido em dias de rua.
  - **Guardado**: caixinha, CDB e afins conferidos pelo banco, e o **Seu número**: saldo + guardado − dívidas.

**Por dentro**
- Banco: `bank_cartoes`, `bank_parcelas`, `bank_emprestimos`, `bank_investimentos` (só o dono lê, só o servidor grava) e cheque especial em `bank_saldos`. Função `financas_painel()` (roda como o vendedor, com RLS). Nada de número de contrato, agência ou conta.
- Edge function nova `pluggy-dia` (`_shared/pluggy-dia.ts`), uma vez por dia às 3h20 de Brasília (cron `pluggy-dia`). Parcelas agrupadas por compra (sem o "1/3"), fica só a parcela mais nova; empréstimo quitado conta como zero; parcela de fatura a mais de 35 dias é ignorada.
- Primeira leitura (02/10): Rick: cartão C6 R$ 208,89 de R$ 252,58, guardado R$ 252,62 em 3 CDBs. Mohamed: cartão Nubank R$ 607,82 acima do limite de R$ 600, vencido 14/09; 1 parcela por vir (R$ 56,05); 12 empréstimos InfinitePay, todos quitados.
- Migrations: `20261002230000_cartao_dividas_guardado.sql`, `20261002231000_pluggy_dia_cron.sql`.

## 02/10/2026 — Open Finance, etapa 3: Finanças com saldo e fôlego + Piloto Automático

**O que mudou pro vendedor** (só quem tem banco ligado; o resto vê Finanças igual)
- **Quanto você tem agora**: a soma dos saldos dos bancos ligados, com o saldo de cada um e a hora da leitura.
- **Fôlego**: quantos dias ele aguenta sem vender pagando só as contas fixas (saldo ÷ contas fixas por dia), em quadradinhos; o último cheio fica amarelo.
- **Entrou / saiu / sobrou** do mês, lidos do banco. Transferência entre contas do próprio vendedor não conta.
- **Um alerta só**, o mais urgente: saldo negativo, conta vencida ou conta que vence em até 7 dias (com quanto sobra depois de pagar).
- **No negativo** o card inteiro vira vermelho e mostra o que mais saiu nos últimos 7 dias.
- **Piloto Automático**: cada movimentação do banco entra sozinha no Raio-X, já com categoria. O card mostra quantos gastos entraram no mês e quantos ficaram pra conferir.

**Selo verificado (ajuste do mesmo dia)**
- O selo azul passou a valer só pra quem tem **Vant Pro ativo e banco ligado**. Antes, `usuario_verificado()` ainda dava o selo antigo de veterano (conta com 90+ dias e 5+ dias de DEFCON): 43 pessoas sem Pro apareciam com a estrela. Yan e Zeck, marcados à mão em 07/09 sem Pro, também saíram (`verificado_por = 'removido_sem_pro'`). Hoje: Rick e Mohamed.

**Por dentro**
- Banco: tabela `bank_saldos` (saldo por conta da Pluggy, só o dono lê), coluna `extrato_lancamentos.pluggy_tx_id` com índice único por vendedor, função `financas_home()` (roda como o vendedor, com RLS).
- `pluggy-hora` v3: além do Pix do ranking, chama `importarPiloto` (`_shared/pluggy-piloto.ts`): grava os saldos e lê o mês corrente inteiro, saídas e entradas. Categoria: dicionário do Raio-X primeiro, depois a categoria da Pluggy, depois `extrato_analisar_padroes`. Descrição sem números de conta ou CPF. Se já existe PDF daquele banco no mês, o PDF manda e nada duplica.
- Primeira leitura (02/10, ~19h): 3 saldos e 132 movimentações de outubro no Raio-X, sem duplicata na segunda rodada. Rick: R$ 504,61, fôlego de 12 dias. Mohamed: R$ 1.571,69, fôlego de 13 dias, alerta da conta "NUBANK credito" vencida em 14/09.
- Ficaram 48 linhas de 29–30/09 do Mohamed, da primeira rodada (antes de travar a janela no mês corrente). São movimentações reais e não aparecem na home de outubro.
- Migrations: `20261002220000_financas_home_piloto.sql`, `20261002223000_selo_so_pro_com_banco.sql`.

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
