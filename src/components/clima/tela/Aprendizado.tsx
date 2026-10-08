/* 8 · O QUE A VANT APRENDEU SOBRE VOCÊ — cruza 4 coisas, nunca uma média solta:
   1) as vendas dele por tipo de tempo (clima_meu_aprendizado);
   2) o padrão real da região nos últimos 14 dias;
   3) quanto a chuva custa pra ele;
   4) o que os vendedores confirmaram (qual modelo mais acerta ali).
   + o "Tá chovendo aí agora?" que alimenta tudo isso. */
import { useEffect, useState } from "react";
import type { Insight } from "./insights";
import { COR, Cartao, CheckAnimado, Titulo, haptic } from "./comum";

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
              {v ? "Sim" : "Não"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Aprendizado({ insights, onResponder }: { insights: Insight[]; onResponder: (chovendo: boolean) => Promise<boolean> }) {
  return (
    <section aria-label="O que a VANT aprendeu sobre você">
      <Titulo>O que a VANT aprendeu</Titulo>
      <Cartao>
        {insights.length === 0 ? (
          <p className="text-[14px] leading-snug" style={{ color: COR.sub }}>
            Tô anotando o tempo de cada dia junto com o que você vende. Em poucos dias eu te digo em que tempo você rende mais.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {insights.map(({ icone: Icone, titulo, apoio }) => (
              <li key={titulo} className="flex gap-3">
                <span className="w-8 h-8 rounded-[10px] shrink-0 flex items-center justify-center" style={{ background: "#1A1A1A" }}><Icone className="w-[18px] h-[18px]" strokeWidth={2} style={{ color: COR.ouro }} /></span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold leading-snug" style={{ color: COR.texto }}>{titulo}</span>
                  <span className="block text-[13px] mt-0.5" style={{ color: COR.sub }}>{apoio}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <FeedbackChuva onResponder={onResponder} />
      </Cartao>
    </section>
  );
}
