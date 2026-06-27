// Orbis service worker.
//
// Objetivo ÚNICO: ações rápidas na tela bloqueada durante o DEFCON, sem o
// vendedor destravar o celular.
//
// POR QUE DUAS NOTIFICAÇÕES (e não uma com botões): botão de AÇÃO em notificação
// web não renderiza em vários Android (Samsung/Motorola etc.). Já o TOQUE na
// notificação funciona em 100% dos aparelhos. Então mostramos duas notificações
// fixas — "VENDA" e "ABORDAGEM" — e o toque em cada uma registra.
//
// IMPORTANTE: este worker NÃO tem listener de "fetch" e NÃO faz cache de nada,
// então nunca intercepta o carregamento da página nem serve um build velho (era
// o bug que o kill-switch antigo resolvia — tela preta no app publicado).

const ICON = "/orbis-icon-192.png";
const TAG_VENDA = "orbis-venda";
const TAG_ABORDAGEM = "orbis-abordagem";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      await self.clients.claim();
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

function cleanData(d) {
  const o = d || {};
  return {
    vendas: Number(o.vendas) || 0,
    abordagens: Number(o.abordagens) || 0,
    quickValue: Number(o.quickValue) || 0,
  };
}

async function showVenda(data) {
  const d = cleanData(data);
  const valor = brl(d.quickValue);
  return self.registration.showNotification(valor ? `➕ VENDA  ${valor}` : "➕ VENDA", {
    tag: TAG_VENDA,
    body: `Toque aqui pra registrar uma venda  ·  Hoje: ${d.vendas}`,
    icon: ICON,
    badge: ICON,
    silent: true,
    renotify: false,
    requireInteraction: true,
    data: { kind: "venda", ...d },
  });
}

async function showAbordagem(data) {
  const d = cleanData(data);
  return self.registration.showNotification("👋 ABORDAGEM", {
    tag: TAG_ABORDAGEM,
    body: `Toque aqui pra registrar uma abordagem  ·  Hoje: ${d.abordagens}`,
    icon: ICON,
    badge: ICON,
    silent: true,
    renotify: false,
    requireInteraction: true,
    data: { kind: "abordagem", ...d },
  });
}

async function showBoth(data) {
  await showVenda(data);
  await showAbordagem(data);
}

async function hideBoth() {
  const tags = [TAG_VENDA, TAG_ABORDAGEM];
  for (const tag of tags) {
    const notifs = await self.registration.getNotifications({ tag });
    notifs.forEach((n) => n.close());
  }
}

// A página manda (re)mostrar ou esconder as notificações fixas.
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "orbis-defcon-show") {
    event.waitUntil(showBoth(msg.data));
  } else if (msg.type === "orbis-defcon-hide") {
    event.waitUntil(hideBoth());
  }
});

self.addEventListener("notificationclick", (event) => {
  const data = (event.notification && event.notification.data) || {};
  const kind = data.kind || "";
  event.notification.close();

  event.waitUntil((async () => {
    const next = cleanData(data);

    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const orbis = clientsList.find((c) => c.url.includes("/defcon")) || clientsList[0];

    if (kind === "venda") {
      // Sem valor conhecido ainda (1ª venda do dia): abre o app pra registrar certo.
      if (next.quickValue <= 0) {
        await self.clients.openWindow("/defcon?quick=venda");
        return;
      }
      // Contagem otimista (venda também conta uma abordagem, igual no app).
      next.vendas += 1;
      next.abordagens += 1;
      await showVenda(next);
      await showAbordagem(next);
      if (orbis) {
        orbis.postMessage({ type: "orbis-defcon-quick", action: "venda" });
      } else {
        await self.clients.openWindow("/defcon?quick=venda");
      }
    } else if (kind === "abordagem") {
      next.abordagens += 1;
      await showAbordagem(next);
      await showVenda(next);
      if (orbis) {
        orbis.postMessage({ type: "orbis-defcon-quick", action: "abordagem" });
      } else {
        await self.clients.openWindow("/defcon?quick=abordagem");
      }
    } else {
      if (orbis && "focus" in orbis) await orbis.focus();
      else await self.clients.openWindow("/defcon");
    }
  })());
});
