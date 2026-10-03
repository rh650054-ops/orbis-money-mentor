/* ============================================================
   PAYWALL DO VANT PRO (v4 premium, aprovada pelo Rick, 03/10/2026).
   O que ele compra abre a tela: o selo dourado em relevo. Título com ouro
   só na palavra que importa. Anual é um cartão com borda dourada em
   degradê, preço mensal equivalente grande, preço cheio riscado e a
   economia em verde; mensal fica discreto. Sem tabela básico × pro: uma
   lista só do que o Pro destrava (8 itens, nome + uma linha). Um botão só,
   grudado no rodapé; o mensal vira link. Abre o checkout da Hotmart.
   ============================================================ */
import { useState } from "react";
import { getProCheckoutUrl, type PlanoPro } from "@/shared/lib/checkout";
import { SO_PRO, ECONOMIA_ANUAL } from "./pro-lib";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const MUTE = "#7b766e";
const INK2 = "#b9b3a6";
const LINHA = "rgba(255,255,255,.07)";

/** Selo dourado em relevo — o que o vendedor está comprando. */
function SeloOuro() {
  return (
    <span aria-hidden className="relative w-[72px] h-[72px] rounded-full mx-auto flex items-center justify-center"
      style={{
        background: "radial-gradient(circle at 35% 30%,#FFF1B3,#FFC800 45%,#B88E00 100%)",
        boxShadow: "0 0 0 6px rgba(255,200,0,.12), 0 0 0 12px rgba(255,200,0,.06), 0 22px 44px -18px rgba(255,200,0,.9)",
      }}>
      <span className="absolute inset-1 rounded-full" style={{ border: "1.5px dashed rgba(26,18,0,.35)" }} />
      <svg viewBox="0 0 24 24" className="w-[34px] h-[34px]"><path d="M8 12.5l2.6 2.6L16.5 9" stroke="#1a1305" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

function Plano({ ativo, onClick, titulo, preco, sub, risca, economia, selo }: {
  ativo: boolean; onClick: () => void; titulo: string; preco: string; sub: string; risca?: string; economia?: string; selo?: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className="relative w-full rounded-[18px] p-[13px_14px] text-left grid gap-1.5 active:opacity-80"
      style={ativo ? {
        border: "1px solid transparent",
        background: "linear-gradient(#171206,#0f0d08) padding-box, linear-gradient(135deg,#FFE27A,#B88E00 60%,#FFC800) border-box",
        boxShadow: "0 18px 40px -22px rgba(255,200,0,.9)",
      } : { border: "1px solid #26241f", background: "#0e0e0f" }}>
      {selo && (
        <span className="absolute -top-2.5 left-3.5 rounded-full px-2.5 py-1 text-[9px] font-black tracking-[.12em]"
          style={{ background: "linear-gradient(180deg,#FFF1B3,#FFC800)", color: "#1a1305" }}>{selo}</span>
      )}
      <span className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-[15px] font-black">
          <span className="w-[18px] h-[18px] rounded-full shrink-0" style={{
            border: `2px solid ${ativo ? GOLD : "#3a3833"}`,
            background: ativo ? `radial-gradient(circle,${GOLD} 45%,transparent 50%)` : "transparent",
          }} />
          {titulo}
        </span>
        <span className="text-[24px] font-black tracking-[-.02em] tabular-nums leading-none" style={{ color: ativo ? GOLD : "#F4F1EA" }}>
          {preco}<span className="text-[11px] tracking-normal" style={{ color: MUTE }}>/mês</span>
        </span>
      </span>
      <span className="flex items-center justify-between gap-2 text-[10.5px] font-bold" style={{ color: MUTE }}>
        <span>{sub}{risca && <> · <s>{risca}</s></>}</span>
        {economia && <span className="rounded-full px-2 py-[3px] text-[10px] font-black tracking-[.06em]" style={{ background: OK, color: "#0b1d14" }}>{economia}</span>}
      </span>
    </button>
  );
}

export function PaywallPro() {
  const [plano, setPlano] = useState<PlanoPro>("anual");
  const outro: PlanoPro = plano === "anual" ? "mensal" : "anual";

  return (
    <div className="relative">
      {/* brilho dourado no topo */}
      <div aria-hidden className="pointer-events-none absolute -top-[40%] -left-[30%] -right-[30%] h-[70%]" style={{ background: "radial-gradient(60% 60% at 50% 40%,rgba(255,200,0,.26),rgba(255,200,0,0) 70%)" }} />

      <div className="relative space-y-2.5">
        <div className="text-center pt-2 space-y-2">
          <SeloOuro />
          <h1 className="text-[24px] font-black tracking-[-.025em] leading-[1.08] text-balance">
            Seu número<br />com <span style={{ background: "linear-gradient(90deg,#FFE27A,#FFC800 50%,#F5B800)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>selo do banco</span>
          </h1>
          <p className="text-[12px] leading-snug mx-auto max-w-[270px]" style={{ color: INK2 }}>
            O Pix cai, a Vant conta. O gasto sai, a Vant organiza. Você só vende.
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            <span className="rounded-full px-2.5 py-[5px] text-[10px] font-extrabold" style={{ background: "#121211", border: "1px solid #26241f", color: INK2 }}><b style={{ color: OK }}>3 dos 5</b> primeiros do ranking são Pro</span>
            <span className="rounded-full px-2.5 py-[5px] text-[10px] font-extrabold" style={{ background: "#121211", border: "1px solid #26241f", color: INK2 }}>senha do banco <b style={{ color: OK }}>nunca</b> passa pela Vant</span>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <Plano ativo={plano === "anual"} onClick={() => setPlano("anual")} selo="MAIS ESCOLHIDO · 2 MESES GRÁTIS"
            titulo="Anual" preco="R$ 29,99" sub="R$ 359,90 por ano" risca="R$ 598,80" economia={`ECONOMIZA R$ ${ECONOMIA_ANUAL}`} />
          <Plano ativo={plano === "mensal"} onClick={() => setPlano("mensal")}
            titulo="Mensal" preco="R$ 49,90" sub="cancela quando quiser" />
        </div>

        <div className="rounded-[18px] px-3 pt-1 pb-2" style={{ background: "#0f0f10", border: `1px solid ${LINHA}` }}>
          <p className="text-[10px] font-black tracking-[.15em] pt-2.5 pb-1" style={{ color: GOLD }}>SÓ NO PRO</p>
          {SO_PRO.map((b) => (
            <div key={b.nome} className="flex items-center gap-2.5 py-2" style={{ borderTop: `1px solid ${LINHA}` }}>
              <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-[11px] font-black" style={{ background: "rgba(245,184,0,.14)", border: "1px solid rgba(245,184,0,.5)", color: GOLD }}>✓</span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-extrabold">{b.nome}</span>
                <span className="block text-[10.5px] leading-snug" style={{ color: MUTE }}>{b.linha}</span>
              </span>
            </div>
          ))}
          <p className="text-[10.5px] font-bold pt-2" style={{ color: MUTE }}>DEFCON, metas e ranking continuam grátis pra todo mundo.</p>
        </div>

        <div className="sticky bottom-0 pt-3.5 space-y-1.5" style={{ background: "linear-gradient(180deg,rgba(0,0,0,0),#000 35%)" }}>
          <a href={getProCheckoutUrl(plano)}
            className="w-full h-[56px] rounded-[16px] inline-flex items-center justify-center text-[15px] font-black tracking-[.02em] active:translate-y-[1px]"
            style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200", boxShadow: "0 10px 24px -12px rgba(255,200,0,.8)" }}>
            {plano === "anual" ? "ASSINAR ANUAL · R$ 359,90" : "ASSINAR MENSAL · R$ 49,90"}
          </a>
          <button type="button" onClick={() => setPlano(outro)} className="w-full text-[11.5px] font-extrabold underline underline-offset-[3px] py-1" style={{ color: MUTE }}>
            {plano === "anual" ? "prefiro o mensal, R$ 49,90" : "prefiro o anual, R$ 29,99/mês"}
          </button>
          <p className="text-[9.5px] font-extrabold tracking-[.04em] text-center flex justify-center gap-2.5" style={{ color: MUTE }}>
            <span><b style={{ color: OK }}>✓</b> Hotmart</span><span><b style={{ color: OK }}>✓</b> 7 dias de garantia</span><span><b style={{ color: OK }}>✓</b> só leitura</span>
          </p>
        </div>
      </div>
    </div>
  );
}
