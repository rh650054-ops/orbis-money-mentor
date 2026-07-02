// Orbis — importar-semaforos
// Importa semáforos REAIS do OpenStreetMap (nós highway=traffic_signals) pra
// dentro da tabela caca_sinais. Só ADMIN pode disparar (evita abuso do Overpass).
// Não usa Google: geocode pela Nominatim (OSM) e os sinais vêm da Overpass API.
//
// Body: { city, state, radius_km }  (ou { lat, lng, radius_km, city, state })
// Resposta: { ok, cidade, uf, center, total_encontrados, total_salvos }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UA = "OrbisCacaSinal/1.0 (https://orbis.app; contato@orbis.app)";

// Geocode grátis via Nominatim (OSM). Retorna centro da cidade.
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

// Puxa semáforos (highway=traffic_signals) num raio via Overpass API.
async function fetchSemaforos(lat: number, lng: number, radiusMeters: number) {
  const query =
    `[out:json][timeout:60];` +
    `node["highway"="traffic_signals"](around:${radiusMeters},${lat},${lng});` +
    `out body;`;
  const r = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
    body: "data=" + encodeURIComponent(query),
  });
  if (!r.ok) throw new Error(`overpass_${r.status}`);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "sem_auth" }, 401);

    // Verifica ADMIN com o JWT do chamador.
    const caller = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: isAdmin, error: admErr } = await caller.rpc("is_orbis_admin");
    if (admErr) return json({ error: "check_admin_falhou", detalhe: admErr.message }, 500);
    if (isAdmin !== true) return json({ error: "somente_admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const city = (body?.city ?? "").toString().trim();
    const state = (body?.state ?? "").toString().trim().toUpperCase();
    const radiusMeters = Math.min(Math.max(Number(body?.radius_km ?? 8) * 1000, 1000), 30000);

    let lat = Number(body?.lat);
    let lng = Number(body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      if (!city || !state) return json({ error: "informe city+state ou lat+lng" }, 400);
      const geo = await geocode(city, state);
      if (!geo) return json({ error: "cidade_nao_encontrada" }, 404);
      lat = geo.lat;
      lng = geo.lng;
    }

    const encontrados = await fetchSemaforos(lat, lng, radiusMeters);
    if (encontrados.length === 0) {
      return json({ ok: true, cidade: city, uf: state, center: { lat, lng }, total_encontrados: 0, total_salvos: 0 });
    }

    // Grava com service role (ignora RLS). Upsert por osm_id evita duplicar em re-imports.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const rows = encontrados.map((s: any) => ({
      osm_id: s.osm_id,
      lat: s.lat,
      lng: s.lng,
      cidade: city || null,
      uf: state || null,
      vias: s.vias,
      fonte: "osm",
      atualizado_em: new Date().toISOString(),
    }));

    let salvos = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await admin.from("caca_sinais").upsert(chunk, { onConflict: "osm_id" });
      if (error) return json({ error: "upsert_falhou", detalhe: error.message, salvos }, 500);
      salvos += chunk.length;
    }

    return json({
      ok: true,
      cidade: city,
      uf: state,
      center: { lat, lng },
      total_encontrados: encontrados.length,
      total_salvos: salvos,
    });
  } catch (e) {
    console.error("importar-semaforos exceção", String(e).slice(0, 300));
    return json({ error: "excecao", detalhe: String(e).slice(0, 200) }, 500);
  }
});
