import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Always returns 200 to prevent Pluggy from retrying
const respond = (body = {}) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("Pluggy webhook received:", JSON.stringify(payload).slice(0, 400));

    const { event, itemId } = payload;
    if (!event || !itemId) return respond({ received: true });

    // Only process transaction-related events
    if (!event.toLowerCase().startsWith("transactions") && event !== "item/updated") {
      return respond({ received: true });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Find the bank_connection linked to this item
    const { data: connection } = await supabase
      .from("bank_connections")
      .select("id, user_id")
      .eq("item_id", itemId)
      .maybeSingle();

    if (!connection) {
      console.log("No bank_connection found for item_id:", itemId);
      return respond({ received: true });
    }

    // Authenticate with Pluggy
    const pluggyClientId = Deno.env.get("PLUGGY_CLIENT_ID");
    const pluggyClientSecret = Deno.env.get("PLUGGY_CLIENT_SECRET");

    const authRes = await fetch("https://api.pluggy.ai/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: pluggyClientId, clientSecret: pluggyClientSecret }),
    });

    if (!authRes.ok) {
      console.error("Pluggy auth failed in webhook handler");
      return respond({ received: true });
    }

    const { apiKey } = await authRes.json();

    // Fetch accounts for this item
    const accountsRes = await fetch(`https://api.pluggy.ai/accounts?itemId=${itemId}`, {
      headers: { "X-API-KEY": apiKey },
    });
    const accountsData = await accountsRes.json();
    const accounts: any[] = accountsData.results || [];

    // Only look at transactions from the last 7 days to avoid importing old history
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const dateFrom = since.toISOString().split("T")[0];

    let inserted = 0;

    for (const account of accounts) {
      const txRes = await fetch(
        `https://api.pluggy.ai/transactions?accountId=${account.id}&dateFrom=${dateFrom}&pageSize=50`,
        { headers: { "X-API-KEY": apiKey } },
      );
      const txData = await txRes.json();
      const transactions: any[] = txData.results || [];

      // Only process CREDIT transactions (money coming IN — sales / PIX received)
      const credits = transactions.filter((tx) => tx.type === "CREDIT" && tx.amount > 0);

      for (const tx of credits) {
        const txDate = tx.date ? tx.date.split("T")[0] : dateFrom;

        const { error } = await supabase
          .from("auto_detected_sales")
          .upsert(
            {
              user_id: connection.user_id,
              bank_connection_id: connection.id,
              transaction_id: tx.id,
              amount: tx.amount,
              description: tx.description ?? null,
              transaction_date: txDate,
              status: "pending",
            },
            { onConflict: "transaction_id", ignoreDuplicates: true },
          );

        if (!error) inserted++;
      }
    }

    console.log(`Inserted ${inserted} auto_detected_sales for user ${connection.user_id}`);

    // Update sync timestamp
    await supabase
      .from("bank_connections")
      .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", connection.id);

    return respond({ received: true, inserted });
  } catch (error) {
    console.error("pluggy-webhook error:", error);
    // Always 200 — never return 4xx/5xx or Pluggy will keep retrying
    return respond({ received: true });
  }
});
