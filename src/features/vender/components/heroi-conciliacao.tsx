/* Level 1 — "Conciliado hoje": what landed × what was sold × what is missing. */
import { RefreshCw, CheckCircle2, Clock3, AlertTriangle, Info } from "lucide-react";
import { horaBR } from "@/components/conectar/pluggy";
import { COR } from "@/shared/components/vant-ui";
import { TOM } from "@/shared/components/vant-status";
import { useNumeroAnimado } from "@/shared/hooks/use-numero-animado";
import type { DiaConc, Estado } from "../types";
import { esperado, estadoDoDia, progresso } from "../lib/conciliacao";
import { TOM_DO_ESTADO, mensagem, reais } from "../lib/textos";

const ICONE: Record<Estado, typeof CheckCircle2> = {
  ok: CheckCircle2, depois: Info, aguardando: Clock3, parcial: AlertTriangle, nada: AlertTriangle, sem_venda: Info,
};

interface Props {
  dia: DiaConc; ehHoje: boolean; ultimaLeitura: string | null; bancos: (string | null)[];
  dicas: string[]; atualizando: boolean; onAtualizar: () => void;
}

export function HeroiConciliacao({ dia, ehHoje, ultimaLeitura, bancos, dicas, atualizando, onAtualizar }: Props) {
  const estado = estadoDoDia(dia);
  const cor = TOM[TOM_DO_ESTADO[estado]];
  const caiu = useNumeroAnimado(dia.caiu ?? 0);
  const pct = progresso(dia);
  const pctDepois = esperado(dia) > 0 ? Math.min(pct, Math.round((dia.depois / esperado(dia)) * 100)) : 0;
  const { titulo, apoio } = mensagem(dia, estado, bancos);
  const Icone = ICONE[estado];
  const rotulo = ehHoje ? "CONCILIADO HOJE" : `CONCILIADO ${dia.dia.slice(8, 10)}/${dia.dia.slice(5, 7)}`;

  return (
    <section aria-label="Conciliação do dia" className="rounded-[22px] p-4 relative overflow-hidden"
      style={{ background: `linear-gradient(170deg, ${cor}14, ${COR.card} 55%)`, border: `1px solid ${cor}40` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black tracking-[.16em]" style={{ color: cor }}>{rotulo}</p>
          <p className="text-[11.5px] font-semibold mt-0.5" style={{ color: COR.apagado }}>
            {ultimaLeitura ? `Última sincronização às ${horaBR(ultimaLeitura)}` : "Aguardando a primeira leitura do banco"}
          </p>
        </div>
        <button type="button" onClick={onAtualizar} disabled={atualizando} aria-label="Atualizar agora"
          className="h-8 px-2.5 rounded-[10px] inline-flex items-center gap-1.5 text-[11.5px] font-extrabold transition-transform duration-100 active:scale-[0.97] disabled:opacity-60"
          style={{ background: "#141416", border: `1px solid ${COR.borda}`, color: COR.texto }}>
          <RefreshCw className={`w-3.5 h-3.5 ${atualizando ? "animate-spin" : ""}`} /> {atualizando ? "Lendo…" : "Atualizar"}
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3 mt-4">
        <div className="min-w-0">
          <p className="text-[31px] font-black tabular-nums leading-none whitespace-nowrap" style={{ color: estado === "sem_venda" ? COR.texto : estado === "depois" ? COR.ok : cor }}>{reais(Math.round(caiu * 100) / 100)}</p>
          <p className="text-[12px] font-bold mt-1.5" style={{ color: COR.suave }}>caiu na conta</p>
          {dia.qtd > 0 && <p className="text-[11px]" style={{ color: COR.apagado }}>{dia.qtd} {dia.qtd === 1 ? "entrada" : "entradas"} no banco</p>}
        </div>
        <div className="text-right max-w-[150px]">
          <p className="text-[22px] font-black tabular-nums leading-none mt-2 whitespace-nowrap" style={{ color: COR.texto }}>{reais(dia.fez)}</p>
          <p className="text-[12px] font-bold mt-1.5" style={{ color: COR.suave }}>você lançou</p>
          {dia.dinheiro > 0 && <p className="text-[11px]" style={{ color: COR.apagado }}>{reais(dia.dinheiro)} em dinheiro não passa no banco</p>}
        </div>
      </div>

      <div className="h-2 rounded-full mt-4 overflow-hidden flex" style={{ background: "#1c1c1f" }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full transition-[width] duration-500 ease-out" style={{ width: `${pct - pctDepois}%`, background: estado === "depois" ? COR.ok : cor }} />
        {pctDepois > 0 && <div className="h-full transition-[width] duration-500 ease-out" style={{ width: `${pctDepois}%`, background: COR.info }} />}
      </div>

      <div className="flex items-start gap-2 mt-3">
        <Icone className="w-[18px] h-[18px] shrink-0 mt-[1px]" style={{ color: cor }} />
        <div className="min-w-0">
          <p className="text-[15px] font-black leading-snug" style={{ color: estado === "sem_venda" ? COR.texto : cor }}>{titulo}</p>
          <p className="text-[12.5px] leading-snug mt-0.5" style={{ color: COR.suave }}>{apoio}</p>
        </div>
      </div>

      {dicas.map((d) => (
        <p key={d} className="text-[12px] leading-snug mt-2.5 rounded-xl px-3 py-2" style={{ background: "rgba(0,0,0,.35)", color: COR.suave }}>{d}</p>
      ))}
    </section>
  );
}
