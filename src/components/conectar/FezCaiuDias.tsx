/* ============================================================
   FEZ × CAIU POR DIA (aba Vender, Rick 10/10/2026)
   Com banco: cada dia mostra o que ele vendeu e o que caiu de verdade.
   Sem Pro: o que ele vendeu aparece, o "caiu" fica borrado com o convite —
   é a vitrine do Pro (Rick: "algo que motive o cara a fazer o upgrade").
   ============================================================ */
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { carregarFezCaiu, naoApareceu, somaSemana, type DiaFezCaiu } from "./fez-caiu";

const OK = "#3DD68C";
const RED = "#ff6b7a";
const GOLD = "#F5B800";
const MUTE = "#8a857c";
const LINHA = "#1f1e22";
const caixa = { background: "linear-gradient(180deg,#101013,#0b0b0d)", border: `1px solid ${LINHA}` };

const reais = (v: number) => formatCurrency(v).replace(/,00$/, "");
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const rotulo = (iso: string) => {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  return `${SEMANA[d.getDay()] ?? ""} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
};

export function FezCaiuDias({ travado = false, onDesbloquear }: { travado?: boolean; onDesbloquear?: () => void }) {
  const [dias, setDias] = useState<DiaFezCaiu[] | null>(null);
  useEffect(() => { let vivo = true; void carregarFezCaiu(7).then((d) => { if (vivo) setDias(d); }); return () => { vivo = false; }; }, []);

  if (dias === null) return <div className="rounded-[22px] h-[180px] animate-pulse" style={caixa} />;
  if (dias.length === 0 && !travado) return null;

  const tot = somaSemana(dias);
  return (
    <div className="rounded-[22px] px-4 py-4" style={caixa}>
      <p className="text-[10.5px] font-black tracking-[.16em]" style={{ color: travado ? GOLD : OK }}>VOCÊ FEZ × CAIU · 7 DIAS</p>
      <div className="flex items-end justify-between mt-2.5 gap-3">
        <div>
          <p className="text-[26px] font-black tabular-nums leading-none">{reais(tot.fez)}</p>
          <p className="text-[11.5px] mt-1.5" style={{ color: MUTE }}>você vendeu</p>
        </div>
        <div className="text-right">
          <p className={`text-[26px] font-black tabular-nums leading-none ${travado ? "blur-[7px] select-none" : ""}`} style={{ color: OK }}>
            {travado ? "R$ 0.000" : reais(tot.recebido)}
          </p>
          <p className="text-[11.5px] mt-1.5" style={{ color: MUTE }}>recebeu de verdade</p>
        </div>
      </div>

      <div className="mt-3.5 relative">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[10px] font-black tracking-[.08em] pb-1.5" style={{ color: MUTE, borderBottom: `1px solid ${LINHA}` }}>
          <span>DIA</span><span className="text-right w-[78px]">FEZ</span><span className="text-right w-[78px]">CAIU</span>
        </div>
        {(dias.length ? dias : [{ dia: "", fez: 0, dinheiro: 0, caiu: null, conferido: true }]).map((d, i) => {
          const falta = naoApareceu(d);
          return (
            <div key={d.dia || i} className="py-2" style={{ borderBottom: `1px solid ${LINHA}` }}>
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center text-[13px] tabular-nums">
                <span className="font-bold">{rotulo(d.dia) || "—"}{d.conferido ? "" : <span className="text-[10px] font-black ml-1.5" style={{ color: GOLD }}>HOJE</span>}</span>
                <span className="text-right w-[78px] font-extrabold">{reais(d.fez)}</span>
                <span className={`text-right w-[78px] font-extrabold ${travado ? "blur-[6px] select-none" : ""}`} style={{ color: OK }}>
                  {travado ? "R$ 000" : d.caiu === null ? "—" : reais(d.caiu + d.dinheiro)}
                </span>
              </div>
              {!travado && falta > 0 && (
                <p className="text-[11px] mt-0.5" style={{ color: d.conferido ? RED : MUTE }}>
                  {d.conferido ? `${reais(falta)} não caíram · conta como fiado` : `${reais(falta)} ainda não apareceram · o banco confere à meia-noite`}
                </p>
              )}
            </div>
          );
        })}

        {travado && (
          <div className="absolute inset-y-0 right-0 w-[60%] flex items-center justify-center" style={{ background: "linear-gradient(90deg,transparent,rgba(11,11,13,.92) 30%)" }}>
            <button type="button" onClick={onDesbloquear}
              className="flex flex-col items-center gap-1.5 px-3 text-center active:opacity-70">
              <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(245,184,0,.12)", border: "1px solid rgba(245,184,0,.45)" }}>
                <Lock className="w-4 h-4" style={{ color: GOLD }} strokeWidth={2.6} />
              </span>
              <span className="text-[12.5px] font-black leading-tight">Quanto disso caiu de verdade?</span>
              <span className="text-[11px] font-extrabold" style={{ color: GOLD }}>Ver com o Vant Pro →</span>
            </button>
          </div>
        )}
      </div>

      <p className="text-[11.5px] mt-2.5 leading-relaxed" style={{ color: MUTE }}>
        {travado
          ? "O Pro liga no seu banco e mostra, dia por dia, o que caiu do que você vendeu — e o seu número ganha o selo no ranking."
          : "Caiu = Pix e maquininha que o banco viu + o dinheiro que você disse que recebeu. No ranking: durante o dia conta o que você lançou; da meia-noite em diante conta só o que caiu no banco (dinheiro não entra)."}
      </p>
    </div>
  );
}
