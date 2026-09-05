/* ============================================================
   FECHAMENTO DO DIA — Etapa 1 da Onda 2 (Rick, 05/09).
   Substitui a DefconEndScreen (1.442 linhas) pelas 4 telas que o Rick
   aprovou no mockup "mock-final3" + "mock-fluxo":

     1. CUSTOS        "Os custos que eu já sei são estes. Teve mais algum?"
                      mercadoria (CMV) automática, transporte/comida em zero,
                      tudo editável, "+ adicionar outro custo". Zero não conta.
     2. RELATÓRIO     premium: sobrou pra você, vendido/recebido/fiado,
                      COMPARTILHAR (preto e dourado, Instagram), e
                      "como o dinheiro entrou" EDITÁVEL — dinheiro / pix /
                      cartão ali mesmo; o CALOTE é calculado, nunca digitado.
                      (Rick, 05/09: o pix ele confere depois, não na hora)
     3. O QUE MEXEU   ranking, calote, constância, amanhã → FECHAR O DIA

   Por baixo é tudo o que já existia: onSaveBreakdown (divide os blocos e
   grava daily_sales + total_debt), personal_expenses, daily_sales.cost (CMV),
   leaderboard_stats, DefconShareCarousel. Nenhuma tabela nova.
   Regra da casa: todo hook ACIMA do primeiro return.
   ============================================================ */
import { useEffect, useMemo, useState, type ReactNode, type CSSProperties } from "react";
import {
  Banknote, Smartphone, CreditCard, AlertTriangle, ShoppingCart, Bus, Utensils, Package, Plus, Trash2,
  Check, Clock, Trophy, Coins, Flame, ChevronRight, Loader2, Instagram, RotateCcw, ArrowLeft, Pencil,
} from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { toast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { DefconShareCarousel } from "./DefconShareCarousel";
import { CompetitionStatementUpload } from "./CompetitionStatementUpload";

type Passo = "custos" | "relatorio" | "mexeu";
interface CustoLinha { id: string; nome: string; sub: string; valor: number; texto?: string; auto?: boolean; origem: "cmv" | "manual" | "sugestao" | "novo"; categoria?: string; icone?: string }

interface Props {
  phase?: "finished" | "abandoned";
  totalSold: number;
  dailyGoal: number;
  totalApproaches?: number;
  totalSalesCount?: number;
  workedMinutes?: number;
  userId?: string;
  onSaveBreakdown: (dinheiro: number, cartao: number, pix: number) => Promise<void>;
  onExit: () => void;
  onExtend?: () => Promise<void>;
  onRestart?: () => Promise<void>;
}

const brl0 = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));
const nnum = (t: string) => Number(String(t).replace(/\./g, "").replace(",", ".")) || 0;
const fmtHora = (s: string) => new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/* ---- peças de UI (FORA do componente: definidas dentro, remontavam a cada
   tecla e o input perdia o foco) ---- */
function Passos({ n }: { n: 1 | 2 }) {
  return (
    <>
      <p className="orbis-mini">Fechamento · passo {n} de 2</p>
      <div className="flex gap-1.5 mt-3">
        {[1, 2].map((k) => <span key={k} className="h-[3px] flex-1 rounded-full" style={{ background: k <= n ? "var(--orbis-gold)" : "rgba(255,255,255,.10)" }} />)}
      </div>
    </>
  );
}
function CampoValor({ valor, onChange, destaque }: { valor: string; onChange: (v: string) => void; destaque?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[12px] px-3 h-[38px] shrink-0"
      style={{ border: `1px solid ${destaque ? "rgba(245,184,0,.45)" : "rgba(255,255,255,.10)"}`, background: destaque ? "rgba(245,184,0,.06)" : "transparent" }}>
      <small className="text-[12px]" style={{ color: "var(--orbis-fg-3)" }}>R$</small>
      <input inputMode="decimal" value={valor} placeholder="0,00" onChange={(e) => onChange(e.target.value)}
        className="orbis-num w-[76px] bg-transparent outline-none text-right text-[16px] font-bold" style={{ color: "var(--orbis-fg)" }} />
    </span>
  );
}
function Bloco({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="rounded-[20px] border overflow-hidden" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)", ...style }}>{children}</div>;
}

