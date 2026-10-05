/* 3 · ONDE VOCÊ GASTOU — top 5 por valor. Cada linha nomeia a referência
   (Teto / Ritmo / Média) e a cor é o ESTADO, nunca a categoria.
   Custos do negócio (mercadoria, gelo, DAS) ficam numa linha própria, fora do total. */
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Barra, COR, Cartao, Folha } from "../planejar/ui";
import { IconeCategoria } from "./icones";
import { A_REVISAR, reais, referencia, type CatAnalise, type Negocio } from "./tipos";

const TOP = 5;

function Linha({ c, base, corrente, pendentes, onAbrir }: { c: CatAnalise; base: number; corrente: boolean; pendentes: number; onAbrir: () => void }) {
  const ref = referencia(c, corrente);
  const parte = base > 0 ? Math.round((c.total / base) * 100) : 0;
  const revisar = A_REVISAR.has(c.categoria) && pendentes > 0;
  return (
    <button type="button" onClick={onAbrir} aria-label={`${c.rotulo}, ${reais(c.total)}`}
      className="group w-full text-left flex items-center gap-2.5 py-3 -mx-2 px-2 rounded-[12px] transition-[transform,background-color] duration-[120ms] active:scale-[0.99] active:bg-white/[.05]">
      <IconeCategoria slug={c.categoria} tamanho={32} />
      <span className="flex-1 min-w-0">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-semibold truncate" style={{ color: COR.texto }}>{c.rotulo}</span>
          <span className="text-[17px] font-bold tabular-nums shrink-0" style={{ color: COR.texto }}>{reais(c.total)}</span>
        </span>
        <span className="flex items-center justify-between gap-3 mt-0.5 text-[12.5px]">
          <span className="truncate" style={{ color: COR.mute }}>{parte}% dos seus gastos</span>
          <span className="tabular-nums shrink-0" style={{ color: revisar ? COR.ouro : COR.sub }}>
            {revisar ? `${pendentes} pra confirmar` : ref.curto}
          </span>
        </span>
        {ref.metrica && !A_REVISAR.has(c.categoria) && <span className="block mt-1.5"><Barra pct={ref.pct} cor={ref.cor} altura={6} /></span>}
      </span>
      <ChevronRight className="w-4 h-4 shrink-0 transition-transform duration-[120ms] group-active:translate-x-0.5" strokeWidth={2.4} style={{ color: "#5c5850" }} />
    </button>
  );
}

function LinhaNegocio({ n, onAbrir }: { n: Negocio; onAbrir: () => void }) {
  const nomes = n.categorias.slice(0, 2).map((c) => c.rotulo.toLowerCase()).join(", ");
  return (
    <button type="button" onClick={onAbrir}
      className="group w-full text-left flex items-center gap-2.5 py-3 -mx-2 px-2 rounded-[12px] border-t transition-[transform,background-color] duration-[120ms] active:scale-[0.99] active:bg-white/[.05]"
      style={{ borderColor: "rgba(255,255,255,.06)" }}>
      <IconeCategoria slug="__negocio" cor={COR.ouro} tamanho={32} />
      <span className="flex-1 min-w-0">
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-semibold truncate" style={{ color: COR.texto }}>Custos do negócio</span>
          <span className="text-[18px] font-bold tabular-nums shrink-0" style={{ color: COR.texto }}>{reais(n.total)}</span>
        </span>
        <span className="block mt-0.5 text-[12.5px] truncate" style={{ color: COR.mute }}>Fora dos seus gastos · {nomes}</span>
      </span>
      <ChevronRight className="w-4 h-4 shrink-0 transition-transform duration-[120ms] group-active:translate-x-0.5" strokeWidth={2.4} style={{ color: "#5c5850" }} />
    </button>
  );
}

export function OndeGastou({ cats, gasto, corrente, negocio, pendentesPorCat, onAbrir, onNegocio, onTetos }: {
  cats: CatAnalise[]; gasto: number; corrente: boolean; negocio?: Negocio; pendentesPorCat: Record<string, number>;
  onAbrir: (c: CatAnalise) => void; onNegocio: () => void; onTetos: () => void;
}) {
  const [todas, setTodas] = useState(false);
  const comGasto = cats.filter((c) => c.total > 0);
  const linha = (c: CatAnalise, fechar = false) => (
    <Linha key={c.categoria} c={c} base={gasto} corrente={corrente} pendentes={pendentesPorCat[c.categoria] ?? 0}
      onAbrir={() => { if (fechar) setTodas(false); onAbrir(c); }} />
  );
  return (
    <section aria-label="Onde você gastou">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-[16px] font-black uppercase tracking-[.08em]" style={{ color: COR.texto }}>Onde você gastou</h2>
        <button type="button" onClick={onTetos}
          className="group min-h-11 px-2 -mr-2 rounded-[12px] inline-flex items-center gap-0.5 text-[14px] font-extrabold transition-colors duration-100 active:bg-white/[.05]" style={{ color: COR.ouro }}>
          Tetos <ChevronRight className="w-4 h-4 transition-transform duration-100 group-active:translate-x-0.5" strokeWidth={2.6} />
        </button>
      </div>
      <Cartao className="py-1">
        {comGasto.length === 0 ? (
          <p className="py-3 text-[14px]" style={{ color: COR.sub }}>Nenhum gasto pessoal neste mês ainda.</p>
        ) : comGasto.slice(0, TOP).map((c) => linha(c))}
        {negocio && negocio.total > 0 && <LinhaNegocio n={negocio} onAbrir={onNegocio} />}
        {comGasto.length > TOP && (
          <button type="button" onClick={() => setTodas(true)}
            className="group w-full h-12 border-t flex items-center justify-between text-[15px] font-bold transition-colors duration-100 active:bg-white/[.04]"
            style={{ borderColor: "rgba(255,255,255,.06)", color: COR.ouro }}>
            Ver todas as {comGasto.length} categorias <ChevronRight className="w-5 h-5 transition-transform duration-100 group-active:translate-x-0.5" strokeWidth={2.4} />
          </button>
        )}
      </Cartao>
      <Folha open={todas} onOpenChange={setTodas} titulo="Todas as categorias" subtitulo={`${comGasto.length} categorias · ${reais(gasto)}`} alta>
        <div>{comGasto.map((c) => linha(c, true))}</div>
      </Folha>
    </section>
  );
}
