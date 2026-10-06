# CHANGELOG — VANT

Registro do que mudou no app, em português, do mais novo pro mais antigo.

## 06/10/2026 — Arte "Sobrou pra mim" removida
- A arte de story "Sobrou pra mim" saiu do compartilhamento do fim do DEFCON, a pedido do Rick. Voltam só as artes de antes: a com fundo (feed/WhatsApp) e as transparentes pro story.

## 06/10/2026 — Planos novos da VANT (Essencial, banco avulso, Pro, Pro Anual)
- **Planos:** Essencial R$ 29,90 (`8qbxvm9p`) · banco Open Finance +R$ 12,90 cada (`otgozkn9`) · Pro R$ 49,90 com 1 banco (`5y86n311`) · Pro Anual R$ 418,80 = R$ 34,90/mês com 2 bancos (`ew11enu0`; o anual antigo `6vkxbh8c` continua valendo pra quem já assinou).
- **Paywall /pro:** anual R$ 34,90/mês com 2 bancos e economia de R$ 180, mensal com 1 banco, e o bloco "Só quer ligar o banco?" (Essencial + banco R$ 42,80 × Pro R$ 49,90).
- **Banco avulso sem Pro:** quem assina o Essencial e compra o banco liga o banco e tem o Pix lido. Selo e ranking conferido continuam só do Pro (`vant_pro_pleno`). `orbis_pro_ativo` passa a significar "pode usar Open Finance".
- **Bancos por plano** (`open_finance_limite`): Pro Anual 2, Pro mensal 1, Essencial 0, +1 por banco avulso; devolve `plano` e `liberado`.
- **Textos:** R$ 29,99 corrigido pra R$ 29,90 em todas as telas; banco a mais R$ 12,90; X1 "a partir de R$ 12,90 no Essencial".
- Interno: a sincronização da origem do parceiro saiu de `checkout.ts` pra `origem-conta.ts` (os testes que importam o checkout não puxam mais o cliente do Supabase).

## 06/10/2026 — Links do parceiro no CRM (3 links + painel) e origem gravada na conta
- **CRM › Parceiros (Yan e Rick):** fluxo novo "Gerar links de um parceiro": cria o cupom na Hotmart → digita o mesmo nome no CRM + nome/@/WhatsApp → saem o link do app (teste grátis), o link da página (landing), o link de assinatura (checkout Hotmart com sck + cupom) e o painel privado, cada um com botão Copiar, mais a mensagem pronta pro WhatsApp. Lista de parceiros com "Ver os links" e todos os tipos (influenciador e afiliado).
- **Regra padrão:** 50% na 1ª mensalidade e 7% nas renovações (config `pct_recorrente_padrao`=7, `pct_bonus_primeira`=43). Vem preenchida e pode ser ajustada na criação; parceiros antigos mantêm a regra deles. Endereços da landing e do checkout ficam em `parc_config` (`lp_url`, `checkout_url`).
- **Origem na conta:** logo depois do login o app chama `parc_fixar_minha_origem` — grava o parceiro na conta (só se estiver vazia, parceiro ativo, conta com até 7 dias) e devolve o dono da conta pro checkout. Quem clicou no Instagram e assina pelo PC continua levando o sck do influenciador. A trava `protect_profile_billing_columns` só abre para essa função.

## 04/10/2026 — estudio-arte: repo alinhado com o que estava no ar + caixinha na arte

- O `estudio-arte` publicado (v23: ordem dos provedores pelo banco, limites em `ai_limites`) era bem mais novo que o arquivo do repositório (v9). O repo agora tem a versão do ar, e por cima dela os campos `frase`, `contato` e `valores_caixinha` (selos "CAIXINHA" ao lado do Pix).
- Corrigido: quando nenhum provedor de imagem respondia, a função quebrava com erro 500 (variáveis fora de escopo) em vez de dizer "geração falhou".

## 04/10/2026 — Estúdio vira conversa (e adesivo ganha valores de caixinha)

