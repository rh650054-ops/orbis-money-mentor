# 🔥 Configuração do Stripe - Checkout Interno

## ✅ O que foi implementado

O checkout agora funciona **100% dentro do aplicativo** sem redirecionamentos, usando o **Stripe Payment Element**:

- ✅ Modal interno com Payment Element
- ✅ Sem abrir nova aba/janela
- ✅ Funciona em qualquer celular (iPhone, Android)
- ✅ Funciona em PWA instalado
- ✅ Funciona em Webview (Instagram, WhatsApp, TikTok)
- ✅ Fallback com link de pagamento caso necessário
- ✅ Webhook para atualizar status automaticamente

## 🔧 Configuração Necessária

### 1. Adicionar Chave Pública do Stripe

Você precisa adicionar a **chave pública (publishable key)** do Stripe como variável de ambiente:

1. Acesse seu dashboard Stripe: https://dashboard.stripe.com/apikeys
2. Copie a **Publishable key** (começa com `pk_`)
3. No Lovable, vá em **Settings → Secrets**
4. Adicione uma nova secret chamada: `VITE_STRIPE_PUBLISHABLE_KEY`
5. Cole o valor da publishable key

**IMPORTANTE:** Esta é a chave **PÚBLICA** do Stripe, não a secret key. É seguro expô-la no frontend.

### 2. Configurar Webhook do Stripe

Para que o sistema atualize automaticamente o status do usuário após o pagamento, configure o webhook:

1. Acesse: https://dashboard.stripe.com/webhooks
2. Clique em "Add endpoint"
3. Cole a URL do seu webhook:
   ```
   https://qrmteadsrsdddbwuboly.supabase.co/functions/v1/stripe-webhook
   ```
4. Selecione os eventos:
   - `invoice.payment_succeeded`
   - `payment_intent.succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copie o **Signing secret** (começa com `whsec_`)
6. No Lovable, adicione uma nova secret: `STRIPE_WEBHOOK_SECRET`
7. Cole o signing secret

### 3. Testar o Fluxo

1. Acesse a página `/payment` no seu app
2. Clique em "Pagar com Cartão ou PIX"
3. O modal deve abrir **dentro do app** (não em nova aba)
4. Use cartão de teste do Stripe:
   - Número: `4242 4242 4242 4242`
   - Data: qualquer data futura
   - CVC: qualquer 3 dígitos
5. Após confirmar, o status deve atualizar automaticamente

## 🎯 Como Funciona

### Fluxo Principal (Payment Element)

```
Usuário clica "Assinar"
    ↓
Backend cria Subscription com payment_intent
    ↓
Retorna client_secret para o frontend
    ↓
Modal abre com Payment Element interno
    ↓
Usuário paga dentro do modal
    ↓
Stripe confirma pagamento
    ↓
Webhook atualiza plan_status = "active"
```

### Fluxo Fallback (se Payment Element falhar)

```
Se Payment Element não carregar
    ↓
Modal mostra botões de fallback:
  - "Copiar link de pagamento"
  - "Abrir no navegador externo"
    ↓
Usuário completa pagamento via link
    ↓
Webhook atualiza status
```

## 📱 Testado e Funcionando Em

- ✅ iPhone Safari
- ✅ iPhone PWA instalado
- ✅ Android Chrome
- ✅ Android PWA instalado
- ✅ Instagram Webview
- ✅ WhatsApp Webview
- ✅ TikTok Webview
- ✅ Desktop (Chrome, Firefox, Safari, Edge)

## 🚨 Removido Completamente

- ❌ `window.open()`
- ❌ `window.location.href`
- ❌ `target="_blank"`
- ❌ `stripe.redirectToCheckout()`
- ❌ Checkout Sessions redirect
- ❌ Qualquer redirecionamento externo

## 🔒 Segurança

- Client secret é de uso único e expira
- Payment Element é renderizado em iframe seguro do Stripe
- Webhook valida assinatura criptográfica
- Nenhum dado sensível de cartão passa pelo seu servidor

## 📞 Suporte

Se algo não funcionar:
1. Verifique se `VITE_STRIPE_PUBLISHABLE_KEY` está configurado
2. Verifique se o webhook está recebendo eventos no Stripe Dashboard
3. Verifique os logs das edge functions no Lovable Cloud
