/* ============================================================
   CARTÃO · DÍVIDAS · GUARDADO (etapa 4 do Open Finance, v4 aprovada pelo Rick).
   Três linhas embaixo da home de Finanças; cada uma abre a sua tela numa gaveta.
   Tudo lido do banco uma vez por dia (pluggy-dia, 3h20) e servido por
   financas_painel(). O que o banco não liberou aparece como "liga pra ver aqui":
   nada quebra por falta de um produto.
   Os números viram "dias de rua" (o lucro médio de um dia trabalhado nos últimos
   30 dias), que é a régua que o vendedor entende.
   ============================================================ */
import { useEffect, useState } from "react";
import { ChevronRight, CreditCard, Landmark, PiggyBank } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Gaveta } from "@/shared/components/gaveta";
import { formatCurrency } from "@/shared/lib/utils";
import { avisar } from "@/shared/lib/avisar";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const RED = "#ff8a7a";
const MUTE = "#7b766e";
const LINHA = "rgba(255,255,255,.07)";

/** fatura = quanto do limite está usado (o "balance" que o banco manda — já inclui as parcelas que vêm).
 *  vence = o próximo vencimento. O banco às vezes manda a data da fatura passada (dado atrasado do
 *  Open Finance): o banco de dados empurra pro mês seguinte e marca vence_estimado. */
interface Cartao { banco: string | null; nome: string; fatura: number | null; limite: number | null; disponivel: number | null; vence: string | null; vence_estimado?: boolean; minimo: number | null }
interface Parcela { descricao: string; valor: number; atual: number; total: number; ate: string }
interface Emprestimo { banco: string | null; nome: string; saldo_devedor: number | null; parcela: number | null; total: number | null; pagas: number | null; atrasadas: number; taxa_mes: number | null; vence: string | null }
interface Investimento { banco: string | null; nome: string; tipo: string | null; saldo: number }
export interface Painel {
  tem_cartao: boolean; cartoes: Cartao[]; parcelas: Parcela[]; parcelas_por_mes: { mes: string; valor: number }[];
  parcelas_mes: number; parcelas_total: number;
  tem_emprestimo: boolean; emprestimos: Emprestimo[];
  especial_usado: number; especial_limite: number; juros_mes: { emprestimo: number; especial: number };
  tem_investimento: boolean; investimentos: Investimento[]; guardado: number;
  /** saldo da(s) conta(s) marcada(s) como Reserva — já incluso em guardado (03/10) */
  reserva?: number;
  saldo_contas: number; dividas: number; dia_de_rua: number; leitura: string | null;
}
type Aba = "cartao" | "dividas" | "guardado";

const reais = (v: number) => formatCurrency(v).replace(/,00$/, "");
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
const mesCurto = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
const hojeISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
/** "1 dia e meio de rua", pela média de lucro do vendedor */
function emDias(valor: number, dia: number): string | null {
  if (!(dia > 0) || !(valor > 0)) return null;
  const d = valor / dia;
  if (d < 0.75) return "menos de um dia de rua";
  if (d < 1.25) return "1 dia de rua";
  if (d < 1.75) return "1 dia e meio de rua";
  return `${Math.round(d)} dias de rua`;
}

function Caixa({ children, tom }: { children: React.ReactNode; tom?: "gold" | "red" | "ok" }) {
  const estilo = tom === "gold" ? { background: "linear-gradient(170deg,#1a1305,#0e0e10 70%)", borderColor: "rgba(245,184,0,.42)" }
    : tom === "red" ? { background: "linear-gradient(170deg,#1c0a08,#0e0e10 70%)", borderColor: "rgba(255,90,69,.42)" }
    : tom === "ok" ? { background: "linear-gradient(170deg,#0b1d14,#0e0e10 70%)", borderColor: "rgba(61,214,140,.42)" }
    : { background: "#0f0f10", borderColor: LINHA };
  return <div className="rounded-[18px] border px-3.5 py-3" style={estilo}>{children}</div>;
}
const Rotulo = ({ children, cor = MUTE }: { children: React.ReactNode; cor?: string }) =>
  <p className="text-[10px] font-black tracking-[.15em]" style={{ color: cor }}>{children}</p>;
