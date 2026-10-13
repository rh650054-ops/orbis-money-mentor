/* Atalhos do "Tô no mercado": ingredientes das receitas, produtos que ele compra
   pronto e "+ outro item" (texto livre). */
import { useState } from "react";
import { compraPronto, type BaseMercado, type TipoLinha } from "../lib/mercado";
import { Chip } from "./mercado-casca";

export function MercadoChips({ base, onAdicionar }: {
  base: BaseMercado; onAdicionar: (tipo: TipoLinha, id: string | null, nome: string) => void;
}) {
  const [outro, setOutro] = useState<string | null>(null);
  const naReceita = new Set(base.receitas.map((r) => r.ingredient_id));
  const ingredientes = base.ingredientes.filter((i) => naReceita.has(i.id));
  const prontos = base.produtos.filter(compraPronto);

  const porOutro = () => {
    const nome = (outro ?? "").trim();
    if (nome) onAdicionar("novo", null, nome);
    setOutro(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-extrabold" style={{ color: "#b9b3a6" }}>O que você tá pegando?</span>
      <div className="flex flex-wrap gap-2">
        {ingredientes.map((i) => (
          <Chip key={i.id} onClick={() => onAdicionar("ingrediente", i.id, i.name)}>+ {i.name}</Chip>
        ))}
        {prontos.map((p) => (
          <Chip key={p.id} onClick={() => onAdicionar("produto", p.id, p.name)}>+ {p.emoji ?? "📦"} {p.name}</Chip>
        ))}
        {outro === null && <Chip onClick={() => setOutro("")}>+ outro item</Chip>}
      </div>
      {outro !== null && (
        <div className="flex gap-2">
          <input autoFocus value={outro} onChange={(e) => setOutro(e.target.value)} placeholder="Ex.: copo 300 ml"
            onKeyDown={(e) => { if (e.key === "Enter") porOutro(); }} aria-label="Outro item"
            className="flex-1 h-11 rounded-xl px-3 bg-[#0f0d08] outline-none text-[15px] font-bold" style={{ border: "1.5px solid #F5B800" }} />
          <button type="button" onClick={porOutro} className="h-11 px-4 rounded-xl font-black text-[13px]"
            style={{ background: "#F5B800", color: "#1A1200" }}>Pôr</button>
        </div>
      )}
    </div>
  );
}
