/* ============================================================
   FINANÇAS EM ABAS (04/10/2026) — Resumo · Bancos · Planejar · Raio-X (era Análise até 27/10).
   Mesma identidade da tela (preto, ouro, verde/vermelho), só reorganizada:
   cada card responde UMA pergunta, um número grande por card, no máximo duas
   linhas de explicação e uma ação. O detalhe fica um toque abaixo.
   "Bancos" (e não "Contas") porque "contas" já são as contas a pagar; a aba só
   existe pra quem tem banco ligado, senão seria uma aba vazia.
   Aqui moram as peças novas; o que já existia (Guardar hoje, Mês blindado,
   contas a pagar, caixinhas…) continua em Finances.tsx, só trocou de aba.
   ============================================================ */
import { useLayoutEffect, useRef, useState } from "react";
import { ChevronRight, Landmark, AlertTriangle, Lock } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { type HomeFinancas } from "./FinancasHome";

/* 27/10: "Análise" virou "Raio-X" (as duas telas respondiam "pra onde foi o dinheiro"). */
export type AbaFinancas = "resumo" | "bancos" | "planejar" | "raiox";
const ROTULO: Record<AbaFinancas, string> = { resumo: "Resumo", bancos: "Bancos", planejar: "Planejar", raiox: "Raio-X" };

const GOLD = "#F5B800";
const OK = "#3DD68C";
const RED = "#ff8a7a";
const MUTE = "#7b766e";
const SUB = "#b9b3a6";
const LINHA = "rgba(255,255,255,.07)";

const reais = (v: number) => formatCurrency(v).replace(/,00$/, "");
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const nomeMes = () => new Date().toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });

/** bancosTravado (25/10): Essencial vê a aba Bancos com cadeado, com o que o Pro mostraria (fosco). */
/** bancosVazio (28/11): a Pro account with no bank sees the tab with the "first bank" empty state. */
export function abaValida(v: string | null, comBanco: boolean, bancosTravado = false, bancosVazio = false): AbaFinancas {
  if (v === "planejar" || v === "raiox") return v;
  if (v === "analise") return "raiox";   // links antigos
  if (v === "bancos" && (comBanco || bancosTravado || bancosVazio)) return v;
  return "resumo";
}

/* ---------- navegação: texto, ouro no selecionado, sem botões grandes ---------- */
export function AbasNav({ aba, onAba, comBanco, bancosTravado = false, bancosVazio = false }: { aba: AbaFinancas; onAba: (a: AbaFinancas) => void; comBanco: boolean; bancosTravado?: boolean; bancosVazio?: boolean }) {
  const lista: AbaFinancas[] = comBanco || bancosTravado || bancosVazio ? ["resumo", "bancos", "planejar", "raiox"] : ["resumo", "planejar", "raiox"];
  // 05/10: o sublinhado ouro desliza até a aba escolhida (~200ms, ease-out) e
  // acompanha a largura do texto.
  const botoes = useRef<Partial<Record<AbaFinancas, HTMLButtonElement | null>>>({});
  const [barra, setBarra] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = botoes.current[aba];
    if (el) setBarra({ x: el.offsetLeft, w: el.offsetWidth });
  }, [aba, comBanco, bancosTravado, bancosVazio]);
  return (
    <div role="tablist" aria-label="Partes das finanças" className="relative flex gap-5 overflow-x-auto" style={{ borderBottom: `1px solid ${LINHA}` }}>
      {lista.map((a) => {
        const on = a === aba;
        return (
          <button key={a} ref={(el) => { botoes.current[a] = el; }} type="button" role="tab" aria-selected={on} onClick={() => onAba(a)}
            className={`relative shrink-0 min-h-11 pb-2.5 pt-1 text-[15px] transition-colors duration-200 ${on ? "font-bold" : "font-semibold"}`}
            style={{ color: on ? GOLD : MUTE }}>
            <span className="inline-flex items-center gap-1">{ROTULO[a]}{a === "bancos" && bancosTravado && !comBanco && <Lock className="w-3 h-3" aria-label="do VANT Pro" />}</span>
          </button>
        );
      })}
      {barra && (
        <span aria-hidden className="absolute -bottom-px left-0 h-[2px] rounded-full"
          style={{ width: barra.w, transform: `translateX(${barra.x}px)`, background: GOLD, transition: "transform 200ms ease-out, width 200ms ease-out" }} />
      )}
    </div>
  );
}

