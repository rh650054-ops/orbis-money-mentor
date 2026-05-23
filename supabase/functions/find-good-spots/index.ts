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

function mapHeaders() {
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
    "Content-Type": "application/json",
  };
}

async function geocode(query: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
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

async function searchPlaces(lat: number, lng: number, radius: number, types: string[]) {
  const body = {
    includedTypes: types,
    maxResultCount: 15,
    locationRestriction: {
      circle: { center: { latitude: lat, longitude: lng }, radius },
    },
    languageCode: "pt-BR",
    regionCode: "BR",
  };
  const r = await fetch(`${GATEWAY}/places/v1/places:searchNearby`, {
    method: "POST",
    headers: {
      ...mapHeaders(),
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.businessStatus,places.priceLevel,places.userRatingCount,places.rating",
    },
    body: JSON.stringify(body),
  });
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

async function aiClassify(spots: any[], cityLabel: string, productContext: string) {
  const body = {
    model: "google/gemini-3-flash-preview",
    messages: [
      {
        role: "system",
        content:
          "Você é um especialista brasileiro em vendas de rua (sinais, semáforos, avenidas movimentadas). Analise pontos de uma cidade e classifique cada um para um vendedor ambulante. Use bom senso geográfico do Brasil. Seja objetivo, prático e direto.",
      },
      {
        role: "user",
        content: `Cidade: ${cityLabel}\nContexto do vendedor: ${productContext || "vendedor de rua genérico"}\n\nPontos candidatos (avenidas, cruzamentos, shoppings, terminais, postos):\n${spots
          .map(
            (s, i) =>
              `${i + 1}. ${s.name} — ${s.address} — tipos: ${(s.types || []).join(",")} — rating ${s.rating ?? "?"} (${s.userRatingCount ?? 0} avaliações)`,
          )
          .join("\n")}\n\nClassifique CADA ponto e retorne via tool call.`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "classify_spots",
          description: "Retorna análise de cada ponto para vendedor de rua.",
          parameters: {
            type: "object",
            properties: {
              spots: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "number", description: "Índice do ponto (1-based) na lista" },
                    traffic_level: { type: "string", enum: ["alto", "medio", "baixo"] },
                    best_hours: { type: "string", description: "Ex: 'Seg-Sex 11h-13h e 17h-19h'" },
                    audience_profile: {
                      type: "string",
                      enum: ["nobre", "media", "popular", "misto"],
                    },
                    customer_type: {
                      type: "string",
                      description: "Ex: 'Carros classe A/B, executivos voltando do trabalho'",
                    },
                    score: { type: "number", description: "0 a 10" },
                    reason: { type: "string", description: "1 frase curta porque vale a pena" },
                    recommended_product: {
                      type: "string",
                      description: "Tipo de produto que vende bem ali (água, balas, ticket alto, etc)",
                    },
                  },
                  required: [
                    "index",
                    "traffic_level",
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
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AI ${r.status}: ${t}`);
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
    const { city, state, radius_km = 5, product_context = "" } = await req.json();
    if (!city || !state) {
      return new Response(JSON.stringify({ error: "city e state obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const radiusMeters = Math.min(Math.max(Number(radius_km) * 1000, 500), 25000);
    const cacheKey = `${city.toLowerCase()}|${state.toLowerCase()}|${radiusMeters}`;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // cache lookup
    const { data: cached } = await supabase
      .from("spot_finder_cache")
      .select("result, expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (cached && new Date(cached.expires_at) > new Date()) {
      return new Response(JSON.stringify({ ...(cached.result as any), cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Geocode
    const geo = await geocode(`${city}, ${state}, Brasil`);
    if (!geo) {
      return new Response(JSON.stringify({ error: "Não consegui localizar essa cidade" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Places search — múltiplos tipos relevantes para vendedor de rua
    const [a, b, c, d] = await Promise.all([
      searchPlaces(geo.lat, geo.lng, radiusMeters, ["shopping_mall", "supermarket", "transit_station"]),
      searchPlaces(geo.lat, geo.lng, radiusMeters, ["gas_station", "bus_station", "subway_station"]),
      searchPlaces(geo.lat, geo.lng, radiusMeters, ["stadium", "university", "hospital"]),
      searchPlaces(geo.lat, geo.lng, radiusMeters, ["tourist_attraction", "park", "city_hall"]),
    ]);

    const merged = dedupe([...a, ...b, ...c, ...d]);
    const spots = merged.slice(0, 12).map((p: any) => ({
      id: p.id,
      name: p.displayName?.text || "Sem nome",
      address: p.formattedAddress || "",
      lat: p.location?.latitude,
      lng: p.location?.longitude,
      types: p.types || [],
      rating: p.rating,
      userRatingCount: p.userRatingCount,
      distance_km: Number(
        distanceKm({ lat: geo.lat, lng: geo.lng }, { lat: p.location?.latitude, lng: p.location?.longitude }).toFixed(2),
      ),
    }));

    if (spots.length === 0) {
      return new Response(JSON.stringify({ spots: [], center: geo }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) IA classifica
    const classified = await aiClassify(spots, `${city} - ${state}`, product_context);

    const enriched = spots.map((s, i) => {
      const cls = classified.find((c: any) => c.index === i + 1) || {};
      return { ...s, ...cls };
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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
