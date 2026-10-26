/* "A compra ensinou a receita" (Rick, 26/10/2026): pro produto que virou estoque, os
   ingredientes marcados "descubro na compra" ganham a quantidade por leva = comprado ÷ levas.
   Roda uma vez por compra+produto e mostra o que aprendeu. */
import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import { useAprenderMutation } from "../api/use-sabores";
import { reais } from "./campos";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: n < 10 ? 1 : 0 });

export function MercadoAprendeu({ compraId, produtoId, nome, unidades }: { compraId: string; produtoId: string; nome: string; unidades: number }) {
  const aprender = useAprenderMutation();
  const rodou = useRef<string | null>(null);
  useEffect(() => {
    const chave = `${compraId}:${produtoId}:${unidades}`;
    if (unidades <= 0 || rodou.current === chave) return;
    rodou.current = chave;
    aprender.mutate({ compra: compraId, produto: produtoId, unidades });
  }, [compraId, produtoId, unidades, aprender]);
  const lista = aprender.data?.aprendeu ?? [];
  if (lista.length === 0) return null;
  return (
    <div className="rounded-[14px] px-3 py-2.5 flex flex-col gap-1" style={{ background: "rgba(245,184,0,.07)", border: "1px solid rgba(245,184,0,.35)" }}>
      <span className="text-[10px] font-black tracking-[.14em] inline-flex items-center gap-1" style={{ color: "#F5B800" }}><Sparkles className="w-3 h-3" /> A COMPRA ENSINOU A RECEITA</span>
      {lista.map((a) => (
        <span key={a.nome} className="text-[13px] font-bold">
          {a.nome}: <b style={{ color: "#F5B800" }}>≈ {fmt(a.por_unidade)} {a.unidade}</b> em cada {nome.toLowerCase()}
          {a.custo_unidade > 0 ? <span style={{ color: "#7b766e" }}> · {reais(a.custo_unidade)}</span> : null}
        </span>
      ))}
      {aprender.data && aprender.data.custo > 0 && (
        <span className="text-[12px] font-bold" style={{ color: "#b9b3a6" }}>Custo de cada {nome.toLowerCase()} agora: <b className="text-[#F4F1EA]">{reais(aprender.data.custo)}</b></span>
      )}
    </div>
  );
}
