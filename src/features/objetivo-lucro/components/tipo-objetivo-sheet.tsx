/* "Criar objetivo" first asks the kind (Rick, 27/10/2026):
   save for something (the existing caixinha flow) or hit a profit (challenge). */
import { PiggyBank, TrendingUp, type LucideIcon } from "lucide-react";
import { Gaveta } from "@/shared/components/gaveta";
import { COR, PRESS } from "./ui";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onJuntar: () => void;
  onLucro: () => void;
}

export function TipoObjetivoSheet({ open, onOpenChange, onJuntar, onLucro }: Props) {
  return (
    <Gaveta open={open} onOpenChange={onOpenChange} titulo="Novo objetivo" style={{ background: COR.fundo, borderColor: "#2a2416" }}>
      <div className="px-[18px] pt-1" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
        <h3 className="text-[22px] font-black tracking-tight leading-none text-foreground">Novo objetivo</h3>
        <p className="text-[12.5px] mt-1" style={{ color: COR.mute }}>O que você quer conquistar?</p>
        <div className="mt-4 flex flex-col gap-2.5">
          <Opcao icon={TrendingUp} destaque titulo="Bater um lucro"
            texto="Ex.: R$ 5.000 de lucro em 15 dias. A Vant olha seus últimos 60 dias e diz quanto vender por dia."
            onClick={() => { onOpenChange(false); onLucro(); }} />
          <Opcao icon={PiggyBank} titulo="Juntar pra algo"
            texto="Moto, reserva, viagem. A Vant separa um pouco do lucro de cada dia até chegar lá."
            onClick={() => { onOpenChange(false); onJuntar(); }} />
        </div>
      </div>
    </Gaveta>
  );
}

function Opcao({ icon: Icon, titulo, texto, destaque = false, onClick }: { icon: LucideIcon; titulo: string; texto: string; destaque?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`w-full text-left rounded-[18px] p-4 flex gap-3 ${PRESS}`}
      style={destaque
        ? { background: "linear-gradient(170deg,rgba(245,184,0,.10),#131211 65%)", border: "1px solid rgba(245,184,0,.4)" }
        : { background: COR.caixa, border: `1px solid ${COR.linha}` }}>
      <span className="w-11 h-11 rounded-[13px] shrink-0 flex items-center justify-center" style={{ background: destaque ? "rgba(245,184,0,.14)" : "rgba(255,255,255,.05)" }}>
        <Icon className="w-5 h-5" style={{ color: destaque ? COR.ouro : COR.sub }} strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className="block text-[15.5px] font-extrabold" style={{ color: destaque ? COR.ouro : COR.texto }}>{titulo}</span>
        <span className="block text-[12.5px] mt-1 leading-snug" style={{ color: COR.sub }}>{texto}</span>
      </span>
    </button>
  );
}
