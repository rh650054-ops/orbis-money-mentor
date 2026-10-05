/* ============================================================
   FINANÇAS EM ABAS (04/10/2026) — Resumo · Bancos · Planejar · Análise.
   Mesma identidade da tela (preto, ouro, verde/vermelho), só reorganizada:
   cada card responde UMA pergunta, um número grande por card, no máximo duas
   linhas de explicação e uma ação. O detalhe fica um toque abaixo.
   "Bancos" (e não "Contas") porque "contas" já são as contas a pagar; a aba só
   existe pra quem tem banco ligado, senão seria uma aba vazia.
   Aqui moram as peças novas; o que já existia (Guardar hoje, Mês blindado,
   contas a pagar, caixinhas…) continua em Finances.tsx, só trocou de aba.
   ============================================================ */
import { useLayoutEffect, useRef, useState } from "react";
import { ChevronRight, Landmark, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { Folego, type HomeFinancas } from "./FinancasHome";

export type AbaFinancas = "resumo" | "bancos" | "planejar" | "analise";
const ROTULO: Record<AbaFinancas, string> = { resumo: "Resumo", bancos: "Bancos", planejar: "Planejar", analise: "Análise" };

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

export function abaValida(v: string | null, comBanco: boolean): AbaFinancas {
  if (v === "planejar" || v === "analise") return v;
  if (v === "bancos" && comBanco) return v;
  return "resumo";
}

/* ---------- navegação: texto, ouro no selecionado, sem botões grandes ---------- */
export function AbasNav({ aba, onAba, comBanco }: { aba: AbaFinancas; onAba: (a: AbaFinancas) => void; comBanco: boolean }) {
  const lista: AbaFinancas[] = comBanco ? ["resumo", "bancos", "planejar", "analise"] : ["resumo", "planejar", "analise"];
  // 05/10: o sublinhado ouro desliza até a aba escolhida (~200ms, ease-out) e
  // acompanha a largura do texto.
  const botoes = useRef<Partial<Record<AbaFinancas, HTMLButtonElement | null>>>({});
  const [barra, setBarra] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = botoes.current[aba];
    if (el) setBarra({ x: el.offsetLeft, w: el.offsetWidth });
  }, [aba, comBanco]);
  return (
    <div role="tablist" aria-label="Partes das finanças" className="relative flex gap-6 overflow-x-auto" style={{ borderBottom: `1px solid ${LINHA}` }}>
      {lista.map((a) => {
        const on = a === aba;
        return (
          <button key={a} ref={(el) => { botoes.current[a] = el; }} type="button" role="tab" aria-selected={on} onClick={() => onAba(a)}
            className={`relative shrink-0 min-h-11 pb-2.5 pt-1 text-[15px] transition-colors duration-200 ${on ? "font-bold" : "font-semibold"}`}
            style={{ color: on ? GOLD : MUTE }}>
            {ROTULO[a]}
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

/* ---------- RESUMO 1 · SEU DINHEIRO (só com banco) ---------- */
export function SeuDinheiro({ h, onVerBancos }: { h: HomeFinancas; onVerBancos: () => void }) {
  const [comoCalcula, setComoCalcula] = useState(false);
  const saldo = h.saldo ?? 0;
  const negativo = h.tem_saldo && saldo < 0;
  const nBancos = h.bancos.length;
  const lido = h.atualizado ? ` · lido ${hora(h.atualizado)}` : "";

  if (negativo) {
    return (
      <Caixa tom="red">
        <Rotulo cor={RED}>Seu dinheiro</Rotulo>
        <p className="text-[44px] font-black tabular-nums leading-none tracking-tight" style={{ color: RED }}>− {reais(Math.abs(saldo))}</p>
        <p className="text-[13px] font-semibold" style={{ color: SUB }}>no negativo agora{lido}</p>
        {h.causas && h.causas.length > 0 && (
          <div className="rounded-xl px-3 py-1 mt-1" style={{ background: "rgba(0,0,0,.35)" }}>
            <p className="text-[9.5px] font-black tracking-[.15em] pt-2" style={{ color: MUTE }}>O QUE MAIS SAIU NESSES 7 DIAS</p>
            {h.causas.slice(0, 3).map((c, i) => (
              <div key={i} className="flex items-center gap-2 py-2" style={{ borderTop: i === 0 ? "none" : `1px solid ${LINHA}` }}>
                <span className="flex-1 min-w-0 text-[12.5px] font-extrabold truncate">{c.descricao}</span>
                <span className="text-[12.5px] font-black tabular-nums" style={{ color: RED }}>− {reais(c.valor)}</span>
              </div>
            ))}
          </div>
        )}
        <Link onClick={onVerBancos}>Ver bancos</Link>
      </Caixa>
    );
  }

  return (
    <Caixa>
      <Rotulo>Seu dinheiro</Rotulo>
      {h.tem_saldo ? (
        <>
          <p className="text-[44px] font-black tabular-nums leading-none tracking-tight text-foreground">{reais(saldo)}</p>
          <p className="text-[13px] font-semibold" style={{ color: SUB }}>
            disponível agora · {nBancos} {nBancos === 1 ? "banco" : "bancos"}{lido}
          </p>
          {h.saldo_pessoal != null && (
            <p className="text-[12.5px] font-bold tabular-nums" style={{ color: MUTE }}>
              trabalho <b className="text-foreground">{reais(h.saldo_trabalho ?? 0)}</b> · pessoal <b className="text-foreground">{reais(h.saldo_pessoal ?? 0)}</b>
            </p>
          )}
        </>
      ) : (
        <p className="text-[13px]" style={{ color: SUB }}>Lendo o saldo do seu banco. Aparece aqui na próxima leitura.</p>
      )}

      <div className="flex items-baseline justify-between gap-3 mt-2">
        <Rotulo>Fôlego</Rotulo>
        {h.folego_dias != null && (
          <span className="text-[18px] font-black tabular-nums">{h.folego_dias} {h.folego_dias === 1 ? "dia" : "dias"}</span>
        )}
      </div>
      {h.folego_dias != null ? (
        <>
          <Folego dias={h.folego_dias} />
          <p className="text-[13px]" style={{ color: SUB }}>
            Você aguenta {h.folego_dias} {h.folego_dias === 1 ? "dia" : "dias"} sem vender, pagando só as contas fixas.{" "}
            <button type="button" onClick={() => setComoCalcula((v) => !v)} className="font-extrabold underline-offset-2 underline" style={{ color: MUTE }}>
              {comoCalcula ? "fechar" : "como calculamos?"}
            </button>
          </p>
          {comoCalcula && (
            <p className="text-[12.5px] rounded-xl px-3 py-2" style={{ color: SUB, background: "#151514" }}>
              Saldo dos bancos ÷ o que suas contas fixas custam por dia ({reais(h.fixas_mes)} no mês ÷ 30).
            </p>
          )}
        </>
      ) : (
        <p className="text-[13px]" style={{ color: SUB }}>
          {h.fixas_mes > 0 ? "Aparece quando o saldo for lido." : "Cadastre suas contas fixas (aluguel, luz, celular) pra ver quantos dias você aguenta."}
        </p>
      )}
      <Link onClick={onVerBancos}>Ver bancos</Link>
    </Caixa>
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

/* ---------- RESUMO 4 · MOVIMENTO (entrou × saiu do banco) ---------- */
export function Movimento({ h, onVer }: { h: HomeFinancas; onVer: () => void }) {
  const dif = h.entrou - h.saiu;
  return (
    <Caixa>
      <Rotulo>Movimento · {nomeMes()}</Rotulo>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[13px] font-semibold" style={{ color: SUB }}>Entrou</p>
          <p className="text-[26px] font-black tabular-nums leading-tight" style={{ color: OK }}>{reais(h.entrou)}</p>
        </div>
        <div>
          <p className="text-[13px] font-semibold" style={{ color: SUB }}>Saiu</p>
          <p className="text-[26px] font-black tabular-nums leading-tight" style={{ color: RED }}>{reais(h.saiu)}</p>
        </div>
      </div>
      <p className="text-[13px] font-semibold tabular-nums" style={{ color: SUB }}>
        <b className="text-[16px]" style={{ color: dif < 0 ? RED : "#F4F1EA" }}>{dif < 0 ? "−" : "+"}{reais(Math.abs(dif))}</b> de diferença entre entradas e saídas
      </p>
      <Link onClick={onVer}>Ver movimentações</Link>
    </Caixa>
  );
}

/* ---------- BANCOS · saldo de cada conta, com o papel (trabalho/reserva) ---------- */
export function BancosLista({ h, onGerenciar }: { h: HomeFinancas; onGerenciar: () => void }) {
  const linhas = h.contas && h.contas.length > 0
    ? h.contas.map((c) => ({ id: c.id, banco: c.banco ?? "Banco", saldo: c.saldo, papel: c.papel }))
    : h.bancos.map((b, i) => ({ id: String(i), banco: b.banco ?? "Banco", saldo: b.saldo as number | null, papel: null as "trabalho" | "pessoal" | null }));
  return (
    <section className="orbis-card-in rounded-[18px] border px-4 py-3" style={{ background: "#0e0e10", borderColor: LINHA }}>
      <div className="flex items-center justify-between gap-2 pb-1">
        <Rotulo>Seus bancos</Rotulo>
        <button type="button" onClick={onGerenciar} className="inline-flex items-center gap-0.5 h-8 text-[12.5px] font-extrabold" style={{ color: GOLD }}>
          Gerenciar <ChevronRight className="w-4 h-4" strokeWidth={2.6} />
        </button>
      </div>
      {linhas.map((l, i) => (
        <div key={l.id} className="flex items-center gap-3 py-3" style={{ borderTop: i === 0 ? "none" : `1px solid ${LINHA}` }}>
          <span className="w-9 h-9 rounded-[11px] shrink-0 flex items-center justify-center" style={{ background: "#1a1a19" }}>
            <Landmark className="w-[17px] h-[17px]" style={{ color: SUB }} />
          </span>
          <span className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-[15px] font-extrabold truncate">{l.banco}</span>
            {l.papel && (
              <span className="text-[9.5px] font-black tracking-[.1em] uppercase rounded-full px-2 py-0.5 shrink-0"
                style={l.papel === "trabalho"
                  ? { color: GOLD, border: "1px solid rgba(245,184,0,.45)", background: "#1a1305" }
                  : { color: "#d8d2c6", border: "1px solid rgba(255,255,255,.18)", background: "#16161a" }}>
                {l.papel}
              </span>
            )}
          </span>
          <span className="text-[16px] font-black tabular-nums shrink-0">{l.saldo == null ? "—" : reais(l.saldo)}</span>
        </div>
      ))}
      {h.atualizado && <p className="text-[11px] font-bold pt-1" style={{ color: MUTE }}>lido às {hora(h.atualizado)} · atualiza de hora em hora</p>}
    </section>
  );
}

/* ---------- ANÁLISE · Piloto automático (o banco alimentando o Raio-X) ---------- */
export function PilotoLinha({ h, onAbrir }: { h: HomeFinancas; onAbrir: () => void }) {
  const mes = nomeMes();
  return (
    <button type="button" onClick={onAbrir}
      className="w-full rounded-[18px] px-4 py-3 flex items-center gap-3 text-left active:opacity-70"
      style={{ background: "#0e0e10", border: `1px solid ${LINHA}` }}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: OK, boxShadow: "0 0 0 4px rgba(61,214,140,.18)" }} />
      <span className="flex-1 min-w-0">
        <span className="block text-[10px] font-black tracking-[.15em]" style={{ color: OK }}>PILOTO AUTOMÁTICO LIGADO</span>
        <span className="block text-[12.5px] font-bold mt-0.5" style={{ color: SUB }}>
          {h.piloto.lancamentos > 0
            ? `${h.piloto.lancamentos} ${h.piloto.lancamentos === 1 ? "gasto entrou" : "gastos entraram"} sozinho${h.piloto.lancamentos === 1 ? "" : "s"} em ${mes}${h.piloto.conferir > 0 ? ` · ${h.piloto.conferir} pra conferir` : ""}`
            : "Cada gasto do banco entra sozinho no Raio-X, já organizado."}
        </span>
      </span>
      <ChevronRight className="w-4 h-4 shrink-0" style={{ color: MUTE }} />
    </button>
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
