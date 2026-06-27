// Orbis service worker.
//
// Objetivo ÚNICO: permitir ações rápidas na tela bloqueada durante o DEFCON
// ("Venda" / "Abordagem") sem o vendedor precisar destravar o celular.
//
// IMPORTANTE: este worker NÃO tem listener de "fetch" e NÃO faz cache de nada.
// Ou seja, ele nunca intercepta o carregamento da página nem serve um build
// velho — que era exatamente o bug que o kill-switch antigo resolvia (tela
// preta no app publicado). Ele só cuida de notificação.

const ICON = "/orbis-icon-192.png";
const NOTIF_TAG = "orbis-defcon-quick";
const NOTIF_TITLE = "Orbis — DEFCON 4 ativo";

self.addEventListener("install", (event) => {
  // Ativa na hora pra atualização rolar rápido.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      await self.clients.claim();
      // Limpa qualquer cache legado deixado pelo worker antigo (vite-plugin-pwa).
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    } catch (e) {
      // best-effort
    }
  })());
});

// (proposital) sem listener de "fetch".

function brl(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return "R$" + n.toFixed(2).replace(".", ",");
}

function buildBody(vendas, abordagens) {
  const v = Number.isFinite(Number(vendas)) ? Number(vendas) : 0;
  const a = Number.isFinite(Number(abordagens)) ? Number(abordagens) : 0;
  return `Vendas: ${v}  ·  Abordagens: ${a}`;
}

function buildActions(quickValue) {
  const label = brl(quickValue);
  return [
    { action: "venda", title: label ? `➕ Venda ${label}` : "➕ Venda" },
    { action: "abordagem", title: "👋 Abordagem" },
  ];
}

async function showQuickNotification(data) {
  const d = data || {};
  return self.registration.showNotification(NOTIF_TITLE, {
    tag: NOTIF_TAG,
    body: buildBody(d.vendas, d.abordagens),
    icon: ICON,
    badge: ICON,
    silent: true,
    renotify: false,
    requireInteraction: true,
    data: d,
    actions: buildActions(d.quickValue),
  });
}

// A página manda o worker (re)mostrar ou esconder a notificação fixa.
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "orbis-defcon-show") {
    event.waitUntil(showQuickNotification(msg.data));
  } else if (msg.type === "orbis-defcon-hide") {
    event.waitUntil((async () => {
      const notifs = await self.registration.getNotifications({ tag: NOTIF_TAG });
      notifs.forEach((n) => n.close());
    })());
  }
});

self.addEventListener("notificationclick", (event) => {
  const action = event.action; // "venda" | "abordagem" | ""
  const prev = (event.notification && event.notification.data) || {};
  event.notification.close();

  event.waitUntil((async () => {
    const quickValue = Number(prev.quickValue) || 0;

    // Contagem otimista: o vendedor vê o número subir na tela bloqueada na
    // hora, mesmo se a página estiver dormindo e a gravação real no banco
    // acontecer um instante depois (a página reconcilia com o valor real).
    const next = {
      vendas: Number(prev.vendas || 0),
      abordagens: Number(prev.abordagens || 0),
      quickValue,
    };
    if (action === "venda") {
      next.vendas += 1;
      next.abordagens += 1; // quem comprou foi abordado (igual no app)
    }
    if (action === "abordagem") next.abordagens += 1;

    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const orbis = clientsList.find((c) => c.url.includes("/defcon")) || clientsList[0];

    if (action === "venda") {
      // Sem valor conhecido ainda (1ª venda do dia): abre o app pra registrar certo.
      if (quickValue <= 0) {
        await self.clients.openWindow("/defcon?quick=venda");
        return;
      }
      await showQuickNotification(next);
      if (orbis) {
        orbis.postMessage({ type: "orbis-defcon-quick", action: "venda" });
      } else {
        await self.clients.openWindow("/defcon?quick=venda");
      }
    } else if (action === "abordagem") {
      await showQuickNotification(next);
      if (orbis) {
        orbis.postMessage({ type: "orbis-defcon-quick", action: "abordagem" });
      } else {
        await self.clients.openWindow("/defcon?quick=abordagem");
      }
    } else {
      // Toque no corpo da notificação -> só traz o app pra frente.
      if (orbis && "focus" in orbis) await orbis.focus();
      else await self.clients.openWindow("/defcon");
    }
  })());
});
