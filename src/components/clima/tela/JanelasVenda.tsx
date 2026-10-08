/* 3 · JANELAS DE VENDA — a melhor janela, a confiança e os motivos REAIS
   (cada motivo só aparece se vale pra maioria das horas da janela). */
import { Check } from "lucide-react";
import type { Janela } from "../decisao";
import { COR_NIVEL } from "../decisao";
import { COR, Cartao, ChipConf, Titulo } from "./comum";

export function JanelasVenda({ janelas, aprendendo, pausadoPor }: { janelas: Janela[]; aprendendo: boolean; pausadoPor?: string | null }) {
  const melhor = janelas[0];
  const outras = janelas.slice(1, 3);
  return (
    <section aria-label="Janelas de venda">
      <Titulo>Janelas de venda</Titulo>
      <Cartao>
        {pausadoPor ? (
          <>
            <p className="text-[18px] font-bold" style={{ color: COR_NIVEL.risco }}>Janelas pausadas</p>
            <p className="text-[13.5px] mt-1" style={{ color: COR.sub }}>{pausadoPor}: nenhuma hora é segura pra vender enquanto o alerta valer.</p>
          </>
        ) : !melhor ? (
          <>
            <p className="text-[18px] font-bold" style={{ color: COR.texto }}>Sem janela boa por agora</p>
            <p className="text-[13.5px] mt-1" style={{ color: COR.sub }}>Chuva ou rua vazia nas próximas horas. Confere o hora a hora.</p>
          </>
        ) : (
          <>
            {!melhor.boa && <p className="text-[15px] font-bold mb-1" style={{ color: COR_NIVEL.atencao }}>Hoje o clima aperta</p>}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold" style={{ color: COR.sub }}>
                  {melhor.boa ? `Melhor janela ${melhor.amanha ? "amanhã" : "hoje"}` : `Melhor janela curta${melhor.amanha ? " amanhã" : ""}`}
                </p>
                <p className="text-[30px] leading-none font-extrabold tabular-nums mt-1" style={{ color: melhor.boa ? COR_NIVEL.bom : COR_NIVEL.atencao }}>{melhor.rotulo}</p>
              </div>
              <ChipConf conf={melhor.conf} />
            </div>
            {melhor.etiquetas.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {melhor.etiquetas.map((e) => (
                  <li key={e} className="inline-flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: "#d8d3c9" }}>
                    <Check className="w-4 h-4" strokeWidth={2.6} style={{ color: COR_NIVEL.bom }} />{e}
                  </li>
                ))}
              </ul>
            )}
            {outras.length > 0 && (
              <div className="mt-3 pt-3 border-t flex flex-col gap-1.5" style={{ borderColor: "rgba(255,255,255,.06)" }}>
                {outras.map((j) => (
                  <p key={j.iso} className="text-[14px] flex items-baseline gap-2" style={{ color: COR.sub }}>
                    <span className="font-bold tabular-nums" style={{ color: COR.texto }}>{j.rotulo}{j.amanha ? " (amanhã)" : ""}</span>
                    <span className="truncate">{j.etiquetas.slice(0, 2).join(" · ") || "dá pra vender"}</span>
                  </p>
                ))}
              </div>
            )}
          </>
        )}
        {aprendendo && <p className="text-[12px] mt-3" style={{ color: COR.mute }}>Quanto mais você usa o Foco, mais a janela acerta o seu horário forte.</p>}
      </Cartao>
    </section>
  );
}
