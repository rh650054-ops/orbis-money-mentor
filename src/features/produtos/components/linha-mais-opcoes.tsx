/* 25/11 (Rick: "eliminar o excesso de botões"): "Mais opções" of a recipe line — "essa compra dá pra N"
   and the by-weight / by-pulp purchase. Whole / half / "Ainda não sei" live in "Quanto uso?"
   (QuantoUsa). Plus the one question asked of an OLD line whose name looks per unit: it is never
   moved without his answer. */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { qtdPorDaPra, type IngredienteRascunho, type PorConsumo } from "../lib/receitas";
import { MiniNumero } from "./mini-campos";
import { UsoPorPeso } from "./uso-por-peso";

const LINHA = "flex items-center gap-1.5 flex-wrap text-[12px] font-bold pl-[30px]";
const CHIP = (sel: boolean) => (sel ? { background: "#F5B800", color: "#1A1200" } : { background: "#1a1a19", color: "#d8d2c4", border: "1px solid #2c2a25" });

export function LinhaMaisOpcoes({ it, rende, nomeProduto, onMudar }: {
  it: IngredienteRascunho; rende: number; nomeProduto: string; onMudar: (m: Partial<IngredienteRascunho>) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [daPra, setDaPra] = useState(0);
  const [porPeso, setPorPeso] = useState(false);
  // nothing left to offer: a pending line has no amount to fill, and only a new ingredient can be by weight
  if (it.aprender && it.id) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5 flex-wrap pl-[30px]">
        <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-extrabold min-h-[34px]" style={CHIP(false)}>
          Mais opções <ChevronDown className={`w-3.5 h-3.5 transition-transform ${aberto ? "rotate-180" : ""}`} />
        </button>
      </div>
      {aberto && (
        <>
          {!it.aprender && rende > 0 && (
            <div className={LINHA} style={{ color: "#8A8A8A" }}>
              <span>essa compra dá pra</span>
              <MiniNumero valor={daPra} largura={56} exemplo="?" rotulo={`Dá pra quantas ${nomeProduto}`} onChange={(n) => {
                setDaPra(n);
                if (!(n > 0)) return;
                // fills "Quanto uso?" only; the yield stays his. Per unit: one purchase ÷ N units
                onMudar({ uso: undefined, qtd: it.por === "unidade" ? Math.round(((it.pacote > 0 ? it.pacote : 1) / n) * 1000) / 1000 : qtdPorDaPra({ pacote: it.pacote, daPra: n }, rende) });
              }} />
              <span>{nomeProduto}</span>
            </div>
          )}
          {!it.id && <UsoPorPeso it={it} aberto={porPeso} onAbrir={() => setPorPeso(true)} onMudar={onMudar} />}
        </>
      )}
    </div>
  );
}

/** An old line (saved before 25/11) whose name looks per unit: it was counted ONCE per recipe. */
export function LinhaConfirmar({ it, nomeProduto, onEscolher }: { it: IngredienteRascunho; nomeProduto: string; onEscolher: (p: PorConsumo) => void }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[12px] px-2.5 py-2 ml-[30px]" style={{ background: "#1a1305", border: "1px solid rgba(245,184,0,.4)" }}>
      <span className="text-[12px] font-extrabold leading-snug" style={{ color: "#F5B800" }}>
        Confirme: {it.nome.trim() || "esse item"} vai em cada {nomeProduto.replace(/s$/, "")} ou só {it.qtd > 0 ? `${it.qtd} ${it.unidade}` : "uma vez"} por receita?
      </span>
      <span className="text-[11px] font-bold leading-snug" style={{ color: "#b9b3a6" }}>Até hoje a VANT contava {it.qtd > 0 ? `${it.qtd} ${it.unidade}` : "ele"} por receita. Nada muda até você responder.</span>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => onEscolher("unidade")} className="rounded-[10px] px-2 py-2 text-[12px] font-extrabold min-h-[38px]" style={CHIP(false)}>Em cada unidade</button>
        <button type="button" onClick={() => onEscolher("receita")} className="rounded-[10px] px-2 py-2 text-[12px] font-extrabold min-h-[38px]" style={CHIP(false)}>Por receita</button>
      </div>
    </div>
  );
}
