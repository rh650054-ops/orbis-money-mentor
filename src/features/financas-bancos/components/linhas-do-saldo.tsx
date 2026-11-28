/* The pieces of "saldo disponível" shared by the Resumo and the Bancos cards, so both say the
   same thing in the same words: the PARCIAL badge, the big number and the lines under it. */
import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { COR, hora } from "@/features/financas-resumo";
import { dinheiro } from "../lib/ocultar";
import { diaCurto, type Consolidado } from "../lib/saldo";

const AMBAR = "#F2B43A";
const n = (q: number, um: string, varios: string) => `${q} ${q === 1 ? um : varios}`;

export function CabecaDoSaldo({ c, children }: { c: Consolidado; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {children}
      {c.conferido && c.parcial && c.recente != null && (
        <span className="rounded-full px-2 py-0.5 text-[10px] font-black tracking-[.08em] shrink-0"
          style={{ color: AMBAR, background: "rgba(242,180,58,.1)", border: "1px solid rgba(242,180,58,.35)" }}>PARCIAL</span>
      )}
    </div>
  );
}

/** The recent money; "Saldo atual indisponível" when nothing is recent (never R$ 0). */
export function NumeroDoSaldo({ c, oculto, tamanho }: { c: Consolidado; oculto: boolean; tamanho: number }) {
  if (!c.conferido) return <div aria-busy="true" className="h-8 w-44 rounded-lg mt-3 animate-pulse" style={{ background: "#1f1e1a" }} />;
  if (c.recente == null) {
    return <p className="text-[22px] font-black leading-tight mt-2" style={{ color: COR.mute }}>Saldo atual indisponível</p>;
  }
  return (
    <p className="font-black tabular-nums leading-none tracking-tight mt-2"
      style={{ fontSize: tamanho, color: c.recente < 0 && !oculto ? COR.vermelho : COR.texto }}>{dinheiro(c.recente, oculto)}</p>
  );
}

function Linha({ children, aviso = false, icone }: { children: ReactNode; aviso?: boolean; icone?: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[12.5px] font-semibold mt-1.5" style={{ color: aviso ? AMBAR : COR.sub }}>
      {icone ?? <AlertTriangle className="w-3.5 h-3.5 mt-[2px] shrink-0" aria-hidden />}<span className="min-w-0">{children}</span>
    </p>
  );
}

export function LinhasDoSaldo({ c, oculto }: { c: Consolidado; oculto: boolean }) {
  if (!c.conferido) return null;
  const relogio = (cor: string) => <RefreshCw className="w-3.5 h-3.5 mt-[2px] shrink-0" style={{ color: cor }} aria-hidden />;
  const quem = c.qtdDesconectadas === c.qtdSemConfirmacao
    ? (c.qtdSemConfirmacao === 1 ? "banco desconectado" : "bancos desconectados")
    : (c.qtdSemConfirmacao === 1 ? "banco sem leitura recente" : "bancos sem leitura recente");
  return (
    <div className="mt-0.5">
      {c.recente != null && c.atualizado && (
        <Linha icone={relogio(c.parcial ? COR.mute : COR.verde)}>
          {c.parcial ? `Com leitura recente · ${hora(c.atualizado)}` : `Atualizado às ${hora(c.atualizado)}`}
        </Linha>
      )}
      {c.semConfirmacao != null && (
        <Linha aviso>
          {c.recente == null ? "Último saldo conhecido" : "Sem confirmação recente"}: <b className="tabular-nums">{dinheiro(c.semConfirmacao, oculto)}</b>
          {" "}· {c.qtdSemConfirmacao} {quem}{c.desde ? ` desde ${diaCurto(c.desde)}` : ""}
        </Linha>
      )}
      {c.qtdIndisponiveis > 0 && <Linha aviso>Sem saldo de {n(c.qtdIndisponiveis, "banco", "bancos")}: não entra no total</Linha>}
      {c.recente == null && c.semConfirmacao == null && c.qtdIndisponiveis === 0 && (
        <Linha icone={relogio(COR.mute)}>O banco ainda não mandou o saldo</Linha>
      )}
    </div>
  );
}
