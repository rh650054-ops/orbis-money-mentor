/* 8 · A VANT APRENDEU (editorial, v2)  — cruza 4 coisas, nunca uma média solta:
   1) as vendas dele por tipo de tempo (clima_meu_aprendizado);
   2) o padrão real da região nos últimos 14 dias;
   3) quanto a chuva custa pra ele;
   4) o que os vendedores confirmaram (qual modelo mais acerta ali).
   + o "Tá chovendo aí agora?" que alimenta tudo isso. */
import { useEffect, useState } from "react";
import type { Insight } from "./insights";
import { Check } from "lucide-react";
import { COR, CheckAnimado, haptic } from "./comum";

const K = "vant_clima_feedback_ts";
function respondeuHaPouco() { try { return Date.now() - Number(localStorage.getItem(K) ?? 0) < 60 * 60 * 1000; } catch { return false; } }

function FeedbackChuva({ onResponder }: { onResponder: (chovendo: boolean) => Promise<boolean> }) {
  const [estado, setEstado] = useState<"pergunta" | "enviando" | "ok" | "oculto">(() => (respondeuHaPouco() ? "oculto" : "pergunta"));
  const [escolha, setEscolha] = useState<boolean | null>(null);
  useEffect(() => { if (estado === "ok") { const t = window.setTimeout(() => setEstado("oculto"), 6000); return () => window.clearTimeout(t); } }, [estado]);
  if (estado === "oculto") return null;
  const enviar = async (sim: boolean) => {
    haptic("sucesso"); setEscolha(sim); setEstado("enviando");
    try { localStorage.setItem(K, String(Date.now())); } catch { /* sem armazenamento */ }
    await onResponder(sim);
    setEstado("ok");
  };
  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,.06)" }}>
      {estado === "ok" ? (
        <p className="flex items-center gap-2 text-[14px] font-semibold animate-in fade-in duration-200" style={{ color: "#3DD68C" }}>
          <CheckAnimado tamanho={18} /> Valeu! Isso calibra a previsão da sua região.
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <p className="flex-1 text-[15px] font-bold" style={{ color: COR.texto }}>Tá chovendo aí agora?</p>
          {[true, false].map((v) => (
            <button key={String(v)} type="button" disabled={estado === "enviando"} onClick={() => void enviar(v)}
              className="h-10 min-w-[64px] px-3 rounded-[12px] border text-[14px] font-bold transition-[transform,background-color] duration-100 active:scale-[0.97]"
              style={escolha === v ? { background: COR.ouro, borderColor: COR.ouro, color: "#141005" } : { background: COR.surface2, borderColor: COR.borda, color: COR.texto }}>
              {escolha === v && <Check className="w-4 h-4 inline -mt-0.5 mr-1" strokeWidth={3} />}{v ? "Sim" : "Não"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Aprendizado({ insights, dias, onResponder }: { insights: Insight[]; dias: number; onResponder: (chovendo: boolean) => Promise<boolean> }) {
  return (
    <section aria-label="O que a VANT aprendeu sobre você">
      <div className="relative overflow-hidden rounded-[20px] border p-[18px]" style={{ borderColor: "rgba(245,184,0,.18)", background: "radial-gradient(120% 90% at 100% 0%, rgba(155,123,255,.10), transparent 50%), #0e0e10" }}>
        <p className="text-[12px] font-black uppercase tracking-[.16em]" style={{ color: COR.ouro }}>A VANT aprendeu</p>
        {insights.length === 0 ? (
          <p className="text-[15px] font-semibold leading-snug mt-2" style={{ color: COR.texto }}>
            Tô cruzando o tempo de cada dia com o que você vende. Em poucos dias eu te digo em que tempo você rende mais.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3.5">
            {insights.map(({ icone: Icone, cor, titulo, apoio }) => (
              <li key={titulo} className="flex gap-3">
                <Icone className="w-[22px] h-[22px] shrink-0 mt-px" strokeWidth={2.1} style={{ color: cor }} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-[16px] font-extrabold leading-snug" style={{ color: COR.texto }}>{titulo}</span>
                  <span className="block text-[13px] mt-0.5" style={{ color: COR.mute }}>{apoio}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {dias > 0 && <p className="text-[12px] mt-3.5" style={{ color: COR.mute }}>Baseado em {dias} {dias === 1 ? "dia analisado" : "dias analisados"}</p>}
        <FeedbackChuva onResponder={onResponder} />
      </div>
    </section>
  );
}
