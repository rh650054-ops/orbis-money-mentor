/* Plans on the Vender tab: tap a plan to open its benefits; the sticky button opens
   that plan's checkout directly (Hotmart, with buyer prefill and partner sck).
   Trial: Essencial · Pro Anual (middle, most chosen) · Pro Mensal. Essencial
   subscriber: their plan marked, upgrade only. Web build only (see vitrine-pro). */
import { useState } from "react";
import { COR } from "@/shared/components/vant-ui";
import { ECONOMIA_ANUAL } from "@/components/conectar/pro-lib";
import { PLANOS, type Plano } from "./vitrine-dados";
import { abrirCheckout, getCheckoutUrl, getProCheckoutUrl } from "@/shared/lib/checkout";
import { useCheckoutUrl } from "@/hooks/useCheckoutUrl";


function Cartao({ p, aberto, onClick }: { p: Plano; aberto: boolean; onClick: () => void }) {
  const d = PLANOS[p];
  const anual = p === "anual";
  return (
    <button type="button" onClick={onClick} aria-expanded={aberto}
      className={`relative w-full text-left rounded-[20px] overflow-hidden transition-shadow ${anual && aberto ? "vv-borda vv-borda-cheia" : ""}`}
      style={{ background: anual ? "linear-gradient(165deg,#241a05,#0f0f10 60%)" : aberto && p === "mensal" ? "linear-gradient(165deg,#06172a,#0f0f10 60%)" : COR.card,
        border: `1px solid ${aberto ? (anual ? "transparent" : `${d.cor}b3`) : anual ? "rgba(255,200,0,.45)" : COR.borda}`,
        boxShadow: aberto ? `0 18px 44px -20px ${d.cor}cc` : undefined }}>
      {anual && <span className="vv-faixa block text-center text-[10px] font-black tracking-[.14em] py-1.5 px-2.5" style={{ color: "#111" }}>★ MAIS ESCOLHIDO · ECONOMIZA R$ {ECONOMIA_ANUAL}</span>}
      <span className="grid grid-cols-[22px_1fr_auto] gap-2.5 items-center p-3.5">
        <span className="w-5 h-5 rounded-full grid place-items-center" style={{ border: `2px solid ${aberto ? d.cor : "#4a463d"}` }}>
          <i className="w-2.5 h-2.5 rounded-full" style={{ background: aberto ? d.cor : "transparent" }} />
        </span>
        <span><b className="block text-[15px] font-black">{d.nome}</b><span className="block text-[12px] font-bold mt-0.5" style={{ color: p === "essencial" ? "#a9a49a" : d.cor }}>{d.frase}</span></span>
        <span className="text-right"><span className="block text-[24px] font-black tabular-nums leading-none" style={{ color: p === "essencial" ? COR.texto : d.cor }}>{d.preco}</span><span className="block text-[10px] font-extrabold mt-0.5" style={{ color: COR.apagado }}>por mês</span></span>
      </span>
      {aberto && (
        <span className="block px-3.5 pb-3.5">
          {d.destaque && <span className="block rounded-[12px] px-3 py-2.5 mb-1 text-[12px] leading-snug" style={{ background: "rgba(255,200,0,.1)", border: "1px solid rgba(255,200,0,.35)", color: "#f6e2a0" }}>{d.destaque}</span>}
          {d.itens.map(([ic, t], i) => (
            <span key={i} className="vv-cai grid grid-cols-[26px_1fr] gap-2 items-start py-1.5 text-[12.5px] leading-snug" style={{ borderTop: "1px solid #1d1b17", color: COR.suave, animationDelay: `${i * 40}ms` }}>
              <span className="w-[26px] h-[26px] rounded-[8px] grid place-items-center text-[13px]" style={{ background: `${d.cor}22` }}>{ic}</span><span>{t}</span>
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

export function VitrinePlanos({ assinaEssencial }: { assinaEssencial: boolean }) {
  const [plano, setPlano] = useState<Plano>("anual");
  const montar = useCheckoutUrl();
  const comprar = () => abrirCheckout(montar(plano === "essencial" ? getCheckoutUrl() : getProCheckoutUrl(plano)));
  const lista: Plano[] = assinaEssencial ? ["anual", "mensal"] : ["essencial", "anual", "mensal"];
  return (
    <>
      <p className="text-[12px] text-center mb-2" style={{ color: COR.apagado }}>Toque em um plano pra ver o que vem nele</p>
      <div className="grid gap-2.5">
        {assinaEssencial && (
          <div className="flex items-center justify-between rounded-[20px] p-3.5 opacity-80" style={{ background: COR.card, border: `1px dashed ${COR.borda}` }}>
            <span><b className="block text-[15px] font-black">Essencial</b><span className="block text-[12px] font-bold" style={{ color: "#a9a49a" }}>{PLANOS.essencial.frase}</span></span>
            <span className="text-[9.5px] font-black tracking-[.1em] rounded-full px-2 py-[3px]" style={{ color: COR.suave, border: "1px solid #3a3426" }}>SEU PLANO</span>
          </div>
        )}
        {lista.map((p) => <Cartao key={p} p={p} aberto={plano === p} onClick={() => setPlano(p)} />)}
      </div>
      <div className="grid grid-cols-3 gap-1.5 mt-5">
        {[["🔒", "Senha do banco nunca passa pela VANT"], ["🏛️", "Open Finance regulado pelo Banco Central"], ["↩️", "7 dias de garantia"]].map(([ic, t]) => (
          <div key={t} className="rounded-[12px] px-1.5 py-2 text-center text-[10.5px] leading-tight" style={{ background: "#0b0b0c", border: `1px solid ${COR.borda}`, color: COR.suave }}><b className="block text-[16px] mb-0.5">{ic}</b>{t}</div>
        ))}
      </div>
      <div className="sticky bottom-[calc(62px+max(env(safe-area-inset-bottom),0.5rem))] md:bottom-0 z-[3] -mx-1 px-1 pt-4 pb-2 mt-2" style={{ background: "linear-gradient(180deg,rgba(0,0,0,0),#000 38%)" }}>
        <button type="button" onClick={comprar} className="vv-brilho w-full rounded-[16px] py-[15px] text-[15px] font-black active:translate-y-[1px]"
          style={{ color: "#111", background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", boxShadow: "0 10px 26px -10px rgba(255,200,0,.9)" }}>
          {PLANOS[plano].cta}
        </button>
        <p className="text-[11px] text-center mt-1.5" style={{ color: COR.apagado }}>{PLANOS[plano].rodape}</p>
      </div>
    </>
  );
}
