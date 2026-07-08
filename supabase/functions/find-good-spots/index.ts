// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function mapHeaders(extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function geocode(query: string) {
  const r = await fetch(
    `${GATEWAY}/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=br&language=pt-BR`,
    { headers: mapHeaders() },
  );
  const data = await r.json();
  const res = data?.results?.[0];
  if (!res) return null;
  return {
    lat: res.geometry.location.lat,
    lng: res.geometry.location.lng,
    formatted: res.formatted_address,
  };
}

// Places API New - searchText (melhor pra "avenidas", "cruzamentos", "centro")
async function searchText(query: string, lat: number, lng: number, radius: number) {
  const body = {
    textQuery: query,
    languageCode: "pt-BR",
    regionCode: "BR",
    maxResultCount: 15,
    locationBias: {
      circle: { center: { latitude: lat, longitude: lng }, radius },
    },
  };
  const r = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
    method: "POST",
    headers: mapHeaders({
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.primaryType",
    }),
    body: JSON.stringify(body),
  });
  if (!r.ok) return [];
  const data = await r.json();
  return data?.places ?? [];
}

async function searchNearby(lat: number, lng: number, radius: number, types: string[]) {
  const body = {
    includedTypes: types,
    maxResultCount: 12,
    locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius } },
    languageCode: "pt-BR",
    regionCode: "BR",
  };
  const r = await fetch(`${GATEWAY}/places/v1/places:searchNearby`, {
    method: "POST",
    headers: mapHeaders({
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount,places.primaryType",
    }),
    body: JSON.stringify(body),
  });
  if (!r.ok) return [];
  const data = await r.json();
  return data?.places ?? [];
}

