/* ============================================================
   CRM da Vant — Admin › Competições
   Port of src/pages/AdminCompetitions.tsx: create / edit / pin / delete
   competitions, list participants, award a winner (finish), plus a read-only
   ranking drawer (RPC competition_ranking, same one the app's ranking uses).
   Server-side rules (RLS, admin_* RPCs) stay exactly as they are.
   ============================================================ */
(function () {
  "use strict";
  if (!window.CRMAdmin) return;
  const U = window.CRMAdmin.util;

  const INPUT = "width:100%;padding:9px 11px;border:1px solid var(--line2);border-radius:9px;background:var(--panel);color:var(--ink);font:inherit;box-sizing:border-box";
  const LBL = "display:block;font-size:11px;color:var(--dim);margin:0 0 4px";

  const todayIso = () => new Date().toISOString().slice(0, 10);
  const inDaysIso = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

  const PERIODOS = { weekly: "Semanal", monthly: "Mensal", custom: "Personalizado" };
  const METRICAS = { pix_revenue: "Faturamento PIX", pix_sales_count: "Nº vendas PIX", streak: "Ofensiva (dias)" };
  const ENTRADAS = { free: "Livre", paid: "Paga", invite: "Convite" };
  const PUBLICOS = { open: "Aberto a todos", city: "Restrito a cidades", invite: "Apenas convidados (por CPF)" };
  const STATUS = { active: "p2", finished: "p4" };

  function formVazio() {
    return {
      name: "", description: "", prize_label: "", prize_value: "0",
      period_type: "weekly", starts_at: todayIso(), ends_at: inDaysIso(7),
      metric: "pix_revenue", entry_rule: "free", entry_fee: "0",
      entry_instructions: "", recurrence_note: "",
      audience_type: "open", audience_cities: "", invited_cpfs: "",
      bilhete_intro_sub: "", bilhete_prize_desc: "", bilhete_minis: "",
      bilhete_comissao_titulo: "", bilhete_comissoes: "", bilhete_comissao_nota: "",
    };
  }

  // Module state survives re-renders so a half-filled form is not lost on reload.
  let form = formVazio();
  let editingId = null;

  const opts = (map, sel) => Object.keys(map).map((k) =>
    `<option value="${U.esc(k)}"${k === sel ? " selected" : ""}>${U.esc(map[k])}</option>`).join("");
  const campo = (rotulo, nome, tipo, ph) => `<div><label style="${LBL}">${U.esc(rotulo)}</label>
      <input data-f="${nome}" type="${tipo || "text"}" value="${U.esc(form[nome])}" placeholder="${U.esc(ph || "")}" style="${INPUT}"${tipo === "number" ? ' inputmode="decimal"' : ""}></div>`;
  const area = (rotulo, nome, linhas, ph) => `<div><label style="${LBL}">${U.esc(rotulo)}</label>
      <textarea data-f="${nome}" rows="${linhas}" placeholder="${U.esc(ph || "")}" style="${INPUT};resize:vertical">${U.esc(form[nome])}</textarea></div>`;
  const sel = (rotulo, nome, map) => `<div><label style="${LBL}">${U.esc(rotulo)}</label>
      <select data-f="${nome}" style="${INPUT}">${opts(map, form[nome])}</select></div>`;
  const G2 = "display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px";

  function htmlForm() {
    return `<div class="box" style="padding:14px;margin-bottom:12px">
      <h4 class="mini-h" style="margin:0 0 10px">${editingId ? "Editar competição" : "Nova competição"}</h4>
      <div style="display:grid;gap:10px">
        ${campo("Nome", "name")}
        ${area("Descrição", "description", 2)}
        <div style="${G2}">${campo("Prêmio (texto)", "prize_label", "text", "iPhone, R$500 PIX...")}${campo("Valor R$", "prize_value", "number")}</div>
        <div style="${G2}">${sel("Período", "period_type", PERIODOS)}${sel("Métrica", "metric", METRICAS)}</div>
        <div style="${G2}">${campo("Início", "starts_at", "date")}${campo("Fim", "ends_at", "date")}</div>
        <div style="${G2}">${sel("Entrada", "entry_rule", ENTRADAS)}
          <div data-show="fee" style="${form.entry_rule === "paid" ? "" : "display:none"}">${campo("Taxa R$", "entry_fee", "number")}</div></div>
        ${area("Instruções de entrada (opcional)", "entry_instructions", 2, "Ex: envie PIX para X e avise no WhatsApp...")}
        ${campo("Premiação — frequência (opcional)", "recurrence_note", "text", "Ex: Toda semana o Top 1 leva R$500")}

        <div style="border:1px solid var(--c5);background:var(--c5s);border-radius:10px;padding:10px;display:grid;gap:10px">
          <div class="mini-h" style="color:var(--c5)">🎟️ Bilhete dourado (opcional)${editingId ? " — só na criação" : ""}</div>
          ${campo("Frase do convite", "bilhete_intro_sub", "text", "Um dos pioneiros do maior movimento...")}
          ${campo("Descrição do prêmio", "bilhete_prize_desc", "text", "Para o maior vendedor do mês — no Pix")}
          ${area("Prêmios menores (1 por linha: valor | descrição)", "bilhete_minis", 2, "R$100 | Top 1 da semana\nR$50 | Por 3 indicações")}
          ${campo("Título da comissão", "bilhete_comissao_titulo", "text", "Ganhe indicando...")}
          ${area("Faixas de comissão (1 por linha: descrição | valor)", "bilhete_comissoes", 3, "Até 10 indicados | R$5/cada\nDe 11 a 30 | R$7/cada\n31+ | R$10/cada")}
          ${campo("Observação da comissão", "bilhete_comissao_nota", "text", "Cada faixa vale para os indicados dentro dela.")}
        </div>

        <div style="border:1px solid var(--c1);background:var(--c1s);border-radius:10px;padding:10px;display:grid;gap:10px">
          <div class="mini-h" style="color:var(--c1)">Quem pode participar${editingId ? " — só na criação" : ""}</div>
          ${sel("Público", "audience_type", PUBLICOS)}
          <div data-show="city" style="${form.audience_type === "city" ? "" : "display:none"}">${campo("Cidades permitidas (separadas por vírgula)", "audience_cities", "text", "São Paulo, Rio de Janeiro")}</div>
          <div data-show="invite" style="${form.audience_type === "invite" ? "" : "display:none"}">${area("CPFs convidados (vírgula ou uma linha cada)", "invited_cpfs", 3, "12345678900, 98765432100")}</div>
        </div>
        ${editingId ? `<div style="font-size:11px;color:var(--faint)">Na edição só os campos principais são salvos (como no app): bilhete e público ficam como foram criados.</div>` : ""}
        <div style="display:flex;gap:8px">
          <button class="btn go" data-acao="salvar" style="flex:1">${editingId ? "Salvar alterações" : "Criar competição"}</button>
          ${editingId ? `<button class="btn ghost" data-acao="cancelar">Cancelar</button>` : ""}
        </div>
      </div></div>`;
  }

  function htmlLista(comps, parts, nomes) {
    if (!comps.length) return `<div class="box" style="padding:18px;color:var(--dim);text-align:center">Nenhuma competição ainda.</div>`;
    return comps.map((c) => {
      const ps = parts[c.id] || [];
      const ativa = c.status === "active";
      return `<div class="box" style="padding:14px;margin-bottom:10px">
        <div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:180px">
            <div class="pills" style="margin-bottom:4px">
              <span class="pill ${STATUS[c.status] || ""}">${U.esc(c.status)}</span>
              <span class="pill">${U.esc(PERIODOS[c.period_type] || c.period_type)}</span>
              ${c.pinned ? `<span class="pill p5">📌 fixada</span>` : ""}
            </div>
            <b style="font-size:15px">${U.esc(c.name)}</b>
            <div style="font-size:12px;color:var(--dim)">${U.esc(c.prize_label)}${Number(c.prize_value) ? " · " + U.esc(U.brl(c.prize_value)) : ""}</div>
            <div style="font-size:11px;color:var(--faint);margin-top:2px">${U.esc(U.dataBR(c.starts_at))} → ${U.esc(U.dataBR(c.ends_at))} · ${U.esc(METRICAS[c.metric] || c.metric)} · entrada ${U.esc(ENTRADAS[c.entry_rule] || c.entry_rule)}${c.entry_rule === "paid" && c.entry_fee != null ? " " + U.esc(U.brl(c.entry_fee)) : ""}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn ghost" data-rank="${U.esc(c.id)}" style="padding:6px 10px;font-size:12px">Ranking</button>
            <button class="btn ghost" data-edit="${U.esc(c.id)}" style="padding:6px 10px;font-size:12px">Editar</button>
            <button class="btn ghost" data-pin="${U.esc(c.id)}" style="padding:6px 10px;font-size:12px">${c.pinned ? "Desafixar" : "Fixar"}</button>
            <button class="btn lose" data-del="${U.esc(c.id)}" style="padding:6px 10px;font-size:12px">Excluir</button>
          </div>
        </div>
        <div class="mini-h" style="margin:12px 0 6px">Participantes (${ps.length})</div>
        ${ps.length ? ps.map((p) => `<div style="display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:8px;padding:6px 9px;margin-bottom:4px">
            <span style="flex:1;font-size:13px">${U.esc(nomes[p.user_id] || String(p.user_id).slice(0, 8))}</span>
            ${p.score != null ? `<span style="font-size:11px;color:var(--faint)">${U.esc(p.score)}</span>` : ""}
            ${p.paid ? `<span class="pill p2" style="font-size:10px">pago</span>` : ""}
            ${c.winner_user_id === p.user_id ? `<span class="pill p2">✓ vencedor</span>` : ""}
            ${ativa ? `<button class="btn win" data-premiar="${U.esc(c.id)}" data-uid="${U.esc(p.user_id)}" style="padding:5px 10px;font-size:12px">🏆 Premiar</button>` : ""}
          </div>`).join("") : `<div style="font-size:12px;color:var(--faint);font-style:italic">Sem participantes ainda.</div>`}
      </div>`;
    }).join("");
  }

  async function carregar(sb) {
    const rc = await sb.from("competitions").select("*")
      .order("pinned", { ascending: false }).order("created_at", { ascending: false });
    if (rc.error) throw new Error(rc.error.message);
    const rp = await sb.from("competition_participants").select("*");
    if (rp.error) U.aviso("Participantes: " + rp.error.message, true);
    const parts = {};
    (rp.data || []).forEach((r) => { (parts[r.competition_id] = parts[r.competition_id] || []).push(r); });
    const ids = Array.from(new Set((rp.data || []).map((r) => r.user_id)));
    const nomes = {};
    if (ids.length) {
      const pr = await sb.from("profiles").select("user_id,nickname").in("user_id", ids);
      (pr.data || []).forEach((p) => { nomes[p.user_id] = p.nickname || String(p.user_id).slice(0, 6); });
    }
    return { comps: rc.data || [], parts, nomes };
  }

  function linhas(txt, a, b) {
    return String(txt || "").split("\n").map((l) => l.split("|"))
      .filter((p) => p[0] && p[0].trim())
      .map((p) => ({ [a]: p[0].trim(), [b]: (p[1] || "").trim() }));
  }

  async function salvar(sb, user) {
    if (!form.name || !form.prize_label) { U.aviso("Preencha nome e prêmio", true); return false; }
    const base = {
      name: form.name,
      description: form.description || null,
      prize_label: form.prize_label,
      prize_value: Number(form.prize_value) || 0,
      period_type: form.period_type,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      metric: form.metric,
      entry_rule: form.entry_rule,
      entry_fee: form.entry_rule === "paid" ? Number(form.entry_fee) || 0 : null,
      entry_instructions: form.entry_instructions || null,
      recurrence_note: form.recurrence_note || null,
    };
    if (isNaN(new Date(form.starts_at)) || isNaN(new Date(form.ends_at))) { U.aviso("Datas inválidas", true); return false; }

    if (editingId) {
      const r = await U.rpc("admin_update_competition", { p_id: editingId, p_data: base });
      if (r.error) { U.aviso("Erro ao salvar: " + r.error, true); return false; }
      U.aviso("Competição atualizada!");
      editingId = null;
      form = Object.assign(form, { name: "", description: "", prize_label: "", prize_value: "0", entry_instructions: "", recurrence_note: "" });
      return true;
    }

    // Invited CPFs -> user_ids (same lookup the app did).
    let invited_user_ids = [];
    if (form.audience_type === "invite" && form.invited_cpfs.trim()) {
      const cpfs = form.invited_cpfs.split(/[,\n]/).map((s) => s.replace(/\D/g, "")).filter((s) => s.length === 11);
      if (cpfs.length) {
        const pr = await sb.from("profiles").select("user_id,cpf").in("cpf", cpfs);
        if (pr.error) { U.aviso("Erro ao buscar CPFs: " + pr.error.message, true); return false; }
        invited_user_ids = (pr.data || []).map((p) => p.user_id);
        if (invited_user_ids.length < cpfs.length) {
          U.aviso(`Alguns CPFs não foram encontrados: ${invited_user_ids.length}/${cpfs.length} cadastrados serão convidados.`, true);
        }
      }
    }
    const audience_cities = form.audience_type === "city"
      ? form.audience_cities.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const bMinis = linhas(form.bilhete_minis, "valor", "label");
    const bComis = linhas(form.bilhete_comissoes, "nome", "val");
    const bilhete_config = (form.bilhete_intro_sub || form.bilhete_prize_desc || bMinis.length || bComis.length || form.bilhete_comissao_titulo)
      ? {
          introSub: form.bilhete_intro_sub || null,
          grandPrizeDesc: form.bilhete_prize_desc || null,
          miniPrizes: bMinis,
          commissionTitle: form.bilhete_comissao_titulo || null,
          commissionTiers: bComis,
          commissionNote: form.bilhete_comissao_nota || null,
        }
      : null;

    const { error } = await sb.from("competitions").insert(Object.assign({}, base, {
      status: "active",
      created_by: user.id,
      audience_type: form.audience_type,
      audience_cities,
      invited_user_ids,
      bilhete_config,
    }));
    if (error) { U.aviso("Erro: " + error.message, true); return false; }
    U.aviso("Competição criada!");
    form = Object.assign(form, {
      name: "", description: "", prize_label: "", prize_value: "0", entry_instructions: "", recurrence_note: "",
      audience_cities: "", invited_cpfs: "", bilhete_intro_sub: "", bilhete_prize_desc: "", bilhete_minis: "",
      bilhete_comissao_titulo: "", bilhete_comissoes: "", bilhete_comissao_nota: "",
    });
    return true;
  }

  async function verRanking(c) {
    window.CRMAdmin.abrirPainel("Ranking — " + (c.name || ""), `<div style="color:var(--dim)">Carregando…</div>`, async (body) => {
      const r = await U.rpc("competition_ranking", { p_id: c.id });
      if (r.error) { body.innerHTML = `<div style="color:var(--bad)">${U.esc(r.error)}</div>`; return; }
      const rows = r.data || [];
      body.innerHTML = rows.length ? `<div style="font-size:11px;color:var(--faint);margin-bottom:8px">Valor verificado por extrato no período (mesmo ranking que o app mostra).</div>
        <table class="tabela" style="width:100%"><thead><tr><th>#</th><th>Vendedor</th><th>Faturamento</th><th>Dias</th></tr></thead><tbody>
        ${rows.map((x, i) => `<tr><td class="n">${i + 1}</td><td>${U.esc(x.nome_usuario || String(x.user_id).slice(0, 8))}</td>
          <td class="n">${U.esc(U.brl(x.faturamento))}</td><td class="n">${U.esc(Number(x.dias) || 0)}</td></tr>`).join("")}
        </tbody></table>` : `<div style="color:var(--dim)">Ninguém pontuou ainda.</div>`;
    });
  }

  window.CRMAdmin.secao("competicoes", {
    titulo: "Competições",
    ordem: 40,
    render: async (el, ctx) => {
      const sb = ctx.sb;
      el.innerHTML = `<div class="box" style="padding:18px;color:var(--dim)">Carregando…</div>`;
      let dados;
      try { dados = await carregar(sb); }
      catch (e) { U.aviso(e.message, true); el.innerHTML = `<div class="box" style="padding:18px;color:var(--bad)">${U.esc(e.message)}</div>`; return; }
      const { comps, parts, nomes } = dados;
      const porId = {}; comps.forEach((c) => { porId[c.id] = c; });

      const ativas = comps.filter((c) => c.status === "active").length;
      const totalPart = Object.values(parts).reduce((s, a) => s + a.length, 0);
      el.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin-bottom:12px">
          <div class="stat"><div class="k">Competições</div><div class="v">${comps.length}</div></div>
          <div class="stat"><div class="k">Ativas</div><div class="v">${ativas}</div></div>
          <div class="stat"><div class="k">Inscrições</div><div class="v">${totalPart}</div></div>
        </div>
        <div id="cmp-form">${htmlForm()}</div>
        <div id="cmp-lista">${htmlLista(comps, parts, nomes)}</div>`;

      const redesenharForm = () => { el.querySelector("#cmp-form").innerHTML = htmlForm(); ligarForm(); };
      function ligarForm() {
        const box = el.querySelector("#cmp-form");
        box.querySelectorAll("[data-f]").forEach((inp) => {
          const ev = inp.tagName === "SELECT" ? "change" : "input";
          inp.addEventListener(ev, () => {
            form[inp.dataset.f] = inp.value;
            if (inp.dataset.f === "entry_rule") box.querySelector('[data-show="fee"]').style.display = inp.value === "paid" ? "" : "none";
            if (inp.dataset.f === "audience_type") {
              box.querySelector('[data-show="city"]').style.display = inp.value === "city" ? "" : "none";
              box.querySelector('[data-show="invite"]').style.display = inp.value === "invite" ? "" : "none";
            }
          });
        });
        const bs = box.querySelector('[data-acao="salvar"]');
        bs.addEventListener("click", async () => {
          bs.disabled = true; bs.textContent = "Salvando…";
          const ok = await salvar(sb, ctx.user);
          if (ok) window.CRMAdmin.recarregar();
          else { bs.disabled = false; bs.textContent = editingId ? "Salvar alterações" : "Criar competição"; }
        });
        const bc = box.querySelector('[data-acao="cancelar"]');
        if (bc) bc.addEventListener("click", () => {
          editingId = null;
          Object.assign(form, { name: "", description: "", prize_label: "", prize_value: "0", entry_instructions: "", recurrence_note: "" });
          redesenharForm();
        });
      }
      ligarForm();

      const lista = el.querySelector("#cmp-lista");
      lista.querySelectorAll("[data-rank]").forEach((b) => b.addEventListener("click", () => verRanking(porId[b.dataset.rank])));
      lista.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => {
        const c = porId[b.dataset.edit];
        editingId = c.id;
        Object.assign(form, {
          name: c.name || "", description: c.description || "", prize_label: c.prize_label || "",
          prize_value: String(c.prize_value != null ? c.prize_value : 0), period_type: c.period_type || "weekly",
          starts_at: String(c.starts_at || "").slice(0, 10), ends_at: String(c.ends_at || "").slice(0, 10),
          metric: c.metric || "pix_revenue", entry_rule: c.entry_rule || "free",
          entry_fee: String(c.entry_fee != null ? c.entry_fee : 0),
          entry_instructions: c.entry_instructions || "", recurrence_note: c.recurrence_note || "",
        });
        redesenharForm();
        el.querySelector("#cmp-form").scrollIntoView({ behavior: "smooth", block: "start" });
      }));
      lista.querySelectorAll("[data-pin]").forEach((b) => b.addEventListener("click", async () => {
        const c = porId[b.dataset.pin];
        b.disabled = true;
        const r = await U.rpc("admin_set_competition_pin", { p_id: c.id, p_pinned: !c.pinned });
        if (r.error) { U.aviso("Erro ao fixar: " + r.error, true); b.disabled = false; return; }
        window.CRMAdmin.recarregar();
      }));
      lista.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
        if (!U.confirmar("Excluir esta competição? Isso apaga os participantes e não dá pra desfazer.")) return;
        b.disabled = true;
        const r = await U.rpc("admin_delete_competition", { p_id: b.dataset.del });
        if (r.error) { U.aviso("Não consegui excluir: " + r.error, true); b.disabled = false; return; }
        if (editingId === b.dataset.del) { editingId = null; form = formVazio(); }
        U.aviso("Competição excluída");
        window.CRMAdmin.recarregar();
      }));
      lista.querySelectorAll("[data-premiar]").forEach((b) => b.addEventListener("click", async () => {
        const c = porId[b.dataset.premiar], uid = b.dataset.uid;
        if (!U.confirmar(`Finalizar competição e premiar ${nomes[uid] || uid}?`)) return;
        b.disabled = true;
        const fin = await sb.from("competitions").update({ status: "finished", winner_user_id: uid }).eq("id", c.id);
        if (fin.error) { U.aviso("Não consegui finalizar a competição: " + fin.error.message, true); b.disabled = false; return; }
        const win = await sb.from("competition_winners").insert({
          competition_id: c.id, user_id: uid, prize_label: c.prize_label, prize_value: c.prize_value,
        });
        if (win.error) { U.aviso("Finalizei a competição, mas não consegui registrar o vencedor: " + win.error.message, true); window.CRMAdmin.recarregar(); return; }
        U.aviso("Vencedor registrado! 🏆");
        window.CRMAdmin.recarregar();
      }));
    },
  });
})();
