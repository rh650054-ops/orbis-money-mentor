/* 2 · 3 · Contas de trabalho (gold) and pessoais (blue): total, logo, name, balance and the REAL
   state of each connection (statusDoBanco, the same rule as the Vender screen). */
import { ChevronRight, Landmark } from "lucide-react";
import { statusDoBanco } from "@/features/vender";
import { Pilula } from "@/shared/components/vant-status";
import { Cartao, COR } from "@/features/financas-resumo";
import { totalDoGrupo, type LinhaConta } from "../lib/contas";
import { dinheiro } from "../lib/ocultar";

export type TipoGrupo = "trabalho" | "pessoal" | "sem";
const COR_DO_GRUPO: Record<TipoGrupo, string> = { trabalho: COR.ouro, pessoal: COR.azul, sem: COR.sub };
const TITULO: Record<TipoGrupo, string> = { trabalho: "Contas de trabalho", pessoal: "Contas pessoais", sem: "Sem classificação" };

function Logo({ l }: { l: LinhaConta }) {
  const url = l.conexao?.institution_logo;
  return url
    ? <img src={url} alt="" className="w-10 h-10 rounded-[12px] shrink-0 object-contain p-1" style={{ background: "#fff" }} />
    : <span className="w-10 h-10 rounded-[12px] shrink-0 grid place-items-center" style={{ background: "#1a1916", border: `1px solid ${COR.borda}` }}>
        <Landmark className="w-4 h-4" style={{ color: COR.sub }} aria-hidden />
      </span>;
}

interface Props {
  tipo: TipoGrupo; linhas: LinhaConta[]; oculto: boolean; ligando: boolean;
  onAbrir: () => void; onAutorizar: (itemId: string) => void;
}

export function GrupoContas({ tipo, linhas, oculto, ligando, onAbrir, onAutorizar }: Props) {
  if (linhas.length === 0) return null;
  const cor = COR_DO_GRUPO[tipo];
  const total = totalDoGrupo(linhas);
  return (
    <Cartao rotulo={TITULO[tipo]}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[14px] font-black" style={{ color: COR.texto }}>
            <span className="w-1 h-4 rounded-full" style={{ background: cor }} aria-hidden />{TITULO[tipo]}
          </p>
          {tipo === "sem" && <p className="text-[12.5px] mt-1" style={{ color: COR.sub }}>Diga se é de trabalho ou pessoal.</p>}
        </div>
        {tipo === "sem"
          ? <button type="button" onClick={onAbrir} className="text-[13px] font-extrabold shrink-0 min-h-9" style={{ color: COR.ouro }}>Classificar</button>
          : <p className="text-[18px] font-black tabular-nums shrink-0" style={{ color: total == null ? COR.mute : cor }}>{dinheiro(total, oculto)}</p>}
      </div>
      <div className="mt-2 -mb-2">
        {linhas.map((l) => {
          const st = l.conexao ? statusDoBanco(l.conexao.status, l.conexao.last_synced_at) : null;
          const desconectado = !!st?.autorizar;
          return (
            <div key={l.id} className="py-3" style={{ borderTop: `1px solid ${COR.linha}` }}>
              <button type="button" onClick={onAbrir} aria-label={`Detalhes de ${l.banco}`}
                className="w-full flex items-center gap-3 text-left active:opacity-70">
                <Logo l={l} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14.5px] font-black truncate" style={{ color: COR.texto }}>{l.banco}</span>
                  <span className="block text-[12px] truncate" style={{ color: desconectado ? COR.vermelho : COR.mute }}>{desconectado ? "conexão interrompida" : st ? st.detalhe : "sem dados da conexão"}</span>
                </span>
                <span className="text-right shrink-0">
                  <span className="block text-[15px] font-black tabular-nums" style={{ color: l.saldo == null ? COR.mute : (l.saldo < 0 && !oculto) ? COR.vermelho : COR.texto }}>
                    {dinheiro(l.saldo, oculto)}
                  </span>
                  <span className="inline-block mt-1"><Pilula tom={st?.tom ?? "neutro"}>{st?.rotulo ?? "SEM DADOS"}</Pilula></span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0" style={{ color: COR.mute }} aria-hidden />
              </button>
              {desconectado && l.conexao && (
                <button type="button" onClick={() => onAutorizar(l.conexao!.item_id)} disabled={ligando}
                  className="w-full h-10 mt-2.5 rounded-[12px] text-[13px] font-black active:scale-[0.98] transition-transform"
                  style={{ background: COR.ouro, color: "#1A1200" }}>Autorizar de novo no app do banco</button>
              )}
            </div>
          );
        })}
      </div>
    </Cartao>
  );
}
