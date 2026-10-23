# Google Play Console — respostas dos formulários ("Configurar seu app")

Preenchido em 23/10/2026 a partir do código. Tudo aqui é declaração do Rick pro Google:
informação errada dá remoção do app. Onde estiver **[conferir]**, confirme antes de enviar.

Painel do app › **Política e programas › Conteúdo do app**. A ordem abaixo é a da tela.

---

## 1. Política de privacidade
- URL: `https://app.vantapp.com.br/privacidade`

## 2. Acesso ao app
- Marque: **"Todas ou algumas funcionalidades do app estão restritas"**.
- Clique em **Adicionar instruções**:
  - Nome: `Conta de revisão`
  - Nome de usuário: o e-mail da conta demo criada em CRM › Admin › Demo (`revisao@vantapp.com.br`)
  - Senha: a senha que o CRM mostrou ao criar (cole você mesmo, nunca pelo chat)
  - Outras informações:
    ```
    Na tela de login, toque em "Entrar com e-mail" e use o e-mail e a senha acima.
    A conta tem o VANT Pro ativo e dados de exemplo (vendas, produtos e metas).
    Fluxo principal: aba "Vender" > "Ativar Modo Foco" > registrar vendas com um toque.
    A conexão com banco (Open Finance) exige conta bancária brasileira real e não está ligada nesta conta.
    ```
  - Marque "Não é necessário nenhum outro dado para acessar o app".

## 3. Anúncios
- **Não, meu app não contém anúncios.** (Não há SDK de anúncio no app.)

## 4. Classificação de conteúdo (questionário IARC)
- E-mail de contato: `suporte@vantapp.com.br`
- Categoria: **"Todos os outros tipos de app"** (não é jogo, rede social pura nem app de notícias).
- Respostas:
  - Violência, sangue, medo, sexo, nudez, linguagem imprópria: **Não** em todas.
  - Substâncias controladas (drogas, álcool, tabaco): **Não**.
  - Jogos de azar simulados ou com dinheiro real: **Não** (no app da loja o X1 é só por pontos).
  - **Os usuários podem interagir ou trocar conteúdo?** **Sim** — comunidade com posts e comentários, perfil público e ranking.
  - **O app compartilha a localização atual do usuário com outros usuários?** **Não** [conferir: o ranking mostra cidade/estado escrito no perfil, não a localização do GPS].
  - **O app permite compras de produtos digitais?** **Não** no app da loja (a assinatura é feita no site).
  - O app é um navegador ou mecanismo de pesquisa irrestrito: **Não**.
- Resultado esperado: Livre/12+ por causa da interação entre usuários. Aceite o que o IARC der.

## 5. Público-alvo e conteúdo
- Faixa etária: **18 ou mais** (só marque essa). O app é ferramenta de trabalho para adultos.
- "O app pode atrair crianças sem querer?": **Não**.

## 6. Apps de notícias
- **Não**.

## 7. Apps de rastreamento de contato e status de COVID-19
- **Meu app não é um app de rastreamento de contato ou de status de COVID-19.**

## 8. Segurança dos dados
Perguntas gerais:
- O app coleta ou compartilha algum dos tipos de dados obrigatórios? **Sim**
- Todos os dados coletados são criptografados em trânsito? **Sim**
- Que métodos de conta o app oferece? **Nome de usuário e senha** (CPF ou e-mail + senha).
- Os usuários podem pedir a exclusão dos dados? **Sim** — URL: `https://app.vantapp.com.br/excluir-conta`

Tipos de dados (para cada um: **Coletado = Sim**, **Compartilhado = Não**, **Processado de forma efêmera = Não**, **Obrigatório** salvo quando escrito "Opcional"):

| Seção do formulário | Tipo | Finalidades a marcar | Obrigatório? |
|---|---|---|---|
| Informações pessoais | Nome | Funcionalidade do app, Gerenciamento de contas | Obrigatório |
| Informações pessoais | Endereço de e-mail | Gerenciamento de contas, Comunicações do desenvolvedor | Obrigatório |
| Informações pessoais | Números de telefone | Gerenciamento de contas, Comunicações do desenvolvedor | Obrigatório |
| Informações pessoais | IDs do usuário (CPF) | Gerenciamento de contas, Prevenção de fraudes/segurança | Obrigatório |
| Informações financeiras | Outras informações financeiras (vendas, gastos, metas) | Funcionalidade do app | Obrigatório |
| Informações financeiras | Informações de pagamento do usuário (extrato via Open Finance) | Funcionalidade do app | **Opcional** (só quem liga o banco) |
| Local | Localização aproximada | Funcionalidade do app | **Opcional** |
| Local | Localização exata | Funcionalidade do app | **Opcional** |
| Fotos e vídeos | Fotos | Funcionalidade do app | **Opcional** (nota fiscal, foto de produto, arte) |
| Áudio | Gravações de voz ou som | Funcionalidade do app | **Opcional** (pergunta por voz ao mentor) |
| Mensagens | Outras mensagens no app (posts e comentários da comunidade) | Funcionalidade do app | **Opcional** |
| Atividade no app | Interações com o app | Análise | Obrigatório |
| Atividade no app | Outro conteúdo gerado pelo usuário (produtos, metas) | Funcionalidade do app | Obrigatório |
| Informações e desempenho do app | Registros de erros, Diagnóstico | Análise | Obrigatório |

Por que "Compartilhado = Não": Supabase (banco), Pluggy (Open Finance), provedor de e-mail e
provedores de IA processam os dados **em nome da VANT** (prestadores de serviço). Pela regra do
Google isso não conta como "compartilhamento".

## 9. Apps governamentais
- **Não**.

## 10. Recursos financeiros
- Marque: **"Gerenciamento de finanças pessoais ou de pequenas empresas"** e, se aparecer,
  **"Agregação de contas / Open Finance"**.
- Não marque: empréstimo, investimento, cripto, pagamentos, carteira digital, banco.

## 11. Saúde
- **Meu app não tem recursos de saúde.**

## 12. ID de publicidade
- **Não**, o app não usa o ID de publicidade. (O app não declara a permissão AD_ID.)

---

## Ficha da loja (Presença na loja › Versão principal)
Textos prontos em `loja/ficha-da-loja.md`. Imagens: ícone 512×512 e destaque 1024×500 em
`assets/`; prints em `loja/prints/` (gerados da conta demo).

- Categoria: **Empresa** (alternativa: Finanças).
- Tags: Produtividade, Pequenas empresas, Finanças.
- E-mail de contato: `suporte@vantapp.com.br` · Site: `https://beta.vantapp.com.br`

## Pendência que trava a aprovação: denúncia e bloqueio na comunidade
O app tem comunidade (posts, comentários, perfil público). A política do Google de **conteúdo
gerado pelo usuário** (e a diretriz 1.2 da Apple) exige, dentro do app:
1. denunciar post/comentário/usuário;
2. bloquear um usuário (deixar de ver o que ele posta);
3. moderação dos denunciados e termos que proíbem conteúdo ofensivo.
Hoje o app **não tem** 1 e 2. Precisa entrar antes do envio.
