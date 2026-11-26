/* In-app renewal path (Rick, 26/11/2026). Loads the logged-in person's path once (and again when
   the app comes back to the front, e.g. after paying), so abrirCheckout decides at the tap.
   When a checkout would be refused by Hotmart, abrirCheckout fires EVENTO_CAMINHO and this sheet
   shows the right path instead (RegularizarAssinatura). Path still unknown at the tap: loads it
   here; a new checkout then opens only from this sheet's own button. */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { abrirCheckoutDireto } from "@/shared/lib/checkout";
import { EVENTO_CAMINHO, carregarCaminho, definirUsuarioDoCaminho, precisaDesviar, type Caminho } from "@/shared/lib/caminho-assinatura";
import { useRenovacaoPixQuery } from "../api/use-renovacao-pix";
import { RegularizarAssinatura } from "./regularizar-assinatura";

export function CaminhoAssinaturaSheet() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [pedido, setPedido] = useState<{ url: string; caminho: Caminho | null } | null>(null);
  const pix = useRenovacaoPixQuery(pedido ? userId ?? undefined : undefined).data ?? null;

  useEffect(() => {
    definirUsuarioDoCaminho(userId);
    if (!userId) return;
    void carregarCaminho();
    const voltou = () => { if (document.visibilityState === "visible") void carregarCaminho(); };
    document.addEventListener("visibilitychange", voltou);
    return () => document.removeEventListener("visibilitychange", voltou);
  }, [userId]);

  useEffect(() => {
    const abrir = (e: Event) => {
      const url = (e as CustomEvent<{ url: string }>).detail?.url ?? "";
      void carregarCaminho().then((c) => {
        // the server cannot tell, or a new checkout is valid: go on to the checkout
        if (!c || !precisaDesviar(c, url)) { setPedido(null); abrirCheckoutDireto(url); return; }
        setPedido({ url, caminho: c });
      });
    };
    window.addEventListener(EVENTO_CAMINHO, abrir);
    return () => window.removeEventListener(EVENTO_CAMINHO, abrir);
  }, []);

  if (!pedido?.caminho) return null;
  const fechar = () => setPedido(null);
  return (
    <div role="dialog" aria-modal="true" aria-label="Sua assinatura" className="fixed inset-0 z-[90] flex items-end justify-center" style={{ background: "rgba(0,0,0,.65)" }} onClick={fechar}>
      <div className="w-full max-w-[480px] rounded-t-[24px] px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-h-[90dvh] overflow-y-auto text-[#F4F1EA]"
        onClick={(e) => e.stopPropagation()} style={{ background: "#0b0b0c", borderTop: "1px solid rgba(245,184,0,.35)" }}>
        <div className="flex justify-end -mb-2"><button type="button" onClick={fechar} aria-label="Fechar" className="p-1" style={{ color: "#8f897e" }}><X className="w-5 h-5" /></button></div>
        <RegularizarAssinatura caminho={pedido.caminho} pix={pix}
          onLiberado={() => { fechar(); window.location.reload(); }}
          onNovaAssinatura={() => { const u = pedido.url; fechar(); abrirCheckoutDireto(u); }} />
      </div>
    </div>
  );
}
