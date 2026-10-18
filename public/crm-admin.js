/* ============================================================
   CRM da Vant — ABA ADMIN (18/10/2026, Rick: "tudo que tem dentro da função de
   administração do app vai pro CRM"; o app deixa de ter a aba de admin).
   Quem vê: quem é admin no CRM (orbis_papel = 'admin': Rick, Mohamed, Yan).
   A segurança de verdade continua no banco: toda RPC/política confere admin
   no servidor. Esta tela é só a interface.

   Estrutura:
     crm-admin.js            → este arquivo: núcleo (sub-abas, utilitários, modal)
     crm-admin-<secao>.js    → cada seção se registra com CRMAdmin.secao(...)
   Regras da CSP do site: nada de onclick="" no HTML (script inline é proibido);
   todo evento é ligado com addEventListener depois de montar o HTML.
   ============================================================ */
(function () {
  "use strict";

  const SECOES = [];          // {id, titulo, ordem, render(el, ctx)}
  let CTX = null;             // {sb, toast, papel, user}
  let ATUAL = null;

  /* ---------- utilitários compartilhados ---------- */
  const esc = (v) => String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const brl = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);
  const dataBR = (iso) => {
    if (!iso) return "—";
    const s = String(iso);
    const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : new Date(s);
    return isNaN(d) ? s : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  };
  const dataHoraBR = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d) ? String(iso) : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };
  /** Hoje em Brasília, YYYY-MM-DD. */
  const hojeBR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const soDigitos = (v) => String(v || "").replace(/\D/g, "");
  const fmtCpf = (v) => { const d = soDigitos(v); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : (v || "—"); };
  const fmtTel = (v) => { const d = soDigitos(v); return d.length >= 10 ? d.replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3") : (v || "—"); };
  const zapLink = (tel, texto) => { let d = soDigitos(tel); if (!d) return null; if (d.length <= 11) d = "55" + d;
    return "https://wa.me/" + d + (texto ? "?text=" + encodeURIComponent(texto) : ""); };

  /** RPC com erro legível. Devolve {data, error}. */
  async function rpc(nome, args) {
    try {
      const r = args ? await CTX.sb.rpc(nome, args) : await CTX.sb.rpc(nome);
      return { data: r.data, error: r.error ? r.error.message : null };
    } catch (e) { return { data: null, error: (e && e.message) || String(e) }; }
  }
  /** Edge function com erro legível (lê o corpo do erro quando a função devolve 4xx/5xx). */
  async function funcao(nome, body) {
    try {
      const { data, error } = await CTX.sb.functions.invoke(nome, { body: body || {} });
      if (error) {
        let msg = error.message || String(error);
        try { const ctx = error.context; if (ctx && typeof ctx.json === "function") { const j = await ctx.json(); if (j && j.error) msg = j.error + (j.detalhe ? " — " + j.detalhe : ""); } } catch (_) { /* body is not JSON */ }
        return { data: null, error: msg };
      }
      if (data && data.error) return { data, error: String(data.error) };
      return { data, error: null };
    } catch (e) { return { data: null, error: (e && e.message) || String(e) }; }
  }
  /** Avisa no rodapé (usa o toast do CRM). Erros ficam mais tempo. */
  function aviso(texto, erro) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = texto;
    el.dataset.on = "1";
    el.style.background = erro ? "var(--bad)" : "";
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.dataset.on = "0"; el.style.background = ""; }, erro ? 6000 : 2400);
  }
  async function copiar(texto, rotulo) {
    try { await navigator.clipboard.writeText(texto); aviso((rotulo || "Copiado") + " ✓"); }
    catch (_) { aviso("Não consegui copiar — selecione e copie na mão.", true); }
  }
  /** Confirmação antes de ações que não têm volta. */
  function confirmar(texto) { return window.confirm(texto); }

  /* ---------- modal (painel lateral do próprio CRM) ---------- */
  function abrirPainel(titulo, html, ligar) {
    const dr = document.getElementById("drawer"), veu = document.getElementById("veu");
    dr.dataset.id = "";
    dr.innerHTML = `<div class="dr-head" style="display:flex;align-items:center;gap:10px">
        <b style="flex:1;font-size:15px">${esc(titulo)}</b>
        <button class="btn ghost" data-adm-fechar style="padding:6px 11px;font-size:12px">Fechar</button></div>
      <div class="dr-body" style="overflow:auto;padding:14px 16px 28px">${html}</div>`;
    dr.dataset.on = "1"; veu.dataset.on = "1";
    veu.onclick = fecharPainel;
    dr.querySelector("[data-adm-fechar]").addEventListener("click", fecharPainel);
    if (ligar) ligar(dr.querySelector(".dr-body"));
  }
  function fecharPainel() {
    const dr = document.getElementById("drawer"), veu = document.getElementById("veu");
    dr.dataset.on = "0"; veu.dataset.on = "0"; dr.innerHTML = "";
  }

  /* ---------- registro e desenho das seções ---------- */
  function secao(id, def) {
    const i = SECOES.findIndex((s) => s.id === id);
    const s = Object.assign({ id, ordem: 50 }, def);
    if (i >= 0) SECOES[i] = s; else SECOES.push(s);
    SECOES.sort((a, b) => a.ordem - b.ordem);
    if (CTX) desenharMenu();
  }

  function desenharMenu() {
    const raiz = document.getElementById("p-admin");
    if (!raiz) return;
    if (!ATUAL && SECOES.length) ATUAL = SECOES[0].id;
    raiz.innerHTML = `
      <div class="box" style="padding:12px 14px;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <b style="font-size:14px">Administração da Vant</b>
          <span class="pill p4">só admin</span>
          <span style="flex:1"></span>
          <span style="font-size:11px;color:var(--faint)">Tudo que era admin no app mora aqui.</span>
        </div>
        <div class="pills" id="adm-menu" style="margin-top:10px">
          ${SECOES.map((s) => `<button class="pill${s.id === ATUAL ? " p1" : ""}" data-adm-secao="${esc(s.id)}" style="font-size:12px;padding:6px 12px">${esc(s.titulo)}</button>`).join("")}
        </div>
      </div>
      <div id="adm-corpo"></div>`;
    raiz.querySelectorAll("[data-adm-secao]").forEach((b) =>
      b.addEventListener("click", () => { ATUAL = b.dataset.admSecao; desenharMenu(); }));
    desenharSecao();
  }

  async function desenharSecao() {
    const corpo = document.getElementById("adm-corpo");
    const s = SECOES.find((x) => x.id === ATUAL);
    if (!corpo || !s) return;
    corpo.innerHTML = `<div class="box" style="padding:18px;color:var(--dim)">Carregando ${esc(s.titulo)}…</div>`;
    try { await s.render(corpo, CTX); }
    catch (e) {
      corpo.innerHTML = `<div class="box" style="padding:18px;border-color:var(--bad);background:var(--bad-s)">
        <b>${esc(s.titulo)} falhou ao abrir.</b><br><span style="font-size:12px">${esc((e && e.message) || e)}</span></div>`;
      console.error(e);
    }
  }

  /** Chamado pelo crm.js depois do login, só para admin. */
  function iniciar(ctx) {
    CTX = ctx;
    desenharMenu();
  }
  /** Redesenha a seção aberta (depois de salvar algo). */
  function recarregar() { desenharSecao(); }

  window.CRMAdmin = {
    secao, iniciar, recarregar, abrirPainel, fecharPainel,
    util: { esc, brl, dataBR, dataHoraBR, hojeBR, soDigitos, fmtCpf, fmtTel, zapLink, rpc, funcao, aviso, copiar, confirmar },
    get ctx() { return CTX; },
  };
})();
