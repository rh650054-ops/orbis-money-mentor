/* ============================================================
   CRM da Vant — Admin › CLIENTES
   Port of src/pages/AdminSubscriptions.tsx (subscriptions admin) plus the
   admin-only "ficha" of src/components/PublicProfileModal.tsx.
   Same tables / RPCs / edge functions with the same arguments as the app;
   every permission check stays on the server.
   ============================================================ */
(function () {
  "use strict";
  if (!window.CRMAdmin) return;
  const A = window.CRMAdmin;
  const U = A.util;

  const INP = "width:100%;padding:9px 11px;border:1px solid var(--line2);border-radius:9px;background:var(--panel);color:var(--ink);font:inherit;box-sizing:border-box";
  const LBL = "display:block;font-size:11px;font-weight:600;color:var(--dim);margin:0 0 4px";
  const BTN_S = "padding:6px 10px;font-size:12px";

  // Module state survives re-renders of the section (filters, period, loaded rows).
  const S = {
    sb: null, me: null,
    users: [], carregado: false, erroUsers: null,
    busca: "", filtro: "assinantes", limite: 150,
    isSuper: false, adminMap: {},            // cpf(digits) -> is_super_admin
    preset: "mes", ini: null, fim: null, periodo: null, loadingPeriodo: false,
    ocupado: {},                             // user_id -> true while an action runs
  };

  /* ---------- date helpers (Brasília) ---------- */
  const hojeSP = () => U.hojeBR();
  const somaDias = (iso, dias) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + dias); return d.toLocaleDateString("en-CA"); };
  const primeiroDoMes = (iso) => iso.slice(0, 8) + "01";
  const isoBR = (iso) => String(iso || "").split("-").reverse().join("/");
  const mesAtual = () => hojeSP().slice(0, 7);
  const reais = (v) => "R$ " + Number(v || 0).toFixed(2).replace(".", ",");

  /* ---------- classification (same rules as the app) ---------- */
  const isComp = (u) => Boolean(u.billing_exempt);
  const endDay = (u) => String(u.trial_end || "").slice(0, 10);
  const isUltimoDia = (u) => u.plan_status === "trial" && endDay(u) === hojeSP();
  const isExpirado = (u) => !isComp(u) && u.plan_status !== "active" && endDay(u) !== "" && endDay(u) < hojeSP();

  const FILTROS = [
    ["assinantes", "Assinantes", (u) => u.plan_status === "active" && !isComp(u)],
    ["trial", "Trial (3 dias)", (u) => u.plan_status === "trial"],
    ["ultimo_dia", "Último dia", isUltimoDia],
    ["expirados", "Expirados", isExpirado],
    ["cortesias", "Cortesias", isComp],
    ["todos", "Todos", () => true],
  ];
  const TITULOS = {
    assinantes: "Assinantes", trial: "Em teste (3 dias)",
    ultimo_dia: "Último dia de teste — mande a mensagem! ⏳",
    expirados: "Expirados — não assinaram (win-back) 🔁",
    cortesias: "Cortesias / Influenciadores", todos: "Todos os usuários",
  };

  /* ---------- data loading ---------- */
  async function carregarUsers() {
    // Same select as the app; paged so lists over 1000 rows are complete.
    const todos = [];
    const PASSO = 1000;
    for (let de = 0; ; de += PASSO) {
      const { data, error } = await S.sb.from("profiles")
        .select("id, user_id, email, nickname, plan_status, is_demo, billing_exempt, comp_label, trial_end, phone, cpf")
        .order("created_at", { ascending: false })
        .range(de, de + PASSO - 1);
      if (error) { S.erroUsers = error.message; break; }
      todos.push(...(data || []));
      if (!data || data.length < PASSO) { S.erroUsers = null; break; }
    }
    S.users = todos;
    S.carregado = true;
  }

  async function carregarAdminMeta() {
    try {
      const { data: superData } = await U.rpc("is_orbis_super_admin");
      S.isSuper = !!superData;
      S.adminMap = {};
      if (S.isSuper) {
        const { data: rows } = await S.sb.from("admin_access").select("cpf, enabled, is_super_admin");
        (rows || []).forEach((r) => { if (r.enabled) S.adminMap[U.soDigitos(r.cpf)] = !!r.is_super_admin; });
      }
    } catch (_) { S.isSuper = false; }
  }

  async function carregarPeriodo(el) {
    const ini = S.ini, fim = S.fim;
    if (!ini || !fim || ini > fim) return;
    S.loadingPeriodo = true; desenharPeriodo(el);
    const { data, error } = await U.rpc("orbis_painel_periodo", { p_inicio: ini, p_fim: fim });
    S.loadingPeriodo = false;
    if (error) { U.aviso("Não consegui carregar o período: " + error, true); }
    else S.periodo = data;
    desenharPeriodo(el);
  }

  /* ---------- section render ---------- */
  async function render(el, ctx) {
    S.sb = ctx.sb; S.me = ctx.user;
    if (!S.ini) { S.ini = primeiroDoMes(hojeSP()); S.fim = hojeSP(); }
    el.innerHTML = `
      <div id="cl-periodo"></div>
      <div class="box" style="padding:14px;margin-top:12px" id="cl-busca"></div>
      <div class="box" style="padding:14px;margin-top:12px" id="cl-vincular"></div>
      <div class="box" style="padding:14px;margin-top:12px" id="cl-lista"><div style="color:var(--dim)">Carregando clientes…</div></div>`;
    desenharVincular(el);
    desenharBusca(el);
    await Promise.all([carregarUsers(), carregarAdminMeta(), carregarPeriodo(el)]);
    if (S.erroUsers) U.aviso("Erro ao carregar usuários: " + S.erroUsers, true);
    desenharBusca(el);
    desenharLista(el);
  }

  /* ---------- period report (affiliate commission) ---------- */
  const PRESETS = [["hoje", "Hoje"], ["ontem", "Ontem"], ["7dias", "Últimos 7 dias"], ["mes", "Este mês"], ["mes_passado", "Mês passado"], ["custom", "Personalizado"]];
  function aplicarPreset(p) {
    S.preset = p;
    const hoje = hojeSP();
    if (p === "hoje") { S.ini = hoje; S.fim = hoje; }
    else if (p === "ontem") { const o = somaDias(hoje, -1); S.ini = o; S.fim = o; }
    else if (p === "7dias") { S.ini = somaDias(hoje, -6); S.fim = hoje; }
    else if (p === "mes") { S.ini = primeiroDoMes(hoje); S.fim = hoje; }
    else if (p === "mes_passado") { const u = somaDias(primeiroDoMes(hoje), -1); S.ini = primeiroDoMes(u); S.fim = u; }
  }

  function desenharPeriodo(el) {
    const box = el.querySelector("#cl-periodo");
    if (!box) return;
    const p = S.periodo || {};
    const L = S.loadingPeriodo;
    const porRef = Array.isArray(p.por_ref) ? p.por_ref : [];
    const porDia = Array.isArray(p.por_dia) ? p.por_dia : [];
    box.innerHTML = `<div class="box" style="padding:14px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <b style="font-size:14px">Resultados do período</b>
        ${L ? `<span style="font-size:11px;color:var(--faint)">Carregando…</span>` : ""}
      </div>
      <div style="font-size:12px;color:var(--dim);margin-top:4px">Escolha o dia, o mês ou um intervalo pra ver quantos entraram, quantos assinaram e quanto cada afiliado tem a receber.</div>
      <div class="pills" style="margin-top:10px">
        ${PRESETS.map(([k, t]) => `<button class="pill${S.preset === k ? " p1" : ""}" data-preset="${k}" style="font-size:12px;padding:6px 12px">${t}</button>`).join("")}
      </div>
      ${S.preset === "custom" ? `
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-top:10px">
          <label style="flex:1;min-width:140px"><span style="${LBL}">De</span><input type="date" id="cl-p-ini" value="${U.esc(S.ini)}" max="${U.esc(S.fim)}" style="${INP}"></label>
          <label style="flex:1;min-width:140px"><span style="${LBL}">Até</span><input type="date" id="cl-p-fim" value="${U.esc(S.fim)}" min="${U.esc(S.ini)}" max="${hojeSP()}" style="${INP}"></label>
          <button class="btn go" id="cl-p-aplicar" ${L ? "disabled" : ""}>Aplicar</button>
        </div>` : ""}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:12px">
        <div class="stat"><div class="k">Cadastros</div><div class="v">${L ? "—" : U.esc(p.cadastros ?? 0)}</div><div class="s">${U.esc(p.cadastros_total ?? 0)} no total</div></div>
        <div class="stat" style="border-color:var(--ok)"><div class="k">Vendas (Hotmart)</div><div class="v" style="color:var(--ok)">${L ? "—" : U.esc(p.assinaturas_novas ?? 0)}</div>
          <div class="s">${U.esc(p.primeiras ?? 0)} primeira compra · ${U.esc(p.upgrades ?? 0)} upgrade</div>
          <div class="s">+ ${U.esc(p.renovacoes ?? 0)} renovações · ${reais(p.receita_hotmart ?? 0)}</div>
          ${Number(p.sem_origem || 0) > 0 ? `<div class="s" style="color:var(--warn)">${U.esc(p.sem_origem)} sem afiliado</div>` : ""}</div>
        <div class="stat" style="border-color:var(--c1)"><div class="k">Comissão a pagar</div><div class="v" style="color:var(--c1)">${L ? "—" : reais(p.comissao_total)}</div><div class="s">1ª compra: valor do parceiro · anual: 40% do líquido · upgrade e reembolso não pagam</div></div>
        <div class="stat"><div class="k">Ativas agora (Hotmart)</div><div class="v">${L ? "—" : U.esc(p.assinaturas_ativas_agora ?? 0)}</div>
          <div class="s">${Object.entries(p.ativas_por_plano || {}).map(([k, n]) => `${U.esc(String(k).replace(/:$/, ""))} ${U.esc(n)}`).join(" · ")}</div></div>
        <div class="stat"><div class="k">Leads no link</div><div class="v">${L ? "—" : U.esc(p.leads ?? 0)}</div><div class="s">${isoBR(S.ini)} a ${isoBR(S.fim)}</div></div>
      </div>
      ${porRef.length ? `
        <div style="margin-top:12px;border:1px solid var(--line);border-radius:10px;overflow:hidden">
          <div style="display:flex;align-items:center;padding:8px 10px;background:var(--panel2)">
            <span class="mini-h" style="flex:1">Por afiliado</span>
            <button class="btn ghost" id="cl-p-csv" style="${BTN_S}">Baixar CSV</button>
          </div>
          <div style="max-height:320px;overflow:auto">
            <table class="tabela"><thead><tr><th>Afiliado</th><th class="n">Leads</th><th class="n">Cadastros</th><th class="n">Vendas</th><th class="n">Renov.</th><th class="n">Comissão</th></tr></thead>
            <tbody>${porRef.map((r) => `<tr><td><b>${U.esc(r.ref)}</b></td><td class="n">${U.esc(r.leads)}</td><td class="n">${U.esc(r.cadastros)}</td>
              <td class="n" style="color:var(--ok);font-weight:700">${U.esc(r.assinaturas)}${Number(r.upgrades) > 0 ? `<span style="color:var(--faint);font-weight:400"> +${U.esc(r.upgrades)} upg</span>` : ""}</td>
              <td class="n">${U.esc(r.renovacoes ?? 0)}</td>
              <td class="n" style="color:var(--c1);font-weight:700">${Number(r.comissao) > 0 ? reais(r.comissao) : "—"}</td></tr>`).join("")}</tbody></table>
          </div>
        </div>` : ""}
      ${porDia.length > 1 ? `
        <details style="margin-top:10px;border:1px solid var(--line);border-radius:10px">
          <summary class="mini-h" style="padding:8px 10px;cursor:pointer">Dia a dia</summary>
          <div style="max-height:260px;overflow:auto;border-top:1px solid var(--line)">
            <table class="tabela"><tbody>${porDia.filter((d) => d.cadastros > 0 || d.assinaturas > 0 || d.renovacoes > 0).slice().reverse().map((d) =>
              `<tr><td>${U.esc(isoBR(d.dia))}</td><td class="n">${U.esc(d.cadastros)} cadastro(s)</td><td class="n" style="color:var(--ok);font-weight:700">${U.esc(d.assinaturas)} venda(s)</td><td class="n">${U.esc(d.renovacoes ?? 0)} renov.</td></tr>`).join("")}</tbody></table>
          </div>
        </details>` : ""}
    </div>`;

    box.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.preset;
      if (k === "custom") { S.preset = "custom"; desenharPeriodo(el); return; }
      aplicarPreset(k);
      carregarPeriodo(el);
    }));
    const ini = box.querySelector("#cl-p-ini"), fim = box.querySelector("#cl-p-fim");
    if (ini) ini.addEventListener("change", () => { S.ini = ini.value; fim.min = ini.value; });
    if (fim) fim.addEventListener("change", () => { S.fim = fim.value; ini.max = fim.value; });
    const ap = box.querySelector("#cl-p-aplicar");
    if (ap) ap.addEventListener("click", () => {
      if (!S.ini || !S.fim || S.ini > S.fim) { U.aviso("O início precisa ser antes do fim.", true); return; }
      carregarPeriodo(el);
    });
    const csv = box.querySelector("#cl-p-csv");
    if (csv) csv.addEventListener("click", baixarCSVComissao);
  }

  // Spreadsheet to pay affiliates without typing anything by hand (same layout as the app).
  function baixarCSVComissao() {
    const linhas = (S.periodo && S.periodo.por_ref) || [];
    if (!linhas.length) return;
    const csv = [
      "afiliado;leads;cadastros;primeiras_compras;upgrades;renovacoes;comissao_brl",
      ...linhas.map((r) => `${r.ref};${r.leads};${r.cadastros};${r.assinaturas};${r.upgrades ?? 0};${r.renovacoes ?? 0};${Number(r.comissao).toFixed(2).replace(".", ",")}`),
      `TOTAL;;;;${Number(S.periodo.comissao_total ?? 0).toFixed(2).replace(".", ",")}`,
    ].join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `comissao-orbis-${S.ini}-a-${S.fim}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------- search + filters ---------- */
  function desenharBusca(el) {
    const box = el.querySelector("#cl-busca");
    if (!box) return;
    const n = (fn) => S.users.filter(fn).length;
    box.innerHTML = `
      <div style="display:flex;gap:8px;align-items:flex-end">
        <label style="flex:1"><span style="${LBL}">Buscar por e-mail, apelido, telefone ou CPF</span>
          <input id="cl-q" type="search" placeholder="email@exemplo.com" value="${U.esc(S.busca)}" style="${INP}"></label>
        <button class="btn ghost" id="cl-recarregar" title="Recarregar">Atualizar</button>
      </div>
      <div class="pills" style="margin-top:10px">
        ${FILTROS.map(([k, t, fn]) => {
          const on = S.filtro === k;
          const cor = on ? (k === "ultimo_dia" ? " p5" : k === "expirados" ? " bad" : " p1") : "";
          return `<button class="pill${cor}" data-filtro="${k}" style="font-size:12px;padding:6px 12px">${t} (${S.carregado ? n(fn) : "…"})</button>`;
        }).join("")}
      </div>`;
    const q = box.querySelector("#cl-q");
    q.addEventListener("input", () => { S.busca = q.value; S.limite = 150; desenharLista(el); });
    box.querySelector("#cl-recarregar").addEventListener("click", async () => {
      await Promise.all([carregarUsers(), carregarAdminMeta()]);
      if (S.erroUsers) U.aviso("Erro ao carregar usuários: " + S.erroUsers, true);
      desenharBusca(el); desenharLista(el);
    });
    box.querySelectorAll("[data-filtro]").forEach((b) => b.addEventListener("click", () => {
      S.filtro = b.dataset.filtro; S.limite = 150; desenharBusca(el); desenharLista(el);
    }));
  }

  function filtrados() {
    const fn = (FILTROS.find((f) => f[0] === S.filtro) || FILTROS[5])[2];
    const q = S.busca.trim().toLowerCase();
    const qd = U.soDigitos(q);
    let lista = S.users.filter((u) => {
      if (!fn(u)) return false;
      if (!q) return true;
      return (u.email || "").toLowerCase().includes(q) || (u.nickname || "").toLowerCase().includes(q) ||
        (qd.length >= 3 && (U.soDigitos(u.phone).includes(qd) || U.soDigitos(u.cpf).includes(qd)));
    });
    // Conversion tabs: most recent trial end first (hottest lead).
    if (S.filtro === "ultimo_dia" || S.filtro === "expirados") lista = lista.slice().sort((a, b) => endDay(b).localeCompare(endDay(a)));
    return lista;
  }

  /* ---------- link CPF to an e-mail account ---------- */
  function desenharVincular(el) {
    const box = el.querySelector("#cl-vincular");
    box.innerHTML = `
      <b style="font-size:14px">Vincular CPF a conta</b>
      <div style="font-size:12px;color:var(--dim);margin:4px 0 10px">Use quando um usuário se cadastrou com e-mail mas precisa vincular o CPF para login.</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">
        <label><span style="${LBL}">E-mail da conta</span><input id="cl-v-email" type="email" placeholder="email@exemplo.com" style="${INP}"></label>
        <label><span style="${LBL}">CPF (11 dígitos)</span><input id="cl-v-cpf" inputmode="numeric" maxlength="11" placeholder="12345678900" style="${INP}"></label>
      </div>
      <button class="btn go block" id="cl-v-btn" style="margin-top:10px;width:100%">Vincular CPF</button>`;
    const em = box.querySelector("#cl-v-email"), cpf = box.querySelector("#cl-v-cpf"), bt = box.querySelector("#cl-v-btn");
    cpf.addEventListener("input", () => { cpf.value = U.soDigitos(cpf.value).slice(0, 11); });
    bt.addEventListener("click", async () => {
      if (!em.value || cpf.value.length !== 11) { U.aviso("Preencha e-mail e CPF (11 dígitos)", true); return; }
      bt.disabled = true; bt.textContent = "Vinculando…";
      const { data, error } = await U.funcao("link-cpf-to-account", { email: em.value.trim(), cpf: cpf.value });
      bt.disabled = false; bt.textContent = "Vincular CPF";
      if (error) { U.aviso("Erro ao vincular CPF: " + error, true); return; }
      U.aviso("✅ CPF vinculado com sucesso! " + ((data && data.message) || "Usuário pode fazer login com CPF agora."));
      em.value = ""; cpf.value = "";
      await carregarUsers(); desenharBusca(el); desenharLista(el);
    });
  }

  /* ---------- user list ---------- */
  function zapDoUsuario(u) {
    const digits = U.soDigitos(u.phone);
    if (digits.length < 10) return null;
    const wa = digits.startsWith("55") ? digits : "55" + digits;
    const first = (u.nickname || "").trim().split(/\s+/)[0] || "";
    const nm = first ? " " + first : "";
    // Ready message per tab: urgency on "último dia", win-back on "expirados" (same texts as the app).
    const body = S.filtro === "expirados"
      ? `Opa${nm}, beleza? Rick aqui da Vant. Vi que você não fechou com a gente — o que faltou pra você continuar? Pode ser sincero, me ajuda demais. 👊`
      : `Opa${nm}, beleza? Rick aqui da Vant. Vi que teu teste fecha hoje e não quis te deixar sair sem dar um alô. Sincero: o que você achou esses dias? Pergunto porque quem segue depois do teste costuma deslanchar de vez — e dá pra continuar com tudo por menos de R$1 por dia. Bora seguir junto? 👊`;
    return `https://wa.me/${wa}?text=${encodeURIComponent(body)}`;
  }

  function cartao(u) {
    const comp = isComp(u);
    const st = u.plan_status || "trial";
    const stCls = u.plan_status === "active" ? "p2" : u.plan_status === "trial" ? "p5" : "bad";
    const busy = !!S.ocupado[u.user_id];
    const zap = zapDoUsuario(u);
    const cpf = U.soDigitos(u.cpf);
    const isUserAdmin = cpf.length === 11 && Object.prototype.hasOwnProperty.call(S.adminMap, cpf);
    const isUserSuper = isUserAdmin && S.adminMap[cpf];
    const uid = U.esc(u.user_id);
    return `<div style="border:1px solid var(--line);border-radius:12px;padding:12px;margin-top:10px;background:var(--panel)">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <b style="font-size:14px;overflow:hidden;text-overflow:ellipsis;max-width:100%">${U.esc(u.nickname || "Sem nome")}</b>
        ${comp ? `<span class="pill p4">${U.esc(u.comp_label || "Cortesia")}</span>` : ""}
        ${!comp && u.comp_label ? `<span class="pill">${U.esc(u.comp_label)}</span>` : ""}
        <span class="pill ${stCls}">${U.esc(st)}</span>
        ${u.is_demo ? `<span class="pill p3">demo</span>` : ""}
        ${isUserAdmin ? `<span class="pill p5">${isUserSuper ? "super admin" : "admin"}</span>` : ""}
      </div>
      <div style="font-size:12px;color:var(--dim);margin-top:4px;word-break:break-all">${U.esc(u.email || "—")}</div>
      <div style="font-size:12px;color:var(--dim);margin-top:2px">Tel: ${U.esc(U.fmtTel(u.phone))} · CPF: ${U.esc(U.fmtCpf(u.cpf))}</div>
      ${u.trial_end ? `<div style="font-size:11px;color:var(--faint);margin-top:2px">Trial até: ${U.esc(U.dataBR(u.trial_end))}</div>` : ""}
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
        <button class="btn ghost" data-act="mais3" data-uid="${uid}" style="${BTN_S}" title="Dar +3 dias de teste grátis" ${busy || u.plan_status === "active" || comp ? "disabled" : ""}>+3 dias</button>
        ${zap ? `<a class="btn ghost" href="${U.esc(zap)}" target="_blank" rel="noopener" style="${BTN_S};color:var(--ok);border-color:var(--ok);text-decoration:none" title="Falar no WhatsApp">WhatsApp</a>` : ""}
        ${S.isSuper ? `<button class="btn ghost" data-act="admin" data-uid="${uid}" style="${BTN_S}${isUserAdmin ? ";color:var(--warn);border-color:var(--warn)" : ""}"
            title="${isUserSuper ? "Super admin (protegido)" : isUserAdmin ? "Remover admin" : "Tornar admin"}" ${busy || isUserSuper ? "disabled" : ""}>${isUserSuper ? "★ Super admin" : isUserAdmin ? "★ Remover admin" : "☆ Tornar admin"}</button>` : ""}
        <button class="btn ghost" data-act="editar" data-uid="${uid}" style="${BTN_S}" title="Ver/editar perfil">Abrir / editar</button>
        <button class="btn ${u.plan_status === "active" ? "lose" : "win"}" data-act="plano" data-uid="${uid}" style="${BTN_S}" ${busy || comp ? "disabled" : ""}>${u.plan_status === "active" ? "Desativar" : "Ativar"}</button>
        <button class="btn ghost" data-act="excluir" data-uid="${uid}" style="${BTN_S};color:var(--bad);border-color:var(--bad)" title="Excluir conta definitivamente" ${busy ? "disabled" : ""}>Excluir</button>
      </div>
    </div>`;
  }

  function desenharLista(el) {
    const box = el.querySelector("#cl-lista");
    if (!box) return;
    if (!S.carregado) { box.innerHTML = `<div style="color:var(--dim)">Carregando clientes…</div>`; return; }
    const lista = filtrados();
    const vis = lista.slice(0, S.limite);
    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <b style="font-size:14px;flex:1">${U.esc(TITULOS[S.filtro])} (${lista.length})</b>
        ${S.isSuper ? `<span class="pill p4">você é super admin</span>` : ""}
      </div>
      ${S.erroUsers ? `<div style="color:var(--bad);font-size:12px;margin-top:6px">${U.esc(S.erroUsers)}</div>` : ""}
      ${lista.length === 0 ? `<div style="color:var(--dim);padding:18px 0;text-align:center">Nenhum usuário encontrado.</div>` : vis.map(cartao).join("")}
      ${lista.length > vis.length ? `<button class="btn ghost block" id="cl-mais" style="margin-top:12px;width:100%">Mostrar mais (${lista.length - vis.length} restantes)</button>` : ""}`;
    const mais = box.querySelector("#cl-mais");
    if (mais) mais.addEventListener("click", () => { S.limite += 150; desenharLista(el); });
    box.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => {
      const u = S.users.find((x) => x.user_id === b.dataset.uid);
      if (!u) return;
      const act = b.dataset.act;
      if (act === "mais3") darMais3(el, u);
      else if (act === "admin") toggleAdmin(el, u);
      else if (act === "editar") abrirCliente(el, u);
      else if (act === "plano") toggleAssinatura(el, u);
      else if (act === "excluir") excluirConta(el, u);
    }));
  }

  async function comOcupado(el, u, fn) {
    S.ocupado[u.user_id] = true; desenharLista(el);
    try { await fn(); } finally { delete S.ocupado[u.user_id]; desenharLista(el); }
  }
  async function recarregarLista(el) { await carregarUsers(); desenharBusca(el); desenharLista(el); }

  // +3 trial days, counted from the current trial end when it is still in the future.
  function darMais3(el, u) {
    return comOcupado(el, u, async () => {
      const base = new Date();
      const atual = endDay(u);
      if (atual) { const fim = new Date(atual + "T23:59:59-03:00"); if (fim.getTime() > base.getTime()) base.setTime(fim.getTime()); }
      base.setDate(base.getDate() + 3);
      const novo = base.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const { error } = await S.sb.from("profiles").update({ trial_end: novo, is_trial_active: true, plan_status: "trial" }).eq("user_id", u.user_id);
      if (error) { U.aviso("Erro: " + (error.message || "Não foi possível dar os 3 dias."), true); return; }
      U.aviso("🎁 +3 dias liberados! Novo fim do teste: " + U.dataBR(novo));
      await recarregarLista(el);
    });
  }

  function toggleAssinatura(el, u) {
    return comOcupado(el, u, async () => {
      const newStatus = (u.plan_status || "trial") === "active" ? "expired" : "active";
      const { error } = await S.sb.from("profiles").update({
        plan_status: newStatus, plan_type: newStatus === "active" ? "pro" : "expired", is_trial_active: false,
      }).eq("user_id", u.user_id);
      if (error) { U.aviso("Não foi possível alterar o status. " + (error.message || ""), true); return; }
      U.aviso((newStatus === "active" ? "✅ Assinatura ativada!" : "❌ Assinatura desativada") + " Status: " + newStatus);
      await recarregarLista(el);
    });
  }

  // Super admin only: grant/revoke admin by CPF in admin_access. The DB protects super admins.
  async function toggleAdmin(el, u) {
    const cpf = U.soDigitos(u.cpf);
    if (cpf.length !== 11) { U.aviso("Sem CPF válido: esse usuário não tem CPF completo no perfil.", true); return; }
    if (S.adminMap[cpf]) { U.aviso("Um super admin não pode ser removido pelo painel.", true); return; }
    const isUserAdmin = Object.prototype.hasOwnProperty.call(S.adminMap, cpf);
    const nome = u.nickname || u.email || cpf;
    if (!U.confirmar(isUserAdmin ? `Remover o acesso de admin de "${nome}"?` : `Tornar "${nome}" admin do app?`)) return;
    await comOcupado(el, u, async () => {
      const r = isUserAdmin
        ? await S.sb.from("admin_access").delete().eq("cpf", cpf)
        : await S.sb.from("admin_access").insert({ cpf, role: "admin", enabled: true });
      if (r.error) { U.aviso("Erro: " + (r.error.message || "Tente novamente."), true); return; }
      U.aviso((isUserAdmin ? "Admin removido: " : "✅ Agora é admin: ") + nome);
      await carregarAdminMeta();
    });
  }

  async function excluirConta(el, u) {
    const label = u.email || u.nickname || u.user_id;
    const typed = window.prompt(`EXCLUIR DEFINITIVAMENTE a conta de "${label}"?\n\nIsso remove a conta do sistema e LIBERA o CPF e o e-mail (pra usar de novo, a pessoa cria do zero). NÃO dá pra desfazer.\n\nDigite EXCLUIR para confirmar:`);
    if (typed !== "EXCLUIR") return;
    await comOcupado(el, u, async () => {
      const { data, error } = await U.funcao("admin-delete-user", { userId: u.user_id });
      if (error) { U.aviso("Erro ao excluir conta: " + error, true); return; }
      U.aviso("🗑️ Conta excluída. " + ((data && data.message) || "CPF e e-mail liberados para um novo cadastro."));
      S.users = S.users.filter((x) => x.user_id !== u.user_id);
      if (P && P.u.user_id === u.user_id) { P = null; A.fecharPainel(); }
      desenharBusca(el);
    });
  }

  /* ============================================================
     CLIENT PANEL: edit profile, access type, ranking, temp password,
     month results, and the super-admin "ficha".
     ============================================================ */
  let P = null; // state of the open panel

  async function abrirCliente(el, u) {
    P = { el, u, form: { nickname: u.nickname || "", phone: "", cpf: "", city: "", state: "", email: u.email || "" },
      comp: { exempt: Boolean(u.billing_exempt), label: u.comp_label || null }, rankingHidden: false,
      sales: [], edits: {}, ficha: null, fichaErro: null, confirmEx: false, senha: null, ocupado: {} };
    A.abrirPainel(u.nickname || u.email || "Cliente", `<div style="color:var(--dim)">Carregando…</div>`);
    const meu = P;
    const mesIni = mesAtual() + "-01";
    const [perf, vendas] = await Promise.all([
      S.sb.from("profiles").select("nickname, phone, cpf, city, state, email, ranking_hidden, billing_exempt, comp_label").eq("user_id", u.user_id).maybeSingle(),
      S.sb.from("daily_sales").select("id, date, cash_sales, card_sales, pix_sales, total_profit").eq("user_id", u.user_id).gte("date", mesIni).order("date", { ascending: false }),
    ]);
    if (P !== meu) return;
    if (perf.error) U.aviso("Erro ao ler o perfil: " + perf.error.message, true);
    const d = perf.data;
    if (d) {
      P.form = { nickname: d.nickname || "", phone: d.phone || "", cpf: d.cpf || "", city: d.city || "", state: d.state || "", email: d.email || "" };
      P.rankingHidden = Boolean(d.ranking_hidden);
      P.comp = { exempt: Boolean(d.billing_exempt), label: d.comp_label || null };
    }
    if (vendas.error) U.aviso("Erro ao ler as vendas do mês: " + vendas.error.message, true);
    P.sales = vendas.data || [];
    P.sales.forEach((s) => { P.edits[s.id] = String(totalDia(s)); });
    desenharPainel();
    carregarFicha(meu);
  }

  const totalDia = (s) => s.total_profit ?? ((s.cash_sales || 0) + (s.card_sales || 0) + (s.pix_sales || 0));

  function desenharPainel() {
    const u = P.u, f = P.form;
    const zap = zapDoUsuario(u);
    const html = `
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
        <span class="pill ${u.plan_status === "active" ? "p2" : u.plan_status === "trial" ? "p5" : "bad"}">${U.esc(u.plan_status || "trial")}</span>
        ${u.is_demo ? `<span class="pill p3">demo</span>` : ""}
        ${u.trial_end ? `<span class="pill">trial até ${U.esc(U.dataBR(u.trial_end))}</span>` : ""}
        ${zap ? `<a class="pill p2" href="${U.esc(zap)}" target="_blank" rel="noopener" style="text-decoration:none">WhatsApp</a>` : ""}
      </div>

      <div id="cl-ficha"></div>
      <div id="cl-ganhos"></div>

      <div class="mini-h" style="margin:14px 0 8px">Perfil</div>
      <div style="display:grid;gap:10px">
        <label><span style="${LBL}">Nome / apelido</span><input data-f="nickname" value="${U.esc(f.nickname)}" style="${INP}"></label>
        <label><span style="${LBL}">Telefone</span><input data-f="phone" value="${U.esc(f.phone)}" placeholder="(11) 90000-0000" style="${INP}"></label>
        <label><span style="${LBL}">CPF</span><input data-f="cpf" value="${U.esc(f.cpf)}" inputmode="numeric" maxlength="11" placeholder="11 dígitos" style="${INP}"></label>
        <div style="display:grid;grid-template-columns:1fr 90px;gap:10px">
          <label><span style="${LBL}">Cidade</span><input data-f="city" value="${U.esc(f.city)}" style="${INP}"></label>
          <label><span style="${LBL}">Estado (UF)</span><input data-f="state" value="${U.esc(f.state)}" maxlength="2" style="${INP}"></label>
        </div>
        <label><span style="${LBL}">E-mail (somente leitura)</span>
          <div style="display:flex;gap:6px"><input value="${U.esc(f.email)}" disabled style="${INP};opacity:.7">
          ${f.email ? `<button class="btn ghost" data-copiar-email style="${BTN_S}">Copiar</button>` : ""}</div>
          <span style="font-size:11px;color:var(--faint)">Mudar o e-mail de login precisa de um passo extra — me avise se precisar.</span></label>
      </div>

      <div id="cl-comp" style="margin-top:14px"></div>
      <div id="cl-rank" style="margin-top:12px"></div>
      <div id="cl-senha" style="margin-top:12px"></div>
      <div id="cl-vendas" style="margin-top:12px"></div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;position:sticky;bottom:-28px;background:var(--panel);padding:10px 0">
        <button class="btn ghost" id="cl-cancelar">Cancelar</button>
        <button class="btn go" id="cl-salvar">Salvar</button>
      </div>`;
    const dr = document.querySelector("#drawer .dr-body");
    if (!dr) return;
    dr.innerHTML = html;
    dr.querySelectorAll("[data-f]").forEach((i) => i.addEventListener("input", () => {
      const k = i.dataset.f;
      if (k === "cpf") i.value = U.soDigitos(i.value).slice(0, 11);
      if (k === "state") i.value = i.value.toUpperCase().slice(0, 2);
      P.form[k] = i.value;
    }));
    const ce = dr.querySelector("[data-copiar-email]");
    if (ce) ce.addEventListener("click", () => U.copiar(f.email, "E-mail copiado"));
    dr.querySelector("#cl-cancelar").addEventListener("click", () => { P = null; A.fecharPainel(); });
    dr.querySelector("#cl-salvar").addEventListener("click", salvarPerfil);
    desenharComp(); desenharRank(); desenharSenha(); desenharVendas(); desenharFicha(); desenharGanhos();
  }
  const sub = (id) => document.querySelector("#drawer #" + id);

  /* ---- access type: cortesia / influenciador / equipe / desconto ---- */
  function desenharComp() {
    const box = sub("cl-comp"); if (!box) return;
    const c = P.comp, b = !!P.ocupado.comp;
    const opt = (label, txt, exempt) => `<button class="btn ${c.label === label ? "go" : "ghost"}" data-comp="${label === null ? "" : U.esc(label)}" data-exempt="${exempt ? 1 : 0}" style="${BTN_S}" ${b ? "disabled" : ""}>${txt}</button>`;
    box.innerHTML = `<div style="border:1px solid var(--line);border-radius:10px;padding:12px">
      <b style="font-size:13px">Tipo de acesso</b>
      <div style="font-size:12px;color:var(--dim);margin:3px 0 8px">${c.label
        ? `Atual: ${U.esc(c.label)}${c.exempt ? " — grátis, não conta como pagante" : " — pagante (entra na receita)"}`
        : "Atual: Pagante normal"}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${opt(null, "Pagante normal", false)}
        ${opt("Influenciador", "Influenciador (grátis)", true)}
        ${opt("Cortesia", "Cortesia (grátis)", true)}
        ${opt("Equipe", "Equipe / Sócio", true)}
        <button class="btn ghost" data-desconto style="${BTN_S}" ${b ? "disabled" : ""}>Cortesia com desconto…</button>
      </div></div>`;
    box.querySelectorAll("[data-comp]").forEach((x) => x.addEventListener("click", () =>
      applyComp(x.dataset.comp || null, x.dataset.exempt === "1")));
    box.querySelector("[data-desconto]").addEventListener("click", () => {
      const pct = window.prompt("Qual o desconto dele, em %? (ex.: 50)", "50");
      if (pct === null) return;
      const n = parseInt(String(pct).replace(/\D/g, ""), 10) || 0;
      // Discounted = still a PAYING customer (counts in Hotmart revenue), only gets the label.
      applyComp(`Cortesia ${n}%`, false);
    });
  }

  async function applyComp(label, exempt) {
    const u = P.u, meu = P;
    // BUG-005: a cortesia on a profile WITHOUT CPF never matches the Hotmart purchase (linked by CPF).
    if (exempt && !U.soDigitos(u.cpf)) {
      if (!U.confirmar("Este perfil está SEM CPF. Se a pessoa pagar o banco na Hotmart, a compra não vai cair nesta conta.\n\nPeça pra ela preencher o CPF em Minha Conta antes (ou procure outra conta dela com CPF). Aplicar a cortesia mesmo assim?")) return;
    }
    P.ocupado.comp = true; desenharComp();
    const updates = { billing_exempt: exempt, comp_label: label };
    if (exempt) { updates.plan_status = "active"; updates.plan_type = "pro"; updates.is_trial_active = false; }
    const { error } = await S.sb.from("profiles").update(updates).eq("user_id", u.user_id);
    if (P !== meu) return;
    P.ocupado.comp = false;
    if (error) { U.aviso("Erro ao aplicar selo: " + (error.message || "Tente novamente."), true); desenharComp(); return; }
    P.comp = { exempt, label };
    S.users = S.users.map((x) => x.user_id === u.user_id ? Object.assign({}, x, { billing_exempt: exempt, comp_label: label, plan_status: exempt ? "active" : x.plan_status }) : x);
    P.u = S.users.find((x) => x.user_id === u.user_id) || P.u;
    U.aviso(label ? `Selo aplicado: ${label}` : "Voltou a Pagante normal");
    desenharComp(); desenharBusca(P.el); desenharLista(P.el);
  }

  /* ---- ranking moderation (profiles.ranking_hidden) ---- */
  function desenharRank() {
    const box = sub("cl-rank"); if (!box) return;
    const h = P.rankingHidden, b = !!P.ocupado.rank;
    box.innerHTML = `<div style="border:1px solid var(--line);border-radius:10px;padding:12px;display:flex;align-items:center;gap:10px">
      <div style="flex:1"><b style="font-size:13px">Ranking</b>
        <div style="font-size:12px;color:var(--dim)">${h ? "Oculto do ranking" : "Aparece no ranking"}</div></div>
      <button class="btn ${h ? "ghost" : "lose"}" id="cl-rank-btn" style="${BTN_S}" ${b ? "disabled" : ""}>${b ? "Aguarde…" : h ? "Voltar ao ranking" : "Remover do ranking"}</button></div>`;
    box.querySelector("#cl-rank-btn").addEventListener("click", toggleRankingHidden);
  }

  // Rebuilds this user's current-month leaderboard row from daily_sales
  // (port of syncLeaderboardRevenue; recalculation is run right after by the caller).
  async function syncLeaderboardRevenue(userId) {
    const mes = mesAtual(), ini = mes + "-01", hoje = hojeSP();
    const { data: vendas, error: e1 } = await S.sb.from("daily_sales").select("total_profit, cash_sales, pix_sales, card_sales, total_debt")
      .eq("user_id", userId).gte("date", ini).lte("date", hoje);
    if (e1 || !vendas) throw new Error("Não consegui ler as vendas do mês (ranking mantido). " + ((e1 && e1.message) || ""));
    const total = vendas.reduce((s, v) => s + (v.card_sales || 0) + (v.pix_sales || 0) + (v.cash_sales || 0), 0);
    const { data: perfil, error: e2 } = await S.sb.from("profiles").select("nickname, email, avatar_url, ranking_hidden, ranking_oculto").eq("user_id", userId).maybeSingle();
    if (e2) throw new Error("Não consegui ler o perfil (ranking mantido). " + e2.message);
    if (perfil && (perfil.ranking_hidden || perfil.ranking_oculto)) {
      const { error } = await S.sb.from("leaderboard_stats").delete().eq("user_id", userId).eq("mes_referencia", mes);
      if (error) throw error;
      return;
    }
    const nome = (perfil && perfil.nickname) || (perfil && perfil.email && perfil.email.split("@")[0]) || "Usuário";
    const avatar = perfil ? perfil.avatar_url : null;
    const dias = vendas.filter((v) => ((v.card_sales || 0) + (v.pix_sales || 0) + (v.cash_sales || 0)) > 0).length;
    const { data: ent, error: e3 } = await S.sb.from("leaderboard_stats").select("id, dias_trabalhados_mes, constancia_streak_atual, constancia_maior_streak")
      .eq("user_id", userId).eq("mes_referencia", mes).maybeSingle();
    if (e3) throw new Error("Não consegui ler a entrada do ranking (ranking mantido). " + e3.message);
    if (ent) {
      const { error } = await S.sb.from("leaderboard_stats").update({
        nome_usuario: nome, avatar_url: avatar, faturamento_total_mes: total,
        dias_trabalhados_mes: Math.max(ent.dias_trabalhados_mes || 0, dias),
      }).eq("id", ent.id);
      if (error) throw error;
    } else if (total > 0) {
      const { error } = await S.sb.from("leaderboard_stats").insert({
        user_id: userId, nome_usuario: nome, avatar_url: avatar, mes_referencia: mes,
        faturamento_total_mes: total, dias_trabalhados_mes: dias, constancia_streak_atual: 1, constancia_maior_streak: 1,
      });
      if (error) throw error;
    }
  }

  async function toggleRankingHidden() {
    const u = P.u, meu = P;
    const novo = !P.rankingHidden;
    if (novo && !U.confirmar(`Remover "${u.nickname || u.email || "este usuário"}" do ranking?`)) return;
    P.ocupado.rank = true; desenharRank();
    try {
      const { error } = await S.sb.from("profiles").update({ ranking_hidden: novo }).eq("user_id", u.user_id);
      if (error) throw error;
      if (novo) {
        const { error: delErr } = await S.sb.from("leaderboard_stats").delete().eq("user_id", u.user_id);
        if (delErr) throw delErr;
      } else {
        await syncLeaderboardRevenue(u.user_id);
      }
      // Forced recalculation (admin screen), same RPC as recalcularRanking(mes, true).
      const { error: rErr } = await U.rpc("recalculate_ranking_positions", { target_month: mesAtual() });
      if (rErr) throw new Error(rErr);
      if (P === meu) { P.rankingHidden = novo; if (P.ficha) P.ficha.ranking_hidden = novo; }
      U.aviso(novo ? "🚫 Removido do ranking" : "✅ De volta ao ranking");
    } catch (e) {
      U.aviso("Erro no ranking: " + ((e && e.message) || e || "Tente novamente."), true);
    } finally {
      if (P === meu) { P.ocupado.rank = false; desenharRank(); desenharFicha(); }
    }
  }

  /* ---- temporary password ---- */
  function desenharSenha() {
    const box = sub("cl-senha"); if (!box) return;
    const b = !!P.ocupado.senha;
    box.innerHTML = `<div style="border:1px solid var(--line);border-radius:10px;padding:12px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1"><b style="font-size:13px">Senha temporária</b>
          <div style="font-size:12px;color:var(--dim)">Use quando o usuário não consegue entrar.</div></div>
        <button class="btn ghost" id="cl-senha-btn" style="${BTN_S}" ${b ? "disabled" : ""}>${b ? "Gerando…" : "Gerar"}</button>
      </div>
      ${P.senha ? `<div style="display:flex;align-items:center;gap:8px;margin-top:10px;background:var(--panel2);border:1px solid var(--line2);border-radius:9px;padding:9px 11px">
        <code style="flex:1;font-size:16px;letter-spacing:.08em;user-select:all;word-break:break-all">${U.esc(P.senha)}</code>
        <button class="btn go" id="cl-senha-copiar" style="${BTN_S}">Copiar</button></div>
        <div style="font-size:11px;color:var(--faint);margin-top:6px">Copie e envie para o usuário.</div>` : ""}
    </div>`;
    box.querySelector("#cl-senha-btn").addEventListener("click", resetSenha);
    const cp = box.querySelector("#cl-senha-copiar");
    if (cp) cp.addEventListener("click", () => U.copiar(P.senha, "Senha copiada"));
  }

  async function resetSenha() {
    const u = P.u, meu = P;
    if (!U.confirmar(`Gerar uma senha temporária para "${u.nickname || u.email || "este usuário"}"? A senha atual dele deixa de funcionar.`)) return;
    P.ocupado.senha = true; P.senha = null; desenharSenha();
    const { data, error } = await U.rpc("admin_reset_user_password", { p_user_id: u.user_id });
    if (P !== meu) return;
    P.ocupado.senha = false;
    if (error) U.aviso("Erro ao redefinir senha: " + error, true);
    else { P.senha = typeof data === "string" ? data : (data && (data.password || data.senha)) || JSON.stringify(data); U.aviso("Senha redefinida — copie e envie para o usuário."); }
    desenharSenha();
  }

  /* ---- month results (anti-cheat correction) ---- */
  function desenharVendas() {
    const box = sub("cl-vendas"); if (!box) return;
    box.innerHTML = `<div style="border:1px solid var(--line);border-radius:10px;padding:12px">
      <b style="font-size:13px">Resultados do mês (corrigir)</b>
      ${P.sales.length === 0 ? `<div style="font-size:12px;color:var(--dim);margin-top:6px">Nenhuma venda registrada neste mês.</div>` :
        P.sales.map((s) => {
          const b = !!P.ocupado["s" + s.id];
          const dd = String(s.date || "").slice(8, 10) + "/" + String(s.date || "").slice(5, 7);
          return `<div style="display:flex;align-items:center;gap:6px;margin-top:8px">
            <span style="font-size:12px;color:var(--dim);width:44px;flex-shrink:0">${U.esc(dd)}</span>
            <div style="position:relative;flex:1;min-width:0">
              <span style="position:absolute;left:9px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--faint)">R$</span>
              <input type="number" inputmode="decimal" step="0.01" data-venda="${U.esc(s.id)}" value="${U.esc(P.edits[s.id] ?? "")}" style="${INP};padding-left:30px">
            </div>
            <button class="btn go" data-salvar-dia="${U.esc(s.id)}" style="${BTN_S}" title="Salvar valor" ${b ? "disabled" : ""}>${b ? "…" : "Salvar"}</button>
            <button class="btn ghost" data-remover-dia="${U.esc(s.id)}" style="${BTN_S};color:var(--bad);border-color:var(--bad)" title="Remover este dia" ${b ? "disabled" : ""}>Remover</button>
          </div>`;
        }).join("")}
      <div style="font-size:11px;color:var(--faint);margin-top:8px">Ajuste o valor de um dia ou remova um lançamento falso. O ranking recalcula sozinho.</div>
    </div>`;
    box.querySelectorAll("[data-venda]").forEach((i) => i.addEventListener("input", () => { P.edits[i.dataset.venda] = i.value; }));
    box.querySelectorAll("[data-salvar-dia]").forEach((b) => b.addEventListener("click", () => {
      const s = P.sales.find((x) => String(x.id) === b.dataset.salvarDia); if (s) salvarDia(s, P.edits[s.id] ?? "0");
    }));
    box.querySelectorAll("[data-remover-dia]").forEach((b) => b.addEventListener("click", () => {
      const s = P.sales.find((x) => String(x.id) === b.dataset.removerDia); if (s) removerDia(s);
    }));
  }

  // Server-side correction: updates daily_sales, scales hour blocks, recalculates the ranking.
  async function salvarDia(s, novoStr) {
    const meu = P, novo = parseFloat(novoStr) || 0;
    P.ocupado["s" + s.id] = true; desenharVendas();
    const { data, error } = await U.rpc("admin_corrigir_resultado_dia", { p_sale_id: s.id, p_novo_total: novo });
    if (P !== meu) return;
    delete P.ocupado["s" + s.id];
    if (error) U.aviso("Erro ao corrigir: " + error, true);
    else {
      P.sales = P.sales.map((x) => x.id === s.id ? Object.assign({}, x, data && typeof data === "object" ? data : {}) : x);
      P.edits[s.id] = String(novo);
      U.aviso("✅ Resultado corrigido — dia, blocos de hora e ranking atualizados.");
    }
    desenharVendas();
  }

  async function removerDia(s) {
    const meu = P;
    if (!U.confirmar(`Remover o lançamento do dia ${U.dataBR(s.date)} (${U.brl(totalDia(s))})? O ranking será recalculado.`)) return;
    P.ocupado["s" + s.id] = true; desenharVendas();
    const { error } = await U.rpc("admin_remover_resultado_dia", { p_sale_id: s.id });
    if (P !== meu) return;
    delete P.ocupado["s" + s.id];
    if (error) U.aviso("Erro ao remover: " + error, true);
    else { P.sales = P.sales.filter((x) => x.id !== s.id); delete P.edits[s.id]; U.aviso("🗑️ Dia removido. Ranking recalculado."); }
    desenharVendas();
  }

  async function salvarPerfil() {
    const u = P.u, f = P.form, meu = P;
    const bt = sub("cl-salvar") || document.querySelector("#drawer #cl-salvar");
    if (bt) { bt.disabled = true; bt.textContent = "Salvando…"; }
    try {
      const { error } = await S.sb.from("profiles").update({
        nickname: f.nickname || null, phone: f.phone || null,
        cpf: f.cpf ? U.soDigitos(f.cpf) : null, city: f.city || null, state: f.state || null,
      }).eq("user_id", u.user_id);
      if (error) throw error;
      // Leaderboard keeps a COPY of the name: propagate it right away.
      const { error: lbErr } = await S.sb.from("leaderboard_stats").update({ nome_usuario: f.nickname || null }).eq("user_id", u.user_id);
      if (lbErr) throw lbErr;
      // Also save any day value typed in "Resultados do mês" but not saved by its row button.
      const pendentes = P.sales.filter((s) => {
        const dig = parseFloat(P.edits[s.id] ?? "");
        if (isNaN(dig)) return false;
        return Math.abs(dig - Number(totalDia(s))) >= 0.005;
      });
      for (const s of pendentes) {
        const { error: e } = await U.rpc("admin_corrigir_resultado_dia", { p_sale_id: s.id, p_novo_total: parseFloat(P.edits[s.id]) });
        if (e) throw new Error(e);
      }
      U.aviso("✅ Perfil atualizado" + (pendentes.length ? ` — ${pendentes.length} resultado(s) do mês corrigido(s) e ranking recalculado.` : ""));
      if (P === meu) { P = null; A.fecharPainel(); }
      await recarregarLista(meu.el);
    } catch (e) {
      U.aviso("Erro ao salvar: " + ((e && e.message) || e || "Tente novamente."), true);
      if (bt) { bt.disabled = false; bt.textContent = "Salvar"; }
    }
  }

  /* ---- super-admin "ficha" (from PublicProfileModal) ----
     Same gate as the app: only a super admin, and never on their own profile. */
  async function carregarFicha(meu) {
    if (!S.isSuper || (S.me && S.me.id === meu.u.user_id)) return;
    meu.fichaLoading = true; if (P === meu) desenharFicha();
    const { data, error } = await U.rpc("admin_ficha_usuario", { target: meu.u.user_id });
    meu.fichaLoading = false;
    if (error) { meu.fichaErro = error; meu.ficha = null; } else meu.ficha = data;
    if (P === meu) desenharFicha();
  }

  function linha(rot, val, copiar, destaque) {
    const v = val != null && String(val).trim() ? String(val) : "—";
    const cor = destaque === "ok" ? "var(--ok)" : destaque === "warn" ? "var(--bad)" : "var(--ink)";
    return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:3px 0">
      <span style="color:var(--dim);width:130px;flex-shrink:0">${U.esc(rot)}</span>
      <b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;color:${cor}">${U.esc(v)}</b>
      ${copiar && v !== "—" ? `<button class="btn ghost" data-copiar-ficha="${U.esc(v)}" style="padding:3px 8px;font-size:11px">Copiar</button>` : ""}
    </div>`;
  }

  /* ---- winnings (was the admin view of PublicProfileModal "Ganhos"): total, X1 history, competition prizes ---- */
  async function desenharGanhos() {
    const box = sub("cl-ganhos"); if (!box || !P) return;
    const uid = P.u.user_id, alvo = P;
    box.innerHTML = `<div class="box" style="padding:12px 14px;margin-top:12px"><b style="font-size:13px">Ganhos</b>
      <div style="font-size:12px;color:var(--dim);margin-top:6px">Carregando…</div></div>`;
    const [w, x1, cw] = await Promise.all([
      U.rpc("get_user_winnings", { p_user: uid }),
      ctxSb().from("x1_challenges").select("id, challenger_id, opponent_id, winner_user_id, prize_amount, created_at")
        .eq("status", "finished").or(`challenger_id.eq.${uid},opponent_id.eq.${uid}`)
        .order("created_at", { ascending: false }).limit(20),
      ctxSb().from("competition_winners").select("id, prize_label, prize_value, awarded_at")
        .eq("user_id", uid).order("awarded_at", { ascending: false }).limit(20),
    ]);
    if (P !== alvo) return;
    const total = w.data && typeof w.data.total === "number" ? w.data.total : 0;
    const hist = (x1.data || []).map((r) => ({ other: r.challenger_id === uid ? r.opponent_id : r.challenger_id, won: r.winner_user_id === uid, prize: Number(r.prize_amount) || 0 }));
    const ids = [...new Set(hist.map((h) => h.other))];
    const nomes = new Map();
    if (ids.length) {
      const { data: ps } = await ctxSb().from("public_profiles").select("user_id, nickname").in("user_id", ids);
      (ps || []).forEach((p) => nomes.set(p.user_id, p.nickname || "Vendedor"));
    }
    if (P !== alvo) return;
    const comps = cw.data || [];
    box.innerHTML = `<div class="box" style="padding:12px 14px;margin-top:12px">
      <div style="display:flex;align-items:center;gap:8px"><b style="font-size:13px;flex:1">Ganhos</b>
        <b style="color:var(--ok)">${U.esc(U.brl(total))}</b></div>
      ${w.error ? `<div style="font-size:11px;color:var(--bad)">${U.esc(w.error)}</div>` : ""}
      ${hist.length ? `<div class="mini-h" style="margin-top:10px">X1 (últimos ${hist.length})</div>
        ${hist.map((h) => `<div style="display:flex;gap:8px;font-size:12px;padding:3px 0">
          <span style="flex:1">vs ${U.esc(nomes.get(h.other) || "Vendedor")}</span>
          <span style="font-weight:700;color:${h.won ? "var(--ok)" : "var(--bad)"}">${h.won ? "venceu" + (h.prize ? " · " + U.esc(U.brl(h.prize)) : "") : "perdeu"}</span></div>`).join("")}` : ""}
      ${comps.length ? `<div class="mini-h" style="margin-top:10px">Competições</div>
        ${comps.map((c) => `<div style="display:flex;gap:8px;font-size:12px;padding:3px 0"><span style="flex:1">${U.esc(c.prize_label || "Prêmio")}</span>
          <span style="font-weight:700">${U.esc(U.brl(Number(c.prize_value) || 0))}</span></div>`).join("")}` : ""}
      ${!hist.length && !comps.length ? `<div style="font-size:12px;color:var(--dim);margin-top:6px">Nenhum X1 ou prêmio ainda.</div>` : ""}
    </div>`;
  }
  const ctxSb = () => window.CRMAdmin.ctx.sb;

  function desenharFicha() {
    const box = sub("cl-ficha"); if (!box || !P) return;
    if (!S.isSuper || (S.me && S.me.id === P.u.user_id)) { box.innerHTML = ""; return; }
    const fi = P.ficha;
    let corpo = "";
    if (P.fichaLoading) corpo = `<div style="font-size:12px;color:var(--dim);margin-top:6px">Carregando ficha…</div>`;
    else if (P.fichaErro) corpo = `<div style="font-size:12px;color:var(--bad);margin-top:6px">Não consegui abrir a ficha: ${U.esc(P.fichaErro)}</div>`;
    else if (fi) {
      const a = fi.assinatura || {};
      const assin = a.status
        ? `${a.status}${a.fim_periodo ? " · até " + U.dataBR(a.fim_periodo) : ""}`
        : fi.is_trial_active ? `trial${fi.trial_end ? " · até " + U.dataBR(fi.trial_end) : ""}` : (fi.plan_status || "sem assinatura");
      const rk = fi.ranking_hidden ? "EXCLUÍDO" : fi.ranking
        ? `#${fi.ranking.posicao ?? "—"} · ${U.brl(Number(fi.ranking.faturamento_mes || 0))} · ${fi.ranking.dias_mes ?? 0} dias` : "fora este mês";
      const mods = Array.isArray(fi.moderacoes) ? fi.moderacoes : [];
      corpo = `<div style="margin-top:8px">
        ${linha("E-mail", fi.email, true)}
        ${linha("Telefone", fi.phone || fi.whatsapp_public, true)}
        ${linha("Cidade", [fi.city, fi.state].filter(Boolean).join(" / "))}
        ${linha("Cadastro", fi.cadastro_em ? U.dataBR(fi.cadastro_em) : null)}
        ${linha("Assinatura", assin, false, a.status === "active" ? "ok" : "warn")}
        ${linha("Ranking", rk, false, fi.ranking_hidden ? "warn" : undefined)}
        ${linha("Vendas DEFCON (mês)", String(fi.vendas_defcon_mes ?? 0))}
        ${fi.origem_ref ? linha("Origem", fi.origem_ref) : ""}
        ${mods.length ? `<div style="font-size:11px;color:var(--bad);padding-top:4px">Já moderado ${mods.length}× · última: ${U.esc(U.dataBR(mods[0] && mods[0].em))}</div>
          <details style="margin-top:4px"><summary style="font-size:11px;color:var(--dim);cursor:pointer">Ver moderações</summary>
            ${mods.map((m) => `<div style="font-size:11px;color:var(--dim);padding:2px 0">${U.esc(U.dataHoraBR(m.em))}${m.motivo ? " — " + U.esc(m.motivo) : ""}${m.acao ? " (" + U.esc(m.acao) + ")" : ""}</div>`).join("")}
          </details>` : ""}
      </div>
      ${!fi.ranking_hidden ? (P.confirmEx ? `
        <div style="margin-top:10px;border-radius:9px;padding:10px;background:var(--bad-s)">
          <b style="font-size:12px">Zerar ${U.esc(U.brl(Number((fi.ranking && fi.ranking.faturamento_mes) || 0)))} e tirar do ranking pra sempre?</b>
          <div style="font-size:11px;color:var(--dim);margin-top:2px">Ele continua usando o app; só some do ranking. Pra devolver: "Voltar ao ranking" aqui embaixo.</div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button class="btn lose" id="cl-ex-sim" style="flex:1;${BTN_S}" ${P.ocupado.ex ? "disabled" : ""}>${P.ocupado.ex ? "Excluindo…" : "SIM, EXCLUIR"}</button>
            <button class="btn ghost" id="cl-ex-nao" style="${BTN_S}">Voltar</button>
          </div></div>` : `
        <button class="btn ghost" id="cl-ex" style="width:100%;margin-top:10px;${BTN_S};color:var(--bad);border-color:var(--bad)">Zerar e excluir do ranking</button>`) : ""}`;
    }
    box.innerHTML = `<div style="border:1px solid var(--bad);background:var(--bad-s);border-radius:10px;padding:12px">
      <div style="display:flex;align-items:center;gap:6px"><span class="mini-h" style="color:var(--bad);flex:1">Ficha — admin supremo</span></div>
      ${corpo}</div>`;
    box.querySelectorAll("[data-copiar-ficha]").forEach((b) => b.addEventListener("click", () => U.copiar(b.dataset.copiarFicha)));
    const ex = box.querySelector("#cl-ex"); if (ex) ex.addEventListener("click", () => { P.confirmEx = true; desenharFicha(); });
    const nao = box.querySelector("#cl-ex-nao"); if (nao) nao.addEventListener("click", () => { P.confirmEx = false; desenharFicha(); });
    const sim = box.querySelector("#cl-ex-sim"); if (sim) sim.addEventListener("click", excluirDoRanking);
  }

  async function excluirDoRanking() {
    const meu = P;
    P.ocupado.ex = true; desenharFicha();
    const { data, error } = await U.rpc("admin_excluir_do_ranking", { target: meu.u.user_id, motivo: "nome/valor impróprio — moderação no ranking" });
    meu.ocupado.ex = false;
    if (error) { U.aviso("Não deu: " + error, true); if (P === meu) desenharFicha(); return; }
    U.aviso(`Excluído do ranking. Zerado: ${U.brl(Number((data && data.faturamento_zerado) || 0))}. Ele não volta sozinho.`);
    if (meu.ficha) meu.ficha = Object.assign({}, meu.ficha, { ranking_hidden: true, ranking: null });
    meu.confirmEx = false; meu.rankingHidden = true;
    if (P === meu) { desenharFicha(); desenharRank(); }
  }

  A.secao("clientes", { titulo: "Clientes", ordem: 10, render });
})();
