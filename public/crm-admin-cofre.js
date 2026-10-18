/* ============================================================
   CRM da Vant — Admin › Cofre da IA
   Port of src/pages/AdminCofre.tsx. Every ACTIVE note in ai_conhecimento is
   read by the AI mentor in every conversation (bright-action reads it via RPC
   orbis_conhecimento). Saved = live. Real security is RLS (is_orbis_admin).
   Also shows the read-only "clima do vendedor" panel (RPC clima_painel).
   ============================================================ */
(function () {
  "use strict";
  if (!window.CRMAdmin) return;
  const U = window.CRMAdmin.util;

  const INPUT = "width:100%;padding:9px 11px;border:1px solid var(--line2);border-radius:9px;background:var(--panel);color:var(--ink);font:inherit;box-sizing:border-box";
  // Character ceiling the database applies when building the mentor block.
  const LIMITE = 24000;
  const NOME_ESTADO = { sol: "dia limpo", calor: "calor", nublado: "nublado", chuva: "chuva", tempestade: "tempestade", frio: "frio", noite: "noite" };
  const moeda = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  const NOVA = () => ({ id: null, titulo: "", categoria: "geral", ordem: 100, conteudo: "", ativo: true });

  // Module state: survives section re-renders.
  let notas = [];
  let atual = null;            // draft being edited (or null)
  const fechadas = new Set();  // collapsed folders
  let clima = null;

  async function carregarNotas(sb) {
    const { data, error } = await sb.from("ai_conhecimento").select("*").order("ordem").order("id");
    if (error) { U.aviso("Não consegui carregar o cofre: " + error.message, true); return false; }
    notas = data || [];
    return true;
  }
  async function carregarClima() {
    const r = await U.rpc("clima_painel");
    clima = r.error ? null : (r.data || null); // silent on error, like the app
  }

  const abrir = (n) => { atual = { id: n.id, titulo: n.titulo || "", categoria: n.categoria || "geral", ordem: n.ordem != null ? n.ordem : 100, conteudo: n.conteudo || "", ativo: !!n.ativo }; };

  function htmlOrcamento() {
    const usado = notas.filter((n) => n.ativo).reduce((s, n) => s + ((n.titulo || "").length) + ((n.conteudo || "").length) + 6, 0);
    const pct = Math.min(100, Math.round((100 * usado) / LIMITE));
    return `<div class="box" style="padding:10px 14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--dim);flex-wrap:wrap">
        <span>${pct}% do espaço no cérebro usado</span>
        <span style="font-variant-numeric:tabular-nums">${usado.toLocaleString("pt-BR")} / ${LIMITE.toLocaleString("pt-BR")} letras</span>
      </div>
      <div style="height:6px;border-radius:99px;background:var(--line);margin-top:6px;overflow:hidden">
        <div style="height:100%;width:${pct}%;border-radius:99px;background:${pct >= 90 ? "var(--bad)" : "var(--c4)"}"></div>
      </div></div>`;
  }

  function imagensDe(txt) {
    const m = String(txt || "").match(/https?:\/\/\S+\.(?:png|jpe?g|webp|gif)/gi) || [];
    return m.slice(0, 8);
  }
  function htmlImagens() {
    const imgs = imagensDe(atual && atual.conteudo);
    return imgs.map((u) => `<img src="${U.esc(u)}" alt="" style="height:80px;border-radius:8px;border:1px solid var(--line)">`).join("");
  }

  function htmlEditor() {
    if (!atual) return "";
    return `<div class="box" style="padding:14px;margin-bottom:12px;border-color:var(--c4)">
      <h4 class="mini-h" style="margin:0 0 10px">${atual.id ? "Editar nota" : "Nova nota"}</h4>
      <div style="display:grid;gap:10px">
        <input data-n="titulo" value="${U.esc(atual.titulo)}" placeholder="Título da nota" style="${INPUT};font-weight:700">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:11px;color:var(--dim)">
          <label style="display:flex;align-items:center;gap:6px">pasta
            <input data-n="categoria" value="${U.esc(atual.categoria)}" placeholder="geral" style="${INPUT};width:130px;padding:6px 9px;font-size:12px"></label>
          <label style="display:flex;align-items:center;gap:6px">ordem
            <input data-n="ordem" type="number" value="${U.esc(atual.ordem)}" style="${INPUT};width:80px;padding:6px 9px;font-size:12px;text-align:center"></label>
          <label style="display:flex;align-items:center;gap:6px;margin-left:auto;cursor:pointer">
            <input data-n="ativo" type="checkbox"${atual.ativo ? " checked" : ""} style="width:18px;height:18px"> no cérebro</label>
        </div>
        <textarea data-n="conteudo" rows="10" placeholder="O conhecimento em si. Escreva como quem ensina um vendedor novo do time: direto, com números e exemplos. Links de imagem (.png/.jpg) aparecem aqui embaixo." style="${INPUT};resize:vertical;line-height:1.5;font-size:13px">${U.esc(atual.conteudo)}</textarea>
        <div id="cof-imgs" style="display:flex;flex-wrap:wrap;gap:8px">${htmlImagens()}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button class="btn go" data-acao="salvar">Salvar</button>
          <button class="btn lose" data-acao="apagar">${atual.id ? "Apagar" : "Descartar"}</button>
          <button class="btn ghost" data-acao="fechar">Fechar</button>
          <span style="margin-left:auto;font-size:10px;color:var(--faint)">◈ lida pelo mentor em toda conversa</span>
        </div>
      </div></div>`;
  }

  function htmlArvore() {
    if (!notas.length) return `<div class="box" style="padding:18px;text-align:center;color:var(--dim)">O cofre está vazio. Crie a primeira nota.</div>`;
    const m = {};
    notas.forEach((n) => { const p = n.categoria || "geral"; (m[p] = m[p] || []).push(n); });
    return Object.keys(m).sort().map((p) => {
      const fechada = fechadas.has(p);
      return `<div class="box" style="padding:0;margin-bottom:8px;overflow:hidden">
        <button type="button" data-pasta="${U.esc(p)}" style="all:unset;box-sizing:border-box;cursor:pointer;width:100%;display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--dim)">
          <span>${fechada ? "▸" : "▾"}</span><span>${U.esc(p)}</span><span style="margin-left:auto;opacity:.6">${m[p].length}</span></button>
        ${fechada ? "" : `<div style="padding:0 8px 8px;display:grid;gap:4px">${m[p].map((n) => {
          const sel = atual && atual.id === n.id;
          return `<button type="button" data-nota="${U.esc(n.id)}" style="all:unset;box-sizing:border-box;cursor:pointer;width:100%;padding:8px 12px;border-radius:8px;font-size:13px;border:1px solid ${sel ? "var(--c4)" : "var(--line)"};background:${sel ? "var(--c4s)" : "var(--panel)"};color:var(--ink);${n.ativo ? "" : "opacity:.6;text-decoration:line-through"}">
            <span style="opacity:.6;margin-right:6px">◈</span>${U.esc(n.titulo)}</button>`;
        }).join("")}</div>`}
      </div>`;
    }).join("");
  }

  function htmlClima() {
    if (!clima) return "";
    const est = Array.isArray(clima.por_estado) ? clima.por_estado.slice().sort((a, b) => (Number(b.media_lucro) || 0) - (Number(a.media_lucro) || 0)) : [];
    const cid = Array.isArray(clima.top_cidades) ? clima.top_cidades : [];
    return `<div class="box" style="padding:14px;margin-top:14px">
      <h4 class="mini-h" style="margin:0 0 10px">☁ Clima do vendedor — o que o app aprendeu</h4>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        ${[["usaram", clima.vendedores], ["nos 7 dias", clima.vendedores_7d], ["hoje", clima.vendedores_hoje]].map(([r, v]) =>
          `<div class="stat" style="text-align:center"><div class="v">${U.esc(v != null ? v : 0)}</div><div class="s">${U.esc(r)}</div></div>`).join("")}
      </div>
      ${est.length ? `<div class="mini-h" style="margin:12px 0 4px">Média vendida por tempo</div>
        <table class="tabela"><tbody>${est.map((e) => `<tr><td><b>${U.esc(NOME_ESTADO[e.estado] || e.estado)}</b></td>
          <td style="color:var(--dim)">${U.esc(e.dias)} dias · ${U.esc(e.vendedores)} vendedores</td>
          <td class="n"><b>${U.esc(moeda(e.media_lucro))}</b></td></tr>`).join("")}</tbody></table>` : ""}
      ${cid.length ? `<p style="font-size:11px;color:var(--dim);line-height:1.5;margin:10px 0 0">Cidades: ${cid.map((c) => U.esc(`${c.cidade}${c.uf ? "/" + c.uf : ""} (${c.vendedores})`)).join(" · ")}</p>` : ""}
      <p style="font-size:11px;color:var(--faint);margin:8px 0 0">Uma linha por vendedor por dia, com o tempo mais severo daquele dia cruzado com o que ele vendeu. Quanto mais dias, mais firme fica o "você vende X% menos na chuva" que aparece pra ele.</p>
    </div>`;
  }

  window.CRMAdmin.secao("cofre", {
    titulo: "Cofre da IA",
    ordem: 50,
    render: async (el, ctx) => {
      const sb = ctx.sb;
      el.innerHTML = `<div class="box" style="padding:18px;color:var(--dim)">Carregando…</div>`;
      await Promise.all([carregarNotas(sb), carregarClima()]);
      if (atual && atual.id && !notas.some((n) => n.id === atual.id)) atual = null;

      function desenhar() {
        el.innerHTML = `
          <div class="box" style="padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <div style="flex:1;min-width:200px"><b>Cofre de Conhecimento</b>
              <div style="font-size:11px;color:var(--dim)">Tudo que estiver ativo aqui é lido pelo mentor em toda conversa — vale no minuto seguinte, sem publicar nada.</div></div>
            <button class="btn ghost" data-acao="recarregar" style="padding:7px 12px;font-size:12px">↻ Recarregar</button>
            <button class="btn go" data-acao="nova" style="padding:7px 12px;font-size:12px">+ Nova nota</button>
          </div>
          ${htmlOrcamento()}
          <div id="cof-editor">${htmlEditor()}</div>
          <div id="cof-arvore">${htmlArvore()}</div>
          ${htmlClima()}`;
        ligar();
      }

      function ligarImgs() {
        el.querySelectorAll("#cof-imgs img").forEach((img) => img.addEventListener("error", () => { img.style.display = "none"; }));
      }

      function ligar() {
        el.querySelector('[data-acao="recarregar"]').addEventListener("click", async (ev) => {
          ev.currentTarget.disabled = true;
          await carregarNotas(sb);
          desenhar();
        });
        el.querySelector('[data-acao="nova"]').addEventListener("click", () => { atual = NOVA(); desenhar(); el.querySelector("#cof-editor").scrollIntoView({ behavior: "smooth", block: "start" }); });
        el.querySelectorAll("[data-pasta]").forEach((b) => b.addEventListener("click", () => {
          const p = b.dataset.pasta; if (fechadas.has(p)) fechadas.delete(p); else fechadas.add(p); desenhar();
        }));
        el.querySelectorAll("[data-nota]").forEach((b) => b.addEventListener("click", () => {
          const n = notas.find((x) => String(x.id) === b.dataset.nota);
          if (n) { abrir(n); desenhar(); el.querySelector("#cof-editor").scrollIntoView({ behavior: "smooth", block: "start" }); }
        }));

        const ed = el.querySelector("#cof-editor");
        if (!atual) return;
        ligarImgs();
        ed.querySelectorAll("[data-n]").forEach((inp) => {
          const k = inp.dataset.n;
          inp.addEventListener(inp.type === "checkbox" ? "change" : "input", () => {
            if (k === "ativo") atual.ativo = inp.checked;
            else if (k === "ordem") atual.ordem = Number(inp.value) || 0;
            else atual[k] = inp.value;
            if (k === "conteudo") { ed.querySelector("#cof-imgs").innerHTML = htmlImagens(); ligarImgs(); }
          });
        });
        ed.querySelector('[data-acao="fechar"]').addEventListener("click", () => { atual = null; desenhar(); });

        const bs = ed.querySelector('[data-acao="salvar"]');
        bs.addEventListener("click", async () => {
          const linha = {
            titulo: atual.titulo.trim(),
            categoria: (atual.categoria.trim() || "geral").toLowerCase(),
            ordem: Number(atual.ordem) || 100,
            conteudo: atual.conteudo.trim(),
            ativo: atual.ativo,
            atualizado_em: new Date().toISOString(),
          };
          if (!linha.titulo || !linha.conteudo) { U.aviso("Título e conteúdo são obrigatórios.", true); return; }
          bs.disabled = true; bs.textContent = "Salvando…";
          const r = atual.id
            ? await sb.from("ai_conhecimento").update(linha).eq("id", atual.id).select().single()
            : await sb.from("ai_conhecimento").insert(linha).select().single();
          if (r.error) { U.aviso("Não consegui salvar a nota: " + r.error.message, true); bs.disabled = false; bs.textContent = "Salvar"; return; }
          U.aviso("Salvo — o mentor já está lendo esta versão");
          await carregarNotas(sb);
          abrir(r.data);
          desenhar();
        });

        ed.querySelector('[data-acao="apagar"]').addEventListener("click", async () => {
          if (!atual.id) { atual = null; desenhar(); return; }
          if (!U.confirmar(`Apagar a nota "${atual.titulo}"? O mentor deixa de saber isso.`)) return;
          const { error } = await sb.from("ai_conhecimento").delete().eq("id", atual.id);
          if (error) { U.aviso("Não consegui apagar a nota: " + error.message, true); return; }
          U.aviso("Nota apagada.");
          atual = null;
          await carregarNotas(sb);
          desenhar();
        });
      }

      desenhar();
    },
  });
})();
