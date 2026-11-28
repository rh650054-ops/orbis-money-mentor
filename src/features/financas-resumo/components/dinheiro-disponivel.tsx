/* 2 · Dinheiro disponível: sum of the banks (financas_home), split work × personal. */
import { Briefcase, RefreshCw, User } from "lucide-react";
import type { HomeFinancas } from "@/components/financas/FinancasHome";
import { Atalho, Cartao, COR, Divisor, hora, reais, Titulo, Valor } from "./pecas";

/** Work and personal share of the bar. Only positive balances fill it; null when it cannot be drawn. */
export function divisaoDaBarra(trabalho: number, pessoal: number): { trabalho: number; pessoal: number } | null {
  const t = Math.max(0, trabalho), p = Math.max(0, pessoal);
  if (t + p <= 0) return null;
  const pt = Math.round((t / (t + p)) * 100);
  return { trabalho: pt, pessoal: 100 - pt };
}

function Leitura({ h }: { h: HomeFinancas }) {
  const n = h.bancos.length;
  return (
    <p className="flex items-center gap-1.5 text-[12.5px] font-semibold mt-2" style={{ color: COR.sub }}>
      <RefreshCw className="w-3.5 h-3.5" style={{ color: COR.verde }} aria-hidden />
      {n} {n === 1 ? "banco" : "bancos"}{h.atualizado ? ` · Lido às ${hora(h.atualizado)}` : ""}
    </p>
  );
}

function TrabalhoPessoal({ h }: { h: HomeFinancas }) {
  const t = h.saldo_trabalho ?? 0, p = h.saldo_pessoal ?? 0;
  const barra = divisaoDaBarra(t, p);
  return (
    <>
      <Divisor />
      <div className="grid grid-cols-2 gap-4">
        <Valor rotulo="Trabalho" valor={t < 0 ? `− ${reais(Math.abs(t))}` : reais(t)} cor={t < 0 ? COR.vermelho : COR.texto}
          icone={<Briefcase className="w-3.5 h-3.5" style={{ color: COR.ouro }} aria-hidden />} />
        <Valor rotulo="Pessoal" valor={p < 0 ? `− ${reais(Math.abs(p))}` : reais(p)} cor={p < 0 ? COR.vermelho : COR.texto}
          icone={<User className="w-3.5 h-3.5" style={{ color: COR.azul }} aria-hidden />} />
      </div>
      {barra && (
        <div className="flex h-[6px] rounded-full overflow-hidden mt-3.5 gap-[3px]" role="img"
          aria-label={`${barra.trabalho}% trabalho, ${barra.pessoal}% pessoal`}>
          {barra.trabalho > 0 && <span className="h-full rounded-full" style={{ width: `${barra.trabalho}%`, background: COR.ouro }} />}
          {barra.pessoal > 0 && <span className="h-full rounded-full" style={{ width: `${barra.pessoal}%`, background: COR.azul }} />}
        </div>
      )}
    </>
  );
}

export function DinheiroDisponivel({ h, onVerBancos }: { h: HomeFinancas; onVerBancos: () => void }) {
  const saldo = h.saldo ?? 0;
  const negativo = h.tem_saldo && saldo < 0;

  if (!h.tem_saldo) {
    return (
      <Cartao rotulo="Dinheiro disponível">
        <Titulo>Dinheiro disponível</Titulo>
        <p className="text-[14px] mt-3" style={{ color: COR.sub }}>Lendo o saldo do seu banco. Aparece aqui na próxima leitura.</p>
        <Atalho onClick={onVerBancos}>Ver minhas contas</Atalho>
      </Cartao>
    );
  }

  return (
    <Cartao rotulo="Dinheiro disponível" tom={negativo ? "vermelho" : "normal"}>
      <Titulo cor={negativo ? COR.vermelho : COR.sub}>{negativo ? "Você está no negativo" : "Dinheiro disponível"}</Titulo>
      <p className="text-[32px] font-black tabular-nums leading-none tracking-tight mt-3"
        style={{ color: negativo ? COR.vermelho : COR.texto }}>
        {negativo ? `− ${reais(Math.abs(saldo))}` : reais(saldo)}
      </p>
      <Leitura h={h} />
      {h.saldo_pessoal != null && <TrabalhoPessoal h={h} />}
      {negativo && h.causas && h.causas.length > 0 && (
        <div className="rounded-xl px-3 py-1 mt-4" style={{ background: "rgba(0,0,0,.35)" }}>
          <p className="text-[10px] font-black tracking-[.14em] pt-2" style={{ color: COR.mute }}>O QUE MAIS SAIU NESSES 7 DIAS</p>
          {h.causas.slice(0, 3).map((c, i) => (
            <div key={i} className="flex items-center gap-2 py-2" style={{ borderTop: i === 0 ? "none" : `1px solid ${COR.linha}` }}>
              <span className="flex-1 min-w-0 text-[13px] font-extrabold truncate">{c.descricao}</span>
              <span className="text-[13px] font-black tabular-nums" style={{ color: COR.vermelho }}>− {reais(c.valor)}</span>
            </div>
          ))}
        </div>
      )}
      <Atalho onClick={onVerBancos}>Ver minhas contas</Atalho>
    </Cartao>
  );
}
