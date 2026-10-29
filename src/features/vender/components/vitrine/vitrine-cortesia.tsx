/* Pro de cortesia sem banco pago (Rick, 29/10/2026 — caso de um influenciador): o Pro é dele, mas
   o banco tem custo, então cada banco é R$ 12,90/mês. Em vez dos planos, o caminho do
   banco avulso: 1 compra por banco. App da loja: sem preço, fala com o suporte. */
import { ExternalLink, Landmark } from "lucide-react";
import { COR } from "@/shared/components/vant-ui";
import { BANCO_EXTRA_CHECKOUT, aoClicarCheckout } from "@/shared/lib/checkout";
import { useCheckoutUrl } from "@/hooks/useCheckoutUrl";
import { podeMostrarAssinatura } from "@/shared/lib/cobranca-loja";
import { abrirLinkExterno } from "@/shared/lib/link-externo";

const SUPORTE = "https://wa.me/5511915054830?text=" + encodeURIComponent("Oi! Tenho o VANT Pro de cortesia e quero ligar o banco (Open Finance).");

export function VitrineCortesia({ email }: { email?: string | null }) {
  const montar = useCheckoutUrl();
  const vende = podeMostrarAssinatura() && !!BANCO_EXTRA_CHECKOUT;
  const link = vende ? montar(`${BANCO_EXTRA_CHECKOUT}&sck=banco_extra`, { email }) : null;
  return (
    <section className="rounded-[22px] p-5 text-center" style={{ background: "linear-gradient(170deg,#1a1305,#0e0e10 70%)", border: "1px solid rgba(245,184,0,.42)", color: COR.texto }} aria-label="Ligar banco">
      <span className="mx-auto w-12 h-12 rounded-[14px] flex items-center justify-center" style={{ background: "rgba(245,184,0,.14)" }}><Landmark className="w-6 h-6" style={{ color: COR.ouro }} /></span>
      <p className="text-[10px] font-black tracking-[.16em] mt-3" style={{ color: COR.ouro }}>SEU VANT PRO É CORTESIA</p>
      <p className="text-[20px] font-black mt-1 leading-tight">Pra ligar o banco, só o banco é pago</p>
      <p className="text-[12.5px] mt-2 leading-relaxed" style={{ color: COR.suave }}>
        Cada leitura do banco tem custo pra VANT, então cada banco ligado é <b style={{ color: COR.texto }}>R$ 12,90 por mês</b>. Quer ligar 3 bancos? São 3 assinaturas de banco. A vaga libera sozinha em até 1 minuto depois de pagar.
      </p>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" onClick={aoClicarCheckout}
          className="mt-4 w-full h-12 rounded-[14px] inline-flex items-center justify-center gap-2 text-[14px] font-black"
          style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
          LIGAR UM BANCO · R$ 12,90/MÊS
        </a>
      ) : (
        <button type="button" onClick={() => void abrirLinkExterno(SUPORTE)}
          className="mt-4 w-full h-12 rounded-[14px] inline-flex items-center justify-center gap-2 text-[14px] font-black"
          style={{ background: COR.ouro, color: "#1A1200" }}>
          <ExternalLink className="w-4 h-4" /> Falar com o suporte
        </button>
      )}
      <p className="mt-2 text-[11px] leading-relaxed" style={{ color: COR.apagado }}>Paga com o mesmo e-mail da sua conta VANT. Depois volta aqui e liga o banco.</p>
    </section>
  );
}