- O mentor não manda mais a lista de 6 perguntas: conversa como designer amigo, UMA pergunta por mensagem, 1 a 3 frases, reagindo ao que o vendedor disse. Caminho: o que vende → nome (ajuda a criar 3 opções se não tiver) → onde vai o adesivo → clima e cores → frase, @/WhatsApp e valores de caixinha → resumo e "posso desenhar?". Só desenha depois do sim (ou se ele pedir pra gerar já).
- **Valores de caixinha**: o mentor explica o truque e sugere 3 valores a partir do preço dele (ou usa os que ele disser, ex.: R$ 25 · R$ 50 · R$ 100). Na arte, viram 3 selos com a faixa "CAIXINHA" do lado do Pix.
- `criar_adesivo` ganhou os campos `frase`, `contato` e `valores_caixinha`; `estudio-arte` escreve esses textos exatamente como aprovados.

## 04/10/2026 — Chat novo começa do zero (sem memória de conversas antigas)

- A pedido do Rick, o mentor não usa mais nada das conversas antigas: cada chat novo começa limpo. Ele desenhava a marca NINO (de agosto) num pedido "do zero" porque a memória antiga entrava em toda conversa.
- Desligado no chat (`bright-action`: não carrega nem grava `ai_memoria`) e nos relatórios (`generate-insights` sem a linha de memória). Os fatos antigos continuam no banco, só não são usados — dá pra religar se um dia quiser.
- Os números reais do vendedor (vendas, horários, produtos) continuam indo pra IA: são dados do app, não conversa.
- Deploy: `bright-action` agora carrega o código direto do commit aprovado no GitHub (arquivo de 4 linhas com o hash), em vez de colar 93 mil caracteres à mão.

## 04/10/2026 — IA: relatórios com o histórico de verdade e chat mais rápido

**O que mudou pro vendedor**
- **Relatórios e dicas da IA** (dica do dia, dica da hora, análise do relatório, dica de Finanças, relatório semanal) agora usam o mesmo cérebro do chat (Claude Sonnet) e recebem o **histórico real** do vendedor: últimos 30 dias, média por dia, melhores dias da semana e horários, como recebe (Pix/dinheiro/fiado), produtos que mais saem e o que o mentor já sabe dele. A IA compara o dia com o normal DELE em vez de dar conselho de manual.
- **Chat mais rápido**: depois de pedir um adesivo, a conversa toda ficava presa no Opus (o modelo mais lento, 20s+ por resposta). Agora só o pedido de criação vai pro Opus; o resto volta pro Sonnet (4–10s).
- **Fim do "meu cérebro tá fora do ar"** quando o mentor consultava ferramentas 4 vezes seguidas: na última rodada ele é obrigado a responder.
- **Memória do mentor voltou a gravar**: o que o vendedor conta (o que vende, onde, dificuldades) era extraído pelo Gemini grátis, que respondia 429 em quase toda mensagem. Agora é o Claude Haiku (≈ US$ 0,001 por troca), com o Gemini de reserva.
- **Estúdio: conversa nova = marca nova.** Num chat novo, "quero criar o adesivo premium da minha marca" puxava da memória a NINO de agosto e já desenhava. Agora o mentor abre um briefing guiado (nome — ou 3 opções do zero —, o que vende, clima e pra quem) e só cita a marca antiga como opção. Trava no servidor: só desenha marca que apareceu nesta conversa, e "ajuste" só mexe em arte desta conversa.
- **1º contato do estúdio rápido e completo**: o mentor responde em segundos (Sonnet, sem gerar nada) com o briefing em 6 itens — nome (ou 3 opções), o que vende, modelo (vertical/redondo/quadrado), clima, o que vai escrito (frase, @, WhatsApp, QR Pix) e cores — e aceita foto de referência. O Opus agora só entra pra criar NOME de marca. A tela não diz mais "desenhando, 2 minutos" no primeiro contato: mostra "Entendendo o que você quer...".
- A arte do adesivo continua levando ~1–2 min: é o tempo da geração em alta qualidade (gpt-image), não falha.

**Por dentro**
- `bright-action`: modelo escolhido pelas 2 últimas mensagens (era 6); `tool_choice: none` na rodada 4; `extractMemory` → `memoriaClaude` (secret opcional `ANTHROPIC_MODEL_MEMORIA`) + `memoriaGemini`. O deploy também tira o nome antigo "ORBIS IA" que ainda estava no ar.
- `generate-insights`: `historicoVendedor()` (RLS com o token do vendedor), modelo `ANTHROPIC_MODEL_RELATORIO` (padrão `claude-sonnet-5`, sem `temperature` na linha 5), gasto registrado em `ai_custos` como `claude_relatorio`.
## 04/10/2026 — Foco: vendido de verdade + quanto falta cair