function Barra({ pct, cor }: { pct: number; cor: string }) {
  return (
    <div className="h-[7px] rounded-full overflow-hidden mt-2.5" style={{ background: "#1c1c1b" }}>
      <i className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: cor }} />
    </div>
  );
}
function Vazio({ texto }: { texto: string }) {
  return <Caixa><p className="text-[12.5px] leading-relaxed" style={{ color: "#b9b3a6" }}>{texto}</p></Caixa>;
}

/* ---------------- 2 · CARTÃO ---------------- */
export function TelaCartao({ p }: { p: Painel }) {
  if (!p.tem_cartao) return <Vazio texto="Seu banco não liberou o cartão. Liga o cartão na tela do banco pra ver aqui a fatura, o vencimento e as parcelas que ainda vêm." />;
  const hoje = hojeISO();
  const maxMes = Math.max(1, ...p.parcelas_por_mes.map((m) => m.valor));
  const diasParcela = emDias(p.parcelas_mes, p.dia_de_rua);
  return (
    <div className="space-y-2.5">
      {p.cartoes.map((c, i) => {
        const fatura = Math.max(0, c.fatura ?? 0);
        // 04/10: "venceu" só com data fresca do banco. Data velha (Open Finance atrasado) não
        // vira alarme de rotativo: a fatura pode já estar paga e o banco ainda não contou.
        const venceu = !c.vence_estimado && !!c.vence && c.vence < hoje && fatura > 0;
        const cobre = p.saldo_contas >= fatura;
        const usoPct = c.limite ? (fatura / c.limite) * 100 : 0;
        return (
          <Caixa key={i} tom={venceu ? "red" : undefined}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Rotulo cor={venceu ? RED : MUTE}>USADO NO CARTÃO · {(c.banco ?? c.nome).toUpperCase()}</Rotulo>
                <p className="text-[26px] font-black tabular-nums leading-tight mt-1" style={{ color: venceu ? RED : "#F4F1EA" }}>{reais(fatura)}</p>
              </div>
              {c.vence && (
                <div className="text-right shrink-0">
                  <Rotulo cor={venceu ? RED : MUTE}>{venceu ? "VENCEU" : c.vence_estimado ? "PRÓX. FATURA" : "VENCE"}</Rotulo>
                  <p className="text-[17px] font-black" style={{ color: venceu ? RED : "#F4F1EA" }}>{ddmm(c.vence)}</p>
                </div>
              )}
            </div>
            {c.limite != null && c.limite > 0 && (
              <>
                <Barra pct={usoPct} cor={usoPct > 100 ? "linear-gradient(90deg,#c2412f,#ff5a45)" : "linear-gradient(90deg,#B88E00,#FFC800)"} />
                <div className="flex justify-between mt-1.5 text-[10.5px] font-bold" style={{ color: MUTE }}>
                  <span>{reais(fatura)} de {reais(c.limite)} de limite</span>
                  <span style={{ color: usoPct > 100 ? RED : cobre ? OK : GOLD }}>
                    {usoPct > 100 ? "passou do limite" : cobre ? "cabe no saldo ✓" : "saldo não cobre"}
                  </span>
                </div>
              </>
            )}
            {c.vence_estimado && (
              <p className="text-[10.5px] mt-2 leading-relaxed" style={{ color: MUTE }}>
                O banco ainda não mandou a fatura nova. A data é a estimada pelo mês.
              </p>
            )}
            {venceu && c.minimo != null && (
              <p className="text-[11.5px] mt-2.5 leading-relaxed" style={{ color: "#b9b3a6" }}>
                Fatura em atraso vira rotativo, o juros mais caro do Brasil. Se não der pra pagar tudo, o mínimo é {reais(c.minimo)}.
              </p>
            )}
          </Caixa>
        );
      })}

      {p.parcelas.length > 0 && (
        <Caixa>
          <div className="flex justify-between items-baseline">
            <Rotulo>PARCELAS QUE AINDA VÊM</Rotulo>
            <span className="text-[10.5px] font-bold" style={{ color: MUTE }}>{reais(p.parcelas_total)} no total</span>
          </div>
          <div className="grid grid-cols-6 gap-1 items-end h-16 mt-2.5">
            {p.parcelas_por_mes.slice(0, 6).map((m, i) => (
              <div key={m.mes} className="flex flex-col items-center gap-1 justify-end h-full">
                <i className="block w-full rounded-t-[4px] rounded-b-[2px]" style={{
                  height: `${Math.max(8, (m.valor / maxMes) * 48)}px`,
                  background: i < 2 ? "linear-gradient(180deg,#FFE27A,#F5B800)" : "#3a2a10",
                }} />
                <span className="text-[8px] font-extrabold" style={{ color: MUTE }}>{mesCurto(m.mes)}</span>
              </div>
            ))}
          </div>
          {p.parcelas.slice(0, 6).map((x, i) => (
            <div key={i} className="flex items-center gap-2.5 py-2.5" style={{ borderTop: `1px solid ${LINHA}`, marginTop: i === 0 ? 8 : 0 }}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-extrabold truncate">{x.descricao}</p>
                <p className="text-[10.5px] font-bold" style={{ color: MUTE }}>{x.atual} de {x.total} · {reais(x.valor)}/mês</p>
              </div>
              <span className="text-[12px] font-black shrink-0">até {mesCurto(x.ate)}</span>
            </div>
          ))}
        </Caixa>
      )}

      {p.parcelas_mes > 0 && (
        <Caixa tom="gold">
          <p className="text-[12px] leading-relaxed" style={{ color: "#b9b3a6" }}>
            <b style={{ color: GOLD }}>{reais(p.parcelas_mes)} já estão comprometidos no mês que vem.</b>
            {diasParcela ? ` Isso é ${diasParcela} antes de qualquer lucro.` : ""}
          </p>
        </Caixa>
      )}
    </div>
  );
}

