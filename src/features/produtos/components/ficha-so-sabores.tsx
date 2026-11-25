/* 25/11 (Rick's Cremo Maracujá was overwritten): "Tem mais de um sabor? Adicionar sabores" used to
   open the whole product sheet, with the product's name and base recipe on top. He changed them to
   the new flavour and replaced the product he had just registered. Now that button opens only the
   flavours of THIS product, with a new flavour open, and says plainly that a separate product
   (own photo, own price) is "+ Cadastrar outro produto". Nothing of the product above is editable here. */
import { useNavigate } from "react-router-dom";
import type { Ficha } from "../lib/ficha";
import { EditorSabores } from "./editor-sabores";
import { Secao } from "./ficha-secao";

const plural = (n: string) => { const s = n.trim().toLowerCase(); return s ? (s.endsWith("s") ? s : `${s}s`) : "unidades"; };

export function FichaSoSabores({ f, estoques, onMudar, onFichaCompleta }: {
  f: Ficha; estoques: Map<string, number>; onMudar: (m: Partial<Ficha>) => void; onFichaCompleta: () => void;
}) {
  const navigate = useNavigate();
  return (
    <>
      <div className="rounded-[16px] px-3.5 py-3 flex flex-col gap-1" style={{ background: "#1a1305", border: "1px solid rgba(245,184,0,.4)" }}>
        <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: "#F5B800" }}>SABORES DE</span>
        <span className="text-[18px] font-black leading-tight">{f.emoji} {f.nome}</span>
        <span className="text-[12px] font-bold leading-snug" style={{ color: "#b9b3a6" }}>
          Os sabores ficam dentro deste produto, com o mesmo preço. {f.nome} não muda aqui.
        </span>
      </div>
      <Secao titulo="SABORES" sub="Escreva o nome do sabor e o que muda na receita dele.">
        <EditorSabores sabores={f.sabores} base={f.itens} extras={f.extras} rende={f.rende} preco={f.precoLivre ? 0 : f.preco} estoques={estoques}
          nomeProduto={plural(f.nome)} ativoInicial={Math.max(0, f.sabores.length - 1)} onMudar={(sabores) => onMudar({ sabores })} />
      </Secao>
      <button type="button" onClick={() => navigate("/products/novo")} className="rounded-2xl px-3.5 py-3 text-left flex flex-col gap-0.5"
        style={{ background: "#0f0f10", border: "1px dashed #3a3833" }}>
        <span className="text-[13.5px] font-extrabold">É outro produto, com foto ou preço próprio?</span>
        <span className="text-[12.5px] font-black" style={{ color: "#F5B800" }}>+ Cadastrar outro produto ›</span>
      </button>
      <button type="button" onClick={onFichaCompleta} className="text-[13px] font-extrabold underline py-1" style={{ color: "#b9b3a6" }}>ver ficha completa de {f.nome}</button>
    </>
  );
}