- A Foco mostrava como "Vendido hoje" só o que já tinha caído (dinheiro + cartão + Pix). Num dia de R$ 880 com R$ 84,50 ainda por cair, aparecia R$ 796. Agora o número grande é o **vendido de verdade (R$ 880)**, a % da meta usa ele, e embaixo aparece **"caiu R$ 796 · falta cair R$ 85"**. Quando não tem nada pendente, volta o "sobrou R$ X pra você".
- "Semana" e "Ontem" também passam a contar o que ainda falta cair.
- Pix tardio continua do mesmo jeito: quando cai, sai do "falta cair" e entra no "caiu"; o vendido não muda.

## 03/10/2026 — Finanças: caixinhas no alto, reserva em "Guardado" e lucro do mês explicado

**O que mudou pro vendedor**
- **Ordem nova**: o **Mês blindado** virou um card próprio e as **Caixinhas** vêm logo embaixo dele. Depois as Contas a pagar, o Rastreador e o Raio-X. Antes as caixinhas ficavam lá no fim.
- **Guardado** (Vant Pro): a conta marcada como **Reserva** (ex.: Santander) agora entra no Guardado, junto dos CDBs e caixinhas lidos do banco, com a linha "sua conta de reserva". O "seu número" não conta essa conta duas vezes.
- **"Sobrou pra você esse mês" virou "SEU LUCRO NO MÊS"**, com a conta na tela: "vendeu R$ 841 − custos R$ 159,25", a frase "o que ficou pra você depois de mercadoria, transporte e comida" e o anel com "DE LUCRO" embaixo.

**Por dentro**
- Migration `20261003230000_guardado_conta_reserva.sql`: `financas_painel()` com o CTE `res` (saldo das contas `papel = 'reserva'`), campo `reserva`, `guardado` somando a reserva e `saldo_contas` sem ela.

## 03/10/2026 — Popup do dia no padrão Vant

- O popup que abre na Início ("Seu Dia em Andamento") ganhou o visual do card da Foco: preto, borda e rótulo na cor do momento (vermelho antes de começar, verde com o DEFCON rodando, dourado com o dia fechado), número grande, barra da meta, linha SEMANA · MÊS · HORAS sem centavos cortados e o botão do momento (INICIAR MEU DIA / VOLTAR PRO DEFCON / VER O RELATÓRIO DE HOJE). Saíram os ícones coloridos azul/roxo e os emojis.
- Com o DEFCON rodando, mostra quanto já vendeu e quanto falta pra meta.

## 03/10/2026 — Correções da revisão (lotes 5, 6 e 7 + banco extra)

- **Cinturão**: a conta do cinturão só roda pelo fechamento do duelo (antes dava pra chamar direto e somar defesa) e nunca conta o mesmo duelo duas vezes.
- **Banco extra**: o cancelamento da assinatura (que a Hotmart manda sem a oferta) agora reconhece o banco extra pelo código do assinante e tira só a vaga, sem tocar no plano principal. Se der erro ao liberar, a Hotmart pode reenviar (antes o reenvio era ignorado como duplicado). `hotmart-webhook` v43.
- **Provocação**: 2 toques ao mesmo tempo não furam mais o limite de 3.
- **Caixinha**: sequência não pula dia vazio; guardar pela meta não mexe mais no alvo do card "Guardar hoje".
- **Início**: o empurrão "Meta do dia batida" saiu da fila de avisos (ele se marcava como visto mesmo escondido) e voltou pro lugar dele.
- **Story "Sobrou pra mim"**: funciona em iPhone antigo (iOS 15) e se atualiza quando o lucro chega depois.
- Migration `20261003220000_correcoes_revisao_lotes.sql`.

## 03/10/2026 — Lote 7: Dashboard enxuto (um aviso por vez)

