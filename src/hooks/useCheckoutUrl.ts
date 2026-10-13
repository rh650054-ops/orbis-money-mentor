import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { avisar } from "@/shared/lib/avisar";
import { comIdentidade, emailReal, type IdentidadeCheckout } from "@/shared/lib/checkout";

type PerfilCheckout = { nickname: string | null; cpf: string | null; phone: string | null; email: string | null };

// One read per user per session: the identity is needed synchronously at tap time
// (an await before window.open would lose the user gesture and get the tab blocked).
const cache = new Map<string, PerfilCheckout>();
const pendentes = new Map<string, Promise<PerfilCheckout | null>>();

function carregarPerfil(userId: string): Promise<PerfilCheckout | null> {
  const emCurso = pendentes.get(userId);
  if (emCurso) return emCurso;
  const p = (async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("nickname, cpf, phone, email")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (data) cache.set(userId, data);
      return data;
    } catch (e) {
      avisar.silencioso("checkout: ler perfil pro preenchimento", e);
      return null;
    } finally {
      pendentes.delete(userId);
    }
  })();
  pendentes.set(userId, p);
  return p;
}

/** Returns `montar(url, reserva?)`: the checkout URL with the logged-in buyer's
 *  identity (e-mail, name, CPF, phone, xcod=user id) so Hotmart opens prefilled and
 *  the webhook can find the account. `reserva` fills fields the account lacks. */
export function useCheckoutUrl(): (url: string, reserva?: IdentidadeCheckout) => string {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [perfil, setPerfil] = useState<PerfilCheckout | null>(() => (uid ? cache.get(uid) ?? null : null));

  useEffect(() => {
    if (!uid) { setPerfil(null); return; }
    const hit = cache.get(uid);
    if (hit) { setPerfil(hit); return; }
    let vivo = true;
    void carregarPerfil(uid).then((p) => { if (vivo) setPerfil(p); });
    return () => { vivo = false; };
  }, [uid]);

  const email = user?.email ?? null;
  return useCallback(
    (url: string, reserva?: IdentidadeCheckout) =>
      comIdentidade(url, {
        email: emailReal(email) ?? emailReal(perfil?.email) ?? reserva?.email,
        nome: perfil?.nickname ?? reserva?.nome,
        // CPF sign-ups: the login e-mail is "<cpf>@orbis.internal"
        cpf: perfil?.cpf || /^(\d{11})@orbis\.internal$/i.exec(email ?? "")?.[1] || reserva?.cpf,
        telefone: perfil?.phone ?? reserva?.telefone,
        userId: uid ?? reserva?.userId,
      }),
    [email, perfil, uid],
  );
}
