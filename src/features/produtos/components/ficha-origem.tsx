/* Ficha: como ele consegue o produto — compra pronto (custo de 1) ou faz (receita). */
import { custoDaFicha, type Ficha } from "../lib/ficha";
import { CampoDinheiro, DuasAbas, reais } from "./campos";
import { EditorReceita } from "./editor-receita";
import { EditorSabores } from "./editor-sabores";
import { Secao } from "./ficha-secao";

const plural = (n: string) => { const s = n.trim().toLowerCase(); return s ? (s.endsWith("s") ? s : `${s}s`) : "unidades"; };

export function FichaOrigem({ f, estoques, onMudar }: {
  f: Ficha; estoques: Map<string, number>; onMudar: (m: Partial<Ficha>) => void;
}) {
  const custo = custoDaFicha(f);
  return (
    <Secao titulo="COMO VOCÊ CONSEGUE" sub={f.origem === "faz"
      ? "Com a receita, o \"Tô no mercado\" já sabe quantas saem de cada compra."
      : "Quanto você paga em 1 unidade."}>
      <DuasAbas valor={f.origem} onChange={(origem) => onMudar({ origem })}
        opcoes={[["compra", "📦 Compro pronto"], ["faz", "👩‍🍳 Eu faço"]]} />
      {f.origem === "compra" ? (
        <CampoDinheiro rotulo="Custo de 1 unidade" valor={f.custo} onChange={(c) => onMudar({ custo: c })} />
      ) : (
        <>
          <EditorReceita itens={f.itens} rende={f.rende} estoques={estoques} nomeProduto={plural(f.nome)}
            onItens={(itens) => onMudar({ itens })} onRende={(rende) => onMudar({ rende })} />
          {!custo.pelaReceita && f.custo > 0 && (
            <p className="text-[11.5px] font-bold px-1" style={{ color: "#7b766e" }}>Custo salvo hoje: {reais(f.custo)} cada.</p>
          )}
          <div className="mt-1 pt-3" style={{ borderTop: "1px solid #1c1a16" }}>
            <p className="text-[10.5px] font-black tracking-[.14em] mb-2" style={{ color: "#F5B800" }}>SABORES</p>
            <EditorSabores sabores={f.sabores} base={f.itens} rende={f.rende} preco={f.precoLivre ? 0 : f.preco} estoques={estoques} nomeProduto={plural(f.nome)}
              onMudar={(sabores) => onMudar({ sabores })} />
          </div>
        </>
      )}
    </Secao>
  );
}