**O que mudou pro vendedor**
- A Início tinha até 5 avisos que podiam aparecer juntos (primeiros passos, confirmar e-mail, cobrança do horário, bilhete dourado do desafio, empurrão do teste). Agora eles entram numa **fila por prioridade e só o primeiro aparece**, logo acima da meta. Resolveu um, o próximo toma o lugar. Sem nenhum aviso, a meta sobe pro topo.
- Prioridade: primeiros passos (conta nova) → confirmar e-mail → cobrança do horário → bilhete dourado → "meta do dia batida" (teste).

**Por dentro**
- `Index.tsx`: bloco `.orbis-um-aviso`; cada aviso continua decidindo sozinho se aparece. `orbis.css`: a regra que mostra só o primeiro com conteúdo.

## 03/10/2026 — Open Finance, lote 6: Caixinha pela meta, Story "sobrou pra mim" e Comprovante de renda

**O que mudou pro vendedor**
- **Guarda um pedaço?** no fim do DEFCON: a Vant pega a caixinha com a data mais próxima, faz a conta (falta ÷ dias até a data = R$/dia) e sugere quanto separar, arredondado pra cima. Dia forte de Pix sugere o dobro. Botões de valor + "outro", **GUARDAR** de 1 toque (entra na caixinha, no "guardado hoje" e na sequência das Finanças), "fica N dias na frente", sequência e barra da caixinha.
- **Story "Sobrou pra mim"**: nova primeira arte do compartilhar, preta e dourada, com o que sobrou do dia, vendas, abordagens, % que fechou, ✓ Pix do banco (com banco ligado), data e posição no ranking. Nunca mostra os gastos.
- **Comprovante de renda** (Vant Pro): PDF com o que entrou no banco mês a mês (sem transferência entre contas próprias), Pix recebidos, o que foi lançado no app e dias trabalhados, média mensal confirmada pelo banco, CPF mascarado e código de verificação. Escolhe 3 ou 6 meses.

**Por dentro**
- Migration `20261003210000_caixinha_meta_comprovante_renda.sql`: `caixinha_sugestao()`, `caixinha_guardar()`, tabela `comprovantes_renda` (cada comprovante gerado fica registrado com o código) e `comprovante_renda()`.
- Front: `CaixinhaMeta.tsx`, template `sobrou` no `DefconShareCarousel`, `ComprovanteRenda.tsx` + `comprovante-renda.ts` (+ teste `lote6.test.ts`).

## 03/10/2026 — X1, lote 5: Tô na pista, Cinturão da cidade, Torcida certeira e Provocação pronta

**O que mudou pro vendedor**
- **Tô na pista hoje** (interruptor no topo da Arena): ligado, você aparece como disponível e quem te encarar já começa o duelo, sem esperar aceite. Mostra quantos vendedores te veem e quantos estão na pista. Vale até meia-noite.
- **Disponíveis agora**: quem está na pista ou com o DEFCON aberto, com patente, posição, quanto já vendeu hoje e o botão **ENCARAR** (1 toque = amistoso começando na hora).
- **Cinturão da cidade**: um campeão por cidade. O primeiro a vencer um X1 na cidade pega o cinturão; quem vence o campeão (da mesma cidade) toma; cada vitória do campeão contra alguém da cidade é uma defesa. Card com o campeão, dias de reinado, defesas, linha do tempo e **DESAFIAR**. Já nasceu com o histórico dos duelos que existiam (ex.: Cotia é do Rick).
- **Torcida certeira**: quem torce e acerta o vencedor ganha +1 ponto de patente. A arena mostra seus palpites certos.
- **Provocação pronta** dentro da luta: 5 frases fixas ("Vai desistir? 😏", "Tô só esquentando", "Isso é tudo?", "Revanche amanhã", "Respeito 🤝"), com a sua foto, máximo 3 por luta e uma a cada 2 minutos. Sem texto livre. Quem está no DEFCON recebe a notificação "😏 Fulano te provocou".

**Por dentro**
- Migration `20261003200000_x1_pista_cinturao_torcida_provocacao.sql`: `x1_pista`, `x1_na_arena` conta a pista, `x1_disponiveis`, `x1_minha_pista`, `x1_pista_ligar`; `x1_cinturao` + histórico + gatilho em `x1_challenges` (ao virar `finished`) + `x1_cinturao_cidade`; `x1_palpites` e `x1_recorde` somando os acertos; `x1_provocacoes` + `x1_provocar` + `x1_provocacoes_da_luta`.
- Front: `X1Pista.tsx`, `X1Provocacao.tsx`, `x1-lote5.ts` (+ teste); `useX1DefconAlert` avisa provocação nova.

