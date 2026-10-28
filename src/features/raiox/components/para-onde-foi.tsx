/* 5 · Para onde foi: 8 categories with state bars, then "ver todas". */
import { useState } from "react";
import { Barra, Cartao, COR, Folha } from "@/components/financas/planejar/ui";
import type { CatAnalise } from "@/components/financas/analise/tipos";
import type { CategoriaRX } from "../types";
import { FORA_DO_PESO, estadoCategoria } from "../lib/raiox";
import { Linha, LinkOuro, Titulo, inteiro } from "./pecas";

const PRIMEIRAS = 8;

export function ParaOndeFoi({ cats, refs, corrente, mesAnt, onAbrir, onTetos }: {
  cats: CategoriaRX[]; refs: Record<string, CatAnalise>; corrente: boolean; mesAnt: string;
  onAbrir: (c: CategoriaRX) => void; onTetos: () => void;
}) {
  const [todas, setTodas] = useState(false);
  const lista = cats.filter((c) => c.total > 0 && !FORA_DO_PESO.has(c.categoria)).sort((a, b) => b.total - a.total);
  const base = lista.reduce((s, c) => s + c.total, 0);
  const linha = (c: CategoriaRX, fechar = false) => {
    const e = estadoCategoria(c, refs[c.categoria], corrente, mesAnt);
    const parte = base > 0 ? Math.round((c.total / base) * 100) : 0;
    return (
      <Linha key={c.categoria} onClick={() => { if (fechar) setTodas(false); onAbrir(c); }} rotulo={`${c.rotulo}, ${inteiro(c.total)}`}>
        <span className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-semibold truncate" style={{ color: COR.texto }}>{c.rotulo}</span>
          <span className="text-[17px] font-bold tabular-nums shrink-0" style={{ color: COR.texto }}>{inteiro(c.total)}</span>
        </span>
        <span className="block mt-0.5 text-[12.5px]" style={{ color: COR.mute }}>
          {parte}% · <span style={{ color: e.cor === COR.mute ? COR.mute : e.cor }}>{e.texto}</span>
        </span>
        <span className="block mt-1.5"><Barra pct={e.pct} cor={e.cor} altura={6} /></span>
      </Linha>
    );
  };
  if (lista.length === 0) return null;
  return (
    <section aria-label="Para onde foi">
      <Titulo acao={<LinkOuro onClick={onTetos}>Tetos</LinkOuro>}>Para onde foi</Titulo>
      <Cartao className="py-1">
        {lista.slice(0, PRIMEIRAS).map((c) => linha(c))}
        {lista.length > PRIMEIRAS && (
          <div className="border-t" style={{ borderColor: "rgba(255,255,255,.06)" }}>
            <LinkOuro onClick={() => setTodas(true)}>Ver todas as {lista.length} categorias</LinkOuro>
          </div>
        )}
      </Cartao>
      <Folha open={todas} onOpenChange={setTodas} titulo="Todas as categorias" subtitulo={`${lista.length} categorias · ${inteiro(base)}`} alta>
        <div>{lista.map((c) => linha(c, true))}</div>
      </Folha>
    </section>
  );
}
