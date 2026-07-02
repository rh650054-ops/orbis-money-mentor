// Orbis — find-good-spots (versão GRÁTIS, sem Google)
// Antes dependia do Google (geocode + Places) + IA. Agora roda 100% de graça:
//   - Geocode da cidade pela Nominatim (OSM).
//   - Candidatos = SEMÁFOROS REAIS do OSM (tabela caca_sinais; se faltar, busca na
//     Overpass e salva).
//   - Pontua por DENSIDADE de semáforos (cruzamento de vias grandes tem vários
//     sinais perto) + FEEDBACK da comunidade (spot_feedback).
// Sem chave nenhuma. O Google fica pra Fase 2 (trânsito por horário), opcional.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const UA = "OrbisCacaSinal/1.0 (https://orbis.app; contato@orbis.app)";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function geocode(city: string, state: string): Promise<{ lat: number; lng: number } | null> {
  const q = `${city}, ${state}, Brasil`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR" } });
  if (!r.ok) return null;
  const data = await r.json();
  const hit = Array.isArray(data) ? data[0] : null;
  if (!hit) return null;
  return { lat: Number(hit.lat), lng: Number(hit.lon) };
}

async function overpassSignals(lat: number, lng: number, radiusMeters: number) {
  const query =
    `[out:json][timeout:60];` +
    `node["highway"="traffic_signals"](around:${radiusMeters},${lat},${lng});` +
    `out body;`;
  const r = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
    body: "data=" + encodeURIComponent(query),
  });
  if (!r.ok) return [];
  const data = await r.json();
  const els = Array.isArray(data?.elements) ? data.elements : [];
  return els
    .filter((e: any) => e.type === "node" && typeof e.lat === "number" && typeof e.lon === "number")
    .map((e: any) => ({
      osm_id: e.id as number,
      lat: e.lat as number,
      lng: e.lon as number,
      vias: (e.tags?.name || e.tags?.["addr:street"] || null) as string | null,
    }));
}

