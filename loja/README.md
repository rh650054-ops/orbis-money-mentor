# VANT nas lojas — guia de publicação

Tudo o que a Play Store e a App Store pedem, num lugar só. Textos prontos em
`ficha-da-loja.md`, plano de prints em `prints.md`, respostas de privacidade em
`privacidade-e-dados.md` e as notas pro revisor da Apple em `revisao-apple.md`.

## Como o app nativo funciona

- O mesmo código React vira o app nativo pelo **Capacitor** (pastas `android/` e `ios/`).
- O app leva o site já compilado (`dist/`) **dentro** do instalável. Ele não abre
  `app.orbis.inf.br` por dentro: a Apple recusa app que é "só um site embrulhado"
  (diretriz 4.2) e assim o app também abre mais rápido e funciona offline.
- Consequência: mudança de tela no app da loja exige mandar versão nova pras lojas.
  O backend (Supabase, edge functions) continua o mesmo pros dois e atualiza na hora.

## Dinheiro dentro do app (o ponto mais importante)

**Decisão do Rick (14/10/2026): modelo Néctar.** No app da loja, o botão de assinar
abre a Hotmart **no navegador** (fora do app). É o padrão do build
(`src/shared/lib/cobranca-loja.ts`, modo `link`).

| Onde | Como assina | Risco / o que falta |
|---|---|---|
| Web / PWA (`app.orbis.inf.br`) | Hotmart, como hoje | Nenhum |
| App iPhone (App Store) | Botão abre a Hotmart no navegador | Desde 18/06/2026 a Apple aceita link externo no Brasil, **com entitlement** (StoreKit External Purchase Link) e comissão de 15% (10% no Small Business) sobre essas vendas. Pedir o entitlement antes de enviar |
| App Android (Play Store) | Botão abre a Hotmart no navegador | Na última checagem (out/2026) o Brasil não estava no programa de cobrança alternativa do Google: risco de recusa. Conferir de novo antes de enviar |

**Plano B** (se uma loja recusar): build com a variável `VITE_COBRANCA_LOJA=fora` —
o app da loja para de vender e só mostra "já assina? entra com a mesma conta".
Não precisa mexer em código.

**X1 no app da loja:** desde 14/10/2026 o X1 vale **só pontos** (sem carteira, depósito,
aposta nem prêmio em dinheiro), igual na web, no Android e no iPhone. Ver
`privacidade-e-dados.md`. Isso tira o X1 da regra de apostas, mas não quer dizer que
o app esteja aprovado: a revisão das lojas ainda decide.

## Gerar o Android (.aab)

1. Uma vez só, no GitHub › Settings › Secrets and variables › Actions:
   - Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (os mesmos da Vercel)
   - Secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
2. Actions › **Android build** › Run workflow › versão `1.0.0`.
3. Baixa o `.aab` no fim da execução e sobe no Play Console.

A chave de upload (keystore) é criada uma vez e **não pode ser perdida** — guarde
cópia em dois lugares. Com o "Play App Signing" ligado (padrão), o Google guarda a
chave final e, se a de upload sumir, dá pra pedir troca.

## Gerar o iPhone

Precisa de macOS (Xcode). Sem Mac, o caminho é um runner macOS na nuvem
(GitHub Actions ou Codemagic) com o certificado da Apple em secrets — monto
quando a conta Apple estiver aprovada.

## Ícones e splash

Fonte em `assets/` (1024 px). Pra regerar depois de trocar a arte:
`npx @capacitor/assets generate --iconBackgroundColor '#000000' --splashBackgroundColor '#000000'`
(desfazer as mudanças que ele faz em `public/` — a PWA tem os ícones dela).

## Identificador do app

`app.vant.vendas` (em `capacitor.config.ts`, `android/app/build.gradle` e no projeto
iOS). **Depois do primeiro envio pra qualquer loja ele não muda nunca mais.**
