/* ============================================================
   CRM da Vant — Admin · Reembolsos (24/10/2026, opção B do Rick: um clique)
   O robô hotmart-conferir cancela o plano duplicado e o plano antigo de quem virou Pro.
   Aqui aparecem as cobranças que dá pra devolver; NADA sai do caixa sem alguém apertar
   "Reembolsar". RPC: admin_reembolsos_sugeridos. Função: hotmart-reembolsar.
   ============================================================ */
(function () {
  "use strict";
  if (!window.CRMAdmin) return;
  const U = window.CRMAdmin.util;
  const esc = U.esc;
  const MOTIVO = { duplicada: "Pagou duas vezes (assinatura duplicada)", depois_pro: "Plano antigo cobrado depois de virar Pro" };
  const brl = (v) => "R$ " + Number(v || 0).toFixed(2).replace(".", ",");
  const dia = (ts) => { const d = new Date(ts); return isNaN(d) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); };

  function item(r, i) {
    const feito = !!r.reembolsado_em;
    return `<div style="border:1px solid var(--line);border-radius:12px;padding:12px;margin-top:10px;background:var(--panel);display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:220px">
        <b>${esc(r.nome)}</b> · <span class="num">${esc(brl(r.valor))}</span>
        <div style="font-size:12px;color:var(--dim);margin-top:2px">${esc(MOTIVO[r.motivo] || r.motivo)} · cobrado em ${esc(dia(r.cobrado_em))}</div>
        <div style="font-size:11px;color:var(--faint);margin-top:2px">assinatura ${esc(r.subscription_id)} (cancelada) · ficou ${esc(r.manteve || "—")} · cobrança ${esc(r.purchase_id)}</div>
      </div>
      ${feito
        ? `<span class="pill">Reembolsado ${esc(dia(r.reembolsado_em))}</span>`
        : `<div style="display:flex;gap:6px"><button class="btn win" data-reemb="${i}">Reembolsar ${esc(brl(r.valor))}</button>
           <button class="btn ghost" data-dispensa="${i}">Não reembolsar</button></div>`}
    </div>`;
  }

  async function render(el) {
    const { data, error } = await U.rpc("admin_reembolsos_sugeridos");
    const lista = data || [];
    const pend = lista.filter((r) => !r.reembolsado_em);
    el.innerHTML = `
      <div class="box" style="padding:12px 14px;margin-bottom:12px">
        <b>Reembolsos</b>
        <div style="font-size:12px;color:var(--dim);margin-top:2px">Cobranças erradas que o robô já cancelou. Só devolve quando você aperta o botão. A Hotmart avisa o cliente por e-mail.</div>
        ${pend.length ? `<div style="margin-top:6px;font-size:12px"><b>${pend.length}</b> pra decidir · ${esc(brl(pend.reduce((s, r) => s + Number(r.valor || 0), 0)))}</div>` : ""}
      </div>
      ${error ? `<div style="color:var(--bad);font-size:12px">Não foi possível carregar: ${esc(error)}</div>` : ""}
      ${!error && lista.length === 0 ? `<div style="color:var(--dim);padding:18px 0;text-align:center">Nenhum reembolso pra decidir.</div>` : ""}
      ${lista.map(item).join("")}`;
    el.querySelectorAll("[data-reemb]").forEach((b) => b.addEventListener("click", async () => {
      const r = lista[+b.dataset.reemb];
      if (!r) return;
      if (!U.confirmar(`Reembolsar ${brl(r.valor)} pra ${r.nome}?\n\n${MOTIVO[r.motivo] || r.motivo}.\nO dinheiro volta pro cliente e sai do seu saldo na Hotmart.`)) return;
      b.disabled = true; b.textContent = "Reembolsando...";
      const res = await U.funcao("hotmart-reembolsar", { purchase_id: r.purchase_id });
      if (res.error || !(res.data && res.data.success)) {
        b.disabled = false; b.textContent = `Reembolsar ${brl(r.valor)}`;
        U.aviso(res.error || (res.data && res.data.error) || "Não deu pra reembolsar.", true);
        return;
      }
      U.aviso(`Reembolsado: ${brl(r.valor)} pra ${r.nome}`);
      window.CRMAdmin.recarregar();
    }));
    ligarDispensa(el, lista);
  }

  // registrado como 'dispensado' e some da lista (25/10)
  function ligarDispensa(el, lista) {
    el.querySelectorAll("[data-dispensa]").forEach((b) => b.addEventListener("click", async () => {
      const r = lista[+b.dataset.dispensa];
      if (!r || !U.confirmar(`Não reembolsar ${brl(r.valor)} de ${r.nome}?\n\nSai da lista e fica registrado.`)) return;
      b.disabled = true;
      const res = await U.rpc("admin_reembolso_dispensar", { p_purchase: r.purchase_id });
      if (res.error) { b.disabled = false; U.aviso("Não deu: " + res.error, true); return; }
      U.aviso("Tirado da lista");
      window.CRMAdmin.recarregar();
    }));
  }

  window.CRMAdmin.secao("reembolsos", { titulo: "Reembolsos", ordem: 16, render });
})();
