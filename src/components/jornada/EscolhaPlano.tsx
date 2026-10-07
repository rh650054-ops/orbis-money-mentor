/* Os 3 planos da VANT numa tela (Rick, 06/10/2026): VANT Pro Anual (já selecionado),
   VANT Pro Mensal e VANT Essencial. Usado no fim do teste, na tela /planos e na oferta
   do último dia. O Essencial nunca some: é a porta mais barata. */
import { useState } from "react";
import { getCheckoutUrl, getProCheckoutUrl } from "@/shared/lib/checkout";
import { brl } from "./jornada-lib";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const MUTE = "#7b766e";
const ZAP_YAN = "https://wa.me/5511915054830?text=" + encodeURIComponent("Oi! Meu teste da VANT acabou e quero tirar uma dúvida sobre os planos.");

type Escolha = "anual" | "mensal" | "essencial";

const PLANOS: { id: Escolha; nome: string; preco: string; linha: string; selo?: string; economia?: string }[] = [
  { id: "anual", nome: "VANT Pro Anual", preco: "R$ 34,90", linha: "R$ 418,80/ano · 2 bancos", selo: "MAIS ESCOLHIDO · 2 BANCOS", economia: "ECONOMIZA R$ 180" },
  { id: "mensal", nome: "VANT Pro Mensal", preco: "R$ 49,90", linha: "1 banco · selo azul · financeiro · IA · Caça-Sinal" },
  { id: "essencial", nome: "VANT Essencial", preco: "R$ 29,90", linha: "Foco · ranking · relatório · comunidade · sem banco" },
];

const CTA: Record<Escolha, string> = {
  anual: "ASSINAR O PRO ANUAL · R$ 418,80",
  mensal: "ASSINAR O PRO MENSAL · R$ 49,90",
  essencial: "ASSINAR O ESSENCIAL · R$ 29,90",
};

const linkDe = (e: Escolha) => (e === "essencial" ? getCheckoutUrl() : getProCheckoutUrl(e));

export function EscolhaPlano({ vendido, titulo }: { vendido?: number | null; titulo?: string }) {
  const [escolha, setEscolha] = useState<Escolha>("anual");
  return (
    <div className="space-y-3">
      <div className="text-center space-y-1.5">
        <p className="text-[22px] font-black tracking-[-.02em] leading-[1.12] text-balance">
          {titulo ?? (vendido && vendido > 0 ? `Você vendeu ${brl(vendido)} com a VANT. Não para agora.` : "Escolha como seguir com a VANT")}
        </p>
        <p className="text-[12.5px]" style={{ color: "#b9b3a6" }}>Seu histórico, sua ofensiva e seu lugar no ranking ficam guardados.</p>
      </div>

      <div className="space-y-2.5 pt-2">
        {PLANOS.map((p) => {
          const ativo = escolha === p.id;
          return (
            <button key={p.id} type="button" onClick={() => setEscolha(p.id)} aria-pressed={ativo}
              className="relative w-full rounded-[18px] p-[13px_14px] text-left grid gap-1.5 active:opacity-80"
              style={ativo ? {
                border: "1px solid transparent",
                background: "linear-gradient(#171206,#0f0d08) padding-box, linear-gradient(135deg,#FFE27A,#B88E00 60%,#FFC800) border-box",
                boxShadow: "0 18px 40px -22px rgba(255,200,0,.9)",
              } : { border: "1px solid #26241f", background: "#0e0e0f" }}>
              {p.selo && (
                <span className="absolute -top-2.5 left-3.5 rounded-full px-2.5 py-1 text-[9px] font-black tracking-[.12em]"
                  style={{ background: "linear-gradient(180deg,#FFF1B3,#FFC800)", color: "#1a1305" }}>{p.selo}</span>
              )}
              <span className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-[15px] font-black">
                  <span className="w-[18px] h-[18px] rounded-full shrink-0" style={{
                    border: `2px solid ${ativo ? GOLD : "#3a3833"}`,
                    background: ativo ? `radial-gradient(circle,${GOLD} 45%,transparent 50%)` : "transparent",
                  }} />
                  {p.nome}
                </span>
                <span className="text-[22px] font-black tracking-[-.02em] tabular-nums leading-none whitespace-nowrap" style={{ color: ativo ? GOLD : "#F4F1EA" }}>
                  {p.preco}<span className="text-[11px] tracking-normal" style={{ color: MUTE }}>/mês</span>
                </span>
              </span>
              <span className="flex items-center justify-between gap-2 text-[10.5px] font-bold" style={{ color: MUTE }}>
                <span className="min-w-0">{p.linha}</span>
                {p.economia && <span className="rounded-full px-2 py-[3px] text-[10px] font-black tracking-[.06em] whitespace-nowrap shrink-0" style={{ background: OK, color: "#0b1d14" }}>{p.economia}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <a href={linkDe(escolha)} target="_blank" rel="noopener noreferrer"
        className="w-full h-[54px] rounded-[16px] inline-flex items-center justify-center text-[14.5px] font-black tracking-[.02em] active:translate-y-[1px]"
        style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200", boxShadow: "0 10px 24px -12px rgba(255,200,0,.8)" }}>
        {CTA[escolha]}
      </a>
      <a href={ZAP_YAN} target="_blank" rel="noopener noreferrer" className="block text-center text-[12.5px] font-extrabold underline underline-offset-[3px]" style={{ color: "#b9b3a6" }}>
        falar com o Yan no WhatsApp
      </a>
      <p className="text-[10px] font-extrabold tracking-[.04em] text-center" style={{ color: MUTE }}>
        <b style={{ color: OK }}>✓</b> Hotmart · <b style={{ color: OK }}>✓</b> 7 dias de garantia · <b style={{ color: OK }}>✓</b> cancela quando quiser
      </p>
    </div>
  );
}
