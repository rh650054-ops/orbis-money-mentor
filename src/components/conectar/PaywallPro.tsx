/* ============================================================
   PAYWALL DO VANT PRO (v4 premium, aprovada pelo Rick, 03/10/2026).
   O que ele compra abre a tela: o selo azul do Instagram, grande. Título com ouro
   só na palavra que importa. Anual é um cartão com borda dourada em
   degradê, preço mensal equivalente grande, preço cheio riscado e a
   economia em verde; mensal fica discreto. Sem tabela básico × pro: uma
   lista só do que o Pro destrava (8 itens, nome + uma linha). Um botão só,
   grudado no rodapé; o mensal vira link. Abre o checkout da Hotmart.
   ============================================================ */
import { useState } from "react";
import { getProCheckoutUrl, BANCO_EXTRA_CHECKOUT, type PlanoPro } from "@/shared/lib/checkout";
import { SeloVerificado } from "@/components/ranking/AvatarRanking";
import { SO_PRO, ECONOMIA_ANUAL, PRECO_BANCO, PRECO_MENSAL, ESSENCIAL_COM_BANCO, PRECO_ESSENCIAL, brl } from "./pro-lib";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const MUTE = "#7b766e";
const INK2 = "#b9b3a6";
const LINHA = "rgba(255,255,255,.07)";

/** O selo que ele compra: a estrela azul serrilhada do Instagram, grande e em relevo (Rick, 03/10). */
function SeloGrande() {
  return (
    <span aria-hidden className="relative w-[84px] h-[84px] mx-auto flex items-center justify-center"
      style={{ filter: "drop-shadow(0 0 18px rgba(0,149,246,.55)) drop-shadow(0 18px 30px rgba(0,149,246,.35))" }}>
      <SeloVerificado size={84} />
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
        <span className="min-w-0">{sub}{risca && <> · <s className="whitespace-nowrap">{risca}</s></>}</span>
        {economia && <span className="rounded-full px-2 py-[3px] text-[10px] font-black tracking-[.06em] whitespace-nowrap shrink-0" style={{ background: OK, color: "#0b1d14" }}>{economia}</span>}
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
      <div aria-hidden className="pointer-events-none absolute -top-[40%] -left-[30%] -right-[30%] h-[70%]" style={{ background: "radial-gradient(60% 60% at 50% 40%,rgba(0,149,246,.22),rgba(0,149,246,0) 70%)" }} />

      <div className="relative space-y-2.5">
        <div className="text-center pt-2 space-y-2">
          <SeloGrande />
          <h1 className="text-[24px] font-black tracking-[-.025em] leading-[1.08] text-balance">
            Seu número<br />com <span style={{ color: "#4FB3FF" }}>selo do banco</span>
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
          <Plano ativo={plano === "anual"} onClick={() => setPlano("anual")} selo="MAIS ESCOLHIDO · 2 BANCOS INCLUÍDOS"
            titulo="Anual" preco="R$ 34,90" sub="R$ 418,80/ano · 2 bancos" risca="R$ 598,80" economia={`ECONOMIZA R$ ${ECONOMIA_ANUAL}`} />
          <Plano ativo={plano === "mensal"} onClick={() => setPlano("mensal")}
            titulo="Mensal" preco="R$ 49,90" sub="1 banco · cancela quando quiser" />
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
          <p className="text-[10.5px] font-bold pt-2" style={{ color: MUTE }}>DEFCON, metas, ranking e comunidade estão no Essencial, {brl(PRECO_ESSENCIAL)}/mês.</p>
        </div>

        {BANCO_EXTRA_CHECKOUT && (
          <div className="rounded-[18px] px-3.5 py-3" style={{ background: "#0f0f10", border: `1px solid ${LINHA}` }}>
            <p className="text-[12.5px] font-extrabold">Só quer ligar o banco?</p>
            <p className="text-[10.5px] leading-snug mt-1" style={{ color: MUTE }}>
              No Essencial, cada banco é +{brl(PRECO_BANCO)}/mês: fica {brl(ESSENCIAL_COM_BANCO)}. Por {brl(Math.round((PRECO_MENSAL - ESSENCIAL_COM_BANCO) * 100) / 100)} a mais o Pro já vem com o banco e tudo acima.
            </p>
            <a href={`${BANCO_EXTRA_CHECKOUT}&sck=banco_avulso`} target="_blank" rel="noopener noreferrer"
              className="mt-2 inline-flex text-[11.5px] font-extrabold underline underline-offset-[3px]" style={{ color: INK2 }}>
              quero só o banco, {brl(PRECO_BANCO)}/mês (pra quem já assina o Essencial)
            </a>
          </div>
        )}

        <div className="sticky bottom-0 pt-3.5 space-y-1.5" style={{ background: "linear-gradient(180deg,rgba(0,0,0,0),#000 35%)" }}>
          <a href={getProCheckoutUrl(plano)}
            className="w-full h-[56px] rounded-[16px] inline-flex items-center justify-center text-[15px] font-black tracking-[.02em] active:translate-y-[1px]"
            style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200", boxShadow: "0 10px 24px -12px rgba(255,200,0,.8)" }}>
            {plano === "anual" ? "ASSINAR ANUAL · R$ 418,80" : "ASSINAR MENSAL · R$ 49,90"}
          </a>
          <button type="button" onClick={() => setPlano(outro)} className="w-full text-[11.5px] font-extrabold underline underline-offset-[3px] py-1" style={{ color: MUTE }}>
            {plano === "anual" ? "prefiro o mensal, R$ 49,90" : "prefiro o anual, R$ 34,90/mês com 2 bancos"}
          </button>
          <p className="text-[9.5px] font-extrabold tracking-[.04em] text-center flex justify-center gap-2.5" style={{ color: MUTE }}>
            <span><b style={{ color: OK }}>✓</b> Hotmart</span><span><b style={{ color: OK }}>✓</b> 7 dias de garantia</span><span><b style={{ color: OK }}>✓</b> só leitura</span>
          </p>
        </div>
      </div>
    </div>
  );
}
