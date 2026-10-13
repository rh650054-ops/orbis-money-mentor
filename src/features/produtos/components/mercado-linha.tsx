/* Uma linha da compra: quantidade, preço de 1 (opcional) e, quando o
   ingrediente vai em 2+ receitas, "pra qual produto?". */
import { X } from "lucide-react";
import type { LinhaMercado } from "../lib/mercado";
import { CampoDinheiro, Contador, reais } from "./campos";
import { Chip } from "./mercado-casca";

export interface OpcaoPara { id: string; nome: string; emoji: string | null }

export function MercadoLinha({ linha, porItem, subtotal, opcoesPara, unidade, emPacote, onMudar, onTirar }: {
  linha: LinhaMercado; porItem: boolean; subtotal: number; opcoesPara: OpcaoPara[]; unidade?: string; emPacote?: boolean;
  onMudar: (patch: Partial<LinhaMercado>) => void; onTirar: () => void;
}) {
  const escolher = opcoesPara.length > 1;
  const falta = escolher && linha.para.length === 0;
  const alternar = (id: string) =>
    onMudar({ para: linha.para.includes(id) ? linha.para.filter((p) => p !== id) : [...linha.para, id] });

  return (
    <div className="rounded-[18px] p-3.5 flex flex-col gap-2.5"
      style={{ background: "#0e0e10", border: `1px solid ${falta ? "rgba(245,184,0,.55)" : "#26241f"}` }}>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[15px] font-black">{linha.nome}</span>
        {porItem && subtotal > 0 && <span className="text-[13px] font-black" style={{ color: "#F5B800" }}>{reais(subtotal)}</span>}
        <button type="button" onClick={onTirar} aria-label={`Tirar ${linha.nome}`} className="p-1" style={{ color: "#7b766e" }}>
          <X className="w-5 h-5" />
        </button>
      </div>
      <Contador valor={linha.qtd} onChange={(qtd) => onMudar({ qtd })} unidade={unidade} rotulo={emPacote ? "Quantos pacotes" : "Quantos"} />
      {porItem && (
        <CampoDinheiro rotulo={emPacote ? "Preço do pacote (opcional)" : "Preço de 1 (opcional)"} valor={linha.precoUnit ?? 0}
          onChange={(n) => onMudar({ precoUnit: n > 0 ? n : null })} />
      )}
      {escolher && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-extrabold" style={{ color: falta ? "#F5B800" : "#b9b3a6" }}>
            Pra qual produto?{falta ? " (escolhe pelo menos um)" : ""}
          </span>
          <div className="flex flex-wrap gap-2">
            {opcoesPara.map((p) => (
              <Chip key={p.id} ativo={linha.para.includes(p.id)} onClick={() => alternar(p.id)}>
                {p.emoji ?? "📦"} {p.nome}
              </Chip>
            ))}
          </div>
          {linha.para.length > 1 && (
            <span className="text-[11px] font-bold" style={{ color: "#7b766e" }}>Divide igual entre os {linha.para.length}.</span>
          )}
        </div>
      )}
    </div>
  );
}
