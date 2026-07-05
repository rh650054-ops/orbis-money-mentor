// Orbis service worker.
//
// Ações rápidas na tela bloqueada durante o DEFCON, sem destravar o celular.
//
// DOIS MODOS (a página decide pelo aparelho):
//   - "buttons" (Android): UMA notificação com DOIS botões (Venda/Abordagem),
//     com as contagens no corpo. O Android substitui pela tag (não duplica).
//   - "tap" (iPhone): o iOS IGNORA botão de ação em notificação web, então
//     mostramos DUAS notificações que registram por TOQUE — uma de Venda e uma
//     de Abordagem — cada uma com a contagem escrita. Como o iOS NÃO substitui
//     pela tag (empilha/duplica), a gente FECHA a anterior antes de mostrar a nova.
//
// OFFLINE (network-first): o app abre SEM internet servindo a última versão que
// carregou online. A estratégia é NETWORK-FIRST — com sinal, SEMPRE busca o build
// novo do servidor (o cache é só plano B quando a rede falha), então NUNCA volta o
// bug da tela preta (que vinha de cache-FIRST servindo build velho). Só guarda GET
// do MESMO domínio (o shell: html, js, css, ícones) — NUNCA chamadas ao Supabase.
// Pra "matar" o offline em emergência: sobe o CACHE_VERSION que o activate limpa tudo.
const CACHE_VERSION = "orbis-shell-v1";

const ICON = "/orbis-icon-192.png";
const TAG_MAIN = "orbis-defcon";         // Android: notificação única com botões
const TAG_VENDA = "orbis-venda";         // iPhone: notificação de toque (venda)
const TAG_ABORDAGEM = "orbis-abordagem"; // iPhone: notificação de toque (abordagem)

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      await self.clients.claim();
      // Apaga só caches de versões ANTIGAS (mantém a atual). Sobe CACHE_VERSION
      // pra forçar a limpeza total num deploy problemático.
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)));
    } catch (e) {
      // best-effort
    }
  })());
});

// NETWORK-FIRST: tenta a rede; se falhar (offline), serve do cache.
// - Só GET do mesmo domínio (shell). API do Supabase e POST passam direto pra rede.
// - Navegação sem rede cai no index.html cacheado (o React assume dali).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // nunca mexe em POST/PUT (pagamento, RPC, etc.)

  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return; // Supabase e terceiros: rede direta

  const isNavigation = req.mode === "navigate";

  event.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      // Guarda a cópia boa pra usar offline depois (só respostas OK).
      if (fresh && fresh.status === 200 && fresh.type === "basic") {
        const copy = fresh.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
      }
      return fresh;
    } catch (_e) {
      // Sem rede: tenta o cache. Navegação cai no index.html (shell do app).
      const cached = await caches.match(req);
      if (cached) return cached;
      if (isNavigation) {
        const shell = await caches.match("/index.html") || await caches.match("/");
        if (shell) return shell;
      }
      throw _e;
    }
  })());
});

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

// Fecha a notificação anterior dessa tag ANTES de mostrar a nova (evita empilhar no iOS).
async function closeTag(tag) {
  try {
    const ns = await self.registration.getNotifications({ tag });
    ns.forEach((n) => n.close());
  } catch (e) {
    // best-effort
  }
}

// ---- Android: uma notificação, dois botões (a tag substitui sozinha) ----
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

// ---- iPhone: duas notificações de toque (fecha a anterior pra não duplicar) ----
async function showVendaTap(data) {
  const d = cleanData(data);
  const valor = brl(d.quickValue);
  await closeTag(TAG_VENDA);
  return self.registration.showNotification(valor ? `➕ VENDA RÁPIDA  ${valor}` : "➕ VENDA RÁPIDA", {
    tag: TAG_VENDA,
    body: `Vendas hoje: ${d.vendas}  ·  toque pra registrar`,
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
  await closeTag(TAG_ABORDAGEM);
  return self.registration.showNotification("👋 ABORDAGEM", {
    tag: TAG_ABORDAGEM,
    body: `Abordagens hoje: ${d.abordagens}  ·  toque pra registrar`,
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

async function hideMain() {
  for (const tag of [TAG_MAIN, TAG_VENDA, TAG_ABORDAGEM]) {
    await closeTag(tag);
  }
}

// "✅ Venda realizada!" (estilo Kiwify). Uma por venda, EMPILHANDO — diferente das
// de Venda/Abordagem (que substituem pra não duplicar). Pra empilhar de verdade no
// iPhone (que agrupa por título igual e trocava), cada uma leva um tag ÚNICO.
async function showVendaRealizada(amount) {
  const valor = brl(amount) || "R$0,00";
  const uniq = "venda-" + Date.now() + "-" + Math.floor(Math.random() * 1e6);
  return self.registration.showNotification("✅ Venda realizada!", {
    body: `Valor: ${valor}`,
    icon: ICON,
    badge: ICON,
    silent: false,
    tag: uniq,
    renotify: true,
    data: { kind: "info" },
  });
}

// "⚔️ X1 — ..." alerta do duelo (oponente passou / você retomou). Substitui o anterior
// (só o placar mais recente importa) e leva kind:"x1" pra abrir a aba do X1 no toque.
async function showX1Alert(d) {
  return self.registration.showNotification((d && d.title) || "⚔️ X1", {
    body: (d && d.body) || "",
    icon: ICON,
    badge: ICON,
    silent: false,
    tag: "orbis-x1-alert",
    renotify: true,
    data: { kind: "x1" },
  });
}

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "orbis-defcon-show") {
    event.waitUntil(showMain(msg.data));
  } else if (msg.type === "orbis-defcon-hide") {
    event.waitUntil(hideMain());
  } else if (msg.type === "orbis-venda-realizada") {
    event.waitUntil(showVendaRealizada(msg.data && msg.data.amount));
  } else if (msg.type === "orbis-x1-alert") {
    event.waitUntil(showX1Alert(msg.data));
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

    // Alerta de X1: só traz o app pra frente (ou abre o X1 se estiver fechado).
    if (which === "x1") {
      const win = clientsList.find((c) => "focus" in c);
      if (win) await win.focus();
      else await self.clients.openWindow("/x1");
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
      // Re-mostra SÓ a notificação tocada (que já foi fechada acima) -> não duplica no iOS.
      if (next.mode === "buttons") await showButtons(next);
      else await showVendaTap(next);
      if (orbis) {
        orbis.postMessage({ type: "orbis-defcon-quick", action: "venda" });
      } else {
        await self.clients.openWindow("/defcon?quick=venda");
      }
    } else if (which === "abordagem") {
      next.abordagens += 1;
      // Re-mostra SÓ a de abordagem (já fechada acima) -> não duplica no iOS.
      if (next.mode === "buttons") await showButtons(next);
      else await showAbordagemTap(next);
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
