/* Statement of one bank (28/11, Rick): logo, name, work/personal, balance and last read, the
   period's entries and exits, the movements, filters, and the way to manage the connection.
   Movements are the ones already imported (no new read of the bank). */
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Settings2 } from "lucide-react";
import { Folha } from "@/shared/components/vant-ui";
import { Pilula } from "@/shared/components/vant-status";
import { statusDoBanco } from "@/features/vender";
import { COR, hora } from "@/features/financas-resumo";
import { useExtratoQuery } from "../api/use-extrato-query";
import { doBanco, mesesRecentes, nomeDoMes, nomeDoMovimento, porTipo, totais, type TipoFiltro } from "../lib/extrato";
import { dinheiro } from "../lib/ocultar";
import { diaCurto, type ContaNoSaldo } from "../lib/saldo";
import { Logo } from "./grupo-contas";

const PAPEL = { trabalho: { t: "Trabalho", c: COR.ouro }, pessoal: { t: "Pessoal", c: COR.azul }, sem: { t: "Sem classificação", c: COR.sub } } as const;
const TIPOS: { id: TipoFiltro; t: string }[] = [{ id: "tudo", t: "Tudo" }, { id: "entrada", t: "Entradas" }, { id: "saida", t: "Saídas" }];

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo} className="h-9 px-3.5 rounded-full text-[13px] font-extrabold shrink-0 active:scale-[0.97] transition-transform"
      style={ativo ? { background: COR.ouro, color: "#1a1305" } : { background: "#161512", color: COR.sub, border: `1px solid ${COR.borda}` }}>{children}</button>
  );
}

interface Props { conta: ContaNoSaldo | null; userId: string | undefined; oculto: boolean; onFechar: () => void; onGerenciar: () => void }

export function ExtratoBanco({ conta, userId, oculto, onFechar, onGerenciar }: Props) {
  const meses = mesesRecentes(3);
  const [mes, setMes] = useState(meses[0]!);
  const [tipo, setTipo] = useState<TipoFiltro>("tudo");
  const q = useExtratoQuery(userId, mes, !!conta);
  if (!conta) return null;
  const st = conta.conexao ? statusDoBanco(conta.conexao.status, conta.conexao.last_synced_at) : null;
  const doMes = doBanco(q.data ?? [], conta.banco);
  const t = totais(doMes);
  const lista = porTipo(doMes, tipo);
  const lida = conta.conexao?.last_synced_at ?? null;
  const papel = PAPEL[conta.papel];

  return (
    <Folha aberta={!!conta} onFechar={onFechar} titulo={conta.banco} sub="Extrato da conta">
      <section className="rounded-[20px] border p-[18px]" style={{ background: COR.cartao, borderColor: COR.borda }}>
        <div className="flex items-center gap-3">
          <Logo l={conta} />
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-black truncate">{conta.banco}</p>
            <p className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[11px] font-black rounded-full px-2 py-[3px]" style={{ color: papel.c, border: `1px solid ${papel.c}55` }}>{papel.t}</span>
              {st && <Pilula tom={st.tom}>{st.rotulo}</Pilula>}
            </p>
          </div>
        </div>
        <p className="text-[12px] font-semibold mt-4" style={{ color: COR.sub }}>{conta.estado === "sem_confirmacao" ? "Último saldo conhecido" : "Saldo"}</p>
        <p className="text-[28px] font-black tabular-nums leading-tight" style={{ color: conta.estado !== "recente" ? COR.mute : (conta.saldo ?? 0) < 0 && !oculto ? COR.vermelho : COR.texto }}>
          {dinheiro(conta.saldo, oculto)}
        </p>
        <p className="text-[12.5px] mt-1" style={{ color: conta.estado === "recente" ? COR.sub : "#F2B43A" }}>
          {!lida ? "Ainda sem leitura" : conta.estado === "recente" ? `Atualizado às ${hora(lida)}` : `Sem confirmação recente · desde ${diaCurto(lida)}`}
        </p>
      </section>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4" role="group" aria-label="Período">
        {meses.map((m, i) => <Chip key={m} ativo={m === mes} onClick={() => setMes(m)}>{i === 0 ? "Este mês" : nomeDoMes(m)}</Chip>)}
      </div>

      <section className="rounded-[20px] border p-[18px] grid grid-cols-2 gap-4" style={{ background: COR.cartao, borderColor: COR.borda }}>
        <div><p className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: COR.sub }}><ArrowDownLeft className="w-3.5 h-3.5" style={{ color: COR.verde }} aria-hidden />Entradas</p>
          <p className="text-[19px] font-black tabular-nums mt-1 truncate" style={{ color: COR.verde }}>{q.isLoading ? "…" : dinheiro(t.entradas, oculto)}</p></div>
        <div><p className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: COR.sub }}><ArrowUpRight className="w-3.5 h-3.5" style={{ color: COR.vermelho }} aria-hidden />Saídas</p>
          <p className="text-[19px] font-black tabular-nums mt-1 truncate" style={{ color: COR.vermelho }}>{q.isLoading ? "…" : dinheiro(t.saidas, oculto)}</p></div>
      </section>

      <div className="flex gap-2" role="group" aria-label="Tipo">
        {TIPOS.map((x) => <Chip key={x.id} ativo={tipo === x.id} onClick={() => setTipo(x.id)}>{x.t}</Chip>)}
      </div>

      <section aria-label="Movimentações" className="rounded-[20px] border px-[18px] py-1" style={{ background: COR.cartao, borderColor: COR.borda }}>
        {q.isLoading && [0, 1, 2].map((i) => <div key={i} aria-busy="true" className="h-11 my-2.5 rounded-lg animate-pulse" style={{ background: "#1a1916" }} />)}
        {q.isError && <p className="py-4 text-[13.5px]" style={{ color: COR.sub }}>Não deu para abrir o extrato agora. Tente de novo em instantes.</p>}
        {!q.isLoading && !q.isError && lista.length === 0 && (
          <p className="py-4 text-[13.5px]" style={{ color: COR.sub }}>Nenhuma movimentação {tipo === "entrada" ? "de entrada " : tipo === "saida" ? "de saída " : ""}em {nomeDoMes(mes).toLowerCase()}.</p>
        )}
        {lista.slice(0, 300).map((m, i) => (
          <div key={m.id} className="flex items-center gap-3 py-3" style={{ borderTop: i === 0 ? "none" : `1px solid ${COR.linha}` }}>
            <div className="flex-1 min-w-0">
              <p className="text-[14.5px] font-bold truncate">{nomeDoMovimento(m)}</p>
              <p className="text-[12px] truncate" style={{ color: COR.mute }}>{diaCurto(`${m.data}T12:00:00Z`)}{m.hora ? ` · ${m.hora}` : ""}{m.movimento === "entre_contas" ? " · entre suas contas" : ""}</p>
            </div>
            <p className="text-[15px] font-black tabular-nums shrink-0" style={{ color: m.tipo === "entrada" ? COR.verde : COR.texto }}>
              {oculto ? dinheiro(m.valor, true) : `${m.tipo === "entrada" ? "+ " : "− "}${dinheiro(m.valor, false)}`}
            </p>
          </div>
        ))}
      </section>

      <button type="button" onClick={onGerenciar} className="w-full h-12 rounded-[14px] text-[14px] font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        style={{ border: "1px solid rgba(245,184,0,.45)", color: COR.ouro }}>
        <Settings2 className="w-4 h-4" aria-hidden /> Gerenciar conexão
      </button>
    </Folha>
  );
}
