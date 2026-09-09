import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let d1 = (sum * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  let d2 = (sum * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10]);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { cpf, password, name, phone, email } = await req.json();

    if (!cpf || !password || !name) {
      return new Response(
        JSON.stringify({ error: "cpf, password e name são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanedCpf = cpf.replace(/\D/g, "");
    if (!isValidCpf(cleanedCpf)) {
      return new Response(
        JSON.stringify({ error: "CPF inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const internalEmail = `${cleanedCpf}@orbis.internal`;

    // SECURITY: only delete an existing account if it was NEVER confirmed and
    // NEVER logged in (cleanup of an abandoned/failed signup). If a real account
    // already exists for this CPF we must refuse — otherwise anyone who knows a
    // CPF (semi-public in Brazil) could wipe and take over that account.
    // BUG CORRIGIDO (09/09/2026): antes isso listava os usuarios de 200 em 200 e
    // olhava SO a primeira pagina. Com 684 contas, quem estava da 201 em diante
    // nunca era encontrado — a pessoa nao via "Este CPF ja possui uma conta",
    // via o erro cru do banco em ingles. Agora a pergunta vai direto no auth.users.
    const { data: achado } = await supabase.rpc("orbis_conta_por_cpf", { p_cpf: cleanedCpf });
    const existingUser = ((achado as { user_id: string; confirmada: boolean }[]) ?? [])[0] ?? null;
    if (existingUser) {
      const isConfirmed = !!existingUser.confirmada;
      if (isConfirmed) {
        return new Response(
          JSON.stringify({ error: "Este CPF já possui uma conta. Faça login ou recupere a senha." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Unconfirmed leftover from a failed signup — safe to clean up.
      await supabase.auth.admin.deleteUser(existingUser.user_id);
    }

    // Create user with email already confirmed (bypasses email confirmation requirement)
    const trialStart = new Date().toISOString().split("T")[0];
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 3);
    const trialEnd = trialEndDate.toISOString().split("T")[0];

    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { name, cpf: cleanedCpf, phone: phone || null },
    });

    if (createError) {
      // nao devolve o texto cru do banco (vaza detalhe interno e vem em ingles)
      console.error("register-user createUser:", createError.message);
      const jaExiste = /already|exists|duplicate|registered/i.test(createError.message || "");
      return new Response(
        JSON.stringify({ error: jaExiste
          ? "Este CPF já possui uma conta. Faça login ou recupere a senha."
          : "Não deu pra criar sua conta agora. Tenta de novo em instantes." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (authData.user) {
      // Update profile with CPF, phone, email, and trial info
      await supabase
        .from("profiles")
        .update({
          cpf: cleanedCpf,
          phone: phone || null,
          email: email || null,
          nickname: name,
          trial_start: trialStart,
          trial_end: trialEnd,
          is_trial_active: true,
          plan_status: "trial",
        })
        .eq("user_id", authData.user.id);

      // RECONCILIACAO: a pessoa pode ter PAGO na Hotmart antes de criar a conta e a
      // compra ter caido em unlinked_purchases sem nunca liberar acesso. Casamos SO por
      // CPF (a identidade da conta que esta sendo criada) — casar por email seria inseguro
      // (alguem poderia se cadastrar com o email de outra pessoa e roubar a compra dela).
      try {
        const { data: pending } = await supabase
          .from("unlinked_purchases")
          .select("hotmart_purchase_id, hotmart_subscription_id, event_type")
          .eq("buyer_cpf", cleanedCpf)
          .is("linked_to_user_id", null)
          .order("created_at", { ascending: false });

        const latest = (pending ?? [])[0];
        if (latest) {
          const ev = (latest.event_type ?? "").toUpperCase();
          const isActivating =
            ev.includes("APPROVED") || ev.includes("COMPLETE") || ev.includes("RENEWAL");
          if (isActivating) {
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setDate(periodEnd.getDate() + 30);
            const graceEnd = new Date(periodEnd);
            graceEnd.setDate(graceEnd.getDate() + 3);
            await supabase.from("subscriptions").upsert(
              {
                user_id: authData.user.id,
                provider: "hotmart",
                status: "active",
                current_period_end: periodEnd.toISOString(),
                grace_until: graceEnd.toISOString(),
                hotmart_purchase_id: latest.hotmart_purchase_id,
                hotmart_subscription_id: latest.hotmart_subscription_id,
                last_event_at: now.toISOString(),
              },
              { onConflict: "user_id" }
            );
            await supabase
              .from("profiles")
              .update({ plan_status: "active", is_trial_active: false })
              .eq("user_id", authData.user.id);
          }
          // Marca as compras desse CPF como vinculadas (mesmo se o ultimo evento nao ativa,
          // ex: cancelada) pra nao reprocessar depois.
          await supabase
            .from("unlinked_purchases")
            .update({ linked_at: new Date().toISOString(), linked_to_user_id: authData.user.id })
            .eq("buyer_cpf", cleanedCpf)
            .is("linked_to_user_id", null);
        }
      } catch (e) {
        console.error("register-user: reconcile unlinked falhou", (e as { message?: string })?.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, userId: authData.user?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    // o texto cru do erro so vai pro log; pro usuario, portugues de gente
    console.error("register-user:", String(err?.message ?? err).slice(0, 300));
    return new Response(
      JSON.stringify({ error: "Não deu pra criar sua conta agora. Tenta de novo em instantes." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
