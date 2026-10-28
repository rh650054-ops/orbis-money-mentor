/* 12 · Category detail (secondary screen): total, count, average, vs last month,
   "onde mais foi" with recipient chips, then the transactions. */
import { useMemo, useState } from "react";
import { Chip, COR, Folha } from "@/components/financas/planejar/ui";
import type { CategoriaRX, LancamentoRX } from "../types";
import { destinatarios, mesCurto, nomeDestinatario } from "../lib/raiox";
import { ListaTransacoes } from "./transacoes";
import { reais, inteiro } from "./pecas";

export function CategoriaDetalhe({ cat, lista, carregando, rotulos, mesAnt, onFechar }: {
  cat: CategoriaRX | null; lista: LancamentoRX[]; carregando: boolean; rotulos: Record<string, string>; mesAnt: string; onFechar: () => void;
}) {
  const [quem, setQuem] = useState<string | null>(null);
  const daCat = useMemo(() => (cat ? lista.filter((l) => l.categoria === cat.categoria && l.movimento !== "entre_contas" && l.tipo === "saida") : []), [cat, lista]);
  const top = useMemo(() => destinatarios(daCat), [daCat]);
  if (!cat) return null;
  const visiveis = quem ? daCat.filter((l) => nomeDestinatario(l).toUpperCase() === quem.toUpperCase()) : daCat;
  const dif = cat.total - cat.anterior;
  const media = cat.qtd > 0 ? cat.total / cat.qtd : 0;

  return (
    <Folha open onOpenChange={(o) => { if (!o) { setQuem(null); onFechar(); } }} titulo={cat.rotulo} subtitulo={`${cat.qtd} lançamentos · ${reais(media)} por lançamento`} alta>
      <div className="flex items-baseline justify-between gap-3 -mt-1">
        <p className="text-[30px] leading-none font-extrabold tabular-nums" style={{ color: COR.texto }}>{inteiro(cat.total)}</p>
        {cat.anterior > 0 && (
          <p className="text-[13px] font-bold" style={{ color: dif > 0 ? COR.coral : COR.verde }}>
            {dif > 0 ? "↑" : "↓"} {inteiro(Math.abs(dif))} vs {mesCurto(mesAnt)}
          </p>
        )}
      </div>
      {top[0] && (
        <div>
          <p className="text-[12px] font-black uppercase tracking-[.14em] mb-1" style={{ color: COR.sub }}>Onde mais foi</p>
          <p className="text-[14px] mb-2" style={{ color: COR.texto }}>{top[0].nome} · {inteiro(top[0].total)} em {top[0].qtd}x</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Chip ativo={!quem} onClick={() => setQuem(null)}>Todos</Chip>
            {top.map((d) => <Chip key={d.nome} ativo={quem === d.nome} onClick={() => setQuem(d.nome)}>{d.nome.length > 18 ? `${d.nome.slice(0, 18)}…` : d.nome}</Chip>)}
          </div>
        </div>
      )}
      {carregando ? <p className="py-4 text-[14px]" style={{ color: COR.sub }}>Carregando…</p> : <ListaTransacoes lista={visiveis} rotulos={rotulos} />}
    </Folha>
  );
}
