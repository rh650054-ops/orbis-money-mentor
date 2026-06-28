// Orbis service worker.
//
// Ações rápidas na tela bloqueada durante o DEFCON, sem destravar o celular.
//
// DOIS MODOS (a página decide pelo aparelho):
//   - "buttons" (Android): UMA notificação com DOIS botões de ação (Venda/Abordagem).
//   - "tap" (iPhone): o iOS IGNORA botão de ação em notificação web, então mostramos
//     DUAS notificações que se registram por TOQUE (Venda e Abordagem).
// Além disso: a cada venda dispara "✅ Venda realizada! Valor: R$X" com a logo (os dois).
//
// IMPORTANTE: sem listener de "fetch" e sem cache — nunca intercepta o
// carregamento da página nem serve build velho (bug da tela preta do worker antigo).

const ICON = "/orbis-icon-192.png";
const TAG_MAIN = "orbis-defcon";            // Android: notificação única com botões
const TAG_VENDA = "orbis-venda";            // iPhone: notificação de toque (venda)
const TAG_ABORDAGEM = "orbis-abordagem";    // iPhone: notificação de toque (abordagem)
const TAG_REALIZADA = "orbis-venda-realizada"; // "Venda realizada!" (os dois)

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
    mode: o.mode === "buttons" ? "buttons" : "tap",
    vendas: Number(o.vendas) || 0,
    abordagens: Number(o.abordagens) || 0,
    quickValue: Number(o.quickValue) || 0,
  };
}

// ---- Android: uma notificação, dois botões ----
async function showButtons(data) {
  const d = cleanData(data);
  const valor = brl(d.quickValue);
  return self.registration.showNotification("Orbis — DEFCON 4 ativo", {
    tag: TAG_MAIN,
    body: `Vendas: ${d.vendas}  ·  Abordagens: ${d.abordagens}`,
    icon: ICON,
    badge: ICON,
    silent: true,
    renotify: false,
    requireInteraction: true,
    data: { ...d, mode: "buttons" },
    actions: [
      { action: "venda", title: valor ? `➕ Venda ${valor}` : "➕ Venda" },
      { action: "abordagem", title: "👋 Abordagem" },
    ],
  });
}

// ---- iPhone: duas notificações de toque ----
async function showVendaTap(data) {
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
    data: { ...d, mode: "tap", kind: "venda" },
  });
}

async function showAbordagemTap(data) {
  const d = cleanData(data);
  return self.registration.showNotification("👋 ABORDAGEM", {
    tag: TAG_ABORDAGEM,
    body: `Toque aqui pra registrar uma abordagem  ·  Hoje: ${d.abordagens}`,
    icon: ICON,
    badge: ICON,
    silent: true,
    renotify: false,
    requireInteraction: true,
    data: { ...d, mode: "tap", kind: "abordagem" },
  });
}

async function showMain(data) {
  const d = cleanData(data);
  if (d.mode === "buttons") return showButtons(d);
  await showVendaTap(d);
  await showAbordagemTap(d);
}

// ---- "Venda realizada!" estilo Kiwify (iPhone e Android) ----
async function showVendaRealizada(amount) {
  const valor = brl(amount) || "R$0,00";
  return self.registration.showNotification("✅ Venda realizada!", {
    tag: TAG_REALIZADA,
    body: `Valor: ${valor}`,
    icon: ICON,
    badge: ICON,
    renotify: true,
    silent: false,
    data: { kind: "info" },
  });
}

async function hideMain() {
  for (const tag of [TAG_MAIN, TAG_VENDA, TAG_ABORDAGEM]) {
    const notifs = await self.registration.getNotifications({ tag });
    notifs.forEach((n) => n.close());
  }
}

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "orbis-defcon-show") {
    event.waitUntil(showMain(msg.data));
  } else if (msg.type === "orbis-defcon-hide") {
    event.waitUntil(hideMain());
  } else if (msg.type === "orbis-venda-realizada") {
    event.waitUntil(showVendaRealizada(msg.data && msg.data.amount));
  }
});

self.addEventListener("notificationclick", (event) => {
  const data = (event.notification && event.notification.data) || {};
  // No Android o botão vem em event.action; no iPhone (toque) vem em data.kind.
  const which = event.action || data.kind || "";
  event.notification.close();

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const orbis = clientsList.find((c) => c.url.includes("/defcon")) || clientsList[0];

    // Toque na notificação "Venda realizada!" -> só abre o app.
    if (data.kind === "info") {
      if (orbis && "focus" in orbis) await orbis.focus();
      else await self.clients.openWindow("/defcon");
      return;
    }

    const next = cleanData(data);

    if (which === "venda") {
      // Sem valor ainda (1ª venda do dia): abre o app pra registrar certo.
      if (next.quickValue <= 0) {
        await self.clients.openWindow("/defcon?quick=venda");
        return;
      }
      next.vendas += 1;
      next.abordagens += 1; // quem comprou foi abordado (igual no app)
      await showMain(next);
      await showVendaRealizada(next.quickValue);
      if (orbis) {
        orbis.postMessage({ type: "orbis-defcon-quick", action: "venda" });
      } else {
        await self.clients.openWindow("/defcon?quick=venda");
      }
    } else if (which === "abordagem") {
      next.abordagens += 1;
      await showMain(next);
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