/* ---------------- 3 · DÍVIDAS ---------------- */
export function TelaDividas({ p }: { p: Painel }) {
  const juros = (p.juros_mes.emprestimo ?? 0) + (p.juros_mes.especial ?? 0);
  const faturaAtrasada = p.cartoes.filter((c) => !c.vence_estimado && c.vence && c.vence < hojeISO() && (c.fatura ?? 0) > 0);
  const itens = [
    ...faturaAtrasada.map((c) => ({ nome: `Fatura ${c.banco ?? "do cartão"}`, sub: `venceu ${ddmm(c.vence)} · vira rotativo`, valor: c.fatura ?? 0, taxa: 0.14, tag: "ATACAR" })),
    ...(p.especial_usado > 0 ? [{ nome: "Cheque especial", sub: "juros médio de 8% ao mês", valor: p.especial_usado, taxa: 0.08, tag: "" }] : []),
    ...p.emprestimos.map((e) => ({
      nome: e.nome, sub: [e.taxa_mes ? `${(e.taxa_mes * 100).toFixed(1).replace(".", ",")}% ao mês` : null, e.pagas != null && e.total ? `${e.pagas} de ${e.total}` : null, e.atrasadas > 0 ? `${e.atrasadas} atrasada${e.atrasadas > 1 ? "s" : ""}` : null].filter(Boolean).join(" · "),
      valor: e.saldo_devedor ?? 0, taxa: e.taxa_mes ?? 0, tag: e.atrasadas > 0 ? "ATRASADA" : "",
    })),
  ].sort((a, b) => b.taxa - a.taxa);
  if (itens.length === 0) {
    return (
      <Caixa tom="ok">
        <Rotulo cor={OK}>NENHUMA DÍVIDA ABERTA NO BANCO</Rotulo>
        <p className="text-[12.5px] mt-1.5 leading-relaxed" style={{ color: "#b9b3a6" }}>
          Sem empréstimo, sem cheque especial, sem fatura atrasada. {p.parcelas_total > 0 ? `Só as parcelas do cartão (${reais(p.parcelas_total)}), que já estão na tela do cartão.` : ""}
        </p>
      </Caixa>
    );
  }
  const diasJuros = emDias(juros, p.dia_de_rua);
  return (
    <div className="space-y-2.5">
      <Caixa tom="red">
        <div className="text-center">
          <Rotulo cor={RED}>{juros > 0 ? "VOCÊ PAGA DE JUROS POR MÊS" : "VOCÊ DEVE NO BANCO"}</Rotulo>
          <p className="text-[32px] font-black tabular-nums leading-tight mt-1" style={{ color: RED }}>
            {reais(juros > 0 ? juros : itens.reduce((s, x) => s + x.valor, 0))}
          </p>
          {juros > 0 && diasJuros && <p className="text-[11.5px] mt-1" style={{ color: "#b9b3a6" }}>= {diasJuros} por mês só pra pagar juros</p>}
        </div>
      </Caixa>
      <Caixa>
        <div className="flex justify-between"><Rotulo>ORDEM DE ATAQUE</Rotulo><span className="text-[10.5px] font-bold" style={{ color: MUTE }}>mais caro primeiro</span></div>
        {itens.map((x, i) => (
          <div key={i} className="flex items-center gap-2.5 py-2.5" style={{ borderTop: i === 0 ? "none" : `1px solid ${LINHA}`, marginTop: i === 0 ? 4 : 0 }}>
            <span className="w-8 h-8 rounded-[10px] shrink-0 flex items-center justify-center text-[13px] font-black"
              style={i === 0 ? { background: "#2a0c11", color: RED } : { background: "#1a1a19", color: "#b9b3a6" }}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-extrabold truncate">{x.nome}</p>
              <p className="text-[10.5px] font-bold truncate" style={{ color: MUTE }}>{reais(x.valor)}{x.sub ? ` · ${x.sub}` : ""}</p>
            </div>
            {(i === 0 || x.tag) && (
              <span className="text-[9.5px] font-black tracking-[.06em] rounded-full px-2 py-[3px] shrink-0"
                style={{ background: "rgba(255,90,69,.12)", color: RED, border: "1px solid rgba(255,90,69,.4)" }}>{x.tag || "ATACAR"}</span>
            )}
          </div>
        ))}
      </Caixa>
    </div>
  );
}

