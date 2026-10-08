/* 3 · MELHOR JANELA — componente de OPORTUNIDADE (v2, 08/10): verde com
   moderação, a janela grande, chips com os motivos REAIS (só os que valem pra
   maioria das horas), a temperatura e a confiança em %. */
import { Check, Thermometer } from "lucide-react";
import type { Janela } from "../decisao";
import { COR, Titulo } from "./comum";
import { CLIMA } from "./paleta";

function Chip({ children, cor = "#d8d3c9" }: { children: React.ReactNode; cor?: string }) {
  return <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[13px] font-semibold whitespace-nowrap" style={{ background: "rgba(255,255,255,.06)", color: cor }}>{children}</span>;
}

export function JanelasVenda({ janelas, aprendendo, pausadoPor }: { janelas: Janela[]; aprendendo: boolean; pausadoPor?: string | null }) {
  const melhor = janelas[0];
  const outras = janelas.slice(1, 3);
  const cor = !melhor || pausadoPor ? CLIMA.neutro : melhor.boa ? CLIMA.bom : CLIMA.instavel;
  return (
    <section aria-label="Melhor janela de venda">
      <Titulo>Melhor janela</Titulo>
      <div className="relative overflow-hidden rounded-[20px] border p-[18px]"
        style={{ borderColor: `${cor}${pausadoPor ? "33" : "55"}`, background: `radial-gradient(120% 120% at 0% 0%, ${cor}1f, transparent 55%), #0e0e10` }}>
        {pausadoPor ? (
          <>
            <p className="text-[20px] font-extrabold" style={{ color: CLIMA.risco }}>Janelas pausadas</p>
            <p className="text-[14px] mt-1 leading-snug" style={{ color: COR.sub }}>{pausadoPor}: nenhuma hora é segura pra vender enquanto o alerta valer.</p>
          </>
        ) : !melhor ? (
          <>
            <p className="text-[20px] font-extrabold" style={{ color: COR.texto }}>Sem janela boa por agora</p>
            <p className="text-[14px] mt-1 leading-snug" style={{ color: COR.sub }}>Chuva ou rua vazia nas próximas horas.</p>
          </>
        ) : (
          <>
            <p className="text-[38px] leading-none font-black tabular-nums tracking-tight" style={{ color: cor }}>
              {melhor.rotulo}{melhor.amanha && <span className="text-[16px] font-bold ml-2" style={{ color: COR.sub }}>amanhã</span>}
            </p>
            <p className="inline-flex items-center gap-2 mt-2.5 text-[15px] font-bold" style={{ color: COR.texto }}>
              <i className="w-2.5 h-2.5 rounded-full" style={{ background: cor, boxShadow: `0 0 0 4px ${cor}26` }} />
              {melhor.boa ? "Boa oportunidade" : "Janela curta · o clima aperta"}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {melhor.etiquetas.map((e) => <Chip key={e}><Check className="w-3.5 h-3.5" strokeWidth={2.8} style={{ color: cor }} />{e}</Chip>)}
              {melhor.temp != null && <Chip><Thermometer className="w-3.5 h-3.5" strokeWidth={2.4} />{melhor.temp}°</Chip>}
              <Chip cor={melhor.confPct >= 80 ? CLIMA.bom : melhor.confPct >= 62 ? CLIMA.instavel : CLIMA.risco}>Confiança {melhor.confPct}%</Chip>
            </div>
            {outras.length > 0 && (
              <p className="mt-3.5 pt-3 border-t text-[13.5px]" style={{ borderColor: "rgba(255,255,255,.07)", color: COR.sub }}>
                Também: {outras.map((j) => <b key={j.iso} className="tabular-nums" style={{ color: COR.texto }}>{j.rotulo}{j.amanha ? " (amanhã)" : ""} </b>)}
              </p>
            )}
          </>
        )}
        {aprendendo && !pausadoPor && <p className="text-[12px] mt-3" style={{ color: COR.mute }}>Quanto mais você usa o Foco, mais a janela acerta o seu horário forte.</p>}
      </div>
    </section>
  );
}
