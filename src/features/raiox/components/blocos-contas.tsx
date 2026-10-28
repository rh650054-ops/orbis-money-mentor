/* 7 · Transferências entre contas · 8 · Suas contas · 9 · Trabalho x pessoal. */
import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { Barra, Cartao, COR, Folha } from "@/components/financas/planejar/ui";
import { Segmentado } from "@/shared/components/vant-status";
import { useContaUsoMutation } from "../api/use-conta-uso-mutation";
import type { ResumoRX } from "../types";
import { Linha, LinkOuro, Titulo, inteiro } from "./pecas";

export function Transferencias({ r, onVer }: { r: ResumoRX; onVer: () => void }) {
  const t = r.entre_contas;
  if (t.qtd === 0) return null;
  return (
    <section aria-label="Transferências entre suas contas">
      <Titulo>Transferências entre suas contas</Titulo>
      <Cartao className="py-1">
        <Linha onClick={onVer} borda={false} rotulo="Ver transferências">
          <span className="flex items-center gap-3">
            <ArrowLeftRight className="w-5 h-5 shrink-0" style={{ color: COR.sub }} />
            <span className="flex-1 min-w-0">
              <span className="block text-[18px] font-bold tabular-nums" style={{ color: COR.texto }}>{inteiro(Math.max(t.saiu, t.entrou))}</span>
              <span className="block text-[12.5px]" style={{ color: COR.mute }}>{t.qtd} {t.qtd === 1 ? "transferência interna" : "transferências internas"} · só mudou de conta, não entra nos gastos</span>
            </span>
          </span>
        </Linha>
      </Cartao>
    </section>
  );
}

export function SuasContas({ r }: { r: ResumoRX }) {
  const [gerenciar, setGerenciar] = useState(false);
  const uso = useContaUsoMutation();
  if (r.contas.length === 0) return null;
  return (
    <section aria-label="Suas contas">
      <Titulo acao={<LinkOuro onClick={() => setGerenciar(true)}>Gerenciar classificação</LinkOuro>}>Suas contas</Titulo>
      <Cartao className="py-1">
        {r.contas.map((c) => (
          <div key={c.banco} className="py-3 border-t first:border-t-0" style={{ borderColor: "rgba(255,255,255,.06)" }}>
            <p className="flex items-baseline justify-between gap-2">
              <span className="text-[15px] font-semibold truncate" style={{ color: COR.texto }}>{c.banco}</span>
              <span className="text-[12px] font-black shrink-0" style={{ color: c.uso === "vendas" ? COR.ouro : COR.sub }}>{c.uso === "vendas" ? "Trabalho" : "Pessoal"}</span>
            </p>
            <p className="text-[12.5px] mt-0.5 tabular-nums" style={{ color: COR.mute }}>entrou {inteiro(c.entrou)} · saiu {inteiro(c.saiu)}</p>
          </div>
        ))}
      </Cartao>
      <Folha open={gerenciar} onOpenChange={setGerenciar} titulo="Classificação das contas" subtitulo="Conta de trabalho entra nos custos do negócio; pessoal entra nos seus gastos.">
        {r.contas.map((c) => (
          <div key={c.banco} className="flex items-center justify-between gap-3">
            <span className="text-[15px] font-semibold truncate" style={{ color: COR.texto }}>{c.banco}</span>
            <div className="w-[200px] shrink-0">
              <Segmentado<"vendas" | "pessoal"> rotulo={`Uso da conta ${c.banco}`} valor={c.uso === "vendas" ? "vendas" : "pessoal"} disabled={uso.isPending}
                onEscolher={(v) => uso.mutate({ banco: c.banco, uso: v }, {
                  onSuccess: () => toast({ title: `${c.banco}: ${v === "vendas" ? "trabalho" : "pessoal"}`, description: "Vant aprendeu essa correção." }),
                  onError: () => toast({ title: "Não consegui salvar", variant: "destructive" }),
                })}
                opcoes={[{ valor: "vendas", texto: "Trabalho", cor: COR.ouro }, { valor: "pessoal", texto: "Pessoal", cor: "#b9b3a6" }]} />
            </div>
          </div>
        ))}
      </Folha>
    </section>
  );
}

export function TrabalhoPessoal({ r, onVer }: { r: ResumoRX; onVer: () => void }) {
  const total = r.corre + r.pessoal;
  if (total <= 0) return null;
  const pc = Math.round((r.corre / total) * 100);
  const frase = pc >= 60 ? "A maior parte das saídas deste mês foi do trabalho." : pc <= 40 ? "A maior parte das suas saídas deste mês foi pessoal." : "Suas saídas ficaram divididas entre trabalho e pessoal.";
  return (
    <section aria-label="Trabalho x pessoal">
      <Titulo acao={<LinkOuro onClick={onVer}>Ver divisão</LinkOuro>}>Trabalho x pessoal</Titulo>
      <Cartao>
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-[13px] font-bold" style={{ color: COR.ouro }}>Trabalho</p><p className="text-[19px] font-extrabold tabular-nums" style={{ color: COR.texto }}>{inteiro(r.corre)}</p><p className="text-[12px]" style={{ color: COR.mute }}>{pc}% das saídas</p></div>
          <div><p className="text-[13px] font-bold" style={{ color: COR.sub }}>Pessoal</p><p className="text-[19px] font-extrabold tabular-nums" style={{ color: COR.texto }}>{inteiro(r.pessoal)}</p><p className="text-[12px]" style={{ color: COR.mute }}>{100 - pc}% das saídas</p></div>
        </div>
        <div className="mt-3"><Barra pct={pc} cor={COR.ouro} altura={6} /></div>
        <p className="text-[12.5px] mt-2" style={{ color: COR.sub }}>{frase}</p>
      </Cartao>
    </section>
  );
}
