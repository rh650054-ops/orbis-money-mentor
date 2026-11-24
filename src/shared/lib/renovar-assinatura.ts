/* Store app, "Renovar assinatura" (Rick, 24/11/2026): an ex-subscriber goes straight to the
 * Hotmart checkout of the plan they had, already filled with their name/e-mail/CPF/phone and
 * xcod=user id, so the webhook releases THIS account (no second account).
 *
 * Which plan they had (read-only, own rows — RLS):
 *   orbis_pro.produto_id = Hotmart offer: 5y86n311 → Pro Mensal, ew11enu0 → Pro Anual;
 *   else a Hotmart row in subscriptions → Essencial.
 * Any other case (old offer, courtesy, nothing found, error) → null: the caller opens the plans
 * page (/assinar with the token) instead of guessing a plan and charging the wrong one. */
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "./avisar";
import { comIdentidade, emailReal, getCheckoutUrl, getProCheckoutUrl } from "./checkout";

const OFERTA_PRO: Record<string, "mensal" | "anual"> = { "5y86n311": "mensal", ew11enu0: "anual" };

export async function linkDeRenovacao(userId: string, emailLogin: string | null): Promise<string | null> {
  try {
    const [pro, sub, perfil] = await Promise.all([
      supabase.from("orbis_pro").select("produto_id, origem, atualizado_em").eq("user_id", userId)
        .order("atualizado_em", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("subscriptions").select("provider").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("nickname, cpf, phone, email").eq("user_id", userId).maybeSingle(),
    ]);
    if (pro.error) throw pro.error;
    let base: string | null = null;
    const plano = pro.data?.origem === "hotmart" ? OFERTA_PRO[pro.data.produto_id ?? ""] : undefined;
    if (plano) base = getProCheckoutUrl(plano);
    else if (!pro.data && !sub.error && sub.data?.provider === "hotmart") base = getCheckoutUrl();
    if (!base) return null;
    const p = perfil.data;
    return comIdentidade(base, {
      email: emailReal(emailLogin) ?? emailReal(p?.email),
      nome: p?.nickname,
      cpf: p?.cpf || /^(\d{11})@orbis\.internal$/i.exec(emailLogin ?? "")?.[1],
      telefone: p?.phone,
      userId,
    });
  } catch (e) {
    avisar.silencioso("renovar: plano anterior", e);
    return null;
  }
}
