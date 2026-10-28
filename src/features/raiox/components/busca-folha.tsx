/* 15 · Search + combinable filters over the month's movements. */
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Chip, COR, Folha } from "@/components/financas/planejar/ui";
import type { Filtros, LancamentoRX } from "../types";
import { FILTROS_VAZIOS } from "../types";
import { aplicarFiltros, contarFiltros } from "../lib/raiox";
import { ListaTransacoes } from "./transacoes";
import { inteiro } from "./pecas";

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-black uppercase tracking-[.14em] mb-1.5" style={{ color: COR.sub }}>{titulo}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const alternar = (lista: string[], v: string) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);
const INPUT = "h-11 w-full rounded-[12px] border px-3 text-[15px] font-semibold outline-none focus:border-[#F5B800]";

export function BuscaFolha({ aberta, inicial, lista, bancos, rotulos, onFechar }: {
  aberta: boolean; inicial: Filtros; lista: LancamentoRX[]; bancos: string[]; rotulos: Record<string, string>; onFechar: () => void;
}) {
  const [f, setF] = useState<Filtros>(inicial);
  const [chave, setChave] = useState(inicial);
  if (chave !== inicial) { setChave(inicial); setF(inicial); }   // reopened with a preset (e.g. "Ver transferências")
  const [verFiltros, setVerFiltros] = useState(false);
  const res = useMemo(() => aplicarFiltros(lista, f), [lista, f]);
  const cats = useMemo(() => [...new Set(lista.map((l) => l.categoria))].sort((a, b) => (rotulos[a] ?? a).localeCompare(rotulos[b] ?? b)), [lista, rotulos]);
  const n = contarFiltros(f);
  const set = (p: Partial<Filtros>) => setF((x) => ({ ...x, ...p }));

  return (
    <Folha open={aberta} onOpenChange={(o) => { if (!o) onFechar(); }} titulo="Buscar movimentação" subtitulo={`${res.length} ${res.length === 1 ? "movimentação" : "movimentações"} · ${inteiro(res.reduce((s, l) => s + l.valor, 0))}`} alta>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COR.mute }} />
        <input value={f.texto} onChange={(e) => set({ texto: e.target.value })} placeholder="Nome, loja ou banco" aria-label="Buscar movimentação"
          className={`${INPUT} pl-9`} style={{ background: COR.surface2, borderColor: COR.borda, color: COR.texto }} />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Chip ativo={verFiltros || n > 0} onClick={() => setVerFiltros((v) => !v)}>Filtros{n > 0 ? ` · ${n}` : ""}</Chip>
        {n > 0 && (
          <button type="button" onClick={() => setF({ ...FILTROS_VAZIOS, texto: f.texto })} className="min-h-11 inline-flex items-center gap-1 text-[14px] font-bold" style={{ color: COR.sub }}>
            <X className="w-4 h-4" /> Limpar
          </button>
        )}
      </div>
      {verFiltros && (
        <div className="flex flex-col gap-4 rounded-[16px] border p-3" style={{ borderColor: COR.borda }}>
          <Grupo titulo="Tipo">
            <Chip ativo={f.tipo === "saida"} onClick={() => set({ tipo: f.tipo === "saida" ? null : "saida" })}>Saídas</Chip>
            <Chip ativo={f.tipo === "entrada"} onClick={() => set({ tipo: f.tipo === "entrada" ? null : "entrada" })}>Entradas</Chip>
            <Chip ativo={f.transferencias} onClick={() => set({ transferencias: !f.transferencias })}>Transferências entre contas</Chip>
          </Grupo>
          <Grupo titulo="Trabalho ou pessoal">
            <Chip ativo={f.esfera === "corre"} onClick={() => set({ esfera: f.esfera === "corre" ? null : "corre" })}>Trabalho</Chip>
            <Chip ativo={f.esfera === "pessoal"} onClick={() => set({ esfera: f.esfera === "pessoal" ? null : "pessoal" })}>Pessoal</Chip>
          </Grupo>
          <Grupo titulo="Identificação">
            <Chip ativo={f.identificacao === "sim"} onClick={() => set({ identificacao: f.identificacao === "sim" ? null : "sim" })}>Identificados</Chip>
            <Chip ativo={f.identificacao === "nao"} onClick={() => set({ identificacao: f.identificacao === "nao" ? null : "nao" })}>Não identificados</Chip>
          </Grupo>
          {bancos.length > 1 && <Grupo titulo="Banco">{bancos.map((b) => <Chip key={b} ativo={f.bancos.includes(b)} onClick={() => set({ bancos: alternar(f.bancos, b) })}>{b}</Chip>)}</Grupo>}
          <Grupo titulo="Categoria">{cats.map((c) => <Chip key={c} ativo={f.categorias.includes(c)} onClick={() => set({ categorias: alternar(f.categorias, c) })}>{rotulos[c] ?? c}</Chip>)}</Grupo>
          <Grupo titulo="Faixa de valor">
            <div className="grid grid-cols-2 gap-2 w-full">
              <input inputMode="decimal" placeholder="De R$" aria-label="Valor mínimo" value={f.min ?? ""} onChange={(e) => set({ min: e.target.value ? Number(e.target.value.replace(",", ".")) || 0 : null })}
                className={INPUT} style={{ background: COR.surface2, borderColor: COR.borda, color: COR.texto }} />
              <input inputMode="decimal" placeholder="Até R$" aria-label="Valor máximo" value={f.max ?? ""} onChange={(e) => set({ max: e.target.value ? Number(e.target.value.replace(",", ".")) || 0 : null })}
                className={INPUT} style={{ background: COR.surface2, borderColor: COR.borda, color: COR.texto }} />
            </div>
          </Grupo>
        </div>
      )}
      <ListaTransacoes lista={res} rotulos={rotulos} vazio="Nenhuma movimentação com esses filtros." />
    </Folha>
  );
}
