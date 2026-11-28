import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { CABECALHOS_VANT, VANT_CLIENTE } from "./cabecalho-cliente";

describe("x-client-info sent by the app", () => {
  it("goes out as exactly the VANT value, not merged with supabase-js's default", async () => {
    const vistos: string[] = [];
    const fetchEspiao: typeof fetch = async (entrada, init) => {
      vistos.push(new Headers(init?.headers).get("x-client-info") ?? "");
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };
    const cliente = createClient("https://exemplo.supabase.co", "chave-publica", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchEspiao, headers: CABECALHOS_VANT },
    });
    await cliente.from("challenge_sessions").select("id");
    await cliente.rpc("defcon_lancar", {});
    expect(vistos).toEqual([VANT_CLIENTE, VANT_CLIENTE]);
  });
});
