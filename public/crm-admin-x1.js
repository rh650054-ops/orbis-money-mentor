/* ============================================================
   CRM da Vant — Admin · X1 · Carteiras
   Port of src/pages/AdminCenter.tsx (everything except the shortcut grid) plus
   the admin-only actions from src/pages/X1Carteira.tsx:
     - Tesouraria X1 (x1_tesouraria — DB allows only Rick+Mohamed; hidden on error)
     - Duel reviews (x1_challenges, proofs in bucket x1-proofs, extrato_uploads,
       analisar-anomalia, x1_admin_confirm_payment, x1_admin_set_result)
     - Withdrawals (x1_withdraw_requests, x1_admin_resolve_withdraw)
     - Deposits (x1_deposit_requests, x1_admin_resolve_deposit, x1_admin_estornar_deposit)
     - Wallets (public_profiles search, x1_admin_wallet_move)
     - Liquidation (x1_settle_due)
     - All duels with admin actions (admin_delete_x1, x1_admin_set_result,
       x1_admin_void, x1_placar)
   Security stays in the database; this is only the interface.
   ============================================================ */
(function () {
  "use strict";
  if (!window.CRMAdmin) return;
  const U = window.CRMAdmin.util;
  const esc = U.esc, brl = U.brl;

  const INPUT = "width:100%;padding:9px 11px;border:1px solid var(--line2);border-radius:9px;background:var(--panel);color:var(--ink);font:inherit";
  const STATUS = {
    pending: "Em negociação",
    accepted: "Acordo fechado · aguardando pagamento",
    active: "Em andamento",
    declined: "Recusado",
    cancelled: "Cancelado",
    awaiting_result: "Aguardando resultado",
    finished: "Encerrado",
  };
  const STATUS_PILL = { pending: "p1", accepted: "p5", active: "warn", awaiting_result: "p4", finished: "p2", declined: "bad", cancelled: "bad" };
  const MONEY = {
    none: "Amistoso (sem aposta)",
    awaiting_payment: "Aguardando pagamento das apostas",
    secured: "Dinheiro garantido pelo admin",
    prize_released: "Prêmio liberado",
  };

  // Per-viewer UI state that survives re-renders (filter/search of the duel list).
  const UI = { filtro: "abertos", busca: "" };

  /** Duel date "dd/mm" or "a combinar" (same as the app). */
  const diaBR = (iso) => {
    if (!iso) return "a combinar";
    const d = new Date(iso + "T12:00:00");
    return isNaN(d) ? String(iso) : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };
  const box = (titulo, corpo, extra) =>
    `<div class="box" style="padding:14px;margin-bottom:12px;${extra || ""}"><div class="mini-h" style="margin-bottom:8px">${titulo}</div>${corpo}</div>`;
  const vazio = (t) => `<p style="font-size:12px;color:var(--dim);margin:0">${t}</p>`;
  const nota = (t) => `<p style="font-size:11px;color:var(--faint);margin:6px 0 0">${t}</p>`;

  async function render(el, ctx) {
    const sb = ctx.sb;
    el.innerHTML = `<div class="box" style="padding:18px;color:var(--dim)">Carregando X1 · Carteiras…</div>`;

    // ---------- reads ----------
    const [rev, todos, tes, pend, rec, wds] = await Promise.all([
      sb.from("x1_challenges")
        .select("id, challenger_id, opponent_id, status, scheduled_date, goal_amount, stakes_amount, fee_amount, prize_amount, challenger_paid, opponent_paid, modo, challenger_proof_url, opponent_proof_url")
        .in("status", ["accepted", "active", "awaiting_result"])
        .order("scheduled_date", { ascending: true }),
      sb.from("x1_challenges")
        .select("id, challenger_id, opponent_id, status, money_status, scheduled_date, goal_amount, stakes_amount, fee_amount, prize_amount, modo, winner_user_id, challenger_paid, opponent_paid, created_at")
        .order("created_at", { ascending: false })
        .limit(150),
      U.rpc("x1_tesouraria"),
      sb.from("x1_deposit_requests").select("id, user_id, valor, motivo, remetente, created_at").eq("status", "pendente_revisao").order("created_at", { ascending: true }),
      sb.from("x1_deposit_requests").select("id, user_id, valor, e2e_id, remetente, created_at").eq("status", "creditado").order("created_at", { ascending: false }).limit(8),
      sb.from("x1_withdraw_requests").select("id, user_id, valor, pix_key, pix_nome, created_at").eq("status", "pendente").order("created_at", { ascending: true }),
    ]);
    const erroLeitura = [rev, todos, pend, rec, wds].map((r) => r.error && r.error.message).filter(Boolean);
    if (erroLeitura.length) U.aviso("Erro ao ler dados do X1: " + erroLeitura[0], true);

    const revisoes = rev.data || [];
    const duelos = todos.data || [];
    const tesouraria = tes.error ? null : tes.data;
    const depsPend = pend.data || [];
    const depsRec = rec.data || [];
    const saques = wds.data || [];

    // Names for every user referenced on the page.
    const uids = new Set();
    revisoes.concat(duelos).forEach((c) => { if (c.challenger_id) uids.add(c.challenger_id); if (c.opponent_id) uids.add(c.opponent_id); });
    depsPend.concat(depsRec, saques).forEach((d) => d.user_id && uids.add(d.user_id));
    const nomes = {};
    if (uids.size) {
      const { data: pf } = await sb.from("public_profiles").select("user_id, nickname").in("user_id", Array.from(uids));
      (pf || []).forEach((p) => (nomes[p.user_id] = p.nickname));
    }
    const nome = (uid) => (uid ? nomes[uid] || "Vendedor" : "— (aberto)");

    // Evidence: verified bank statement for duelists on the relevant days.
    const relev = revisoes.filter((c) => c.scheduled_date && (c.status === "active" || c.status === "awaiting_result"));
    const extratos = {};
    if (relev.length) {
      const ruids = Array.from(new Set(relev.flatMap((c) => [c.challenger_id, c.opponent_id]).filter(Boolean)));
      const dias = Array.from(new Set(relev.map((c) => c.scheduled_date)));
      const { data: ex } = await sb.from("extrato_uploads").select("user_id, dia, total_verificado, qtd_vendas").in("user_id", ruids).in("dia", dias);
      (ex || []).forEach((r) => {
        const k = r.user_id + "|" + r.dia;
        if (!extratos[k]) extratos[k] = { total: 0, qtd: 0 };
        extratos[k].total += Number(r.total_verificado) || 0;
        extratos[k].qtd += Number(r.qtd_vendas) || 0;
      });
    }

    const hoje = U.hojeBR();
    const revAcc = revisoes.filter((c) => c.status === "accepted" && c.stakes_amount > 0);
    const revWin = revisoes.filter((c) => c.status === "awaiting_result" || (c.status === "active" && (c.scheduled_date || "") < hoje));
    const revAtivos = revisoes.filter((c) => c.status === "active" && c.scheduled_date === hoje);
    const porId = {};
    revisoes.concat(duelos).forEach((c) => (porId[c.id] = c));

    // ---------- HTML ----------
    let h = "";

    // Counters (replace the old shortcut badges).
    h += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:12px">
      <div class="stat"><div class="k">Duelos em revisão</div><div class="v">${revAcc.length + revWin.length}</div><div class="s">pagamentos + vencedores</div></div>
      <div class="stat"><div class="k">Depósitos</div><div class="v">${depsPend.length}</div><div class="s">aguardando conferência</div></div>
      <div class="stat"><div class="k">Saques</div><div class="v">${saques.length}</div><div class="s">Pix a enviar</div></div>
      <div class="stat"><div class="k">Rolando hoje</div><div class="v">${revAtivos.length}</div><div class="s">liquida às 9h05</div></div>
    </div>`;

    // Tesouraria (only when the DB lets this admin read it).
    if (tesouraria) {
      const t = tesouraria;
      const porUsuario = Array.isArray(t.por_usuario) ? t.por_usuario : [];
      h += box("🏦 Tesouraria X1 · confidencial", `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="stat"><div class="k">Devido aos usuários</div><div class="v">${brl(t.total_devido)}</div><div class="s">tem que ter isso na conta Pix da Vant</div></div>
          <div class="stat"><div class="k">Taxas acumuladas</div><div class="v" style="color:var(--ok)">${brl(t.taxas)}</div><div class="s">isso é da Vant 💰</div></div>
        </div>
        <table class="tabela" style="margin-top:10px;width:100%"><tbody>
          <tr><td>Depósitos totais</td><td class="n">${brl(t.depositos)}</td></tr>
          <tr><td>Saques totais</td><td class="n">${brl(t.saques)}</td></tr>
          <tr><td>Em jogo agora (duelos ativos)</td><td class="n" style="color:var(--warn)">${brl(t.em_jogo)}</td></tr>
          <tr><td>Prêmios já pagos</td><td class="n">${brl(t.premios_pagos)}</td></tr>
        </tbody></table>
        ${porUsuario.length ? `<div class="mini-h" style="margin:12px 0 6px">Saldo por usuário</div>
          <div style="max-height:260px;overflow:auto"><table class="tabela" style="width:100%"><tbody>
          ${porUsuario.map((u) => `<tr><td>${esc(u.nome)}</td><td class="n" style="color:var(--ok)">${brl(u.saldo)}</td></tr>`).join("")}
          </tbody></table></div>
          <button class="btn ghost" data-act="tes-csv" style="margin-top:8px;font-size:12px">Exportar saldos (CSV)</button>` : ""}
      `, "border-color:var(--c4);background:var(--c4s)");
    }

    // Duel reviews.
    let rv = "";
    if (!revAcc.length && !revWin.length && !revAtivos.length) rv += vazio("Nada pendente — nenhum duelo esperando revisão. 🏖️");
    revAcc.forEach((c) => {
      rv += `<div class="box" style="padding:12px;margin-top:8px;border-color:var(--warn)">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <b style="flex:1;min-width:0;font-size:13px">${esc(nome(c.challenger_id))} <span style="color:var(--dim)">VS</span> ${esc(nome(c.opponent_id))}</b>
          <span class="pill p5">💰 conferir pagamento</span></div>
        <div style="font-size:11px;color:var(--dim);margin:6px 0">📅 ${esc(diaBR(c.scheduled_date))} · pote ${brl(c.stakes_amount * 2)}${c.modo ? " · ⚡ " + esc(c.modo) : ""}
          · ${c.challenger_paid ? "✓" : "✗"} ${esc(nome(c.challenger_id))} pagou · ${c.opponent_paid ? "✓" : "✗"} ${esc(nome(c.opponent_id))} pagou</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn ghost" style="flex:1;min-width:120px" data-act="prova" data-path="${esc(c.challenger_proof_url || "")}" ${c.challenger_proof_url ? "" : "disabled"}>👁 ${esc(nome(c.challenger_id))}</button>
          <button class="btn ghost" style="flex:1;min-width:120px" data-act="prova" data-path="${esc(c.opponent_proof_url || "")}" ${c.opponent_proof_url ? "" : "disabled"}>👁 ${esc(nome(c.opponent_id))}</button>
        </div>
        <button class="btn go block" style="margin-top:8px" data-act="confirmar-pag" data-id="${esc(c.id)}">Confirmar pagamento dos dois → liberar duelo</button>
      </div>`;
    });
    const evidencia = (c, uid) => {
      if (!uid) return "";
      const e = extratos[uid + "|" + c.scheduled_date];
      const meta = c.goal_amount != null && e != null && e.total >= c.goal_amount;
      return `<div style="border:1px solid var(--line);border-radius:9px;padding:8px 10px;margin-top:6px">
        <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px">
          <b style="min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(nome(uid))}</b>
          <span style="font-weight:700;color:${e ? "var(--ok)" : "var(--faint)"}">${e ? brl(e.total) + " · " + e.qtd + " vendas" : "sem extrato"}${meta ? " · ✓ meta" : ""}</span></div>
        <button class="btn ghost block" style="margin-top:6px;font-size:12px;padding:6px" data-act="ia" data-uid="${esc(uid)}">✨ Analisar com IA</button>
        <div data-ia-out="${esc(uid)}" style="font-size:11px;margin-top:4px"></div>
      </div>`;
    };
    revWin.forEach((c) => {
      rv += `<div class="box" style="padding:12px;margin-top:8px;border-color:var(--c4)">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <b style="flex:1;min-width:0;font-size:13px">${esc(nome(c.challenger_id))} <span style="color:var(--dim)">VS</span> ${esc(nome(c.opponent_id))}</b>
          <span class="pill p4">🔎 definir vencedor</span></div>
        <div style="font-size:11px;color:var(--dim);margin-top:6px">📅 ${esc(diaBR(c.scheduled_date))}${c.stakes_amount > 0 ? ` · pote ${brl(c.stakes_amount * 2)} · prêmio ${brl(c.prize_amount)}` : " · amistoso"}${c.goal_amount ? ` · 🎯 ${brl(c.goal_amount)}` : ""}</div>
        ${evidencia(c, c.challenger_id)}${evidencia(c, c.opponent_id)}
        ${nota("A IA dá o parecer; você decide o vencedor abaixo.")}
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          <button class="btn win" style="flex:1;min-width:120px" data-act="vencedor-rev" data-id="${esc(c.id)}" data-w="${esc(c.challenger_id)}">🏆 ${esc(nome(c.challenger_id))}</button>
          ${c.opponent_id ? `<button class="btn win" style="flex:1;min-width:120px" data-act="vencedor-rev" data-id="${esc(c.id)}" data-w="${esc(c.opponent_id)}">🏆 ${esc(nome(c.opponent_id))}</button>` : ""}
        </div>
      </div>`;
    });
    if (revAtivos.length) {
      rv += `<div class="mini-h" style="margin:12px 0 6px;color:var(--warn)">🔴 Rolando hoje (liquida sozinho às 9h05)</div>
        <table class="tabela" style="width:100%"><tbody>
        ${revAtivos.map((c) => `<tr><td>${esc(nome(c.challenger_id))} VS ${esc(nome(c.opponent_id))}</td><td class="n">${c.stakes_amount > 0 ? brl(c.stakes_amount * 2) : "amistoso"}</td></tr>`).join("")}
        </tbody></table>`;
    }
    h += box("⚔️ Revisões de duelos", rv);

    // Withdrawals.
    let sq = "";
    if (!saques.length) sq = vazio("Nenhum saque aguardando envio.");
    saques.forEach((s) => {
      sq += `<div class="box" style="padding:10px 12px;margin-top:8px">
        <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;flex-wrap:wrap">
          <b>${esc(nomes[s.user_id] || "Vendedor")} · <span style="color:var(--warn)">${brl(s.valor)}</span></b>
          <span style="color:var(--dim)">${esc(U.dataHoraBR(s.created_at))}</span></div>
        <button class="btn ghost block" style="text-align:left;margin-top:6px" data-act="copiar-pix" data-id="${esc(s.id)}">
          <span style="display:block;font-size:10px;text-transform:uppercase;color:var(--dim)">Pix pra enviar ${brl(s.valor)} — toca pra copiar</span>
          <span style="display:block;font-weight:700;color:var(--warn);word-break:break-all">${esc(s.pix_key)}</span>
          ${s.pix_nome ? `<span style="display:block;font-size:11px;color:var(--dim)">Titular: ${esc(s.pix_nome)}</span>` : ""}
        </button>
        ${nota("O valor já saiu do saldo dele (reservado). Envie o Pix e confirme abaixo.")}
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          <button class="btn go" style="flex:1;min-width:140px" data-act="saque" data-id="${esc(s.id)}" data-acao="pago">✓ Pix enviado — marcar pago</button>
          <button class="btn lose" style="flex:1;min-width:140px" data-act="saque" data-id="${esc(s.id)}" data-acao="rejeitado">✗ Rejeitar (devolve o valor)</button>
        </div></div>`;
    });
    h += box(`💸 Saques ${saques.length ? "· " + saques.length + " aguardando" : ""}`, sq, "border-color:var(--warn)");

    // Deposits.
    let dp = "";
    if (!depsPend.length) dp += vazio("Nenhum depósito aguardando conferência.");
    else {
      dp += `<div class="mini-h" style="color:var(--warn)">Aguardando conferência (${depsPend.length})</div>`;
      depsPend.forEach((d) => {
        dp += `<div class="box" style="padding:10px 12px;margin-top:8px">
          <div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;flex-wrap:wrap">
            <b>${esc(nomes[d.user_id] || "Vendedor")} · ${brl(d.valor)}</b><span style="color:var(--dim)">${esc(U.dataHoraBR(d.created_at))}</span></div>
          ${d.remetente ? `<div style="font-size:11px;color:var(--dim);margin-top:4px">Remetente no comprovante: ${esc(d.remetente)}</div>` : ""}
          ${d.motivo ? `<div style="font-size:11px;color:var(--warn);margin-top:2px">Motivo: ${esc(d.motivo)}</div>` : ""}
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
            <button class="btn go" style="flex:1;min-width:140px" data-act="deposito" data-id="${esc(d.id)}" data-ok="1">✓ Caiu no banco — creditar</button>
            <button class="btn lose" style="flex:1;min-width:140px" data-act="deposito" data-id="${esc(d.id)}" data-ok="0">✗ Rejeitar</button>
          </div></div>`;
      });
    }
    if (depsRec.length) {
      dp += `<div class="mini-h" style="margin:14px 0 6px">✅ Auto-creditados recentes — bata com o banco 1×/dia</div>
        <div style="overflow:auto"><table class="tabela" style="width:100%"><tbody>
        ${depsRec.map((d) => `<tr><td>${esc(nomes[d.user_id] || "Vendedor")}${d.remetente ? " · de " + esc(d.remetente) : ""}${d.e2e_id ? `<div style="font-size:10px;color:var(--faint);word-break:break-all">E2E ${esc(d.e2e_id)}</div>` : ""}</td>
          <td class="n">${brl(d.valor)}<div style="font-size:10px;color:var(--faint)">${esc(U.dataHoraBR(d.created_at))}</div></td>
          <td style="width:1%"><button class="btn ghost" style="font-size:11px;padding:5px 9px" data-act="estornar" data-id="${esc(d.id)}">Estornar</button></td></tr>`).join("")}
        </tbody></table></div>
        ${nota("Não achou algum no extrato do banco? Estorne pelo botão acima (x1_admin_estornar_deposit).")}`;
    }
    h += box("📋 Depósitos", dp, "border-color:var(--ok)");

    // Wallets.
    h += box("💰 Carteiras · creditar / debitar", `
      <input data-w="busca" placeholder="Buscar vendedor pelo nome…" style="${INPUT}" autocomplete="off">
      <div data-w="achados" style="margin-top:6px"></div>
      <div data-w="form" style="display:none;margin-top:8px">
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
          <b data-w="sel" style="font-size:13px"></b>
          <button class="btn ghost" data-w="trocar" style="font-size:11px;padding:4px 9px">trocar</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          <input data-w="valor" type="number" inputmode="decimal" min="0" step="0.01" placeholder="R$" style="${INPUT};width:120px;flex:0 0 auto">
          <select data-w="tipo" style="${INPUT};width:auto;flex:0 0 auto"><option value="deposito">Depósito</option><option value="saque">Saque</option></select>
          <button class="btn go" data-w="aplicar">Aplicar</button>
        </div>
      </div>`);

    // Liquidation.
    h += box("🏁 Liquidação", `
      <p style="font-size:12px;color:var(--dim);margin:0 0 8px">Roda sozinha todo dia às 9h05 (extrato verificado decide, prêmio cai na carteira, 10% fica pra Vant). Use o botão só pra forçar agora.</p>
      <button class="btn block" data-act="liquidar">🏁 Liquidar duelos vencidos agora</button>`);

    // All duels (admin actions that lived inside X1Carteira).
    const FILTROS = [["abertos", "Em aberto"], ["todos", "Todos"], ["pending", "Negociação"], ["accepted", "Aguard. pagamento"], ["active", "Em andamento"], ["awaiting_result", "Aguard. resultado"], ["finished", "Encerrados"], ["cancelados", "Cancelados/recusados"]];
    h += box("🗂️ Todos os duelos · ações de admin", `
      <div class="pills" data-d="filtros" style="margin-bottom:8px">
        ${FILTROS.map(([k, t]) => `<button class="pill${UI.filtro === k ? " p1" : ""}" data-filtro="${k}" style="font-size:11px;padding:5px 10px">${t}</button>`).join("")}
      </div>
      <input data-d="busca" placeholder="Filtrar por nome do duelista…" value="${esc(UI.busca)}" style="${INPUT}">
      <div data-d="lista" style="margin-top:8px"></div>
      ${nota("Mostra os 150 duelos mais recentes. “Excluir” apaga de vez (limpa públicos/teste) — diferente de cancelar.")}`);

    const raiz = document.createElement("div");
    raiz.innerHTML = h;
    el.innerHTML = "";
    el.appendChild(raiz);

    // ---------- duel list ----------
    const lista = raiz.querySelector('[data-d="lista"]');
    function desenharDuelos() {
      const q = UI.busca.trim().toLowerCase();
      const rows = duelos.filter((c) => {
        if (UI.filtro === "abertos" && !["pending", "accepted", "active", "awaiting_result"].includes(c.status)) return false;
        if (UI.filtro === "cancelados" && !["cancelled", "declined"].includes(c.status)) return false;
        if (!["abertos", "todos", "cancelados"].includes(UI.filtro) && c.status !== UI.filtro) return false;
        if (q && !(nome(c.challenger_id) + " " + nome(c.opponent_id)).toLowerCase().includes(q)) return false;
        return true;
      });
      if (!rows.length) { lista.innerHTML = vazio("Nenhum duelo nesse filtro."); return; }
      lista.innerHTML = rows.map((c) => {
        const podeVencedor = c.status === "active" || c.status === "awaiting_result";
        const podeAnular = !["finished", "cancelled", "declined"].includes(c.status);
        return `<div class="box" style="padding:10px 12px;margin-top:8px">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <b style="flex:1;min-width:0;font-size:13px">${esc(nome(c.challenger_id))} <span style="color:var(--dim)">VS</span> ${esc(nome(c.opponent_id))}</b>
            <span class="pill ${STATUS_PILL[c.status] || ""}">${esc(STATUS[c.status] || c.status)}</span></div>
          <div style="font-size:11px;color:var(--dim);margin-top:4px">📅 ${esc(diaBR(c.scheduled_date))}
            ${c.stakes_amount > 0 ? ` · aposta ${brl(c.stakes_amount)} · pote ${brl(c.stakes_amount * 2)} · prêmio ${brl(c.prize_amount)} · taxa ${brl(c.fee_amount)}` : " · amistoso"}
            ${c.goal_amount ? ` · 🎯 ${brl(c.goal_amount)}` : ""}${c.modo ? " · ⚡ " + esc(c.modo) : ""}
            ${c.money_status ? " · " + esc(MONEY[c.money_status] || c.money_status) : ""} · criado ${esc(U.dataBR(c.created_at))}</div>
          ${c.status === "finished" && c.winner_user_id ? `<div style="font-size:12px;margin-top:4px">🏆 Vencedor: <b style="color:var(--warn)">${esc(nome(c.winner_user_id))}</b>${c.prize_amount > 0 ? " · prêmio " + brl(c.prize_amount) : ""}</div>` : ""}
          <div data-placar="${esc(c.id)}" style="font-size:12px;margin-top:4px"></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
            ${c.status === "accepted" || c.status === "active" || c.status === "awaiting_result" ? `<button class="btn ghost" style="font-size:11px;padding:5px 9px" data-act="placar" data-id="${esc(c.id)}">📊 Placar</button>` : ""}
            ${podeVencedor ? `<button class="btn win" style="font-size:11px;padding:5px 9px" data-act="vencedor-x1" data-id="${esc(c.id)}" data-w="${esc(c.challenger_id)}">🏆 ${esc(nome(c.challenger_id))}</button>` : ""}
            ${podeVencedor && c.opponent_id ? `<button class="btn win" style="font-size:11px;padding:5px 9px" data-act="vencedor-x1" data-id="${esc(c.id)}" data-w="${esc(c.opponent_id)}">🏆 ${esc(nome(c.opponent_id))}</button>` : ""}
            ${podeAnular ? `<button class="btn ghost" style="font-size:11px;padding:5px 9px" data-act="anular" data-id="${esc(c.id)}">⛔ Anular duelo</button>` : ""}
            <button class="btn lose" style="font-size:11px;padding:5px 9px" data-act="excluir" data-id="${esc(c.id)}">🗑 Excluir X1</button>
          </div></div>`;
      }).join("");
    }
    desenharDuelos();
    raiz.querySelectorAll("[data-filtro]").forEach((b) => b.addEventListener("click", () => {
      UI.filtro = b.dataset.filtro;
      raiz.querySelectorAll("[data-filtro]").forEach((x) => x.classList.toggle("p1", x === b));
      desenharDuelos();
    }));
    raiz.querySelector('[data-d="busca"]').addEventListener("input", (e) => { UI.busca = e.target.value; desenharDuelos(); });

    // ---------- actions ----------
    async function rodar(nomeRpc, args, okMsg) {
      const { error } = await U.rpc(nomeRpc, args);
      if (error) { U.aviso("Não rolou: " + error, true); return false; }
      U.aviso(okMsg);
      window.CRMAdmin.recarregar();
      return true;
    }
    async function lerPlacar(id) {
      const { data, error } = await U.rpc("x1_placar", { p_id: id });
      if (error) return { erro: error };
      const row = (data || [])[0];
      return { ch: Number(row && row.challenger_total) || 0, op: Number(row && row.opponent_total) || 0 };
    }
    async function abrirComprovante(path) {
      if (!path) return;
      const w = window.open("", "_blank"); // open first so popup blockers allow it
      const { data } = await sb.storage.from("x1-proofs").createSignedUrl(path, 120);
      if (data && data.signedUrl) { if (w) w.location.href = data.signedUrl; else window.open(data.signedUrl, "_blank"); }
      else { if (w) w.close(); U.aviso("Não consegui abrir o comprovante", true); }
    }
    async function analisarIA(btn, uid) {
      const outs = raiz.querySelectorAll(`[data-ia-out="${CSS.escape(uid)}"]`);
      const btns = raiz.querySelectorAll(`[data-act="ia"][data-uid="${CSS.escape(uid)}"]`);
      btns.forEach((b) => { b.disabled = true; b.textContent = "Analisando…"; });
      const { data, error } = await U.funcao("analisar-anomalia", { user_id: uid });
      let html;
      if (error) html = `<span style="color:var(--bad)">Erro: ${esc(error || "Falhou — tenta de novo.")}</span>`;
      else {
        const score = Number((data && data.score) || 0);
        html = `<span style="color:${score >= 60 ? "var(--bad)" : "var(--ok)"}">IA: ${data && data.suspeito ? "🚩 Suspeito" : "✅ Normal"} · ${score}</span> — <span style="color:var(--dim)">${esc((data && data.motivo) || "")}</span>`;
      }
      outs.forEach((o) => (o.innerHTML = html));
      btns.forEach((b) => { b.disabled = false; b.textContent = "✨ Analisar com IA"; });
    }

    raiz.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-act]");
      if (!b || b.disabled || !raiz.contains(b)) return;
      const act = b.dataset.act, id = b.dataset.id;
      const c = id ? porId[id] : null;

      if (act === "tes-csv" && tesouraria) {
        const linhas = [["usuario", "user_id", "saldo"]].concat((tesouraria.por_usuario || []).map((u) => [u.nome || "", u.user_id, String(u.saldo)]));
        const csv = linhas.map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
        a.download = `tesouraria-x1-${hoje}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
      } else if (act === "prova") {
        abrirComprovante(b.dataset.path);
      } else if (act === "ia") {
        analisarIA(b, b.dataset.uid);
      } else if (act === "confirmar-pag" && c) {
        if (!U.confirmar(`Confirmar o pagamento de ${nome(c.challenger_id)} e ${nome(c.opponent_id)} e liberar o duelo?`)) return;
        rodar("x1_admin_confirm_payment", { p_id: c.id }, "Pagamentos confirmados — duelo liberado");
      } else if (act === "vencedor-rev" && c) {
        if (!U.confirmar(`Premiar ${nome(b.dataset.w)} como vencedor deste X1?${c.stakes_amount > 0 ? " Prêmio " + brl(c.prize_amount) + "." : ""}`)) return;
        rodar("x1_admin_set_result", { p_id: c.id, p_winner: b.dataset.w, p_challenger_score: null, p_opponent_score: null, p_prize: c.prize_amount, p_fee: c.fee_amount, p_notes: "" }, "Resultado salvo! 🏆");
      } else if (act === "vencedor-x1" && c) {
        // Same as X1Carteira's admin "premiar": scores from the live board.
        // Prize/fee use the duel's stored values (10% rake), not x1_settings.fee_flat.
        // A duel whose stake was set but prize never filled in falls back to pot − fee.
        const fee = Number(c.fee_amount) || 0;
        const premio = Number(c.prize_amount) > 0 ? Number(c.prize_amount) : Math.max(0, (Number(c.stakes_amount) || 0) * 2 - fee);
        if (!U.confirmar(`Premiar ${nome(b.dataset.w)} como vencedor deste X1?${c.stakes_amount > 0 ? " Prêmio " + brl(premio) + "." : ""}`)) return;
        const p = await lerPlacar(c.id);
        rodar("x1_admin_set_result", {
          p_id: c.id, p_winner: b.dataset.w,
          p_challenger_score: p.erro ? 0 : p.ch, p_opponent_score: p.erro ? 0 : p.op,
          p_prize: premio, p_fee: fee,
          p_notes: "definido pelo admin no X1",
        }, "Vencedor premiado! 🏆");
      } else if (act === "placar" && c) {
        const out = raiz.querySelector(`[data-placar="${CSS.escape(c.id)}"]`);
        out.textContent = "Carregando placar…";
        const p = await lerPlacar(c.id);
        out.innerHTML = p.erro ? `<span style="color:var(--bad)">Erro: ${esc(p.erro)}</span>`
          : `📊 ${esc(nome(c.challenger_id))} <b>${brl(p.ch)}</b> × <b>${brl(p.op)}</b> ${esc(nome(c.opponent_id))}`;
      } else if (act === "anular" && c) {
        const motivo = window.prompt("Anular este duelo? Ele vira cancelado e, se a aposta já estava garantida, o valor volta pra carteira dos dois.\nMotivo (opcional):", "anulado pelo admin");
        if (motivo === null) return;
        rodar("x1_admin_void", { p_id: c.id, p_reason: motivo.trim() || null }, "Duelo anulado");
      } else if (act === "excluir" && c) {
        if (!U.confirmar("Excluir este X1 de vez? Não dá pra desfazer.")) return;
        rodar("admin_delete_x1", { p_id: c.id }, "X1 excluído");
      } else if (act === "copiar-pix") {
        const s = saques.find((x) => x.id === id);
        if (s) U.copiar(s.pix_key, "Chave Pix copiada");
      } else if (act === "saque") {
        const s = saques.find((x) => x.id === id);
        if (!s) return;
        const pago = b.dataset.acao === "pago";
        const msg = pago
          ? `Confirma que você JÁ enviou o Pix de ${brl(s.valor)} para ${s.pix_key}? O débito fica mantido.`
          : `Rejeitar o saque de ${brl(s.valor)}? O valor volta para o saldo do vendedor.`;
        if (!U.confirmar(msg)) return;
        rodar("x1_admin_resolve_withdraw", { p_id: s.id, p_acao: b.dataset.acao, p_motivo: pago ? null : "rejeitado pelo admin" },
          pago ? "Saque marcado como pago 💸" : "Saque rejeitado — valor devolvido ao saldo");
      } else if (act === "deposito") {
        const d = depsPend.find((x) => x.id === id);
        if (!d) return;
        const ok = b.dataset.ok === "1";
        if (!U.confirmar(ok ? `Confirma que ${brl(d.valor)} caiu no banco? Vai creditar na carteira de ${nomes[d.user_id] || "Vendedor"}.` : `Rejeitar o depósito de ${brl(d.valor)}? (não localizado no banco)`)) return;
        rodar("x1_admin_resolve_deposit", { p_id: d.id, p_aprovar: ok, p_motivo: ok ? null : "não localizado no banco" }, ok ? "Depósito creditado ✅" : "Depósito rejeitado");
      } else if (act === "estornar") {
        const d = depsRec.find((x) => x.id === id);
        if (!d) return;
        if (!U.confirmar(`Estornar o depósito de ${brl(d.valor)} de ${nomes[d.user_id] || "Vendedor"}? O valor sai do saldo dele.`)) return;
        rodar("x1_admin_estornar_deposit", { p_id: d.id, p_motivo: "não localizado no extrato do banco" }, "Depósito estornado");
      } else if (act === "liquidar") {
        if (!U.confirmar("Liquidar agora todos os duelos vencidos? (o mesmo que roda sozinho às 9h05)")) return;
        rodar("x1_settle_due", {}, "Liquidação executada — confere os resultados 🏁");
      }
    });

    // ---------- wallets ----------
    const W = (k) => raiz.querySelector(`[data-w="${k}"]`);
    let sel = null, timer = null, seq = 0;
    const limparCarteira = () => { sel = null; W("busca").value = ""; W("achados").innerHTML = ""; W("valor").value = ""; W("tipo").value = "deposito"; W("form").style.display = "none"; };
    W("busca").addEventListener("input", (e) => {
      const q = e.target.value.trim();
      sel = null; W("form").style.display = "none";
      clearTimeout(timer);
      if (q.length < 2) { W("achados").innerHTML = ""; return; }
      timer = setTimeout(async () => {
        const meu = ++seq;
        const { data, error } = await sb.from("public_profiles").select("user_id, nickname, avatar_url").ilike("nickname", `%${q}%`).limit(5);
        if (meu !== seq) return;
        if (error) { U.aviso(error.message, true); return; }
        const achados = data || [];
        W("achados").innerHTML = achados.length
          ? achados.map((p, i) => `<button class="btn ghost block" data-achado="${i}" style="text-align:left;margin-top:4px;font-size:12px">${esc(p.nickname || "Vendedor")}</button>`).join("")
          : vazio("Ninguém com esse nome.");
        W("achados").querySelectorAll("[data-achado]").forEach((bt) => bt.addEventListener("click", () => {
          sel = achados[Number(bt.dataset.achado)];
          W("achados").innerHTML = "";
          W("sel").textContent = sel.nickname || "Vendedor";
          W("form").style.display = "";
          W("valor").focus();
        }));
      }, 250);
    });
    W("trocar").addEventListener("click", limparCarteira);
    W("aplicar").addEventListener("click", async () => {
      const v = Number(String(W("valor").value).replace(",", "."));
      const tipo = W("tipo").value;
      if (!sel || !v || v <= 0) { U.aviso("Escolhe o vendedor e um valor válido", true); return; }
      const quem = sel.nickname || "Vendedor";
      if (!U.confirmar(tipo === "deposito" ? `Creditar ${brl(v)} na carteira de ${quem}?` : `Debitar (saque) ${brl(v)} da carteira de ${quem}?`)) return;
      const ok = await rodar("x1_admin_wallet_move", { p_user: sel.user_id, p_amount: v, p_tipo: tipo, p_notes: `${tipo} via central de admin` },
        tipo === "deposito" ? `Crédito de ${brl(v)} pra ${quem} ✅` : `Saque de ${brl(v)} registrado ✅`);
      if (ok) limparCarteira();
    });

  }

  window.CRMAdmin.secao("x1", { titulo: "X1 · Carteiras", ordem: 30, render });
})();
