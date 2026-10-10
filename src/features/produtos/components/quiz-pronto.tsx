/* Fim do quiz — "Cada Mentos te dá R$ 1,60 de lucro". */
import { Check } from "lucide-react";
import { lucroDe } from "../lib/conta";
import type { RascunhoProduto } from "../types";
import { reais } from "./campos";
import { OURO } from "./quiz-casca";

export function QuizPronto({ r, onComecarDia, onOutro, onLista }: {
  r: RascunhoProduto; onComecarDia: () => void; onOutro: () => void; onLista: () => void;
}) {
  const l = lucroDe(r.preco, r.custo);
  const comLucro = !r.precoLivre && r.custo > 0 && r.preco > 0;
  const detalhe = [
    r.precoLivre ? "preço na hora" : reais(r.preco),
    r.combo && r.combo.price > 0 ? `${r.combo.qty} por ${reais(r.combo.price)}` : null,
    r.controlaEstoque ? `${r.estoque} un` : null,
  ].filter(Boolean).join(" · ");
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black">
      <div className="min-h-[100dvh] bg-black text-[#F4F1EA] px-4 max-w-md mx-auto flex flex-col gap-3 relative overflow-hidden"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 18px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
      <div className="absolute -left-16 -right-16 -top-20 h-[380px] pointer-events-none" style={{ background: "radial-gradient(55% 55% at 50% 40%, rgba(61,214,140,.18), rgba(0,0,0,0) 70%)" }} />
      <div className="relative flex flex-col items-center gap-2.5 pt-12 text-center">
        <span className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#3DD68C", color: "#0b1d14" }}><Check className="w-8 h-8" strokeWidth={4} /></span>
        <span className="text-[11px] font-black tracking-[.16em]" style={{ color: "#3DD68C" }}>PRODUTO CADASTRADO</span>
        {comLucro ? (
          <>
            <h1 className="text-[26px] font-black tracking-tight leading-[1.12]">
              Cada {r.nome} te dá<br /><span style={{ color: l.sobra > 0 ? "#3DD68C" : "#ff7a6b" }}>{reais(l.sobra)}</span> de lucro
            </h1>
            {r.controlaEstoque && r.estoque > 0 && l.sobra > 0 && (
              <p className="text-[13px] leading-snug" style={{ color: "#b9b3a6" }}>
                Vendendo os {r.estoque} que você tem, sobram <b style={{ color: "#F4F1EA" }}>{reais(l.sobra * r.estoque)}</b> no seu bolso.
              </p>
            )}
          </>
        ) : (
          <h1 className="text-[26px] font-black tracking-tight leading-[1.12]">{r.nome} já aparece no seu Foco</h1>
        )}
      </div>
      <div className="relative rounded-[18px] p-3.5 flex items-center gap-3 mt-3" style={{ background: "#0f0f10", border: "1px solid #26241f" }}>
        {r.foto ? <img src={r.foto} alt="" className="w-[46px] h-[46px] rounded-xl object-cover" />
          : <span className="w-[46px] h-[46px] rounded-xl flex items-center justify-center text-[22px]" style={{ background: "linear-gradient(160deg, #3a2a0a, #161005)" }}>{r.emoji}</span>}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-[15px] font-black truncate">{r.nome}</span>
          <span className="text-xs font-bold truncate" style={{ color: "#7b766e" }}>{detalhe}</span>
        </div>
        {comLucro && <span className="text-sm font-black" style={{ color: "#3DD68C" }}>+{reais(l.sobra)}</span>}
      </div>
      <div className="flex-grow" />
      <button type="button" onClick={onComecarDia} className="w-full h-[54px] rounded-2xl text-[15px] font-black" style={{ background: OURO, color: "#1A1200" }}>
        COMEÇAR MEU DIA DE TRABALHO
      </button>
      <button type="button" onClick={onOutro} className="w-full h-12 rounded-2xl text-[15px] font-black" style={{ background: "#121211", border: "1px solid #26241f" }}>
        + Cadastrar outro produto
      </button>
      <button type="button" onClick={onLista} className="text-[13px] font-extrabold underline py-1" style={{ color: "#b9b3a6" }}>ver meus produtos</button>
    </div>
    </div>
  );
}
