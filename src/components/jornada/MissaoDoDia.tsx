/* Missão do dia no teste (Rick, 06/10/2026): um cartão no Início e no Foco que diz
   o que fazer hoje, marca o que já foi feito e mostra os 4 dias. Some fora do teste. */
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { useJornada, abrirChatCom } from "./useJornada";
import { jornadaDoDia, ABRIR_CHAT_MARCA, TEXTO_CHAT_MARCA, brl } from "./jornada-lib";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const MUTE = "#7b766e";

export function MissaoDoDia() {
  const { emTeste, dia, feitos, vendidoNoTeste } = useJornada();
  const navigate = useNavigate();
  const j = jornadaDoDia(dia);
  if (!emTeste || !j) return null;

  const ir = (destino: string) => (destino === ABRIR_CHAT_MARCA ? abrirChatCom(TEXTO_CHAT_MARCA) : navigate(destino));
  const proximo = j.passos.find((p) => !feitos.has(p.id));
  const tudoFeito = !proximo;

  return (
    <section aria-label="Missão do dia" className="rounded-[20px] p-4 space-y-3"
      style={{ background: "linear-gradient(170deg,#1a1305,#0e0e10 70%)", border: "1px solid rgba(245,184,0,.38)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>
          {j.dia === 0 ? "DIA 0 · SEU COMEÇO" : j.dia === 3 ? "DIA 3 DE 3 · ÚLTIMO DIA" : `DIA ${j.dia} DE 3 · TESTE GRÁTIS`}
        </span>
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2, 3].map((d) => (
            <span key={d} className="h-1.5 w-5 rounded-full" style={{ background: d < j.dia ? GOLD : d === j.dia ? "rgba(245,184,0,.55)" : "#2a2824" }} />
          ))}
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-[18px] font-black leading-tight">{j.titulo}</p>
        <p className="text-[12.5px] leading-snug" style={{ color: "#b9b3a6" }}>{j.texto}</p>
      </div>

      <ul className="space-y-1.5">
        {(j.jaFeitos ?? []).map((t) => (
          <li key={t} className="flex items-center gap-2.5 text-[13px] font-bold">
            <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: OK, color: "#0b1d14" }}>
              <Check className="w-3 h-3" strokeWidth={3.5} />
            </span>
            <span style={{ color: MUTE, textDecoration: "line-through" }}>{t}</span>
          </li>
        ))}
        {j.passos.map((p) => {
          const feito = feitos.has(p.id);
          return (
            <li key={p.id} className="flex items-center gap-2.5 text-[13px] font-bold">
              <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={feito ? { background: OK, color: "#0b1d14" } : { border: "1.5px solid #3a3833" }}>
                {feito && <Check className="w-3 h-3" strokeWidth={3.5} />}
              </span>
              <span style={{ color: feito ? MUTE : "#F4F1EA", textDecoration: feito ? "line-through" : "none" }}>{p.nome}</span>
            </li>
          );
        })}
      </ul>

      {j.dia === 3 && vendidoNoTeste != null && vendidoNoTeste > 0 && (
        <div className="rounded-[14px] px-3 py-2.5 flex items-center justify-between gap-2" style={{ background: "#0f0f10", border: "1px solid #26241f" }}>
          <span className="text-[12px] font-bold" style={{ color: "#b9b3a6" }}>Vendido nos seus dias de teste</span>
          <span className="text-[18px] font-black" style={{ color: GOLD }}>{brl(vendidoNoTeste)}</span>
        </div>
      )}

      {proximo && (
        <button type="button" onClick={() => ir(proximo.destino)}
          className="w-full h-12 rounded-[14px] text-[14px] font-black active:translate-y-[1px]"
          style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
          {proximo.botao}
        </button>
      )}
      {(j.dia === 3 || (tudoFeito && j.dia >= 2)) && (
        <button type="button" onClick={() => navigate("/planos")}
          className="w-full text-[12.5px] font-extrabold underline underline-offset-[3px]" style={{ color: "#d8d2c4" }}>
          ver os planos da VANT
        </button>
      )}
      {tudoFeito && j.dia < 3 && (
        <p className="text-[12px] font-bold text-center" style={{ color: OK }}>Missão de hoje cumprida. Amanhã tem mais.</p>
      )}
    </section>
  );
}