## 03/10/2026 — Banco extra à venda (+R$ 10/mês)

**O que mudou pro vendedor**
- A tela "Mais um banco" agora tem o botão **QUERO LIGAR MAIS UM BANCO**, que abre o checkout da Hotmart (oferta de R$ 10/mês) com o e-mail da conta já preenchido.
- Pagou, a vaga libera sozinha em até 1 minuto: é só voltar e ligar o banco. Cancelou ou estornou, a vaga sai. Se a renovação não acontecer, a vaga vence sozinha 33 dias depois da última cobrança.

**Por dentro**
- Migration `20261003190000_banco_extra_compra.sql`: tabela `bancos_extra_compras` (uma linha por assinatura), `banco_extra_registrar()` (só o servidor) e `open_finance_limite()` somando as vagas pagas e no prazo.
- `hotmart-webhook` v42: a oferta `otgozkn9` tem trilho próprio e sai antes da assinatura principal — comprar ou cancelar o banco extra nunca renova nem derruba o plano do app. Compra sem dono identificado fica só na caixa-preta (não vira assinatura principal no cadastro).

## 03/10/2026 — Caça-Sinal no tamanho do mockup v3

**O que mudou pro vendedor**
- A tela do Caça-Sinal estava com o layout do mockup v3, mas tudo em miniatura. Agora segue as proporções do mockup: título grande, campos de cidade e lugar mais altos, botões PERTO DE MIM e BUSCAR maiores, chips de distância maiores.
- Card de cada sinal: medalha maior, nome do cruzamento em destaque, cidade + distância ("Cotia · 0,4 km de você"), os três quadros com números grandes (Semáforos, Tempo do sinal, Vendedores ou R$/hora sem centavos), barras de melhores horas mais altas e botões IR AGORA / Já vendi aqui no tamanho do dedo.

## 03/10/2026 — DEFCON, lote 4: Retomar meu lugar, Clima na Foco e Caça-Sinal na Foco

**O que mudou pro vendedor**
- **Retomar meu lugar**: a Foco lembra a melhor posição do vendedor no ranking do mês naquele dia. Se depois alguém passa ele, o dia encerrado mostra "Te passaram no ranking: você estava em #12 hoje e caiu pra #14. Faltam R$ 96 pra passar o #13 de novo" e o botão **RETOMAR MEU LUGAR**, que volta o DEFCON por mais uma hora direto.
- **Clima na Foco**: o chip do clima (temperatura + aviso: "chuva 15h", "gelada vende", "fica em casa") aparece no topo da Foco, ao lado da data, antes e durante o DEFCON. Toque abre o clima completo.
- **Caça-Sinal na Foco**: antes de começar o dia aparece **Seu melhor sinal** (o ponto onde ele mais rende, priorizando o dia da semana de hoje, com R$/hora e melhor horário) e o botão **IR PRA LÁ**. Quem ainda não tem histórico vê o **sinal quente mais perto** da última posição. Um toque em "Caça-Sinal" abre a busca completa.

**Por dentro**
- `src/components/defcon/FocoExtras.tsx` (`RetomarLugar`, `SinalDeHoje`) e `retomar-lugar.ts` (+ teste).
- `/defcon?mais=1` estende o DEFCON encerrado uma única vez (`extendChallenge`).

## 03/10/2026 — Finanças, lote 3: Mês blindado, selos, "Resolver agora", recado e projeção

**O que mudou pro vendedor**
- **Mês blindado** no topo das Contas a pagar: o % do mês já guardado em número grande, "3 de 5 contas cobertas", e "Faltam R$ 590 pra fechar o mês sem dever nada. **No ritmo de hoje, dia 19**" (o ritmo é o que ele guardou de verdade nos dias de trabalho das últimas 2 semanas).
- **Recado** logo embaixo: "Você guarda 18% do lucro. Suas contas pedem 27%. Com R$ 28 a mais por dia, o Aluguel chega pago no dia 10 sem aperto." Quando o ritmo dá conta, o recado elogia e diz o dia em que o mês fecha.
- **Selo em cada conta**: VENCEU ONTEM / VENCEU HÁ N DIAS (vermelho), BLINDADA (verde, já está toda guardada), VENCE HOJE / VENCE AMANHÃ (amarelo).
- **Resolver agora**: conta vencida que ainda não está guardada troca o "Paguei" por um botão vermelho que já abre o guardar com o valor que falta.
- **Projeção nas caixinhas**: até 2 meses, mostra a data em que a caixinha chega ("chega ~12/11"); mais longe que isso, em meses.

