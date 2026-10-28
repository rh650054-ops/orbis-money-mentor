/* 3 · O que mais pesou: top 3, one line each, all tappable. */
import { Cartao, COR } from "@/components/financas/planejar/ui";
import type { CatAnalise } from "@/components/financas/analise/tipos";
import type { CategoriaRX } from "../types";
import { estadoCategoria, maisPesou } from "../lib/raiox";
import { Linha, Titulo, inteiro } from "./pecas";

export function OQueMaisPesou({ cats, refs, corrente, mesAnt, onAbrir }: {
  cats: CategoriaRX[]; refs: Record<string, CatAnalise>; corrente: boolean; mesAnt: string; onAbrir: (c: CategoriaRX) => void;
}) {
  const top = maisPesou(cats);
  if (top.length === 0) return null;
  return (
    <section aria-label="O que mais pesou">
      <Titulo>O que mais pesou</Titulo>
      <Cartao className="py-1">
        {top.map((c, i) => {
          const e = estadoCategoria(c, refs[c.categoria], corrente, mesAnt);
          return (
            <Linha key={c.categoria} onClick={() => onAbrir(c)} rotulo={`${c.rotulo}, ${inteiro(c.total)}`}>
              <span className="flex items-center gap-3">
                <span className="w-6 text-[15px] font-black tabular-nums" style={{ color: COR.ouro }}>{i + 1}.</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold truncate" style={{ color: COR.texto }}>{c.rotulo}</span>
                  <span className="block text-[12.5px] font-bold" style={{ color: e.cor }}>{e.texto}</span>
                </span>
                <span className="text-[17px] font-bold tabular-nums" style={{ color: COR.texto }}>{inteiro(c.total)}</span>
              </span>
            </Linha>
          );
        })}
      </Cartao>
    </section>
  );
}
