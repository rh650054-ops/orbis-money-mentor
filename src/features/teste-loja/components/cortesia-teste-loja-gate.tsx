/* TESTE FECHADO DA PLAY STORE (Rick, 28/10/2026): "pode dar essa cortesia".
   In the store app, right after login, asks once for the 30-day test. Draws nothing;
   when the server grants it, reloads so the trial screens and badges pick up the new date. */
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ehAppDaLoja } from "@/shared/lib/platform";
import { useCortesiaTesteLoja } from "../api/use-cortesia-teste-loja";
import { jaPediu, marcarPedido } from "../lib/pedido";

export const AVISO_CORTESIA = "vant_cortesia_loja_aviso";

export function CortesiaTesteLojaGate() {
  const { user } = useAuth();
  const { mutate } = useCortesiaTesteLoja();
  const userId = user?.id;

  useEffect(() => {
    if (!userId || !ehAppDaLoja() || jaPediu(userId)) return;
    mutate(undefined, {
      onSuccess: (r) => {
        marcarPedido(userId);
        if (r !== "aplicada") return;
        try { sessionStorage.setItem(AVISO_CORTESIA, "1"); } catch { /* só o aviso */ }
        window.location.reload();
      },
    });
  }, [userId, mutate]);

  return null;
}