**Por dentro**
- `src/components/financas/blindagem.ts` (+ teste): `guardadoMedioDia`, `diasUteisAteBlindar`, `recadoBlindado`, `seloConta`.
- `src/components/financas/MesBlindado.tsx`: card do mês blindado + `SeloConta`.

## 03/10/2026 — Segurança: funções com caminho fixo

**Por dentro**
- Migration `20261003170000_fixar_search_path_funcoes.sql`: 5 funções auxiliares (`extrato_meses`, `extrato_norm`, `parc_nome_curto`, `parc_pix_mascarado`, `parc_status_indicacao`) agora têm `search_path` fixo, como o alerta de segurança do Supabase pedia. Nada muda pro vendedor.

## 03/10/2026 — Pix travado no fim do DEFCON (de novo) e ao vivo

**O que mudou pro vendedor**
- **Finalizou o dia com banco ligado → o Pix trava no que caiu na conta.** Cadeado, sem digitar. Antes (desde a madrugada de 03/10) o campo voltava a ser digitável e o banco virava só "referência".
- **Na hora que finaliza**, a Vant pede uma leitura do banco na hora e já mostra o valor atualizado.
- **Depois fica ao vivo:** relê a cada 30 s e pede leitura nova a cada 5 min enquanto a tela estiver aberta. Embaixo do Pix aparece "ao vivo · lido 12:50 · próx. 13:55".
- O que você lançou e ainda não caiu aparece como **"R$ X ainda não caíram"**, não como calote, e não trava o botão de finalizar. O cobrador continua ali caso seja fiado de verdade.
- Sem banco ligado, nada muda: Pix digitado como sempre.

**Por dentro**
- `DefconEndScreen.tsx`: `travado = pixBanco.temBanco`; `pixNum` = Pix do banco que cabe no vendido (`pixQueEntraNoDia`); a diferença vira `aindaNaoCaiu`, não `hasCalote`.
- `banco-pix.ts`: `proximaLeitura()` (última leitura + 65 min), usado também no DEFCON rodando.

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
## 03/10/2026 — Aba Vender: convite → paywall premium → trava do X1

**O que mudou pro vendedor**
- **Aba Vender sem banco:** a primeira tela agora é o convite "Liga seu banco e vira vendedor conferido", com o que muda pra ele e um botão só: CONECTAR MEU BANCO.
- **Paywall nova (`/pro`):** selo azul do Instagram, grande, título com azul em "selo do banco", anual em cartão com borda dourada (R$ 29,99/mês, R$ 598,80 riscado, "economiza R$ 238"), mensal discreto, lista "Só no Pro" com 8 itens (Selo Verificado, Pix contado na rua, Arena Pro, Caça-Sinal, IA de Ganhos, Financeiro Completo, Estoque de Produtos, Comprovante de renda), um botão só grudado no rodapé e o mensal como link.
- **Trava do X1:** sem banco ligado, DESAFIAR 1×1 e ABRIR SALA ficam borrados e um cartão com cadeado explica e leva pra aba Vender. Encarar, aceitar desafio, Cinturão e os atalhos pra `/x1/escolher` e `/x1/sala/nova` também respeitam a trava. Lutas e salas ao vivo continuam visíveis (vitrine).

**Por dentro**
- `ConviteBanco.tsx` (novo), `PaywallPro.tsx` (refeita, constantes em `pro-lib.ts`), `pages/Pro.tsx` + rota `/pro` (quem já é Pro volta pra Vender), `X1Trava.tsx` + `x1-trava-lib.ts` (hook `useTravaBanco` lê `orbis_pro_status`).
- Sem mudança no banco nem nas funções do servidor. Testes: 13 passando em `conectar/`; `tsc` igual à base (67); `eslint` 0 erros.

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