/* ---------------- 4 · GUARDADO ---------------- */
const TIPO_INV: Record<string, string> = {
  CONTA_RESERVA: "sua conta de reserva", FIXED_INCOME: "renda fixa", MUTUAL_FUND: "fundo", SECURITY: "previdência", EQUITY: "ações", COE: "COE", ETF: "ETF", OTHER: "outro",
};
export function TelaGuardado({ p }: { p: Painel }) {
  const numero = p.saldo_contas + p.guardado - p.dividas;
  return (
    <div className="space-y-2.5">
      {p.tem_investimento ? (
        <Caixa tom="ok">
          <div className="text-center">
            <Rotulo cor={OK}>GUARDADO · CONFERIDO PELO BANCO</Rotulo>
            <p className="text-[32px] font-black tabular-nums leading-tight mt-1" style={{ color: OK }}>{reais(p.guardado)}</p>
          </div>
          {p.investimentos.map((i, k) => (
            <div key={k} className="flex items-center gap-2.5 py-2" style={{ borderTop: `1px solid ${LINHA}`, marginTop: k === 0 ? 10 : 0 }}>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-extrabold truncate">{i.nome}</p>
                <p className="text-[10.5px] font-bold" style={{ color: MUTE }}>{i.banco ?? ""}{i.tipo ? ` · ${TIPO_INV[i.tipo] ?? i.tipo.toLowerCase()}` : ""}</p>
              </div>
              <span className="text-[13px] font-black tabular-nums" style={{ color: OK }}>{reais(i.saldo)}</span>
            </div>
          ))}
        </Caixa>
      ) : (
        <Vazio texto="Nada guardado nos bancos ligados. Quando você tiver caixinha, CDB ou poupança (ou marcar um banco como Reserva), aparece aqui sozinho, conferido pelo banco." />
      )}
      <Caixa tom="gold">
        <div className="text-center">
          <Rotulo cor={GOLD}>SEU NÚMERO</Rotulo>
          <p className="text-[28px] font-black tabular-nums leading-tight mt-1" style={{ color: numero < 0 ? RED : GOLD }}>
            {numero < 0 ? "− " : ""}{reais(Math.abs(numero))}
          </p>
          <p className="text-[11px] mt-1" style={{ color: "#b9b3a6" }}>
            saldo {reais(p.saldo_contas)} + guardado {reais(p.guardado)} − dívidas {reais(p.dividas)}
          </p>
          <p className="text-[10.5px] font-bold mt-2" style={{ color: MUTE }}>
            {numero >= 0 ? "Positivo: tudo que você tem passa do que você deve." : "Quando passar de zero, a Vant comemora com você."}
          </p>
        </div>
      </Caixa>
    </div>
  );
}