type Sig = { osm_id: number; lat: number; lng: number; vias: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { city, state, radius_km = 5, force_refresh = false } = await req.json().catch(() => ({}));
    if (!city || !state) return json({ error: "city e state obrigatórios" }, 400);

    const radiusMeters = Math.min(Math.max(Number(radius_km) * 1000, 500), 25000);
    const cacheKey = `v3|${String(city).toLowerCase()}|${String(state).toLowerCase()}|${radiusMeters}`;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (!force_refresh) {
      const { data: cached } = await supabase
        .from("spot_finder_cache")
        .select("result, expires_at")
        .eq("cache_key", cacheKey)
        .maybeSingle();
      if (cached && new Date(cached.expires_at) > new Date()) {
        const result = cached.result as any;
        const enriched = await attachFeedback(supabase, result.spots || []);
        return json({ ...result, spots: enriched, cached: true });
      }
    }

    const geo = await geocode(city, state);
    if (!geo) return json({ error: "Não consegui localizar essa cidade" }, 404);

    // 1) Semáforos já salvos no banco (bounding box).
    const dLat = radiusMeters / 111000;
    const dLng = radiusMeters / (111000 * Math.cos((geo.lat * Math.PI) / 180));
    const { data: dbRows } = await supabase
      .from("caca_sinais")
      .select("osm_id, lat, lng, vias")
      .gte("lat", geo.lat - dLat)
      .lte("lat", geo.lat + dLat)
      .gte("lng", geo.lng - dLng)
      .lte("lng", geo.lng + dLng)
      .limit(5000);

    let signals: Sig[] = (dbRows as Sig[]) ?? [];

    // 2) Poucos? Busca na Overpass ao vivo e salva (auto-seed).
    if (signals.length < 5) {
      const fetched = await overpassSignals(geo.lat, geo.lng, radiusMeters);
      if (fetched.length) {
        signals = fetched;
        const rows = fetched.map((s) => ({
          osm_id: s.osm_id, lat: s.lat, lng: s.lng, cidade: city, uf: String(state).toUpperCase(),
          vias: s.vias, fonte: "osm", atualizado_em: new Date().toISOString(),
        }));
        for (let i = 0; i < rows.length; i += 500) {
          await supabase.from("caca_sinais").upsert(rows.slice(i, i + 500), { onConflict: "osm_id" });
        }
      }
    }

    // Só o que está de fato dentro do raio (o box é quadrado).
    const near = signals.filter((s) => distanceM(geo, s) <= radiusMeters).slice(0, 4000);
    if (near.length === 0) return json({ center: geo, spots: [] });

    // Dedupe por célula (~200m) pra não listar 5 sinais do mesmo cruzamento.
    const cell = 200;
    const cLat = cell / 111000;
    const cLng = cell / (111000 * Math.cos((geo.lat * Math.PI) / 180));
    const seen = new Map<string, Sig>();
    for (const s of near) {
      const key = `${Math.round(s.lat / cLat)}_${Math.round(s.lng / cLng)}`;
      if (!seen.has(key)) seen.set(key, s);
    }
    const reps = [...seen.values()];

    // Densidade: quantos semáforos há num raio de 300m de cada representante.
    const scored = reps.map((s) => {
      const density = near.reduce((acc, o) => (distanceM(s, o) <= 300 ? acc + 1 : acc), 0);
      const score = Math.max(3, Math.min(10, Math.round((4 + density * 0.6) * 10) / 10));
      const traffic = density >= 8 ? "alto" : density >= 4 ? "medio" : "baixo";
      return {
        id: `sinal-${s.osm_id}`,
        name: s.vias || "Cruzamento com semáforo",
        address: s.vias || `${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}`,
        lat: s.lat,
        lng: s.lng,
        distance_km: Number((distanceM(geo, s) / 1000).toFixed(2)),
        spot_type: "cruzamento" as const,
        traffic_level: traffic as "alto" | "medio" | "baixo",
        semaforo_duracao: "desconhecido" as const,
        score,
        reason:
          `${density} semáforo(s) num raio de 300m — ${traffic === "alto" ? "cruzamento bem movimentado" : traffic === "medio" ? "movimento moderado" : "ponto mais calmo"}. Vá conferir e avalie pra ajudar os outros.`,
        density,
      };
    });

    scored.sort((a, b) => b.density - a.density || a.distance_km - b.distance_km);
    const top = scored.slice(0, 18);
    const withFb = await attachFeedback(supabase, top);

    const result = { center: geo, spots: withFb, generated_at: new Date().toISOString() };
    await supabase.from("spot_finder_cache").upsert(
      { cache_key: cacheKey, result, expires_at: new Date(Date.now() + 86_400_000).toISOString() },
      { onConflict: "cache_key" },
    );

    return json(result);
  } catch (e) {
    console.error("find-good-spots error:", String(e).slice(0, 300));
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});

async function attachFeedback(supabase: any, spots: any[]) {
  if (!spots.length) return spots;
  const ids = spots.map((s) => s.id);
  const { data: fbs } = await supabase.from("spot_feedback").select("place_id, rating").in("place_id", ids);
  const map: Record<string, { good: number; medium: number; bad: number; total: number }> = {};
  for (const f of fbs || []) {
    if (!map[f.place_id]) map[f.place_id] = { good: 0, medium: 0, bad: 0, total: 0 };
    if (f.rating === "bom") map[f.place_id].good++;
    else if (f.rating === "medio") map[f.place_id].medium++;
    else if (f.rating === "ruim") map[f.place_id].bad++;
    map[f.place_id].total++;
  }
  // Feedback da comunidade ajusta o score (bom sobe, ruim desce).
  return spots.map((s) => {
    const fb = map[s.id];
    let score = s.score;
    if (fb && fb.total > 0) {
      score = Math.max(1, Math.min(10, score + fb.good * 0.6 - fb.bad * 0.8));
      score = Math.round(score * 10) / 10;
    }
    return { ...s, score, feedback_summary: fb || null };
  });
}