/* ---------- casca comum dos cards novos ---------- */
function Caixa({ children, tom }: { children: React.ReactNode; tom?: "red" }) {
  return (
    <section className="orbis-card-in rounded-[18px] border p-4 flex flex-col gap-2"
      style={tom === "red"
        ? { background: "linear-gradient(170deg,#1c0a08,#0e0e10 70%)", borderColor: "rgba(255,90,69,.42)" }
        : { background: "#0e0e10", borderColor: LINHA }}>
      {children}
    </section>
  );
}
function Rotulo({ children, cor = MUTE }: { children: React.ReactNode; cor?: string }) {
  return <p className="text-[10px] font-black tracking-[.16em] uppercase" style={{ color: cor }}>{children}</p>;
}
function Link({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="self-start inline-flex items-center gap-0.5 h-8 text-[13px] font-extrabold" style={{ color: GOLD }}>
      {children} <ChevronRight className="w-4 h-4" strokeWidth={2.6} />
    </button>
  );
}

/* ---------- RESUMO 3 · PARA RESOLVER (só o que pede ação) ---------- */
export interface Pendencia { nome: string; valor: number; texto: string }
export function ParaResolver({ qtd, total, principal, vencidas, onResolver, onVerContas }: {
  qtd: number; total: number; principal: Pendencia | null; vencidas: boolean;
  onResolver: () => void; onVerContas: () => void;
}) {
  if (qtd === 0) return null;
  return (
    <Caixa tom={vencidas ? "red" : undefined}>
      <Rotulo cor={vencidas ? RED : GOLD}>Para resolver</Rotulo>
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-5 h-5 mt-1 shrink-0" style={{ color: vencidas ? RED : GOLD }} strokeWidth={2.4} />
        <div className="min-w-0">
          <p className="text-[24px] font-black leading-tight">
            {qtd} {vencidas ? (qtd === 1 ? "conta vencida" : "contas vencidas") : (qtd === 1 ? "conta vence hoje" : "contas vencem hoje")}
          </p>
          <p className="text-[13px] font-semibold tabular-nums" style={{ color: SUB }}>
            {reais(total)} · {vencidas ? "evite juros e multa" : "paga hoje e não pega juros"}
          </p>
        </div>
      </div>
      {principal && (
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 mt-1" style={{ background: "rgba(0,0,0,.3)", border: `1px solid ${LINHA}` }}>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-extrabold truncate">{principal.nome}</p>
            <p className="text-[12px] font-bold tabular-nums" style={{ color: vencidas ? RED : MUTE }}>{reais(principal.valor)} · {principal.texto}</p>
          </div>
          <button type="button" onClick={onResolver}
            className="h-10 px-4 rounded-xl text-[13.5px] font-black shrink-0 active:scale-95 transition-transform"
            style={vencidas
              ? { background: "linear-gradient(180deg,#ff6b6b,#e04545)", color: "#1a0505", boxShadow: "0 3px 0 #9e2a2a" }
              : { background: "linear-gradient(180deg,#ffc63a,#F5B800)", color: "#1a1200", boxShadow: "0 3px 0 #b88700" }}>
            Resolver
          </button>
        </div>
      )}
      <Link onClick={onVerContas}>Ver contas</Link>
    </Caixa>
  );
}

/* ---------- convite pra ligar o banco (quem ainda não tem) ---------- */
export function ConviteBanco({ onLigar, texto }: { onLigar: () => void; texto: string }) {
  return (
    <button type="button" onClick={onLigar}
      className="w-full rounded-[18px] px-4 py-3 flex items-center gap-3 text-left active:opacity-80"
      style={{ background: "#0e0e10", border: "1px dashed rgba(245,184,0,.4)" }}>
      <span className="w-9 h-9 rounded-[11px] shrink-0 flex items-center justify-center" style={{ background: "rgba(245,184,0,.12)" }}>
        <Landmark className="w-[17px] h-[17px]" style={{ color: GOLD }} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-extrabold" style={{ color: GOLD }}>Ligar meu banco</span>
        <span className="block text-[12.5px] font-semibold mt-0.5" style={{ color: SUB }}>{texto}</span>
      </span>
      <ChevronRight className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
    </button>
  );
}