function dedupe<T extends { id: string }>(arr: T[]) {
  const seen = new Set<string>();
  return arr.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

async function aiClassify(spots: any[], cityLabel: string, productContext: string, feedbackByPlace: Record<string, any>) {
  const body = {
    model: "google/gemini-2.5-pro",
    messages: [
      {
        role: "system",
        content: `Você é um especialista BRASILEIRO em vendas de rua em sinais/semáforos. Conhece bem as grandes cidades, principais avenidas, fluxo de trânsito em horário de pico (manhã 7-9h, tarde 17-19h), perfis socioeconômicos por região.

REGRAS PRA AVALIAR UM PONTO:
- AVENIDAS DE FLUXO ALTO com SEMÁFOROS LONGOS (>60s) = melhores pontos
- Entradas e saídas de avenidas grandes = ótimo (semáforo longo + carros parados)
- Cruzamentos de avenidas movimentadas = ótimo
- Frente de shoppings = bom só FIM DE SEMANA (semáforo curto, menos fluxo dias úteis)
- Próximo a terminais, estações, faculdades grandes = bom em horário de entrada/saída
- Centros comerciais e ruas movimentadas do centro = bom durante horário comercial
- Postos isolados, parques, hospitais, atrações turísticas SEM FLUXO de avenida = pontos FRACOS
- Use seu conhecimento dos horários de pico do Google Maps trânsito

Quando há FEEDBACK de outros vendedores sobre o ponto, dá MUITO peso a isso (eles trabalham lá).
Seja honesto: ponto ruim recebe nota baixa. Não é pra todos terem nota alta.`,
      },
      {
        role: "user",
        content: `Cidade: ${cityLabel}
Vendedor: ${productContext || "vendedor de rua genérico"}

Pontos candidatos (variados: avenidas, cruzamentos, shoppings, terminais, centros):
${spots
  .map((s, i) => {
    const fb = feedbackByPlace[s.id];
    const fbStr = fb
      ? ` | 🗣️ FEEDBACK REAL de vendedores: ${fb.good} bom, ${fb.medium} médio, ${fb.bad} ruim${fb.comments?.length ? `. Comentários: "${fb.comments.slice(0, 3).join('"; "')}"` : ""}`
      : "";
    return `${i + 1}. ${s.name} — ${s.address} — tipos: ${(s.types || []).join(",")} — rating ${s.rating ?? "?"} (${s.userRatingCount ?? 0})${fbStr}`;
  })
  .join("\n")}

Classifique CADA ponto via tool. Pontos sem fluxo de sinal/semáforo (parque isolado, hospital sem avenida, atração turística) recebem score baixo (<5).`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "classify_spots",
          description: "Análise de cada ponto pra vendedor de sinal.",
          parameters: {
            type: "object",
            properties: {
              spots: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "number" },
                    spot_type: {
                      type: "string",
                      enum: ["avenida", "cruzamento", "shopping", "terminal", "centro", "outro"],
                      description: "Categoria do ponto",
                    },
                    traffic_level: { type: "string", enum: ["alto", "medio", "baixo"] },
                    semaforo_duracao: {
                      type: "string",
                      enum: ["longo", "medio", "curto", "desconhecido"],
                      description: "Duração estimada do sinal vermelho",
                    },
                    peak_morning: {
                      type: "string",
                      description: "Pico manhã. Ex: '07h-09h muito movimentado'",
                    },
                    peak_afternoon: {
                      type: "string",
                      description: "Pico tarde. Ex: '17h-19h trânsito pesado'",
                    },
                    weekend_better: {
                      type: "boolean",
                      description: "true se fim de semana é melhor que dia útil",
                    },
                    best_hours: { type: "string", description: "Resumo dos melhores horários" },
                    audience_profile: {
                      type: "string",
                      enum: ["nobre", "media", "popular", "misto"],
                    },
                    customer_type: { type: "string" },
                    score: { type: "number", description: "0-10. Seja honesto." },
                    reason: { type: "string", description: "1 frase curta porque vale ou não" },
                    recommended_product: { type: "string" },
                  },
                  required: [
                    "index",
                    "spot_type",
                    "traffic_level",
                    "semaforo_duracao",
                    "peak_morning",
                    "peak_afternoon",
                    "weekend_better",
                    "best_hours",
                    "audience_profile",
                    "customer_type",
                    "score",
                    "reason",
                    "recommended_product",
                  ],
                },
              },
            },
            required: ["spots"],
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "classify_spots" } },
  };

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    console.error("AI error", r.status, await r.text());
    return [];
  }
  const data = await r.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return [];
  try {
    return JSON.parse(args).spots ?? [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { city, state, radius_km = 5, product_context = "", force_refresh = false } = await req.json();
    if (!city || !state) {
      return new Response(JSON.stringify({ error: "city e state obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const radiusMeters = Math.min(Math.max(Number(radius_km) * 1000, 500), 25000);
    const cacheKey = `v2|${city.toLowerCase()}|${state.toLowerCase()}|${radiusMeters}`;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (!force_refresh) {
      const { data: cached } = await supabase
        .from("spot_finder_cache")
        .select("result, expires_at")
        .eq("cache_key", cacheKey)
        .maybeSingle();
      if (cached && new Date(cached.expires_at) > new Date()) {
        // Mesmo do cache, atualiza feedback agregado
        const result = cached.result as any;
        const enriched = await attachFeedback(supabase, result.spots || [], city, state);
        return new Response(JSON.stringify({ ...result, spots: enriched, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const geo = await geocode(`${city}, ${state}, Brasil`);
    if (!geo) {
      return new Response(JSON.stringify({ error: "Não consegui localizar essa cidade" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca DIVERSIFICADA: avenidas + cruzamentos + centros + shoppings + terminais
    const cityLabel = `${city}, ${state}`;
    const [avenidas, cruzamentos, centros, shoppings, terminais, postos] = await Promise.all([
      searchText(`principais avenidas movimentadas ${cityLabel}`, geo.lat, geo.lng, radiusMeters),
      searchText(`cruzamentos avenidas ${cityLabel}`, geo.lat, geo.lng, radiusMeters),
      searchText(`centro comercial movimentado ${cityLabel}`, geo.lat, geo.lng, radiusMeters),
      searchNearby(geo.lat, geo.lng, radiusMeters, ["shopping_mall", "supermarket"]),
      searchNearby(geo.lat, geo.lng, radiusMeters, ["bus_station", "transit_station", "subway_station"]),
      searchNearby(geo.lat, geo.lng, radiusMeters, ["gas_station"]),
    ]);

    const merged = dedupe([
      ...avenidas, ...cruzamentos, ...centros,
      ...shoppings.slice(0, 4), ...terminais.slice(0, 4), ...postos.slice(0, 3),
    ]);

    let spots = merged.slice(0, 18).map((p: any) => ({
      id: p.id,
      name: p.displayName?.text || "Sem nome",
      address: p.formattedAddress || "",
      lat: p.location?.latitude,
      lng: p.location?.longitude,
      types: p.types || [],
      primaryType: p.primaryType || "",
      rating: p.rating,
      userRatingCount: p.userRatingCount,
      distance_km: Number(
        distanceKm({ lat: geo.lat, lng: geo.lng }, { lat: p.location?.latitude, lng: p.location?.longitude }).toFixed(2),
      ),
    })).filter((s: any) => typeof s.lat === "number" && typeof s.lng === "number");

    if (spots.length === 0) {
      return new Response(JSON.stringify({ spots: [], center: geo }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega feedback agregado pra dar contexto pra IA
    const placeIds = spots.map((s: any) => s.id);
    const { data: feedbacks } = await supabase
      .from("spot_feedback")
      .select("place_id, rating, comment")
      .in("place_id", placeIds);

    const feedbackByPlace: Record<string, any> = {};
    for (const f of feedbacks || []) {
      const k = f.place_id;
      if (!feedbackByPlace[k]) feedbackByPlace[k] = { good: 0, medium: 0, bad: 0, comments: [] };
      if (f.rating === "bom") feedbackByPlace[k].good++;
      else if (f.rating === "medio") feedbackByPlace[k].medium++;
      else if (f.rating === "ruim") feedbackByPlace[k].bad++;
      if (f.comment) feedbackByPlace[k].comments.push(f.comment);
    }

    const classified = await aiClassify(spots, cityLabel, product_context, feedbackByPlace);
    const enriched = spots.map((s: any, i: number) => {
      const cls = classified.find((c: any) => c.index === i + 1) || {};
      const fb = feedbackByPlace[s.id];
      return {
        ...s, ...cls,
        feedback_summary: fb ? { good: fb.good, medium: fb.medium, bad: fb.bad, total: fb.good + fb.medium + fb.bad } : null,
      };
    });
    enriched.sort((x: any, y: any) => (y.score ?? 0) - (x.score ?? 0));

    const result = { center: geo, spots: enriched, generated_at: new Date().toISOString() };

    await supabase.from("spot_finder_cache").upsert(
      { cache_key: cacheKey, result, expires_at: new Date(Date.now() + 86_400_000).toISOString() },
      { onConflict: "cache_key" },
    );

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("find-good-spots error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function attachFeedback(supabase: any, spots: any[], city: string, state: string) {
  if (!spots.length) return spots;
  const ids = spots.map((s) => s.id);
  const { data: fbs } = await supabase
    .from("spot_feedback")
    .select("place_id, rating")
    .in("place_id", ids);
  const map: Record<string, any> = {};
  for (const f of fbs || []) {
    if (!map[f.place_id]) map[f.place_id] = { good: 0, medium: 0, bad: 0, total: 0 };
    if (f.rating === "bom") map[f.place_id].good++;
    else if (f.rating === "medio") map[f.place_id].medium++;
    else if (f.rating === "ruim") map[f.place_id].bad++;
    map[f.place_id].total++;
  }
  return spots.map((s) => ({ ...s, feedback_summary: map[s.id] || null }));
}
