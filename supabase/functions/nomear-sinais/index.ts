// Orbis — nomear-sinais (JOB de fundo, sem chave, sem API no app)
// Semáforos do OSM quase nunca têm nome. Este job pega 40 semáforos sem `vias`
// do banco, faz UMA consulta na Overpass pelas ruas num raio de 35 m de cada
// um e grava "Rua A × Rua B" em caca_sinais.vias. Roda pelo pg_cron a cada
// minuto até acabar; o app NUNCA chama isso — só lê o nome já salvo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UA = "OrbisCacaSinal/1.0 (https://orbis.app; contato@orbis.app)";
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // MODO JOB (sem chave, sem corpo): pega os próximos 40 semáforos SEM nome do
    // próprio banco, priorizando cidades onde há vendedores. Chamado pelo pg_cron
    // a cada minuto até nomear tudo. Nada vem de fora: o corpo é ignorado.
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: rows } = await supabase.rpc("caca_sinais_sem_nome", { p_limit: 40 });
    const lista: { osm_id: number; lat: number; lng: number }[] = ((rows as any[]) || [])
      .map((s) => ({ osm_id: Number(s.osm_id), lat: Number(s.lat), lng: Number(s.lng) }));
    if (!lista.length) return json({ nomes: {}, done: true });

    // Uma consulta só: união de "ways com nome perto de cada ponto", com geometria.
    const partes = lista.map((s) => `way(around:35,${s.lat},${s.lng})["highway"]["name"];`).join("");
    const query = `[out:json][timeout:60];(${partes});out geom;`;

    let elements: any[] | null = null;
    for (const ep of ENDPOINTS) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 45000);
        const r = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
          body: "data=" + encodeURIComponent(query),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (!r.ok) continue;
        const data = await r.json();
        elements = Array.isArray(data?.elements) ? data.elements : [];
        break;
      } catch { /* próximo servidor */ }
    }
    if (!elements) return json({ nomes: {}, error: "overpass indisponível" }, 200);

    // Pra cada sinal: ruas cuja geometria passa a ≤ 35 m; ordena pela mais próxima; pega 2 nomes distintos.
    const nomes: Record<string, string> = {};
    for (const s of lista) {
      const cand: { nome: string; d: number }[] = [];
      for (const w of elements) {
        const nome = String(w?.tags?.name || "").trim();
        if (!nome || !Array.isArray(w?.geometry)) continue;
        let best = Infinity;
        for (const g of w.geometry) {
          const d = dist(s, { lat: Number(g.lat), lng: Number(g.lon) });
          if (d < best) best = d;
        }
        if (best <= 45) cand.push({ nome, d: best });
      }
      cand.sort((a, b) => a.d - b.d);
      const unicos: string[] = [];
      for (const c of cand) if (!unicos.includes(c.nome)) unicos.push(c.nome);
      if (unicos.length) nomes[String(s.osm_id)] = unicos.slice(0, 2).join(" × ");
    }

    // Grava no banco — nunca sobrescreve um nome já existente. Quem ficou sem rua
    // com nome por perto recebe "" (vazio) pra não ser tentado de novo todo minuto.
    for (const s of lista) {
      const vias = nomes[String(s.osm_id)] ?? "";
      await supabase.from("caca_sinais").update({ vias }).eq("osm_id", s.osm_id).is("vias", null);
    }
    return json({ nomes, total: Object.keys(nomes).length, tentados: lista.length });
  } catch (e) {
    return json({ nomes: {}, error: e instanceof Error ? e.message : "erro" }, 200);
  }
});
