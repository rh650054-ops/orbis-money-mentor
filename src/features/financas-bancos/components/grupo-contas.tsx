/* 2 · 3 · Contas de trabalho (gold) and pessoais (blue): the group's RECENT money (lib/saldo.ts),
   then each bank with logo, name, balance and the real state of its connection (statusDoBanco).
   An unconfirmed balance is shown in grey and never added to the group's total. */
import { ChevronRight, Landmark } from "lucide-react";
import { statusDoBanco } from "@/features/vender";
import { Pilula } from "@/shared/components/vant-status";
import { Cartao, COR } from "@/features/financas-resumo";
import type { LinhaConta } from "../lib/contas";
import { dinheiro } from "../lib/ocultar";
import { diaCurto, type ContaNoSaldo } from "../lib/saldo";

export type TipoGrupo = "trabalho" | "pessoal" | "sem";
const COR_DO_GRUPO: Record<TipoGrupo, string> = { trabalho: COR.ouro, pessoal: COR.azul, sem: COR.sub };
const TITULO: Record<TipoGrupo, string> = { trabalho: "Contas de trabalho", pessoal: "Contas pessoais", sem: "Sem classificação" };

export function Logo({ l }: { l: LinhaConta }) {
  const url = l.conexao?.institution_logo;
  return url
    ? <img src={url} alt="" className="w-10 h-10 max-[359px]:w-8 max-[359px]:h-8 rounded-[12px] shrink-0 object-contain p-1" style={{ background: "#fff" }} />
    : <span className="w-10 h-10 max-[359px]:w-8 max-[359px]:h-8 rounded-[12px] shrink-0 grid place-items-center" style={{ background: "#1a1916", border: `1px solid ${COR.borda}` }}>
        <Landmark className="w-4 h-4" style={{ color: COR.sub }} aria-hidden />
      </span>;
}

interface Props {
  tipo: TipoGrupo; linhas: ContaNoSaldo[]; oculto: boolean; ligando: boolean;
  /** institution names connected more than once (lower case) */
  repetidos?: Set<string>;
  /** with an account: its statement; without: the management sheet ("Classificar") */
  onAbrir: (conta?: ContaNoSaldo) => void; onAutorizar: (itemId: string) => void;
}

export function GrupoContas({ tipo, linhas, oculto, ligando, onAbrir, onAutorizar, repetidos }: Props) {
  if (linhas.length === 0) return null;
  const cor = COR_DO_GRUPO[tipo];
  const recentes = linhas.filter((l) => l.estado === "recente");
  const total = recentes.length ? recentes.reduce((t, l) => t + (l.saldo ?? 0), 0) : null;
  const velhas = linhas.filter((l) => l.estado === "sem_confirmacao");
  const semConfirmacao = velhas.length ? velhas.reduce((t, l) => t + (l.saldo ?? 0), 0) : null;
  const semSaldo = linhas.filter((l) => l.estado === "indisponivel").length;
  return (
    <Cartao rotulo={TITULO[tipo]}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[14px] font-black whitespace-nowrap" style={{ color: COR.texto }}>
            <span className="w-1 h-4 rounded-full shrink-0" style={{ background: cor }} aria-hidden />{TITULO[tipo]}
          </p>
          {tipo === "sem" && <p className="text-[12.5px] mt-1" style={{ color: COR.sub }}>Diga se é de trabalho ou pessoal.</p>}
        </div>
        {tipo === "sem"
          ? <button type="button" onClick={() => onAbrir()} className="text-[13px] font-extrabold shrink-0 min-h-9" style={{ color: COR.ouro }}>Classificar</button>
          : <div className="text-right shrink-0 max-w-[55%]">
              {total == null
                ? <p className="text-[13px] font-bold mt-0.5" style={{ color: COR.mute }}>sem leitura recente</p>
                : <p className="text-[18px] max-[359px]:text-[16px] font-black tabular-nums" style={{ color: total < 0 && !oculto ? COR.vermelho : cor }}>{dinheiro(total, oculto)}</p>}
              {semConfirmacao != null && <p className="text-[11px] font-bold tabular-nums" style={{ color: "#F2B43A" }}>{total == null ? `último ${dinheiro(semConfirmacao, oculto)}` : `+ ${dinheiro(semConfirmacao, oculto)} sem confirmação`}</p>}
              {semSaldo > 0 && <p className="text-[11px] font-bold" style={{ color: "#F2B43A" }}>{semSaldo} sem saldo</p>}
            </div>}
      </div>
      <div className="mt-2 -mb-2">
        {linhas.map((l) => {
          const st = l.conexao ? statusDoBanco(l.conexao.status, l.conexao.last_synced_at) : null;
          const desconectado = !!st?.autorizar;
          // a connection that answers but sent no balance is not shown as healthy
          const pilula = l.saldo == null && st?.rotulo === "ATIVO" ? { tom: "atencao" as const, rotulo: "SEM SALDO" } : st ? { tom: st.tom, rotulo: st.rotulo } : { tom: "neutro" as const, rotulo: "SEM DADOS" };
          const desde = l.conexao?.last_synced_at ? diaCurto(l.conexao.last_synced_at) : null;
          return (
            <div key={l.id} className="py-3" style={{ borderTop: `1px solid ${COR.linha}` }}>
              <button type="button" onClick={() => onAbrir(l)} aria-label={`Extrato de ${l.banco}`}
                className="w-full flex items-center gap-3 max-[359px]:gap-2 text-left active:opacity-70">
                <Logo l={l} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14.5px] font-black truncate" style={{ color: COR.texto }}>{l.banco}</span>
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 min-w-0">
                    <span className="shrink-0"><Pilula tom={pilula.tom}>{pilula.rotulo}</Pilula></span>
                    {/* on a 320 px phone the time goes under the pill instead of being cut */}
                    <span className="text-[12px] truncate max-[359px]:whitespace-normal" style={{ color: desconectado ? COR.vermelho : COR.mute }}>{desconectado ? (desde ? `desde ${desde}` : "sem leitura") : st ? st.detalhe : "sem dados da conexão"}</span>
                  </span>
                  {repetidos?.has(l.banco.trim().toLowerCase()) && (
                    <span className="block text-[11.5px] truncate" style={{ color: COR.mute }}>outra conexão deste banco</span>
                  )}
                </span>
                <span className="text-[15px] max-[359px]:text-[14px] font-black tabular-nums shrink-0 text-right" style={{ color: l.estado !== "recente" ? COR.mute : (l.saldo! < 0 && !oculto) ? COR.vermelho : COR.texto }}
                  title={l.estado === "sem_confirmacao" ? "último saldo conhecido, sem confirmação recente" : undefined}>
                  {dinheiro(l.saldo, oculto)}
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 max-[359px]:hidden" style={{ color: COR.mute }} aria-hidden />
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
