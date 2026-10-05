/* PRÓXIMOS DIAS — quanto separar em cada dia de trabalho até o fim do mês. */
import { useState } from "react";
import { Check, ChevronRight, Moon, PencilLine } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { BotaoSecundario, COR, Folha, LinhaTocavel, Rotulo } from "./ui";
import type { DiaVM } from "./tipos";
import type { DiaAlvo } from "./RegistrarValorFolha";

export function ProximosDiasFolha({ open, onOpenChange, dias, metaBase, onEditar }: {
  open: boolean; onOpenChange: (o: boolean) => void; dias: DiaVM[]; metaBase: number; onEditar: (d: DiaAlvo) => void;
}) {
  const [data, setData] = useState(getBrazilDate());
  return (
    <Folha open={open} onOpenChange={onOpenChange} titulo="Próximos dias" subtitulo="quanto separar em cada dia de trabalho" alta>
      {metaBase > 0 && (
        <div className="rounded-[14px] px-4 py-3" style={{ background: "#151a16", border: "1px solid rgba(61,214,140,.2)" }}>
          <div className="flex items-baseline justify-between gap-2">
            <Rotulo cor={COR.sub}>Meta base</Rotulo>
            <b className="text-[18px] tabular-nums" style={{ color: COR.verde }}>{formatCurrency(metaBase)}/dia</b>
          </div>
          <p className="text-[13px] mt-1" style={{ color: COR.sub }}>Guardando esse valor nos dias de trabalho, suas contas ficam cobertas.</p>
        </div>
      )}

      <div className="flex flex-col">
        {dias.map((d) => {
          const tom = d.feito ? COR.verde : d.isToday ? COR.ouro : d.isWork ? COR.texto : COR.mute;
          const conteudo = (
            <span className="flex items-center gap-3 min-h-[52px] w-full">
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold capitalize" style={{ color: d.isToday ? COR.ouro : COR.texto }}>{d.label}</span>
                {d.feito && <span className="text-[12px] font-bold uppercase tracking-[.08em]" style={{ color: tom }}>concluído</span>}
              </span>
              {d.isWork ? (
                <span className="inline-flex items-center gap-1.5 text-[16px] font-bold tabular-nums" style={{ color: tom }}>
                  {d.feito && <Check className="w-4 h-4" strokeWidth={3} />}{formatCurrency(d.valor)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[14px]" style={{ color: COR.mute }}><Moon className="w-4 h-4" />Descanso</span>
              )}
              {d.isWork && <span className="inline-flex items-center gap-0.5 text-[13px] font-semibold" style={{ color: COR.sub }}><PencilLine className="w-4 h-4" /><ChevronRight className="w-4 h-4" /></span>}
            </span>
          );
          return (
            <div key={d.key} className="border-b last:border-b-0" style={{ borderColor: "rgba(255,255,255,.06)" }}>
              {d.isWork
                ? <LinhaTocavel onClick={() => onEditar({ label: d.isToday ? "hoje" : d.label, isToday: d.isToday })}>{conteudo}</LinhaTocavel>
                : <div className="px-0">{conteudo}</div>}
            </div>
          );
        })}
      </div>

      <div className="pt-2" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
        <p className="text-[14px] font-semibold mb-2" style={{ color: COR.sub }}>Guardou num dia que já passou?</p>
        <div className="flex gap-2">
          <input type="date" value={data} max={getBrazilDate()} onChange={(e) => setData(e.target.value)}
            className="min-h-11 flex-1 min-w-0 rounded-[14px] px-3 text-[15px]" style={{ background: COR.surface2, border: `1px solid ${COR.borda}`, color: COR.texto }} />
          <BotaoSecundario tom="ouro" onClick={() => {
            const hoje = data === getBrazilDate();
            onEditar({ label: hoje ? "hoje" : `${data.slice(8, 10)}/${data.slice(5, 7)}`, isToday: hoje, data });
          }}>Registrar</BotaoSecundario>
        </div>
      </div>
    </Folha>
  );
}
