/* Level 2 — "Você fez × caiu · 7 dias": totals, then one short status per day.
   Discrepancies become a chip, not a red sentence on every line. */
import { Lock } from "lucide-react";
import { COR, Secao } from "@/shared/components/vant-ui";
import { Pilula } from "@/shared/components/vant-status";
import type { DiaConc } from "../types";
import { estadoDoDia, recebido, resumoSemana } from "../lib/conciliacao";
import { ROTULO_DO_ESTADO, TOM_DO_ESTADO, reais } from "../lib/textos";

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const rotulo = (iso: string) => `${SEMANA[new Date(`${iso}T12:00:00`).getDay()] ?? ""} ${iso.slice(8, 10)}`;
const inteiro = (v: number) => reais(Math.round(v));

function Total({ valor, texto, cor, borrado }: { valor: string; texto: string; cor: string; borrado?: boolean }) {
  return (
    <div className="flex-1 min-w-0">
      <p className={`text-[17px] font-black tabular-nums leading-none truncate ${borrado ? "blur-[6px] select-none" : ""}`} style={{ color: cor }}>{valor}</p>
      <p className="text-[11px] font-bold mt-1" style={{ color: COR.apagado }}>{texto}</p>
    </div>
  );
}

export function SemanaCard({ dias, travado, onDesbloquear }: { dias: DiaConc[]; travado?: boolean; onDesbloquear?: () => void }) {
  const lista = dias.filter((d) => d.fez > 0);
  const t = resumoSemana(lista);
  if (lista.length === 0 && !travado) return null;

  return (
    <Secao titulo="VOCÊ FEZ × CAIU · 7 DIAS" id="sec-semana">
      <div className="flex gap-3">
        <Total valor={inteiro(t.fez)} texto="você fez" cor={COR.texto} />
        <Total valor={travado ? "R$ 0.000" : inteiro(t.caiu)} texto="caiu" cor={COR.ok} borrado={travado} />
        <Total valor={travado ? "R$ 000" : t.diferenca >= 1 ? inteiro(t.diferenca) : "—"} texto="diferença" cor={t.diferenca >= 1 ? COR.ouro : COR.apagado} borrado={travado} />
      </div>

      <div className="relative mt-3.5" style={{ minHeight: travado ? 120 : undefined }}>
        <div className="grid grid-cols-[1fr_72px_66px_88px] gap-x-2 text-[10px] font-black tracking-[.08em] pb-1.5" style={{ color: COR.apagado, borderBottom: "1px solid #1b1a17" }}>
          <span>DIA</span><span className="text-right">FEZ</span><span className="text-right">CAIU</span><span className="text-right">STATUS</span>
        </div>
        {lista.map((d) => {
          const e = estadoDoDia(d);
          return (
            <div key={d.dia} className="grid grid-cols-[1fr_72px_66px_88px] gap-x-2 items-center py-2 text-[12.5px] tabular-nums" style={{ borderBottom: "1px solid #1b1a17" }}>
              <span className="font-bold truncate">{rotulo(d.dia)}</span>
              <span className="text-right font-extrabold">{reais(d.fez)}</span>
              <span className={`text-right font-extrabold ${travado ? "blur-[5px] select-none" : ""}`} style={{ color: COR.ok }}>{travado ? "R$ 000" : d.caiu === null ? "—" : reais(recebido(d))}</span>
              <span className="flex flex-col items-end gap-0.5">
                {travado ? <span className="text-[11px]" style={{ color: COR.apagado }}>—</span> : <Pilula tom={TOM_DO_ESTADO[e]}>{ROTULO_DO_ESTADO[e]}</Pilula>}
              </span>
            </div>
          );
        })}
        {travado && (
          <button type="button" onClick={onDesbloquear} className="absolute inset-y-0 right-0 w-[62%] flex flex-col items-center justify-center gap-1.5 text-center active:opacity-70"
            style={{ background: "linear-gradient(90deg,transparent,rgba(14,14,16,.94) 28%)" }}>
            <Lock className="w-4 h-4" style={{ color: COR.ouro }} />
            <span className="text-[12.5px] font-black leading-tight">Quanto disso caiu de verdade?</span>
            <span className="text-[11px] font-extrabold" style={{ color: COR.ouro }}>Ver com o VANT Pro →</span>
          </button>
        )}
      </div>
    </Secao>
  );
}
