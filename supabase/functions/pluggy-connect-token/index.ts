import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify Supabase user JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pluggyClientId = Deno.env.get("PLUGGY_CLIENT_ID");
    const pluggyClientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");

    if (!pluggyClientId || !pluggyClientSecret) {
      return new Response(
        JSON.stringify({ error: "Integração bancária não configurada. Entre em contato com o suporte." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Step 1: Authenticate with Pluggy to get API key
    const authResponse = await fetch("https://api.pluggy.ai/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: pluggyClientId, clientSecret: pluggyClientSecret }),
    });

    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      console.error("Pluggy auth failed:", errorText);
      throw new Error("Falha na autenticação com a plataforma bancária");
    }

    const { apiKey } = await authResponse.json();

    // Step 2: Generate a short-lived connect token for the widget
    const connectTokenResponse = await fetch("https://api.pluggy.ai/connect_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
    });

    if (!connectTokenResponse.ok) {
      const errorText = await connectTokenResponse.text();
      console.error("Pluggy connect_token failed:", errorText);
      throw new Error("Falha ao gerar token de conexão bancária");
    }

    const { accessToken } = await connectTokenResponse.json();

    return new Response(JSON.stringify({ accessToken }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("pluggy-connect-token error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