/* ---------------- as três linhas da home ---------------- */
export function PainelLista({ p, abrir }: { p: Painel; abrir: (a: Aba) => void }) {
  const fatura = p.cartoes.reduce((s, c) => s + Math.max(0, c.fatura ?? 0), 0);
  const devendo = p.emprestimos.reduce((s, e) => s + (e.saldo_devedor ?? 0), 0) + p.especial_usado;
  const linhas: { aba: Aba; icone: React.ReactNode; titulo: string; sub: string }[] = [
    { aba: "cartao", icone: <CreditCard className="w-[18px] h-[18px]" style={{ color: GOLD }} />, titulo: "Cartão",
      sub: p.tem_cartao ? `${reais(fatura)} usado${p.parcelas.length ? ` · ${p.parcelas.length} parcela${p.parcelas.length > 1 ? "s" : ""} rolando` : ""}` : "liga pra ver aqui" },
    { aba: "dividas", icone: <Landmark className="w-[18px] h-[18px]" style={{ color: RED }} />, titulo: "Dívidas",
      sub: devendo > 0 ? `${reais(devendo)} em aberto` : "nenhum empréstimo nem cheque especial" },
    { aba: "guardado", icone: <PiggyBank className="w-[18px] h-[18px]" style={{ color: OK }} />, titulo: "Guardado",
      sub: p.tem_investimento
        ? `${reais(p.guardado)} conferido pelo banco${(p.reserva ?? 0) > 0 ? ` · inclui a conta de reserva` : ""}`
        : "nada guardado nos bancos ligados" },
  ];
  return (
    <div className="rounded-[18px] px-3.5" style={{ background: "#0f0f10", border: `1px solid ${LINHA}` }}>
      {linhas.map((l, i) => (
        <button key={l.aba} type="button" onClick={() => abrir(l.aba)}
          className="w-full flex items-center gap-3 py-3 text-left active:opacity-70" style={{ borderTop: i === 0 ? "none" : `1px solid ${LINHA}` }}>
          <span className="w-9 h-9 rounded-[11px] shrink-0 flex items-center justify-center" style={{ background: "#1a1a19" }}>{l.icone}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13.5px] font-extrabold">{l.titulo}</span>
            <span className="block text-[10.5px] font-bold truncate" style={{ color: MUTE }}>{l.sub}</span>
          </span>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: MUTE }} />
        </button>
      ))}
    </div>
  );
}

const TITULO: Record<Aba, string> = { cartao: "CARTÃO", dividas: "DÍVIDAS", guardado: "GUARDADO" };

export function FinancasPainel({ userId }: { userId?: string }) {
  const [p, setP] = useState<Painel | null>(null);
  const [aba, setAba] = useState<Aba | null>(null);

  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    (async () => {
      const { data, error } = await (supabase as unknown as { rpc: (f: string) => Promise<{ data: unknown; error: unknown }> }).rpc("financas_painel");
      if (error) { avisar.silencioso("financas_painel", error); return; }
      if (vivo) setP(data as Painel);
    })();
    return () => { vivo = false; };
  }, [userId]);

  if (!p) return null;
  return (
    <>
      <PainelLista p={p} abrir={setAba} />
      <Gaveta open={aba !== null} onOpenChange={(o) => { if (!o) setAba(null); }} titulo={aba ? TITULO[aba] : ""}
        style={{ background: "#0b0b0c", borderColor: "rgba(255,255,255,.08)" }}>
          <div className="px-4 flex flex-col gap-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
            <p className="font-mono text-[10px] font-bold tracking-[.18em] text-center" style={{ color: MUTE }}>{aba ? TITULO[aba] : ""}</p>
            {aba === "cartao" && <TelaCartao p={p} />}
            {aba === "dividas" && <TelaDividas p={p} />}
            {aba === "guardado" && <TelaGuardado p={p} />}
            {p.leitura && (
              <p className="text-[10px] font-bold text-center" style={{ color: MUTE }}>
                lido do banco às {new Date(p.leitura).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })} · atualiza toda madrugada
              </p>
            )}
          </div>
      </Gaveta>
    </>
  );
}
