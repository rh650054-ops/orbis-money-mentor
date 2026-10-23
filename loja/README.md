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

| Onde | Como assina | Por quê |
|---|---|---|
| Web / PWA (`app.vantapp.com.br`) | Hotmart, os 3 planos na tela | Fora das lojas, vale a regra que você quiser |
| App Android e iPhone | **Modelo Néctar** (Rick, 23/10/2026): o app não mostra preço nem checkout. Quem não tem acesso vê "Assinatura inválida" com **Assinar** (abre beta.vantapp.com.br/#planos no navegador do celular), **Tentar novamente** e **Sair da conta** | É o que o Néctar faz nas duas lojas. Se uma loja recusar, `VITE_COBRANCA_LOJA=fora` tira o botão (só aviso + suporte) sem mexer em código |

Código: `src/shared/lib/cobranca-loja.ts` (`modoCobranca`, `assinaPeloSite`), a tela em
`src/shared/components/assinatura-loja.tsx` (`TelaAssinarPeloSite`), o link externo em
`src/shared/lib/link-externo.ts` (plugin `@capacitor/browser`, abre no navegador do sistema).

Todo botão que abre a Hotmart passa por `abrirCheckout` (`src/shared/lib/checkout.ts`), que no
app da loja abre o site em vez da Hotmart.

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
