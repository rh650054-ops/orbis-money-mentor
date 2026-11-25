/* VANT Receita Inteligente (24/11): how much of the purchase goes in one batch, in one tap.
   "Uso a embalagem inteira" uses exactly what one purchase brings (a 395 g box = 395 g, "1 un" = 1 un):
   no conversion is asked or invented. "Ainda não sei" keeps the line pending. */
import { atalhoDoUso, usoDoAtalho, type AtalhoUso, type IngredienteRascunho } from "../lib/receitas";
import { fmt } from "../lib/formato";

const OPCOES: [AtalhoUso, string][] = [["inteira", "Uso a embalagem inteira"], ["metade", "Uso metade"], ["informar", "Informar quantidade"], ["naosei", "Ainda não sei"]];

export function UsoAtalhos({ it, onMudar, onInformar, semNaoSei }: {
  it: IngredienteRascunho; onMudar: (m: Partial<IngredienteRascunho>) => void; onInformar: () => void;
  /** 25/11: "Ainda não sei" already sits outside "Mais opções" */
  semNaoSei?: boolean;
}) {
  const ativo = atalhoDoUso(it);
  const pac = it.pacote > 0 ? it.pacote : 1;
  return (
    <div className="grid grid-cols-2 gap-1.5 pl-[30px]" role="group" aria-label="Quanto usa">
      {OPCOES.filter(([a]) => !(semNaoSei && a === "naosei")).map(([a, rotulo]) => {
        const sel = a === ativo && (a !== "informar" || it.qtd > 0);
        const extra = a === "inteira" ? `${fmt(pac)} ${it.unidade}` : a === "metade" ? `${fmt(pac / 2)} ${it.unidade}` : "";
        return (
          <button key={a} type="button" aria-pressed={sel}
            onClick={() => { onMudar(usoDoAtalho(a, it)); if (a === "informar") onInformar(); }}
            className="rounded-[12px] px-2.5 py-2 text-[12px] font-extrabold min-h-[40px] leading-tight flex flex-col items-center justify-center text-center"
            style={sel ? { background: "#F5B800", color: "#1A1200" } : { background: "#1a1a19", color: "#d8d2c4", border: "1px solid #2c2a25" }}>
            <span>{rotulo}</span>
            {extra && <span className="text-[10.5px] font-bold opacity-75">{extra}</span>}
          </button>
        );
      })}
    </div>
  );
}
