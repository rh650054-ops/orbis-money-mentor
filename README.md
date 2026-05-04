# Orbis — Gestão Financeira Inteligente

App de gestão financeira para vendedores e empreendedores autônomos.

## Stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Supabase (banco, auth, edge functions)
- Capacitor (Android)

## Desenvolvimento local

```sh
# Instalar dependências
npm install

# Rodar servidor de desenvolvimento
npm run dev

# Build de produção
npm run build
```

## Variáveis de ambiente

Crie um arquivo `.env.local` com:

```
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<sua-anon-key>
```

## Edge Functions — variáveis necessárias no Supabase

| Variável | Onde usar |
|----------|-----------|
| `ANTHROPIC_API_KEY` | chat-with-ai, generate-insights |
| `HOTMART_HOTTOK` | hotmart-webhook |
| `PLUGGY_CLIENT_ID` | pluggy-connect-token, pluggy-webhook |
| `PLUGGY_CLIENT_SECRET` | pluggy-connect-token, pluggy-webhook |
| `GOOGLE_CLIENT_ID` | google-calendar-auth, google-calendar-callback |
| `GOOGLE_CLIENT_SECRET` | google-calendar-callback, google-calendar-refresh |
| `ADMIN_OWNER_CPFS` | check-admin-access (formato: `cpf1,cpf2`) |
| `N8N_WEBHOOK_URL` | chat-with-ai (opcional — fallback para Anthropic se ausente) |

## Deploy Android

```sh
npm run build
npx cap sync android
npx cap open android
```