export function DefconFechamento({
  totalSold, dailyGoal, totalApproaches = 0, totalSalesCount = 0, workedMinutes = 0,
  userId, onSaveBreakdown, onExit, onExtend, onRestart,
}: Props) {
  const [passo, setPasso] = useState<Passo>("custos");
  const [rec, setRec] = useState({ dinheiro: "", pix: "", cartao: "" });
  const [salvandoRec, setSalvandoRec] = useState(false);
  const [recSujo, setRecSujo] = useState(false);
  const [editandoRec, setEditandoRec] = useState(false);
  const [dsId, setDsId] = useState<string | null>(null);
  const [gorjetas, setGorjetas] = useState(0);
  const [linhas, setLinhas] = useState<CustoLinha[]>([]);
  const [custosCarregados, setCustosCarregados] = useState(false);
  const [novoCusto, setNovoCusto] = useState<{ nome: string; valor: string } | null>(null);
  const [salvandoCustos, setSalvandoCustos] = useState(false);
  const [vendas, setVendas] = useState<{ amount: number; method: string; late: boolean; created_at: string; block_index: number | null }[]>([]);
  const [blocos, setBlocos] = useState<{ i: number; sold: number; ini: string | null; fim: string | null }[]>([]);
  const [rank, setRank] = useState<{ posicao: number | null; faturamento: number; dias: number; acima: { nome: string; valor: number } | null; total: number } | null>(null);
  const [horaInicio, setHoraInicio] = useState<number | null>(null);
  const [mostrarShare, setMostrarShare] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [confirmarDescartar, setConfirmarDescartar] = useState(false);

  const hoje = getBrazilDate();

  /* ---- carga inicial: o que já foi registrado hoje ---- */
  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    (async () => {
      const startISO = new Date(`${hoje}T00:00:00-03:00`).toISOString();
      const [ds, vd, pe, sess, lb, plano] = await Promise.all([
        supabase.from("daily_sales").select("id, cash_sales, card_sales, pix_sales, tip_sales, cost").eq("user_id", userId).eq("date", hoje).order("created_at", { ascending: true }).limit(1),
        supabase.from("defcon_sales").select("amount, method, late, created_at, block_index").eq("user_id", userId).gte("created_at", startISO).order("created_at", { ascending: true }),
        supabase.from("personal_expenses").select("id, name, amount, icon, category").eq("user_id", userId).eq("date", hoje).order("created_at", { ascending: true }),
        supabase.from("challenge_sessions").select("id").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("leaderboard_stats").select("user_id, nome_usuario, faturamento_total_mes, dias_trabalhados_mes, posicao_faturamento").eq("mes_referencia", hoje.slice(0, 7)).gt("dias_trabalhados_mes", 0).order("posicao_faturamento", { ascending: true }).limit(200),
        supabase.from("onboarding_planos").select("hora_inicio").eq("user_id", userId).maybeSingle(),
      ]);
      if (!vivo) return;

      const row = (ds.data as any[] | null)?.[0];
      if (row) {
        setDsId(row.id);
        setGorjetas(Number(row.tip_sales || 0));
        // pré-preenche com o que ele JÁ marcou venda a venda — ele só confirma
        setRec({
          dinheiro: row.cash_sales ? String(Number(row.cash_sales)).replace(".", ",") : "",
          pix: row.pix_sales ? String(Number(row.pix_sales)).replace(".", ",") : "",
          cartao: row.card_sales ? String(Number(row.card_sales)).replace(".", ",") : "",
        });
      }
      setVendas(((vd.data as any[]) || []).map((v) => ({ amount: Number(v.amount) || 0, method: String(v.method), late: !!v.late, created_at: v.created_at, block_index: v.block_index == null ? null : Number(v.block_index) })));

      // custos: CMV automático no topo (daily_sales.cost), depois os manuais de hoje, depois sugestões em zero
      const cmv = Number(row?.cost || 0);
      const manuais: CustoLinha[] = ((pe.data as any[]) || []).map((e) => ({
        id: e.id, nome: e.name, sub: e.category || "hoje", valor: Number(e.amount) || 0, origem: "manual", categoria: e.category, icone: e.icon,
      }));
      const temTransporte = manuais.some((m) => (m.categoria || "").toLowerCase().includes("transporte"));
      const temComida = manuais.some((m) => (m.categoria || "").toLowerCase().includes("aliment"));
      const sugestoes: CustoLinha[] = [
        ...(temTransporte ? [] : [{ id: "sug_transporte", nome: "Transporte", sub: "ônibus, gasolina, uber", valor: 0, origem: "sugestao" as const, categoria: "Transporte", icone: "🚗" }]),
        ...(temComida ? [] : [{ id: "sug_comida", nome: "Comida", sub: "almoço, lanche, água", valor: 0, origem: "sugestao" as const, categoria: "Alimentação", icone: "🍽️" }]),
      ];
      setLinhas([
        ...(row ? [{ id: row.id, nome: "Mercadoria", sub: cmv > 0 ? "automático · o que saiu do estoque" : "o que saiu do estoque", valor: cmv, auto: true, origem: "cmv" as const }] : []),
        ...manuais, ...sugestoes,
      ]);
      setCustosCarregados(true);

      // blocos da sessão (melhor hora)
      const sid = (sess.data as any)?.id;
      if (sid) {
        const { data: bl } = await supabase.from("challenge_blocks").select("block_index, sold_amount, started_at, ended_at").eq("session_id", sid).order("block_index", { ascending: true });
        if (!vivo) return;
        const porBloco: Record<number, number> = {};
        for (const v of ((vd.data as any[]) || [])) {
          if (v.method === "gorjeta" || v.block_index == null) continue;
          porBloco[Number(v.block_index)] = (porBloco[Number(v.block_index)] || 0) + (Number(v.amount) || 0);
        }
        setBlocos(((bl as any[]) || []).map((b) => ({ i: Number(b.block_index) || 0, sold: porBloco[Number(b.block_index)] ?? (Number(b.sold_amount) || 0), ini: b.started_at || null, fim: b.ended_at || null })));
      }

      // ranking: eu, quem está logo acima, quantos somos
      const lista = ((lb.data as any[]) || []);
      const eu = lista.find((l) => l.user_id === userId);
      if (eu) {
        const pos = Number(eu.posicao_faturamento) || null;
        const acima = pos && pos > 1 ? lista.find((l) => Number(l.posicao_faturamento) === pos - 1) : null;
        setRank({ posicao: pos, faturamento: Number(eu.faturamento_total_mes) || 0, dias: Number(eu.dias_trabalhados_mes) || 0, acima: acima ? { nome: String(acima.nome_usuario || "vendedor"), valor: Number(acima.faturamento_total_mes) || 0 } : null, total: lista.length });
      } else {
        setRank({ posicao: null, faturamento: 0, dias: 0, acima: null, total: lista.length });
      }
      const hi = (plano.data as any)?.hora_inicio;
      setHoraInicio(hi == null ? null : Number(hi));
    })().catch(() => { if (vivo) setCustosCarregados(true); });
    return () => { vivo = false; };
  }, [userId, hoje]);

  /* ---- números derivados (nunca guardados) ---- */
  const recDin = nnum(rec.dinheiro), recPix = nnum(rec.pix), recCar = nnum(rec.cartao);
  const recebido = recDin + recPix + recCar;
  const vendidoSemGorjeta = Math.max(0, totalSold - gorjetas);
  const fiado = Math.max(0, Math.round((vendidoSemGorjeta - recebido) * 100) / 100);
  const custoTotal = linhas.reduce((t, l) => t + (l.valor > 0 ? l.valor : 0), 0);
  const lucro = vendidoSemGorjeta - custoTotal;
  const margem = vendidoSemGorjeta > 0 ? (lucro / vendidoSemGorjeta) * 100 : 0;
  const pctMeta = dailyGoal > 0 ? Math.round((vendidoSemGorjeta / dailyGoal) * 100) : 0;
  const bateu = dailyGoal > 0 && vendidoSemGorjeta >= dailyGoal;
  const vendasReais = vendas.filter((v) => v.method !== "gorjeta");
  const ticket = vendasReais.length ? vendidoSemGorjeta / vendasReais.length : 0;
  const conversao = totalApproaches > 0 ? Math.min(100, (totalSalesCount / totalApproaches) * 100) : 0;
  const naRua = `${Math.floor(workedMinutes / 60)}h${String(workedMinutes % 60).padStart(2, "0")}`;
  const melhorBloco = useMemo(() => blocos.reduce<typeof blocos[number] | null>((m, b) => (b.sold > 0 && (!m || b.sold > m.sold) ? b : m), null), [blocos]);
  const porMetodo = useMemo(() => {
    const m = { dinheiro: recDin, pix: recPix, cartao: recCar };
    return m;
  }, [recDin, recPix, recCar]);

  /* ---- ações ---- */
  const salvarRecebimentos = async (): Promise<boolean> => {
    if (!recSujo) return true;
    setSalvandoRec(true);
    try {
      await onSaveBreakdown(recDin, recCar, recPix);
      setRecSujo(false);
      setEditandoRec(false);
      return true;
    } catch (e: any) {
      toast({ title: "Não deu pra salvar", description: e?.message || "Tenta de novo.", variant: "destructive" });
      return false;
    } finally {
      setSalvandoRec(false);
    }
  };
  const irParaMexeu = async () => { if (await salvarRecebimentos()) setPasso("mexeu"); };

  // guarda o TEXTO que ele digita (pra vírgula não sumir) e o número derivado dele
  const setLinha = (id: string, texto: string) => setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, texto, valor: nnum(texto) } : l)));

  const salvarCustos = async () => {
    if (!userId) { setPasso("relatorio"); return; }
    setSalvandoCustos(true);
    try {
      for (const l of linhas) {
        if (l.origem === "cmv" && dsId) {
          await supabase.from("daily_sales").update({ cost: l.valor }).eq("id", dsId);
        } else if (l.origem === "manual") {
          await supabase.from("personal_expenses").update({ amount: l.valor }).eq("id", l.id);
        } else if ((l.origem === "sugestao" || l.origem === "novo") && l.valor > 0) {
          await supabase.from("personal_expenses").insert({
            user_id: userId, name: l.nome.slice(0, 80), category: l.categoria || "Outros", icon: l.icone || "➕",
            amount: l.valor, type: "variable", date: hoje,
          });
        }
      }
      setPasso("relatorio");
    } catch (e: any) {
      toast({ title: "Não deu pra salvar os custos", description: e?.message || "Tenta de novo.", variant: "destructive" });
    } finally {
      setSalvandoCustos(false);
    }
  };

  const removerLinha = async (l: CustoLinha) => {
    if (l.origem === "manual" && userId) {
      const { error } = await supabase.from("personal_expenses").delete().eq("id", l.id);
      if (error) { toast({ title: "Não deu pra apagar", variant: "destructive" }); return; }
    }
    setLinhas((ls) => ls.filter((x) => x.id !== l.id));
  };

  const reabrir = async () => {
    if (!onExtend) return;
    setReabrindo(true);
    try { await onExtend(); } finally { setReabrindo(false); }
  };

  const iconeCusto = (l: CustoLinha) =>
    l.origem === "cmv" ? <ShoppingCart className="w-[17px] h-[17px]" strokeWidth={2.1} />
    : (l.categoria || "").toLowerCase().includes("transporte") ? <Bus className="w-[17px] h-[17px]" strokeWidth={2.1} />
    : (l.categoria || "").toLowerCase().includes("aliment") ? <Utensils className="w-[17px] h-[17px]" strokeWidth={2.1} />
    : <Package className="w-[17px] h-[17px]" strokeWidth={2.1} />;

  /* ============ 1 · CUSTOS ============ */
  if (passo === "custos") {
    return (
      <div className="min-h-[100dvh] bg-background pt-safe pb-safe px-5 pt-4 pb-10 max-w-md mx-auto orbis-stagger">
        <Passos n={1} />
        <h1 className="font-display text-[22px] font-extrabold leading-tight mt-4">Os custos que eu já sei<br />são estes. Teve mais algum?</h1>

        {!custosCarregados ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--orbis-fg-3)" }} /></div>
        ) : (
          <Bloco style={{ marginTop: 18 }}>
            {linhas.map((l, idx) => (
              <div key={l.id} className="flex items-center gap-3 px-4 h-[64px]" style={idx ? { borderTop: "1px solid var(--orbis-line)" } : undefined}>
                <span className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.09)", color: "var(--orbis-gold)" }}>{iconeCusto(l)}</span>
                <span className="flex-1 min-w-0">
                  <b className="block text-[14.5px] font-semibold truncate">{l.nome}</b>
                  <small className="block text-[11.5px] truncate" style={{ color: l.auto && l.valor > 0 ? "var(--orbis-ok)" : "var(--orbis-fg-3)" }}>{l.sub}</small>
                </span>
                <CampoValor valor={l.texto ?? (l.valor ? String(l.valor).replace(".", ",") : "")} onChange={(v) => setLinha(l.id, v)} destaque={l.valor > 0} />
                {l.origem !== "cmv" && l.origem !== "sugestao" && (
                  <button onClick={() => void removerLinha(l)} aria-label={`Remover ${l.nome}`} className="shrink-0 p-1"><Trash2 className="w-4 h-4" style={{ color: "var(--orbis-fg-3)" }} /></button>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between px-4 h-[52px]" style={{ borderTop: "1px solid var(--orbis-line)", background: "rgba(0,0,0,.25)" }}>
              <span className="orbis-mini">Total de custos</span>
              <span className="orbis-num text-[17px] font-extrabold" style={{ color: custoTotal > 0 ? "var(--orbis-custo)" : "var(--orbis-fg-3)" }}>{formatCurrency(custoTotal)}</span>
            </div>
          </Bloco>
        )}

        {novoCusto ? (
          <div className="rounded-[16px] border mt-3 p-3.5" style={{ borderColor: "rgba(245,184,0,.3)", background: "rgba(245,184,0,.05)" }}>
            <input autoFocus value={novoCusto.nome} onChange={(e) => setNovoCusto({ ...novoCusto, nome: e.target.value })} placeholder="Do que foi esse custo?" className="w-full bg-transparent outline-none text-[14.5px] font-semibold" />
            <div className="flex gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 rounded-[12px] px-3 h-[40px] flex-1" style={{ border: "1px solid rgba(255,255,255,.12)" }}>
                <small className="text-[12px]" style={{ color: "var(--orbis-fg-3)" }}>R$</small>
                <input inputMode="decimal" value={novoCusto.valor} onChange={(e) => setNovoCusto({ ...novoCusto, valor: e.target.value })} placeholder="0,00" className="orbis-num flex-1 bg-transparent outline-none text-[16px] font-bold" />
              </span>
              <button onClick={() => {
                  const v = nnum(novoCusto.valor);
                  if (v > 0) setLinhas((ls) => [...ls, { id: `novo_${Date.now()}`, nome: novoCusto.nome.trim() || "Outro custo", sub: "você adicionou", valor: v, origem: "novo", categoria: "Outros", icone: "➕" }]);
                  setNovoCusto(null);
                }} className="h-[40px] px-4 rounded-[12px] font-bold text-[13.5px]" style={{ background: "var(--orbis-gold)", color: "#1A1200" }}>ADICIONAR</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setNovoCusto({ nome: "", valor: "" })} className="w-full h-[46px] rounded-[14px] mt-3 text-[13.5px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ border: "1px dashed rgba(245,184,0,.35)", color: "var(--orbis-gold)" }}>
            <Plus className="w-4 h-4" /> adicionar outro custo
          </button>
        )}

        <button onClick={salvarCustos} disabled={salvandoCustos || !custosCarregados} className="orbis-cta w-full mt-5">
          {salvandoCustos ? <Loader2 className="w-5 h-5 animate-spin" /> : "VER MEU RELATÓRIO"}
        </button>
        <p className="text-[11.5px] text-center mt-2.5" style={{ color: "var(--orbis-fg-3)" }}>Deixou em R$ 0? Então não conta.</p>
        <div className="mt-6 flex flex-col items-center gap-1">
          {onExtend && (
            <button onClick={reabrir} disabled={reabrindo} className="h-10 text-[13px] font-semibold inline-flex items-center gap-1.5" style={{ color: "var(--orbis-fg-3)" }}>
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar mais uma hora
            </button>
          )}
          {onRestart && !confirmarDescartar && (
            <button onClick={() => setConfirmarDescartar(true)} className="h-9 text-[12px]" style={{ color: "var(--orbis-fg-3)" }}>Voltar e reiniciar o DEFCON do zero</button>
          )}
          {onRestart && confirmarDescartar && (
            <div className="rounded-[14px] border p-3 w-full text-center" style={{ borderColor: "rgba(229,115,127,.32)" }}>
              <p className="text-[12.5px]" style={{ color: "var(--orbis-fg-2)" }}>Apaga as vendas de hoje e o dia sai da constância. Tem certeza?</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => { void onRestart(); }} className="flex-1 h-9 rounded-[10px] text-[12.5px] font-bold" style={{ background: "rgba(229,115,127,.15)", color: "var(--orbis-custo)" }}><RotateCcw className="w-3.5 h-3.5 inline mr-1" />Sim, reiniciar</button>
                <button onClick={() => setConfirmarDescartar(false)} className="flex-1 h-9 rounded-[10px] text-[12.5px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>Voltar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ============ 2 · RELATÓRIO ============ */
  if (passo === "relatorio") {
    const metodos: [string, number, string, ReactNode][] = [
      ["Dinheiro", porMetodo.dinheiro, "var(--orbis-ok)", <Banknote key="d" className="w-4 h-4" strokeWidth={2.1} />],
      ["Pix", porMetodo.pix, "var(--orbis-gold)", <Smartphone key="p" className="w-4 h-4" strokeWidth={2.1} />],
      ["Cartão", porMetodo.cartao, "var(--orbis-fg-2)", <CreditCard key="c" className="w-4 h-4" strokeWidth={2.1} />],
    ];
    const dataLabel = new Date(`${hoje}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").toUpperCase();
    return (
      <div className="min-h-[100dvh] bg-background pt-safe pb-safe px-5 pt-4 pb-10 max-w-md mx-auto orbis-stagger">
        <p className="orbis-mini">{dataLabel} · {naRua} NA RUA</p>
        <h1 className="font-display text-[22px] font-extrabold mt-1">Relatório do dia</h1>

        <div className="rounded-[24px] border mt-4 p-5" style={{ borderColor: bateu ? "rgba(61,214,140,.32)" : "rgba(245,184,0,.24)", background: "linear-gradient(165deg,#191308 0%,#101010 58%)", boxShadow: "0 24px 54px -32px rgba(245,184,0,.4)" }}>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 h-[24px] text-[10.5px] font-extrabold tracking-[.1em] uppercase"
            style={bateu ? { background: "rgba(61,214,140,.14)", color: "var(--orbis-ok)", border: "1px solid rgba(61,214,140,.3)" } : { background: "rgba(245,184,0,.12)", color: "var(--orbis-gold)", border: "1px solid rgba(245,184,0,.3)" }}>
            {bateu ? <><Check className="w-3 h-3" strokeWidth={3} /> Meta batida · {pctMeta}%</> : <>{pctMeta}% da meta</>}
          </span>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex-1 min-w-0">
              <p className="orbis-mini">Sobrou pra você</p>
              <p className="orbis-num mt-2 whitespace-nowrap" style={{ fontSize: "clamp(30px,8.8vw,38px)", fontWeight: 700, letterSpacing: "-.025em", color: lucro >= 0 ? "var(--orbis-fg)" : "var(--orbis-custo)" }}>{formatCurrency(lucro)}</p>
              <p className="text-[12px] mt-2.5" style={{ color: "var(--orbis-fg-2)" }}>De <b style={{ color: "var(--orbis-fg)" }}>{brl0(vendidoSemGorjeta)}</b> vendidos · margem <b style={{ color: margem >= 0 ? "var(--orbis-ok)" : "var(--orbis-custo)" }}>{Math.round(margem)}%</b></p>
            </div>
            <div className="w-[74px] h-[74px] rounded-full shrink-0 flex items-center justify-center" style={{ border: "7px solid rgba(255,255,255,.07)", boxShadow: bateu ? "0 0 24px -4px rgba(61,214,140,.5), inset 0 0 0 3px rgba(61,214,140,.9)" : "inset 0 0 0 3px rgba(245,184,0,.9)" }}>
              <span className="orbis-num text-[14px] font-extrabold">{Math.min(999, pctMeta)}%</span>
            </div>
          </div>
          <div className="h-px my-[18px]" style={{ background: "var(--orbis-line)" }} />
          <div className="flex">
            <div className="flex-1"><p className="orbis-mini">Vendido</p><p className="orbis-num text-[16px] font-bold mt-1.5">{brl0(vendidoSemGorjeta)}</p></div>
            <div className="flex-1 pl-3" style={{ borderLeft: "1px solid var(--orbis-line)" }}><p className="orbis-mini">Recebido</p><p className="orbis-num text-[16px] font-bold mt-1.5" style={{ color: "var(--orbis-ok)" }}>{brl0(recebido)}</p></div>
            <div className="flex-1 pl-3" style={{ borderLeft: "1px solid var(--orbis-line)" }}><p className="orbis-mini">Fiado</p><p className="orbis-num text-[16px] font-bold mt-1.5" style={{ color: fiado > 0 ? "var(--orbis-custo)" : "var(--orbis-fg-3)" }}>{brl0(fiado)}</p></div>
          </div>
        </div>

        {/* COMPARTILHAR — preto e dourado com o Instagram, logo acima de "como o dinheiro entrou" (Rick, 05/09) */}
        <button onClick={() => setMostrarShare((v) => !v)}
          className="w-full h-[54px] rounded-[16px] mt-5 font-extrabold text-[14.5px] inline-flex items-center justify-center gap-2.5 active:scale-[.98] transition"
          style={{ background: "#000", color: "var(--orbis-gold)", border: "1.5px solid var(--orbis-gold)", boxShadow: "0 10px 28px -14px rgba(245,184,0,.7)" }}>
          <Instagram className="w-5 h-5" strokeWidth={2.2} /> {mostrarShare ? "FECHAR ARTES" : "COMPARTILHAR RESULTADO"}
        </button>
        {mostrarShare && (
          <div className="mt-3">
            <DefconShareCarousel stats={{ faturamento: vendidoSemGorjeta, vendas: totalSalesCount, conversao: Math.round(conversao), horas: naRua }} />
          </div>
        )}

        {/* COMO O DINHEIRO ENTROU — editável: ele confere dinheiro / pix / cartão aqui,
            depois do corre. O fiado é a diferença, nunca digitado. */}
        <div className="flex items-center justify-between mt-6 px-1">
          <p className="orbis-section">Como o dinheiro entrou</p>
          {editandoRec ? (
            <button onClick={() => void salvarRecebimentos()} disabled={salvandoRec} className="text-[12px] font-bold inline-flex items-center gap-1" style={{ color: "var(--orbis-gold)" }}>
              {salvandoRec ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> salvar</>}
            </button>
          ) : (
            <button onClick={() => setEditandoRec(true)} className="text-[12px] font-semibold inline-flex items-center gap-1" style={{ color: "var(--orbis-fg-3)" }}>
              <Pencil className="w-3 h-3" /> corrigir
            </button>
          )}
        </div>
        <Bloco style={{ marginTop: 12 }}>
          {metodos.map(([nome, v, cor, ico], idx) => {
            const k = nome === "Dinheiro" ? "dinheiro" : nome === "Pix" ? "pix" : "cartao";
            return (
              <div key={nome} className="px-4 py-3.5" style={idx ? { borderTop: "1px solid var(--orbis-line)" } : undefined}>
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.05)", color: cor }}>{ico}</span>
                  <span className="flex-1 text-[14px] font-semibold">{nome}</span>
                  {editandoRec ? (
                    <CampoValor valor={rec[k as keyof typeof rec]} onChange={(t) => { setRec({ ...rec, [k]: t }); setRecSujo(true); }} destaque={!!rec[k as keyof typeof rec]} />
                  ) : (
                    <>
                      <span className="orbis-num text-[15px] font-bold" style={{ color: v > 0 ? cor : "var(--orbis-fg-3)" }}>{brl0(v)}</span>
                      <span className="orbis-num text-[11.5px] w-[34px] text-right" style={{ color: "var(--orbis-fg-3)" }}>{recebido > 0 ? Math.round((v / recebido) * 100) : 0}%</span>
                    </>
                  )}
                </div>
                {!editandoRec && (
                  <span className="block h-[3px] rounded-full mt-2.5" style={{ background: "rgba(255,255,255,.07)" }}>
                    <span className="block h-full rounded-full" style={{ width: `${recebido > 0 ? (v / recebido) * 100 : 0}%`, background: cor }} />
                  </span>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderTop: "1px solid var(--orbis-line)", background: fiado > 0 ? "rgba(229,115,127,.06)" : "rgba(0,0,0,.2)" }}>
            <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: fiado > 0 ? "rgba(229,115,127,.16)" : "rgba(255,255,255,.05)", color: fiado > 0 ? "var(--orbis-custo)" : "var(--orbis-fg-3)" }}><AlertTriangle className="w-4 h-4" strokeWidth={2.2} /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold">Fiado / calote</span>
              <small className="block text-[11.5px]" style={{ color: "var(--orbis-fg-3)" }}>vendeu {brl0(vendidoSemGorjeta)} · entrou {brl0(recebido)}</small>
            </span>
            <span className="orbis-num text-[15px] font-bold" style={{ color: fiado > 0 ? "var(--orbis-custo)" : "var(--orbis-fg-3)" }}>{brl0(fiado)}</span>
          </div>
          {recebido > vendidoSemGorjeta + 0.005 && (
            <p className="text-[12px] px-4 py-2.5" style={{ color: "var(--orbis-custo)", borderTop: "1px solid var(--orbis-line)" }}>Entrou mais do que você vendeu — confere os valores.</p>
          )}
        </Bloco>

        <p className="orbis-section mt-6 px-1">O seu dia</p>
        <div className="rounded-[20px] border mt-3 p-4" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
          <div className="grid grid-cols-3 gap-y-4">
            {([["Na rua", naRua, ""], ["Vendas", String(totalSalesCount), ""], ["Ticket", brl0(ticket), ""],
               ["Abord.", String(totalApproaches), ""], ["Conv.", `${Math.round(conversao)}%`, "var(--orbis-gold)"], ["Gorjetas", brl0(gorjetas), gorjetas > 0 ? "var(--orbis-ok)" : ""]] as [string, string, string][])
              .map(([rot, val, cor]) => (
                <div key={rot} className="text-center"><p className="orbis-mini">{rot}</p><p className="orbis-num text-[17px] font-bold mt-1.5" style={cor ? { color: cor } : undefined}>{val}</p></div>
              ))}
          </div>
        </div>

        {melhorBloco && melhorBloco.ini && (
          <div className="rounded-[16px] border mt-3 p-3.5 flex items-center gap-3" style={{ borderColor: "rgba(245,184,0,.24)", background: "rgba(245,184,0,.05)" }}>
            <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.12)", color: "var(--orbis-gold)" }}><Clock className="w-4 h-4" strokeWidth={2.2} /></span>
            <span className="flex-1 min-w-0">
              <b className="block text-[13.5px] font-semibold">Sua melhor hora: {fmtHora(melhorBloco.ini)}{melhorBloco.fim ? ` → ${fmtHora(melhorBloco.fim)}` : ""}</b>
              <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>{brl0(melhorBloco.sold)} num bloco só</small>
            </span>
          </div>
        )}

        <button onClick={() => void irParaMexeu()} disabled={salvandoRec} className="orbis-cta w-full mt-5">
          {salvandoRec ? <Loader2 className="w-5 h-5 animate-spin" /> : "VER O QUE ISSO MEXEU"}
        </button>
        <button onClick={() => setPasso("custos")} className="w-full h-10 mt-1 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ color: "var(--orbis-fg-3)" }}><ArrowLeft className="w-3.5 h-3.5" /> voltar aos custos</button>
      </div>
    );
  }

  /* ============ 3 · O QUE ESSE DIA MEXEU ============ */
  const dataLabel = new Date(`${hoje}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").toUpperCase();
  const faltamPraCima = rank?.acima ? Math.max(0, rank.acima.valor - rank.faturamento) : 0;
  const ritmoMes = rank && rank.dias > 0 ? (rank.faturamento / rank.dias) * 26 : 0;
  return (
    <div className="min-h-[100dvh] bg-background pt-safe pb-safe px-5 pt-4 pb-10 max-w-md mx-auto orbis-stagger">
      <p className="orbis-mini">{dataLabel}</p>
      <h1 className="font-display text-[22px] font-extrabold leading-tight mt-1">O que esse dia<br />mexeu no seu jogo</h1>

      {/* ranking */}
      <div className="rounded-[20px] border mt-4 p-4" style={{ borderColor: "rgba(245,184,0,.3)", background: "linear-gradient(120deg,rgba(70,52,10,.5),#0d0d0d)" }}>
        <div className="flex items-center gap-3.5">
          <span className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.14)", color: "var(--orbis-gold)" }}><Trophy className="w-6 h-6" strokeWidth={2} /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-[10.5px] font-extrabold tracking-[.13em] uppercase" style={{ color: "var(--orbis-gold)" }}>Ranking do mês</span>
            {rank?.posicao ? (
              <>
                <b className="block text-[15.5px] font-semibold mt-1">Você é o #{rank.posicao}</b>
                <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>{brl0(rank.faturamento)} no mês · {rank.total} vendedores</small>
              </>
            ) : (
              <>
                <b className="block text-[15.5px] font-semibold mt-1">Entrando no ranking</b>
                <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>a posição aparece em instantes</small>
              </>
            )}
          </span>
        </div>
        {rank?.acima && (
          <div className="flex items-center justify-between mt-3.5 pt-3.5" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <span className="text-[12.5px]" style={{ color: "var(--orbis-fg-2)" }}>Faltam <b style={{ color: "var(--orbis-gold)" }}>{brl0(faltamPraCima)}</b> pra passar {rank.acima.nome.split(" ")[0]}</span>
          </div>
        )}
      </div>

      {/* calote */}
      {fiado > 0 && (
        <div className="rounded-[20px] border mt-3 p-4" style={{ borderColor: "rgba(229,115,127,.3)", background: "rgba(229,115,127,.07)" }}>
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0" style={{ background: "rgba(229,115,127,.16)" }}><Coins className="w-[18px] h-[18px]" style={{ color: "var(--orbis-custo)" }} strokeWidth={2.2} /></span>
            <span className="flex-1 min-w-0">
              <b className="block text-[16px] font-bold" style={{ color: "var(--orbis-custo)" }}>{formatCurrency(fiado)}</b>
              <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>ficaram de pagar · quando cair, registra no "Caiu depois" pra voltar pro dia certo</small>
            </span>
          </div>
        </div>
      )}

      {/* constância */}
      <div className="rounded-[20px] border mt-3 p-4" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)" }}>
        <span className="inline-flex items-center gap-2 text-[14.5px] font-semibold">
          <Flame className="w-[17px] h-[17px]" strokeWidth={2.3} style={{ color: "var(--orbis-gold)" }} /> {rank?.dias ?? 0} {rank?.dias === 1 ? "dia trabalhado" : "dias trabalhados"} este mês
        </span>
        <p className="text-[12px] mt-2" style={{ color: "var(--orbis-fg-3)" }}>Hoje contou. A chama acende quando você abrir o início.</p>
      </div>

      {/* amanhã */}
      <div className="rounded-[18px] border mt-3 p-4" style={{ borderColor: "rgba(245,184,0,.24)", background: "linear-gradient(165deg,#181307 0%,var(--orbis-surface) 55%)" }}>
        <p className="orbis-section">Amanhã</p>
        {horaInicio != null && (
          <div className="flex items-center justify-between mt-2.5"><span className="text-[13px]" style={{ color: "var(--orbis-fg-2)" }}>Você começa às</span><b className="orbis-num text-[14px]">{String(horaInicio).padStart(2, "0")}h00</b></div>
        )}
        <div className="flex items-center justify-between mt-2"><span className="text-[13px]" style={{ color: "var(--orbis-fg-2)" }}>Meta do dia</span><b className="orbis-num text-[14px]">{brl0(dailyGoal)}</b></div>
        {ritmoMes > 0 && (
          <div className="flex items-center justify-between mt-2 pt-2.5" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}><span className="text-[13px]" style={{ color: "var(--orbis-fg-2)" }}>Nesse ritmo, o mês fecha em</span><b className="orbis-num text-[14px]" style={{ color: "var(--orbis-gold)" }}>{brl0(ritmoMes)}</b></div>
        )}
      </div>

      {userId && <div className="mt-3"><CompetitionStatementUpload userId={userId} /></div>}

      <button onClick={onExit} className="orbis-cta w-full mt-5">FECHAR O DIA</button>
      {onExtend && (
        <button onClick={reabrir} disabled={reabrindo} className="w-full h-[46px] rounded-[14px] mt-2.5 text-[13.5px] font-semibold inline-flex items-center justify-center gap-2" style={{ border: "1px solid rgba(255,255,255,.12)", color: "var(--orbis-fg-2)" }}>
          {reabrindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Voltar mais uma hora <ChevronRight className="w-4 h-4" /></>}
        </button>
      )}
      {onRestart && !confirmarDescartar && (
        <button onClick={() => setConfirmarDescartar(true)} className="w-full h-10 mt-1 text-[12.5px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>Voltar e reiniciar o DEFCON do zero</button>
      )}
      {onRestart && confirmarDescartar && (
        <div className="rounded-[14px] border p-3 mt-2 text-center" style={{ borderColor: "rgba(229,115,127,.32)" }}>
          <p className="text-[12.5px]" style={{ color: "var(--orbis-fg-2)" }}>Apaga as vendas de hoje e o dia sai da constância. Tem certeza?</p>
          <div className="flex gap-2 mt-2">
            <button onClick={() => { void onRestart(); }} className="flex-1 h-9 rounded-[10px] text-[12.5px] font-bold" style={{ background: "rgba(229,115,127,.15)", color: "var(--orbis-custo)" }}><RotateCcw className="w-3.5 h-3.5 inline mr-1" />Sim, reiniciar</button>
            <button onClick={() => setConfirmarDescartar(false)} className="flex-1 h-9 rounded-[10px] text-[12.5px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>Voltar</button>
          </div>
        </div>
      )}
      <button onClick={() => setPasso("relatorio")} className="w-full h-10 mt-1 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ color: "var(--orbis-fg-3)" }}><ArrowLeft className="w-3.5 h-3.5" /> ver o relatório de novo</button>
    </div>
  );
}
