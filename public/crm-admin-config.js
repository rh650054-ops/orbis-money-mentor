/* ============================================================
   CRM da Vant — Admin › Configurações
   1) Extrato deadline hour (port of src/pages/AdminExtratoConfig.tsx):
      app_settings row key = 'extrato_deadline_hour', value = String(0..23).
      Same read (select value, maybeSingle) and write (upsert {key, value}) as
      src/shared/lib/extrato-config.ts. Default 9 when missing.
   2) "Importar semáforos" (admin button of src/pages/SpotFinder.tsx):
      edge function importar-semaforos with { city, state, radius_km } — or
      { lat, lng, radius_km, city, state } when coordinates are given. The app
      used the map's city/UF and Math.max(raio, 10); here the inputs replace the
      map context. Admin check (is_orbis_admin) stays in the function.
   ============================================================ */
(function () {
  "use strict";
  if (!window.CRMAdmin) return;
  const U = window.CRMAdmin.util;
  const esc = U.esc;

  const INPUT = "width:100%;padding:9px 11px;border:1px solid var(--line2);border-radius:9px;background:var(--panel);color:var(--ink);font:inherit;box-sizing:border-box";
  const LABEL = "display:block;font-size:12px;color:var(--dim);margin-bottom:4px";
  const DEFAULT_HOUR = 9;
  const CHAVE = "extrato_deadline_hour";

  // Import form draft survives re-renders.
  let imp = { city: "", uf: "", raio: "10", lat: "", lng: "" };

  async function render(el, ctx) {
    const sb = ctx.sb;

    const [cfg, cid] = await Promise.all([
      sb.from("app_settings").select("value").eq("key", CHAVE).maybeSingle(),
      U.rpc("caca_cidades"),
    ]);
    let hora = DEFAULT_HOUR;
    const h0 = Number(cfg.data && cfg.data.value);
    if (Number.isFinite(h0) && h0 >= 0 && h0 <= 23) hora = h0;
    const cidades = Array.isArray(cid.data) ? cid.data : [];

    el.innerHTML = `
      <div class="box" style="padding:14px;margin-bottom:12px">
        <div class="mini-h">Horário do extrato</div>
        <p style="font-size:13px;color:var(--dim);line-height:1.5;margin:8px 0 10px">
          O extrato de um dia pode ser enviado até esse horário da <b style="color:var(--ink)">manhã seguinte</b> — pra dar tempo do Pix atrasado cair.
          Depois dele, o dia fecha e o próximo passa a valer. Ex: <b style="color:var(--ink)">9</b> = até as 9h.</p>
        ${cfg.error ? `<p style="font-size:12px;color:var(--bad);margin:0 0 8px">Não consegui ler o valor salvo (${esc(cfg.error.message)}); mostrando o padrão ${DEFAULT_HOUR}h.</p>` : ""}
        <div style="display:flex;align-items:flex-end;gap:8px">
          <label style="flex:1"><span style="${LABEL}">Horário-limite (0 a 23)</span>
            <input id="cfg-hora" inputmode="numeric" value="${esc(hora)}" style="${INPUT};font-size:18px;font-weight:700"></label>
          <button class="btn go" id="cfg-salvar" style="padding:10px 18px">Salvar</button>
        </div>
        <p style="font-size:11px;color:var(--faint);margin:8px 0 0">Vale pro popup do fim do DEFCON, o lembrete e o corte do dia. Passa a valer pra todos os usuários no próximo carregamento do app deles.</p>
      </div>

      <div class="box" style="padding:14px;margin-bottom:12px">
        <div class="mini-h">Importar semáforos (Caça-sinal)</div>
        <p style="font-size:13px;color:var(--dim);line-height:1.5;margin:8px 0 10px">
          Puxa os semáforos reais do OpenStreetMap pra uma cidade e grava no Caça-sinal (re-importar não duplica).
          Informe cidade + UF; latitude/longitude são opcionais e, se preenchidas, substituem a busca do centro da cidade.</p>
        <div style="display:grid;grid-template-columns:minmax(0,2fr) minmax(70px,1fr);gap:8px">
          <label><span style="${LABEL}">Cidade</span>
            <input id="imp-city" list="imp-cidades" placeholder="Ex: Cotia" value="${esc(imp.city)}" style="${INPUT}"></label>
          <label><span style="${LABEL}">UF</span>
            <input id="imp-uf" maxlength="2" placeholder="SP" value="${esc(imp.uf)}" style="${INPUT};text-transform:uppercase"></label>
        </div>
        <datalist id="imp-cidades">${cidades.map((c) => `<option value="${esc(c.cidade)}">${esc(c.cidade)}/${esc(c.uf)} — ${esc(c.total)} sinais</option>`).join("")}</datalist>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:8px">
          <label><span style="${LABEL}">Raio (km)</span>
            <input id="imp-raio" inputmode="numeric" value="${esc(imp.raio)}" style="${INPUT}"></label>
          <label><span style="${LABEL}">Latitude</span>
            <input id="imp-lat" inputmode="decimal" placeholder="opcional" value="${esc(imp.lat)}" style="${INPUT}"></label>
          <label><span style="${LABEL}">Longitude</span>
            <input id="imp-lng" inputmode="decimal" placeholder="opcional" value="${esc(imp.lng)}" style="${INPUT}"></label>
        </div>
        <p style="font-size:11px;color:var(--faint);margin:6px 0 0">No app o raio era sempre no mínimo 10 km; o servidor aceita de 1 a 30 km.</p>
        <button class="btn go block" id="imp-go" style="margin-top:10px">Importar semáforos</button>
        <div id="imp-res"></div>
        ${cidades.length ? `<div class="mini-h" style="margin-top:14px">Cidades já mapeadas (${cidades.length})</div>
          <div style="max-height:260px;overflow:auto;margin-top:6px">
          <table class="tabela" style="width:100%"><thead><tr><th>Cidade</th><th>UF</th><th>Sinais</th><th></th></tr></thead><tbody>
          ${cidades.map((c, i) => `<tr><td>${esc(c.cidade)}</td><td>${esc(c.uf)}</td><td class="n">${esc(Number(c.total).toLocaleString("pt-BR"))}</td>
            <td><button class="btn ghost" data-imp-usar="${i}" style="padding:4px 9px;font-size:11px">Usar</button></td></tr>`).join("")}
          </tbody></table></div>` : (cid.error ? `<p style="font-size:12px;color:var(--faint);margin-top:10px">Lista de cidades indisponível: ${esc(cid.error)}</p>` : "")}
      </div>`;

    /* ---------- extrato deadline ---------- */
    el.querySelector("#cfg-salvar").addEventListener("click", async (ev) => {
      const btn = ev.currentTarget;
      const h = Number(el.querySelector("#cfg-hora").value);
      if (el.querySelector("#cfg-hora").value.trim() === "" || !Number.isFinite(h) || h < 0 || h > 23) {
        U.aviso("Horário inválido: use um número de 0 a 23.", true); return;
      }
      const v = Math.max(0, Math.min(23, Math.round(h)));
      btn.disabled = true; btn.textContent = "Salvando…";
      const { error } = await sb.from("app_settings").upsert({ key: CHAVE, value: String(v) });
      btn.disabled = false; btn.textContent = "Salvar";
      if (error) { U.aviso("Não consegui salvar: " + error.message, true); return; }
      el.querySelector("#cfg-hora").value = String(v);
      U.aviso(`Horário atualizado: o extrato do dia fecha às ${v}h da manhã seguinte.`);
    });

    /* ---------- import traffic lights ---------- */
    const campos = { city: "#imp-city", uf: "#imp-uf", raio: "#imp-raio", lat: "#imp-lat", lng: "#imp-lng" };
    Object.keys(campos).forEach((k) => {
      const inp = el.querySelector(campos[k]);
      inp.addEventListener("input", () => { imp[k] = inp.value; });
    });
    // Picking a mapped city from the datalist fills the UF too.
    el.querySelector("#imp-city").addEventListener("change", (ev) => {
      const c = cidades.find((x) => String(x.cidade).toLowerCase() === ev.target.value.trim().toLowerCase());
      if (c && !el.querySelector("#imp-uf").value.trim()) { el.querySelector("#imp-uf").value = c.uf; imp.uf = c.uf; }
    });
    el.querySelectorAll("[data-imp-usar]").forEach((b) => b.addEventListener("click", () => {
      const c = cidades[Number(b.dataset.impUsar)];
      if (!c) return;
      el.querySelector("#imp-city").value = c.cidade; el.querySelector("#imp-uf").value = c.uf;
      imp.city = c.cidade; imp.uf = c.uf;
      el.querySelector("#imp-city").scrollIntoView({ behavior: "smooth", block: "center" });
    }));

    el.querySelector("#imp-go").addEventListener("click", async (ev) => {
      const btn = ev.currentTarget;
      const city = el.querySelector("#imp-city").value.trim();
      const uf = el.querySelector("#imp-uf").value.trim().toUpperCase();
      const raio = Number(el.querySelector("#imp-raio").value) || 10;
      const latS = el.querySelector("#imp-lat").value.trim().replace(",", ".");
      const lngS = el.querySelector("#imp-lng").value.trim().replace(",", ".");
      const lat = Number(latS), lng = Number(lngS);
      const temCoord = latS !== "" && lngS !== "" && Number.isFinite(lat) && Number.isFinite(lng);
      if ((latS || lngS) && !temCoord) { U.aviso("Latitude/longitude inválidas (preencha as duas).", true); return; }
      if (!city || !uf) { U.aviso("Informe a cidade e a UF.", true); return; }
      if (!U.confirmar(`Importar semáforos de ${city}/${uf} num raio de ${raio} km?`)) return;

      const body = { city, state: uf, radius_km: raio };
      if (temCoord) { body.lat = lat; body.lng = lng; }
      btn.disabled = true; btn.textContent = "Importando semáforos…";
      const r = await U.funcao("importar-semaforos", body);
      btn.disabled = false; btn.textContent = "Importar semáforos";
      const res = el.querySelector("#imp-res");
      if (r.error) {
        const det = r.data && r.data.detalhe ? ` (${r.data.detalhe})` : "";
        U.aviso("Erro no import: " + r.error + det, true);
        res.innerHTML = `<p style="font-size:12px;color:var(--bad);margin:8px 0 0">Erro no import: ${esc(r.error + det)}</p>`;
        return;
      }
      const d = r.data || {};
      U.aviso(`${d.total_salvos != null ? d.total_salvos : 0} semáforos importados — ${city}/${uf}`);
      res.innerHTML = `<div class="pills" style="margin-top:10px">
          <span class="stat" style="padding:8px 12px"><span class="k">Encontrados</span> <span class="v">${esc(d.total_encontrados != null ? d.total_encontrados : 0)}</span></span>
          <span class="stat" style="padding:8px 12px"><span class="k">Salvos</span> <span class="v">${esc(d.total_salvos != null ? d.total_salvos : 0)}</span></span>
          ${d.center ? `<span class="stat" style="padding:8px 12px"><span class="k">Centro</span> <span class="s">${esc(Number(d.center.lat).toFixed(5))}, ${esc(Number(d.center.lng).toFixed(5))}</span></span>` : ""}
        </div>`;
    });
  }

  window.CRMAdmin.secao("config", { titulo: "Configurações", ordem: 70, render });
})();
