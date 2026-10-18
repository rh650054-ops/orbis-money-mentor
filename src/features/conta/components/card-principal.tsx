/* Who you are in VANT: picture, name, plan badge, city, member since. No phone/e-mail here. */
import { Camera, MapPin } from "lucide-react";
import type { Conta } from "../types";
import type { Plano } from "../lib/plano";
import { membroDesde } from "../lib/plano";
import { Botao, COR } from "@/shared/components/vant-ui";
import { FotoConta } from "./foto-conta";

export function CardPrincipal({ conta, plano, onFoto, onEditar }: { conta: Conta; plano: Plano; onFoto: () => void; onEditar: () => void }) {
  const cidade = [conta.city, conta.state].filter(Boolean).join(" · ");
  const desde = membroDesde(conta.created_at);
  const premium = plano.status === "ativo" || plano.status === "cortesia";
  return (
    <div className="rounded-[20px] p-4 flex flex-col gap-4 relative overflow-hidden"
      style={{ background: premium ? "linear-gradient(160deg,#1c1606,#0e0e10 62%)" : COR.card, border: `1px solid ${premium ? "rgba(245,184,0,.35)" : COR.borda}` }}>
      <div className="flex items-center gap-3.5">
        <button type="button" onClick={onFoto} aria-label="Trocar foto" className="relative shrink-0 transition-transform duration-100 active:scale-[0.96]">
          <FotoConta url={conta.avatar_url} nome={conta.nickname} tamanho={72} destaque={premium} />
          <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full grid place-items-center" style={{ background: COR.ouro, color: "#1A1200" }}>
            <Camera className="w-3.5 h-3.5" />
          </span>
        </button>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-[21px] font-black leading-tight truncate">{conta.nickname || "Vendedor"}</h1>
            {plano.selo && (
              <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black tracking-[.12em]"
                style={premium ? { background: COR.ouro, color: "#1A1200" } : { border: `1px solid ${COR.borda}`, color: COR.suave }}>
                {plano.selo}
              </span>
            )}
          </div>
          {cidade && <p className="text-[13px] font-semibold flex items-center gap-1" style={{ color: COR.suave }}><MapPin className="w-3.5 h-3.5" />{cidade}</p>}
          {desde && <p className="text-[12px]" style={{ color: COR.apagado }}>Membro desde {desde}</p>}
        </div>
      </div>
      <Botao onClick={onEditar} className="w-full">Editar dados</Botao>
    </div>
  );
}
