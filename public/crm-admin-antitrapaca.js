/* ============================================================
   CRM da Vant — Admin › Anti-trapaça
   Port of src/pages/AdminAntiCheat.tsx: lists who had a day far above their
   own average (RPC defcon_anomaly_suspects), shows a 30-day history
   (defcon_user_history), AI verdict (edge function analisar-anomalia) and
   hides a user from the ranking (profiles.ranking_hidden + delete
   leaderboard_stats + recalculate_ranking_positions for the current month,
   i.e. the forced admin path of src/shared/lib/ranking-recalc.ts).
   ============================================================ */
(function () {
  "use strict";
  if (!window.CRMAdmin) return;
  const U = window.CRMAdmin.util;

  const INPUT = "width:100%;padding:9px 11px;border:1px solid var(--line2);border-radius:9px;background:var(--panel);color:var(--ink);font:inherit;box-sizing:border-box";
  const dMM = (iso) => {
    const d = new Date(String(iso) + "T12:00:00");
    return isNaN(d) ? String(iso || "—") : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  // Module state: survives re-renders of the section.
  let ratio = "1.8";
  let lista = [];
  let abertoUid = null;
  const hist = {};    // uid -> rows
  const ia = {};      // uid -> {loading, suspeito, score, motivo, erro}

  async function carregar() {
    const r = Number(String(ratio).replace(",", ".")) || 1.8;
    const res = await U.rpc("defcon_anomaly_suspects", { p_lookback: 21, p_min_ratio: r });
    if (res.error) U.aviso("Erro ao carregar: " + res.error, true);
    lista = res.data || [];
  }

  function htmlHist(uid) {
    const h = hist[uid];
    if (!h) return `<div style="font-size:12px;color:var(--dim);text-align:center;padding:6px">Carregando histórico…</div>`;
    if (!h.length) return `<div style="font-size:12px;color:var(--dim);text-align:center;padding:6px">Sem histórico.</div>`;
    return h.map((x) => {
      const qtd = Number(x.qtd) || 0;
      const rapido = x.min_intervalo_seg != null && Number(x.min_intervalo_seg) < 15;
      return `<div style="border:1px solid var(--line);border-radius:8px;padding:6px 9px;margin-bottom:5px;background:var(--panel)">
        <div style="display:flex;justify-content:space-between;gap:8px;font-size:11.5px;flex-wrap:wrap">
          <span style="color:var(--dim)">${U.esc(dMM(x.dia))}</span>
          <b>${U.esc(U.brl(x.valor))} · ${qtd} venda${qtd === 1 ? "" : "s"} · ticket ${x.ticket_medio != null ? U.esc(U.brl(x.ticket_medio)) : "—"}</b>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px 10px;font-size:10.5px;color:var(--dim);margin-top:2px">
          <span>ritmo ${x.ritmo != null ? U.esc(x.ritmo) + "min/venda" : "—"}</span>
          <span style="${rapido ? "color:var(--bad);font-weight:700" : ""}">intervalo mín ${x.min_intervalo_seg != null ? Math.round(Number(x.min_intervalo_seg)) + "s" : "—"}</span>
          ${Number(x.calote) > 0 ? `<span style="color:var(--warn)">calote ${U.esc(U.brl(x.calote))}</span>` : ""}
          ${Number(x.gorjeta) > 0 ? `<span>gorjeta ${U.esc(U.brl(x.gorjeta))}</span>` : ""}
        </div></div>`;
    }).join("");
  }

  function htmlIA(uid) {
    const a = ia[uid];
    if (!a || a.loading) return "";
    if (a.erro) return `<div style="margin-top:8px;font-size:11.5px;color:var(--bad)">Erro: ${U.esc(a.erro)}</div>`;
    const ruim = (a.score || 0) >= 60;
    return `<div style="margin-top:8px;border:1px solid ${ruim ? "var(--bad)" : "var(--ok)"};background:${ruim ? "var(--bad-s)" : "var(--ok-s)"};border-radius:8px;padding:8px 10px">
      <div style="font-size:11.5px;font-weight:800;color:${ruim ? "var(--bad)" : "var(--ok)"}">IA: ${a.suspeito ? "🚩 Suspeito" : "✅ Parece normal"} · score ${U.esc(a.score)}</div>
      <div style="font-size:11.5px;color:var(--dim);margin-top:2px;white-space:pre-wrap">${U.esc(a.motivo)}</div></div>`;
  }

  function htmlCard(s) {
    const uid = s.user_id;
    const aberto = abertoUid === uid;
    const box = (k, v) => `<div class="stat" style="padding:7px 8px;text-align:center"><div class="k" style="font-size:9px">${k}</div><div class="v" style="font-size:14px">${v}</div></div>`;
    return `<div class="box" data-card="${U.esc(uid)}" style="padding:0;margin-bottom:10px;overflow:hidden;border-color:var(--warn);background:var(--warn-s)">
      <div style="padding:12px 14px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${U.esc(s.nome || "Vendedor")}</b>
            <span style="font-size:11px;color:var(--dim)">dia ${U.esc(dMM(s.dia))}</span></div>
          <span class="pill bad" style="font-weight:800">${s.ratio ? U.esc(s.ratio) + "×" : "—"} a média</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px">
          ${box("Hoje", U.esc(U.brl(s.valor_hoje)))}${box("Média dele", U.esc(U.brl(s.base_media)))}${box("Ritmo", s.ritmo != null ? U.esc(s.ritmo) + "min" : "—")}
        </div>
        <div style="font-size:10.5px;color:var(--dim);margin-top:6px">Trabalhou ${s.worked_min != null ? Math.round(Number(s.worked_min)) + "min" : "—"} nesse dia · ritmo = minutos por venda</div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn ghost" data-hist="${U.esc(uid)}" style="flex:1;font-size:12px">${aberto ? "▴" : "▾"} Histórico</button>
          <button class="btn lose" data-ocultar="${U.esc(uid)}" style="flex:1;font-size:12px">🚫 Ocultar do ranking</button>
        </div>
        <button class="btn block" data-ia="${U.esc(uid)}" style="margin-top:8px;width:100%;font-size:12px;border-color:var(--c1);color:var(--c1);background:var(--c1s)"${ia[uid] && ia[uid].loading ? " disabled" : ""}>${ia[uid] && ia[uid].loading ? "Analisando…" : "✨ Analisar com IA"}</button>
        <div data-ia-res>${htmlIA(uid)}</div>
      </div>
      ${aberto ? `<div data-hist-box style="border-top:1px solid var(--line);background:var(--panel2);padding:10px 12px">${htmlHist(uid)}</div>` : ""}
    </div>`;
  }

  window.CRMAdmin.secao("antitrapaca", {
    titulo: "Anti-trapaça",
    ordem: 60,
    render: async (el, ctx) => {
      const sb = ctx.sb;

      function desenhar(carregando) {
        el.innerHTML = `
          <div class="box" style="padding:12px 14px;margin-bottom:12px">
            <b>Anti-trapaça</b>
            <div style="font-size:11px;color:var(--dim);margin-bottom:10px">Quem fez um dia muito acima da própria média (últimos 21 dias).</div>
            <div style="display:flex;align-items:flex-end;gap:8px">
              <label style="flex:1;font-size:11px;color:var(--dim)">Sensibilidade (quantas vezes a média do próprio usuário)
                <input id="at-ratio" inputmode="decimal" value="${U.esc(ratio)}" style="${INPUT};margin-top:4px"></label>
              <button class="btn go" id="at-aplicar">Aplicar</button>
            </div>
          </div>
          ${carregando ? `<div class="box" style="padding:18px;color:var(--dim)">Carregando…</div>`
            : !lista.length ? `<div class="box" style="padding:18px;text-align:center;color:var(--dim)">Ninguém suspeito no momento.<br><span style="font-size:11px">(Precisa de alguns dias de histórico pra ter uma média de comparação.)</span></div>`
            : `<div class="mini-h" style="margin:0 0 8px">${lista.length} suspeito${lista.length === 1 ? "" : "s"}</div>${lista.map(htmlCard).join("")}`}`;
        ligar();
      }

      async function aplicar() {
        desenhar(true);
        await carregar();
        desenhar(false);
      }

      function ligar() {
        const inp = el.querySelector("#at-ratio");
        inp.addEventListener("input", () => { ratio = inp.value; });
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") aplicar(); });
        el.querySelector("#at-aplicar").addEventListener("click", aplicar);

        el.querySelectorAll("[data-hist]").forEach((b) => b.addEventListener("click", async () => {
          const uid = b.dataset.hist;
          if (abertoUid === uid) { abertoUid = null; desenhar(false); return; }
          abertoUid = uid;
          desenhar(false);
          if (!hist[uid]) {
            const r = await U.rpc("defcon_user_history", { p_user_id: uid, p_days: 30 });
            if (r.error) U.aviso("Histórico: " + r.error, true);
            hist[uid] = r.data || [];
            if (abertoUid === uid) desenhar(false);
          }
        }));

        el.querySelectorAll("[data-ocultar]").forEach((b) => b.addEventListener("click", async () => {
          const uid = b.dataset.ocultar;
          const s = lista.find((x) => x.user_id === uid) || {};
          if (!U.confirmar(`Ocultar ${s.nome || "esse usuário"} do ranking? Dá pra devolver depois em Assinaturas.`)) return;
          b.disabled = true; b.textContent = "Ocultando…";
          try {
            const up = await sb.from("profiles").update({ ranking_hidden: true }).eq("user_id", uid);
            if (up.error) throw new Error(up.error.message);
            const del = await sb.from("leaderboard_stats").delete().eq("user_id", uid);
            if (del.error) throw new Error(del.error.message);
            const mes = U.hojeBR().slice(0, 7); // YYYY-MM, Brasília
            const rc = await U.rpc("recalculate_ranking_positions", { target_month: mes });
            if (rc.error) throw new Error(rc.error);
            U.aviso(`🚫 Removido do ranking — ${s.nome || "Usuário"} foi ocultado.`);
            lista = lista.filter((x) => x.user_id !== uid);
            if (abertoUid === uid) abertoUid = null;
            desenhar(false);
          } catch (e) {
            U.aviso("Erro ao ocultar: " + ((e && e.message) || e), true);
            b.disabled = false; b.textContent = "🚫 Ocultar do ranking";
          }
        }));

        el.querySelectorAll("[data-ia]").forEach((b) => b.addEventListener("click", async () => {
          const uid = b.dataset.ia;
          ia[uid] = { loading: true };
          desenhar(false);
          const r = await U.funcao("analisar-anomalia", { user_id: uid });
          if (r.error) ia[uid] = { erro: r.error || "Falhou — tenta de novo." };
          else {
            const d = r.data || {};
            ia[uid] = { suspeito: !!d.suspeito, score: Number(d.score != null ? d.score : 0), motivo: d.motivo || "" };
          }
          desenhar(false);
        }));
      }

      await aplicar();
    },
  });
})();
