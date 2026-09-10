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
     (Rick, 05/09 à noite: "o que mexeu" NÃO é passo separado — vem junto
      no relatório, embaixo de "Seu dia": a LIGA do ranking na cor dela,
      animação quando subiu de patente, botão pra ver o ranking e, por
      último, "Suas horas" — cada bloco com o valor REAL e exato.)

   OPEN FINANCE (Rick, 10/09): quem tem banco ligado (Orbis Pro) vê o Pix já
   preenchido com o que caiu na conta (banco_pix_do_dia + pluggy-sync). Digita
   só cartão e dinheiro; o calote é a diferença; o recebido vai pro ranking.
   Quem não tem banco continua lançando tudo na mão, como sempre.

   Por baixo é tudo o que já existia: onSaveBreakdown (divide os blocos e
   grava daily_sales + total_debt), personal_expenses, daily_sales.cost (CMV),
   leaderboard_stats, DefconShareCarousel. Nenhuma tabela nova.
   Regra da casa: todo hook ACIMA do primeiro return.
   ============================================================ */
import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  Banknote, Smartphone, CreditCard, ShoppingCart, Bus, Utensils, Package, Plus, Trash2,
  Clock, Trophy, Loader2, Instagram, RotateCcw, ArrowLeft, Star, PartyPopper, Target, Timer, UserRound, BarChart3, DollarSign, TrendingDown, HandCoins,
  ChevronRight, Landmark,
} from "lucide-react";
import { getTier, type Tier } from "@/components/ranking/tier";
import { AnimatedCurrency } from "@/shared/motion";
import { formatCurrency } from "@/shared/lib/utils";
import { toast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { DefconShareCarousel } from "./DefconShareCarousel";
import { CompetitionStatementUpload } from "./CompetitionStatementUpload";
import { VizinhosCard } from "@/components/x1/VizinhosCard";
import { ConciliacaoDia } from "@/components/financas/MercadoPagoConciliacao";
import { CobradorCard } from "@/components/cobranca/CobradorCard";

type Passo = "custos" | "relatorio";
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
const fmtH = (s: string) => fmtHora(s).replace(":00", "h").replace(":", "h");
// liga por "rank" (1 Bronze … 7 Lenda) → posição representativa → Tier com cor/escudo
const tierPorRank = (r: number): Tier => getTier(({ 7: 1, 6: 2, 5: 3, 4: 4, 3: 11, 2: 21, 1: 46 } as Record<number, number>)[r] ?? 46);
const CHAVE_LIGA = (uid: string) => `orbis_liga_vista_${uid}`;

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
function CampoValor({ valor, onChange, destaque, onBlur, largo }: { valor: string; onChange: (v: string) => void; destaque?: boolean; onBlur?: () => void; largo?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[12px] px-3 shrink-0 ${largo ? "h-[42px]" : "h-[38px]"}`}
      style={{ border: `1px solid ${destaque ? "rgba(245,184,0,.45)" : "rgba(255,255,255,.14)"}`, background: destaque ? "rgba(245,184,0,.06)" : "rgba(0,0,0,.35)" }}>
      <small className="text-[12px]" style={{ color: "var(--orbis-fg-3)" }}>R$</small>
      <input inputMode="decimal" value={valor} placeholder="0,00" onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
        className={`orbis-num bg-transparent outline-none text-right font-bold ${largo ? "w-[88px] text-[17px] font-extrabold" : "w-[76px] text-[16px]"}`} style={{ color: "var(--orbis-fg)" }} />
    </span>
  );
}
function Bloco({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="rounded-[20px] border overflow-hidden" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surf)", ...style }}>{children}</div>;
}

export function DefconFechamento({
  phase, totalSold, dailyGoal, totalApproaches = 0, totalSalesCount = 0, workedMinutes = 0,
  userId, onSaveBreakdown, onExit, onExtend, onRestart,
}: Props) {
  const [passo, setPasso] = useState<Passo>("custos");
  const [rec, setRec] = useState({ dinheiro: "", pix: "", cartao: "" });
  const [salvandoRec, setSalvandoRec] = useState(false);
  const [recSujo, setRecSujo] = useState(false);
  // OPEN FINANCE (Rick, 10/09): quem tem banco ligado vê o Pix já preenchido com o
  // que caiu de verdade na conta. Cartão e dinheiro ele digita; o calote sai da
  // conta (vendido − recebido) e é ESSE valor que vai pro ranking.
  const [banco, setBanco] = useState<{ tem: boolean; nome: string; total: number; qtd: number; ultima: string | null } | null>(null);
  const [bancoBuscando, setBancoBuscando] = useState(false);
  // o vendedor mexeu no Pix com a própria mão? então o banco não sobrescreve mais
  const pixEditadoRef = useRef(false);
  const [dsId, setDsId] = useState<string | null>(null);
  const [gorjetas, setGorjetas] = useState(0);
  const [linhas, setLinhas] = useState<CustoLinha[]>([]);
  const [custosCarregados, setCustosCarregados] = useState(false);
  const [novoCusto, setNovoCusto] = useState<{ nome: string; valor: string } | null>(null);
  const [salvandoCustos, setSalvandoCustos] = useState(false);
  const [vendas, setVendas] = useState<{ amount: number; method: string; late: boolean; created_at: string; block_index: number | null; session_id: string | null }[]>([]);
  const [blocos, setBlocos] = useState<{ i: number; sold: number; n: number; ini: string | null; fim: string | null }[]>([]);
  const [rank, setRank] = useState<{ posicao: number | null; faturamento: number; dias: number; acima: { nome: string; valor: number } | null; total: number } | null>(null);
  // carga do dia (Etapa 2): o que sobrou / o que acabou — unidades só aparecem AQUI, no fim
  const [carga, setCarga] = useState<{ nome: string; levou: number; vendeu: number }[]>([]);
  const [mostrarShare, setMostrarShare] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [confirmarDescartar, setConfirmarDescartar] = useState(false);
  // vendas por bloco (contagem) — "Suas horas" mostra valor E nº de vendas por bloco
  // patente: liga anterior guardada no aparelho → se subiu, roda a cena quando o card aparece
  const [subiuDe, setSubiuDe] = useState<Tier | null>(null);
  const [animar, setAnimar] = useState(false);
  const ligaRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const hoje = getBrazilDate();

  /* ---- carga inicial: o que já foi registrado hoje ---- */
  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    (async () => {
      const startISO = new Date(`${hoje}T00:00:00-03:00`).toISOString();
      const [ds, vd, pe, sess, lb, ld, euRow, cnt] = await Promise.all([
        supabase.from("daily_sales").select("id, cash_sales, card_sales, pix_sales, tip_sales, cost").eq("user_id", userId).eq("date", hoje).order("created_at", { ascending: true }).limit(1),
        supabase.from("defcon_sales").select("amount, method, late, created_at, block_index, session_id").eq("user_id", userId).gte("created_at", startISO).order("created_at", { ascending: true }),
        supabase.from("personal_expenses").select("id, name, amount, icon, category").eq("user_id", userId).eq("date", hoje).order("created_at", { ascending: true }),
        // TODAS as sessões de hoje (reiniciou / voltou mais uma hora): cada bloco é (sessão, índice)
        supabase.from("challenge_sessions").select("id, started_at, ended_at").eq("user_id", userId).eq("date", hoje).order("started_at", { ascending: true }),
        supabase.from("leaderboard_stats").select("user_id, nome_usuario, faturamento_total_mes, dias_trabalhados_mes, posicao_faturamento").eq("mes_referencia", hoje.slice(0, 7)).gt("dias_trabalhados_mes", 0).order("posicao_faturamento", { ascending: true }).limit(200),
        supabase.from("defcon_daily_loadout").select("product_name, qty_initial, qty_sold").eq("user_id", userId).eq("date", hoje),
        // a MINHA linha (mesmo se eu estiver além dos 200 primeiros) e quantos somos — posição real e exata
        supabase.from("leaderboard_stats").select("user_id, faturamento_total_mes, dias_trabalhados_mes, posicao_faturamento").eq("user_id", userId).eq("mes_referencia", hoje.slice(0, 7)).maybeSingle(),
        supabase.from("leaderboard_stats").select("user_id", { count: "exact", head: true }).eq("mes_referencia", hoje.slice(0, 7)).gt("dias_trabalhados_mes", 0),
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
      setVendas(((vd.data as any[]) || []).map((v) => ({ amount: Number(v.amount) || 0, method: String(v.method), late: !!v.late, created_at: v.created_at, block_index: v.block_index == null ? null : Number(v.block_index), session_id: v.session_id ?? null })));

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

      // "Suas horas": blocos de TODAS as sessões de hoje, vendas casadas por (sessão, bloco).
      // Bug antigo: pegava só a última sessão e somava as vendas de "bloco 0" de todas —
      // uma sessão de 1 minuto aparecia com 15 vendas. Bloco sem ended_at (encerrou no
      // meio) usa o fim da sessão ou a última venda dele como fim.
      const sessoes = ((sess.data as any[]) || []);
      const sids = sessoes.map((x) => x.id).filter(Boolean);
      if (sids.length) {
        const { data: bl } = await supabase.from("challenge_blocks").select("session_id, block_index, sold_amount, started_at, ended_at").in("session_id", sids).order("started_at", { ascending: true });
        if (!vivo) return;
        const soma: Record<string, number> = {}, cont: Record<string, number> = {}, ultima: Record<string, string> = {};
        for (const v of ((vd.data as any[]) || [])) {
          if (v.method === "gorjeta" || v.block_index == null || !v.session_id) continue;
          const k = `${v.session_id}:${Number(v.block_index)}`;
          soma[k] = (soma[k] || 0) + (Number(v.amount) || 0);
          cont[k] = (cont[k] || 0) + 1;
          ultima[k] = v.created_at;
        }
        const lista = ((bl as any[]) || [])
          .filter((b) => b.started_at)
          .map((b) => {
            const k = `${b.session_id}:${Number(b.block_index)}`;
            const sessao = sessoes.find((x) => x.id === b.session_id);
            return { sold: soma[k] ?? (Number(b.sold_amount) || 0), n: cont[k] || 0, ini: b.started_at as string, fim: (b.ended_at || sessao?.ended_at || ultima[k] || null) as string | null };
          })
          .sort((a, b) => new Date(a.ini).getTime() - new Date(b.ini).getTime());
        setBlocos(lista.map((b, i) => ({ i, ...b })));
      }

      // ranking: eu, quem está logo acima, quantos somos
      const lista = ((lb.data as any[]) || []);
      const eu = (euRow.data as any) || lista.find((l) => l.user_id === userId);
      const total = Number(cnt.count ?? lista.length) || lista.length;
      if (eu) {
        const pos = Number(eu.posicao_faturamento) || null;
        let acima = pos && pos > 1 ? lista.find((l) => Number(l.posicao_faturamento) === pos - 1) : null;
        if (pos && pos > 1 && !acima) {
          const { data: ac } = await supabase.from("leaderboard_stats").select("nome_usuario, faturamento_total_mes").eq("mes_referencia", hoje.slice(0, 7)).eq("posicao_faturamento", pos - 1).limit(1).maybeSingle();
          if (!vivo) return;
          acima = ac || null;
        }
        setRank({ posicao: pos, faturamento: Number(eu.faturamento_total_mes) || 0, dias: Number(eu.dias_trabalhados_mes) || 0, acima: acima ? { nome: String(acima.nome_usuario || "vendedor"), valor: Number(acima.faturamento_total_mes) || 0 } : null, total });
        // subiu de patente? compara com a liga da última vez que ele viu um relatório
        if (pos) {
          const agora = getTier(pos).rank;
          try {
            const antes = Number(localStorage.getItem(CHAVE_LIGA(userId)) || 0);
            if (antes > 0 && agora > antes) setSubiuDe(tierPorRank(antes));
            localStorage.setItem(CHAVE_LIGA(userId), String(agora));
          } catch { /* sem storage: sem cena, sem erro */ }
        }
      } else {
        setRank({ posicao: null, faturamento: 0, dias: 0, acima: null, total });
      }
      setCarga(((ld.data as any[]) || []).map((l) => ({ nome: String(l.product_name || "produto"), levou: Number(l.qty_initial) || 0, vendeu: Number(l.qty_sold) || 0 })));
    })().catch(() => { if (vivo) setCustosCarregados(true); });
    return () => { vivo = false; };
  }, [userId, hoje]);

  /* ---- banco (Open Finance): o que caiu de Pix hoje, direto da conta ---- */
  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    const ler = async (): Promise<boolean> => {
      try {
        const { data } = await (supabase as any).rpc("banco_pix_do_dia", { p_dia: hoje });
        const r = ((data as any[]) || [])[0];
        if (!vivo) return false;
        if (!r?.tem_banco) { setBanco({ tem: false, nome: "", total: 0, qtd: 0, ultima: null }); return false; }
        setBanco({ tem: true, nome: String(r.banco || ""), total: Number(r.total) || 0, qtd: Number(r.qtd) || 0, ultima: r.ultima_sync ?? null });
        return true;
      } catch { return false; }
    };
    const timers: ReturnType<typeof setTimeout>[] = [];
    (async () => {
      if (!(await ler())) return;
      // pede o extrato fresco. A Pluggy responde pelo webhook, então relê duas vezes depois.
      setBancoBuscando(true);
      try { await (supabase as any).functions.invoke("pluggy-sync"); } catch { /* sem banco fresco: fica o que tem */ }
      await ler();
      if (vivo) setBancoBuscando(false);
      timers.push(setTimeout(() => { if (vivo) void ler(); }, 20_000));
      timers.push(setTimeout(() => { if (vivo) void ler(); }, 50_000));
    })();
    return () => { vivo = false; timers.forEach(clearTimeout); };
  }, [userId, hoje]);

  // Pix vem preenchido do banco — só enquanto o vendedor não mexer nele com a mão.
  // Espera a carga do dia terminar (custosCarregados) pra não ser atropelado pelo
  // valor antigo do daily_sales.
  useEffect(() => {
    if (!banco?.tem || !custosCarregados || pixEditadoRef.current) return;
    // banco ainda sem nenhum Pix de hoje = provavelmente atrasado, não "zero":
    // não apaga o que o vendedor lançou. Só preenche quando o banco viu algo.
    if (banco.qtd <= 0) return;
    const texto = banco.total.toFixed(2).replace(".", ",");
    setRec((r) => {
      if (r.pix === texto) return r;
      return { ...r, pix: texto };
    });
    setRecSujo(true);
  }, [banco, custosCarregados]);

  /* ---- cena de patente: dispara quando o card entra na tela, uma vez só ---- */
  useEffect(() => {
    if (!subiuDe || animar || passo !== "relatorio") return;
    const el = ligaRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setAnimar(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setAnimar(true); io.disconnect(); } }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [subiuDe, animar, passo]);

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
  const unidadesVendidas = carga.reduce((t, c) => t + c.vendeu, 0);
  const sobras = carga.filter((c) => c.levou > 0).map((c) => ({ ...c, sobrou: Math.max(0, c.levou - c.vendeu) }));
  const acabou = sobras.filter((c) => c.sobrou === 0);
  const melhorBloco = useMemo(() => blocos.reduce<typeof blocos[number] | null>((m, b) => (b.sold > 0 && (!m || b.sold > m.sold) ? b : m), null), [blocos]);
  const totalBlocos = blocos.reduce((t, b) => t + b.sold, 0);
  const maxBloco = blocos.reduce((t, b) => Math.max(t, b.sold), 0);
  const ligaAtual = rank?.posicao ? getTier(rank.posicao) : null;
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
      return true;
    } catch (e: any) {
      toast({ title: "Não deu pra salvar", description: e?.message || "Tenta de novo.", variant: "destructive" });
      return false;
    } finally {
      setSalvandoRec(false);
    }
  };
  const fecharDia = async () => { if (await salvarRecebimentos()) onExit(); };

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

        {sobras.length > 0 && (
          <div className="rounded-[16px] border mt-3 p-3.5 flex items-start gap-3" style={{ borderColor: acabou.length ? "rgba(245,184,0,.28)" : "var(--orbis-line)", background: acabou.length ? "rgba(245,184,0,.05)" : "var(--orbis-surf)" }}>
            <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.12)", color: "var(--orbis-gold)" }}><Package className="w-4 h-4" strokeWidth={2.2} /></span>
            <span className="flex-1 min-w-0">
              <b className="block text-[13.5px] font-semibold">Sobrou: {sobras.map((c) => `${c.sobrou} ${c.nome}`).join(" · ")}</b>
              <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>
                {acabou.length ? `${acabou.map((c) => c.nome).join(", ")} acabou — precisa comprar mercadoria` : `${unidadesVendidas} unidades vendidas hoje`}
              </small>
            </span>
          </div>
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
      ["Pix", porMetodo.pix, "#00B1EA", <Smartphone key="p" className="w-4 h-4" strokeWidth={2.1} />],
      ["Cartão", porMetodo.cartao, "var(--orbis-fg-2)", <CreditCard key="c" className="w-4 h-4" strokeWidth={2.1} />],
      ["Dinheiro", porMetodo.dinheiro, "var(--orbis-ok)", <Banknote key="d" className="w-4 h-4" strokeWidth={2.1} />],
    ];
    const dataLabel = new Date(`${hoje}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").toUpperCase();
    return (
      <div className="min-h-[100dvh] bg-background pt-safe pb-safe px-5 pt-4 pb-10 max-w-md mx-auto orbis-stagger">
        {/* ===== O PRÊMIO — o total do dia, grande e dourado (Rick, 10/09):
            "o resultado total aparece como premiação, com animação". Conta de 0 até o
            valor (AnimatedCurrency) e pulsa 3x (orbis-victory). Roda uma vez, na entrada. ===== */}
        <section className="orbis-victory relative overflow-hidden rounded-[26px] border text-center mt-1"
          style={{
            ["--win-color" as string]: bateu ? "rgba(61,214,140,.55)" : "rgba(245,184,0,.55)",
            padding: "26px 18px 20px",
            borderColor: bateu ? "rgba(61,214,140,.45)" : "rgba(245,184,0,.4)",
            background: bateu
              ? "radial-gradient(120% 85% at 50% -10%,#0f3a22 0%,#0a1a10 40%,#0a0a0c 82%)"
              : "radial-gradient(120% 85% at 50% -10%,#4a3405 0%,#241a02 40%,#0a0a0c 82%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.08), 0 26px 60px -30px rgba(245,184,0,.5)",
          }}>
          <span className="absolute pointer-events-none" style={{
            left: "50%", top: -150, width: 540, height: 540, marginLeft: -270,
            background: "conic-gradient(from 200deg,transparent 0 18deg,rgba(245,184,0,.13) 18deg 24deg,transparent 24deg 46deg,rgba(245,184,0,.08) 46deg 52deg,transparent 52deg 74deg,rgba(245,184,0,.13) 74deg 80deg,transparent 80deg 360deg)",
          }} />
          <div className="relative">
            <p className="orbis-mini">{dataLabel} · {naRua} na rua · {totalSalesCount} {totalSalesCount === 1 ? "venda" : "vendas"}</p>
            <p className="orbis-label mt-3" style={{ color: bateu ? "var(--orbis-ok)" : "var(--orbis-gold)" }}>Você fez hoje</p>
            <p className="orbis-num mt-1.5 whitespace-nowrap" style={{ fontSize: "clamp(40px,12vw,52px)", fontWeight: 800, letterSpacing: "-.035em", lineHeight: 1.02, color: bateu ? "var(--orbis-ok)" : "var(--orbis-gold)" }}>
              <AnimatedCurrency value={vendidoSemGorjeta} />
            </p>
            <div className="inline-flex items-center gap-2 mt-3.5 h-8 px-3 rounded-full text-[11.5px] font-black tracking-[.08em] uppercase"
              style={bateu
                ? { color: "var(--orbis-ok)", background: "rgba(61,214,140,.14)", border: "1px solid rgba(61,214,140,.45)" }
                : { color: "var(--orbis-gold)", background: "rgba(245,184,0,.14)", border: "1px solid rgba(245,184,0,.45)" }}>
              {bateu ? <PartyPopper className="w-4 h-4" strokeWidth={2.4} /> : <Target className="w-4 h-4" strokeWidth={2.4} />}
              {dailyGoal <= 0 ? "Dia registrado" : pctMeta >= 150 ? "Explodiu a meta" : pctMeta >= 110 ? "Ultrapassou a meta" : bateu ? "Meta batida" : `${pctMeta}% da meta`}
            </div>
            {dailyGoal > 0 && (
              <p className="text-[13px] mt-2.5" style={{ color: "var(--orbis-fg-2)" }}>
                {bateu
                  ? <><b className="text-foreground">{formatCurrency(vendidoSemGorjeta - dailyGoal)}</b> acima da meta de {brl0(dailyGoal)}</>
                  : <>faltaram <b className="text-foreground">{formatCurrency(dailyGoal - vendidoSemGorjeta)}</b> pra meta de {brl0(dailyGoal)}</>}
              </p>
            )}
            {phase === "abandoned" && <p className="text-[12px] mt-1.5" style={{ color: "var(--orbis-fg-3)" }}>Desafio encerrado antes do tempo</p>}
          </div>
        </section>

        {/* ===== CAIU ATÉ AGORA × FALTA CAIR — o calote sai sozinho (Rick, 10/09) ===== */}
        <Bloco style={{ marginTop: 12, padding: "14px 16px 14px" }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="orbis-section" style={{ color: "var(--orbis-ok)" }}>Caiu até agora</p>
              <p className="orbis-num text-[24px] font-extrabold leading-none mt-1.5" style={{ color: "var(--orbis-ok)" }}>{formatCurrency(recebido)}</p>
            </div>
            <div className="text-right">
              <p className="orbis-section" style={{ color: fiado > 0.005 ? "var(--orbis-calote)" : "var(--orbis-fg-3)" }}>Falta cair</p>
              <p className="orbis-num text-[24px] font-extrabold leading-none mt-1.5" style={{ color: fiado > 0.005 ? "var(--orbis-calote)" : "var(--orbis-fg-3)" }}>
                {recebido > vendidoSemGorjeta + 0.005 ? "—" : formatCurrency(fiado)}
              </p>
            </div>
          </div>
          <div className="flex h-2 w-full rounded-full overflow-hidden mt-3 bg-white/10">
            <div className="orbis-fill h-full" style={{ width: `${vendidoSemGorjeta > 0 ? Math.min(100, (recebido / vendidoSemGorjeta) * 100) : 0}%`, background: "var(--orbis-ok)" }} />
            <div className="h-full flex-1" style={{ background: fiado > 0.005 ? "var(--orbis-calote)" : "transparent" }} />
          </div>
          <p className="text-[12.5px] mt-2" style={{ color: "var(--orbis-fg-2)" }}>
            {salvandoRec ? "salvando…"
              : recebido > vendidoSemGorjeta + 0.005 ? "Entrou mais do que você vendeu — confere os valores abaixo."
              : fiado > 0.005 ? <>{Math.round(vendidoSemGorjeta > 0 ? (recebido / vendidoSemGorjeta) * 100 : 0)}% do vendido já entrou · <b style={{ color: "var(--orbis-calote)" }}>{formatCurrency(fiado)}</b> {banco?.tem ? "não caíram na conta" : "não recebidos"} · fiado / calote</>
              : vendidoSemGorjeta > 0 ? <b style={{ color: "var(--orbis-ok)" }}>100% recebido</b>
              : "sem venda registrada hoje"}
          </p>
        </Bloco>

        {/* COMPARTILHAR — preto e dourado com o Instagram */}
        <button onClick={() => setMostrarShare((v) => !v)}
          className="w-full h-[54px] rounded-[16px] mt-3.5 font-extrabold text-[14.5px] inline-flex items-center justify-center gap-2.5 active:scale-[.98] transition"
          style={{ background: "#000", color: "var(--orbis-gold)", border: "1.5px solid var(--orbis-gold)", boxShadow: "0 10px 28px -14px rgba(245,184,0,.7)" }}>
          <Instagram className="w-5 h-5" strokeWidth={2.2} /> {mostrarShare ? "FECHAR ARTES" : "COMPARTILHAR RESULTADO"}
        </button>
        {mostrarShare && (
          <div className="mt-3">
            <DefconShareCarousel stats={{ faturamento: vendidoSemGorjeta, vendas: totalSalesCount, conversao: Math.round(conversao), horas: naRua }} />
          </div>
        )}

        {/* ===== CONFIRA SEUS RECEBIMENTOS — sempre editável; salva ao sair do campo ===== */}
        <p className="orbis-section mt-6 px-1">Confira seus recebimentos</p>
        <div className="rounded-[18px] border mt-3 px-4 py-3 flex items-center gap-3" style={{ borderColor: "rgba(245,184,0,.4)", background: "rgba(245,184,0,.06)" }}>
          <span className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.16)", color: "var(--orbis-gold)" }}><HandCoins className="w-5 h-5" strokeWidth={2.2} /></span>
          <span className="flex-1 min-w-0">
            <b className="block text-[12.5px] font-extrabold tracking-[.1em] uppercase" style={{ color: "var(--orbis-gold)" }}>Gorjetas</b>
            <small className="block text-[12.5px] mt-0.5" style={{ color: "var(--orbis-fg-2)" }}>Já incluídas no dinheiro</small>
          </span>
          <span className="orbis-num text-[19px] font-extrabold" style={{ color: "var(--orbis-gold)" }}>+{formatCurrency(gorjetas)}</span>
        </div>
        <Bloco style={{ marginTop: 12, padding: "0 16px" }}>
          {metodos.map(([nome, v, cor, ico], idx) => {
            const k = (nome === "Dinheiro" ? "dinheiro" : nome === "Pix" ? "pix" : "cartao") as keyof typeof rec;
            const ehPix = k === "pix";
            const pixDoBanco = ehPix && !!banco?.tem;
            const pixDivergente = pixDoBanco && Math.abs(recPix - (banco?.total ?? 0)) >= 0.005;
            return (
              <div key={nome} style={idx ? { borderTop: "1px solid var(--orbis-line)" } : undefined}>
                <div className="flex items-center gap-3 h-[62px]">
                  <span className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.06)", color: cor }}>{ico}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold">{nome}</span>
                    {pixDoBanco && (
                      <span className="block text-[11px] font-bold mt-0.5 truncate" style={{ color: pixDivergente ? "var(--orbis-fg-3)" : "#00B1EA" }}>
                        {bancoBuscando ? "conferindo no banco…"
                          : (banco?.qtd ?? 0) > 0 ? `${banco?.qtd} Pix ${banco?.qtd === 1 ? "caiu" : "caíram"} na conta · ${formatCurrency(banco?.total ?? 0)}`
                          : "nada caiu na conta hoje ainda"}
                      </span>
                    )}
                  </span>
                  <CampoValor largo valor={rec[k]} destaque={v > 0}
                    onChange={(t) => { if (ehPix) pixEditadoRef.current = true; setRec({ ...rec, [k]: t }); setRecSujo(true); }}
                    onBlur={() => void salvarRecebimentos()} />
                </div>
                {pixDivergente && !bancoBuscando && (
                  <button type="button"
                    onClick={() => { pixEditadoRef.current = false; setRec({ ...rec, pix: (banco?.total ?? 0) > 0 ? (banco?.total ?? 0).toFixed(2).replace(".", ",") : "" }); setRecSujo(true); }}
                    className="w-full -mt-2 pb-3 inline-flex items-center justify-center gap-1.5 text-[12px] font-extrabold" style={{ color: "#00B1EA" }}>
                    <Landmark className="w-3.5 h-3.5" strokeWidth={2.4} /> usar o que caiu na conta ({formatCurrency(banco?.total ?? 0)})
                  </button>
                )}
              </div>
            );
          })}
        </Bloco>
        {salvandoRec && (
          <p className="text-[13px] font-bold mt-3 flex items-center justify-center gap-2" style={{ color: "var(--orbis-fg-3)" }}><Loader2 className="w-4 h-4 animate-spin" /> salvando…</p>
        )}

        {/* ===== RELATÓRIO DO DIA — em lista, como o antigo ===== */}
        <p className="orbis-section mt-6 px-1">Relatório do dia</p>
        <Bloco style={{ marginTop: 12, padding: "0 16px" }}>
          {([
            ["Horas trabalhadas", naRua, "", <Timer key="h" className="w-[15px] h-[15px]" strokeWidth={2.2} />],
            ["Vendido", formatCurrency(vendidoSemGorjeta), "", <Banknote key="v" className="w-[15px] h-[15px]" strokeWidth={2.2} />],
            ["Abordagens", String(totalApproaches), "", <UserRound key="a" className="w-[15px] h-[15px]" strokeWidth={2.2} />],
            ["Vendas", String(totalSalesCount), "var(--orbis-ok)", <ShoppingCart key="s" className="w-[15px] h-[15px]" strokeWidth={2.2} />],
            ["Conversão", `${Math.round(conversao)}%`, conversao >= 30 ? "var(--orbis-ok)" : conversao >= 15 ? "var(--orbis-gold)" : "var(--orbis-custo)", <BarChart3 key="c" className="w-[15px] h-[15px]" strokeWidth={2.2} />],
            ["Ticket médio", brl0(ticket), "", <DollarSign key="t" className="w-[15px] h-[15px]" strokeWidth={2.2} />],
            ...(carga.length ? [["Unidades vendidas", String(unidadesVendidas), "", <Package key="u" className="w-[15px] h-[15px]" strokeWidth={2.2} />] as [string, string, string, ReactNode]] : []),
            ...(gorjetas > 0 ? [["Gorjetas", formatCurrency(gorjetas), "var(--orbis-gold)", <HandCoins key="g" className="w-[15px] h-[15px]" strokeWidth={2.2} />] as [string, string, string, ReactNode]] : []),
            ["Custos", custoTotal > 0 ? `− ${formatCurrency(custoTotal)}` : formatCurrency(0), custoTotal > 0 ? "var(--orbis-custo)" : "var(--orbis-fg-3)", <TrendingDown key="k" className="w-[15px] h-[15px]" strokeWidth={2.2} />],
          ] as [string, string, string, ReactNode][]).map(([rot, val, cor, ico], idx) => (
            <div key={rot} className="flex items-center gap-3 h-[56px]" style={idx ? { borderTop: "1px solid var(--orbis-line)" } : undefined}>
              <span className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.06)", color: "var(--orbis-fg-2)" }}>{ico}</span>
              <span className="flex-1 text-[15px] font-semibold" style={{ color: "var(--orbis-fg-2)" }}>{rot}</span>
              <span className="orbis-num text-[18px] font-extrabold" style={cor ? { color: cor } : undefined}>{val}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 h-[56px] -mx-4 px-4" style={{ borderTop: "1px solid var(--orbis-line)", background: lucro >= 0 ? "rgba(61,214,140,.06)" : "rgba(229,115,127,.06)" }}>
            <span className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0" style={{ background: lucro >= 0 ? "rgba(61,214,140,.15)" : "rgba(229,115,127,.15)", color: lucro >= 0 ? "var(--orbis-ok)" : "var(--orbis-custo)" }}><DollarSign className="w-[15px] h-[15px]" strokeWidth={2.4} /></span>
            <span className="flex-1 text-[15px] font-bold">Sobrou pra você</span>
            <span className="orbis-num text-[18px] font-extrabold" style={{ color: lucro >= 0 ? "var(--orbis-ok)" : "var(--orbis-custo)" }}>{formatCurrency(lucro)}</span>
          </div>
        </Bloco>

        {/* Cobrador de calote: gera o Pix de quem ficou devendo e abre o WhatsApp.
            O card some sozinho quando não há nada pra cobrar — por isso o título
            vive dentro dele, senão sobrava um cabeçalho órfão no fechamento. */}
        <CobradorCard userId={userId} faltouCair={fiado} />

        {/* Conciliação: o que você lançou × o que caiu de verdade no Mercado Pago */}
        <p className="orbis-section mt-6 px-1">Caiu na conta</p>
        <div className="mt-3"><ConciliacaoDia userId={userId} /></div>

        {/* ===== SUA LIGA NO RANKING — cor da liga, subiu de patente, ver ranking ===== */}
        <p className="orbis-section mt-6 px-1">Sua liga no ranking</p>
        <div ref={ligaRef}>
          {subiuDe && ligaAtual ? (
            <div className={`orbis-patente rounded-[26px] border mt-3 px-5 pt-6 pb-5 text-center relative overflow-hidden${animar ? " on" : ""}`}
              style={{ borderColor: ligaAtual.color + "80", background: `radial-gradient(90% 70% at 50% 20%, ${ligaAtual.glow}, transparent 65%), #0c0c0c` }}>
              <span className="orbis-patente-spark" style={{ left: 52, top: 44 }} /><span className="orbis-patente-spark" style={{ right: 64, top: 70, width: 4, height: 4 }} /><span className="orbis-patente-spark" style={{ left: 88, bottom: 90, width: 4, height: 4 }} /><span className="orbis-patente-spark" style={{ right: 44, bottom: 120 }} />
              <p className="orbis-mini" style={{ color: ligaAtual.color }}>Nova patente</p>
              <div className="orbis-patente-escudo mx-auto mt-2 relative w-[120px] h-[120px] flex items-center justify-center">
                <span className="absolute rounded-full" style={{ inset: -26, background: `radial-gradient(circle, ${ligaAtual.glow}, transparent 62%)` }} />
                <img src={subiuDe.icon} alt={subiuDe.label} className="orbis-patente-de absolute w-[104px] h-[104px] object-contain" />
                <img src={ligaAtual.icon} alt={ligaAtual.label} className="orbis-patente-para absolute w-[104px] h-[104px] object-contain" />
              </div>
              <p className="orbis-patente-linha mt-4 text-[11px] font-bold tracking-[.16em] uppercase inline-flex items-center gap-2.5" style={{ color: subiuDe.color }}>
                <span className="inline-block w-[22px] h-px" style={{ background: "rgba(255,255,255,.25)" }} /> {subiuDe.label} <ChevronRight className="w-3 h-3" strokeWidth={2.6} /> <span className="inline-block w-[22px] h-px" style={{ background: "rgba(255,255,255,.25)" }} />
              </p>
              <p className="orbis-patente-nome text-[34px] font-extrabold leading-none mt-1 tracking-[-.5px]" style={{ color: ligaAtual.color }}>{ligaAtual.label}</p>
              <p className="orbis-patente-msg text-[13px] mt-2.5 leading-relaxed" style={{ color: "var(--orbis-fg-2)" }}>
                {rank?.posicao ? <>Você é o <b className="text-foreground">#{rank.posicao}</b> de {rank.total} no Brasil este mês.</> : null}
              </p>
              <button onClick={() => navigate("/ranking")} className="orbis-patente-btn orbis-cta w-full mt-4"><Trophy className="w-4 h-4" strokeWidth={2.4} /> VER MEU LUGAR NO RANKING</button>
            </div>
          ) : (
            <>
              <div className="rounded-[24px] border mt-3 px-[18px] pt-[18px] pb-4 relative overflow-hidden"
                style={{ borderColor: (ligaAtual?.color ?? "#F2B43A") + "73", background: `radial-gradient(110% 80% at 20% 0%, ${ligaAtual?.glow ?? "rgba(242,180,58,.22)"}, transparent 60%), linear-gradient(170deg,#141414 0%,#0d0d0d 75%)` }}>
                <div className="flex items-center gap-3.5">
                  <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                    <span className="absolute rounded-full" style={{ inset: -10, background: `radial-gradient(circle, ${ligaAtual?.glow ?? "rgba(242,180,58,.45)"}, transparent 65%)` }} />
                    {ligaAtual ? <img src={ligaAtual.icon} alt={ligaAtual.label} className="relative w-[60px] h-[60px] object-contain" /> : <Trophy className="relative w-8 h-8" style={{ color: "var(--orbis-gold)" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10.5px] font-bold tracking-[.16em] uppercase" style={{ color: ligaAtual?.color ?? "var(--orbis-gold)" }}>Liga atual</p>
                    {ligaAtual && rank?.posicao ? (
                      <>
                        <p className="text-[26px] font-extrabold leading-[1.05] mt-0.5 tracking-tight" style={{ color: ligaAtual.color }}>{ligaAtual.label}</p>
                        <p className="text-[12.5px] mt-1" style={{ color: "var(--orbis-fg-2)" }}><b className="text-foreground">#{rank.posicao}</b> de {rank.total} no mês · <b className="text-foreground">{brl0(rank.faturamento)}</b> registrados</p>
                      </>
                    ) : (
                      <>
                        <p className="text-[20px] font-extrabold leading-tight mt-0.5">Entrando no ranking</p>
                        <p className="text-[12.5px] mt-1" style={{ color: "var(--orbis-fg-2)" }}>a posição aparece em instantes</p>
                      </>
                    )}
                  </div>
                </div>
                {rank?.acima && (
                  <>
                    <p className="text-[12.5px] mt-3.5 pt-3.5 leading-relaxed" style={{ borderTop: "1px solid rgba(255,255,255,.09)", color: "var(--orbis-fg-2)" }}>
                      Faltam <b className="text-foreground">{brl0(Math.max(0, rank.acima.valor - rank.faturamento))}</b> pra passar o <b className="text-foreground">#{(rank.posicao ?? 1) - 1}</b>{rank.acima.nome ? ` (${rank.acima.nome.split(" ")[0]})` : ""}. Mais um dia desses e você sobe.
                    </p>
                    <div className="h-1.5 rounded-full mt-2.5 overflow-hidden" style={{ background: "rgba(255,255,255,.09)" }}>
                      <div className="h-full rounded-full" style={{ width: `${rank.acima.valor > 0 ? Math.min(100, Math.round((rank.faturamento / rank.acima.valor) * 100)) : 0}%`, background: `linear-gradient(90deg, ${ligaAtual?.color ?? "#F2B43A"}99, ${ligaAtual?.color ?? "#F2B43A"})` }} />
                    </div>
                  </>
                )}
                {rank?.dias ? <p className="text-[11.5px] mt-3" style={{ color: "var(--orbis-fg-3)" }}>{rank.dias} {rank.dias === 1 ? "dia trabalhado" : "dias trabalhados"} este mês · hoje contou</p> : null}
              </div>
              <button onClick={() => navigate("/ranking")} className="orbis-cta w-full mt-3"><Trophy className="w-4 h-4" strokeWidth={2.4} /> VER O RANKING</button>
            </>
          )}
        </div>

        {/* Arena X1: "você vendeu mais que N vizinhos" + desafiar o mais próximo pra amanhã */}
        <VizinhosCard userId={userId} totalSold={totalSold} />

        {/* ===== SUAS HORAS — bloco a bloco, valor real e exato ===== */}
        {blocos.length > 0 && (
          <>
            <p className="orbis-section mt-6 px-1">Suas horas hoje</p>
            <Bloco style={{ marginTop: 12, padding: "4px 16px 14px" }}>
              {blocos.map((b, idx) => {
                const melhor = melhorBloco && b.i === melhorBloco.i && b.sold > 0;
                const n = b.n;
                return (
                  <div key={b.i} className="flex items-center gap-3 py-[11px]" style={idx ? { borderTop: "1px solid rgba(255,255,255,.06)" } : undefined}>
                    <span className="orbis-num w-[100px] shrink-0 text-[12px] font-bold leading-tight" style={{ color: "var(--orbis-fg-2)" }}>
                      {b.ini ? fmtH(b.ini) : `Bloco ${b.i + 1}`}{b.ini && b.fim ? ` – ${fmtH(b.fim)}` : ""}
                    </span>
                    <span className="flex-1 min-w-0">
                      {melhor && <span className="inline-flex items-center gap-1 text-[9.5px] font-extrabold tracking-[.1em] uppercase mb-1.5" style={{ color: "var(--orbis-gold)" }}><Star className="w-2.5 h-2.5" fill="currentColor" strokeWidth={0} /> sua melhor hora</span>}
                      <span className="block h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.07)" }}>
                        <span className="block h-full rounded-full" style={{ width: `${maxBloco > 0 ? (b.sold / maxBloco) * 100 : 0}%`, background: melhor ? "linear-gradient(90deg,#F5B800,#FFC63A)" : "rgba(255,255,255,.28)" }} />
                      </span>
                    </span>
                    <span className="w-[92px] shrink-0 text-right">
                      <span className="orbis-num block text-[14px] font-extrabold" style={{ color: melhor ? "var(--orbis-gold)" : b.sold > 0 ? "var(--orbis-fg)" : "var(--orbis-fg-3)" }}>{formatCurrency(b.sold)}</span>
                      <small className="block text-[10.5px] font-semibold mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>{b.sold > 0 ? `${n} ${n === 1 ? "venda" : "vendas"}` : "sem venda"}</small>
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-3 mt-1 text-[13px] font-semibold" style={{ borderTop: "1px solid rgba(255,255,255,.10)", color: "var(--orbis-fg-2)" }}>
                <span>{blocos.length} {blocos.length === 1 ? "bloco" : "blocos"} · {naRua} na rua</span>
                <b className="orbis-num text-[15px] font-extrabold text-foreground">{formatCurrency(totalBlocos)}</b>
              </div>
            </Bloco>
            {melhorBloco && melhorBloco.ini && totalBlocos > 0 && (
              <div className="rounded-[16px] border mt-3 px-[15px] py-[13px] flex items-center gap-3" style={{ borderColor: "rgba(245,184,0,.26)", background: "rgba(245,184,0,.06)" }}>
                <span className="w-[34px] h-[34px] rounded-[11px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.14)", color: "var(--orbis-gold)" }}><Clock className="w-4 h-4" strokeWidth={2.2} /></span>
                <span className="flex-1 min-w-0">
                  <b className="block text-[13.5px] font-bold">Das {fmtH(melhorBloco.ini)}{melhorBloco.fim ? ` às ${fmtH(melhorBloco.fim)}` : ""} você fez {Math.round((melhorBloco.sold / totalBlocos) * 100)}% do dia.</b>
                  <small className="block text-[12px] mt-0.5 leading-snug" style={{ color: "var(--orbis-fg-2)" }}>Amanhã esteja no ponto antes das {fmtH(melhorBloco.ini)} — é aí que o dinheiro aparece.</small>
                </span>
              </div>
            )}
          </>
        )}

        {userId && <div className="mt-4"><CompetitionStatementUpload userId={userId} /></div>}

        {/* ===== fim: fechar / +1h / reiniciar ===== */}
        <button onClick={() => void fecharDia()} disabled={salvandoRec} className="orbis-cta w-full mt-6">
          {salvandoRec ? <Loader2 className="w-5 h-5 animate-spin" /> : "FECHAR O DIA"}
        </button>
        {onExtend && (
          <button onClick={reabrir} disabled={reabrindo} className="w-full h-[50px] rounded-[16px] mt-2.5 text-[14px] font-bold inline-flex items-center justify-center gap-2" style={{ border: "1px solid rgba(245,184,0,.45)", color: "var(--orbis-gold)" }}>
            {reabrindo ? <Loader2 className="w-4 h-4 animate-spin" /> : "Voltar mais uma hora"}
          </button>
        )}
        {onRestart && !confirmarDescartar && (
          <button onClick={() => setConfirmarDescartar(true)} className="w-full h-[50px] rounded-[16px] mt-2.5 text-[14px] font-semibold" style={{ border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", color: "var(--orbis-fg-2)" }}>Voltar e reiniciar o DEFCON do zero</button>
        )}
        {onRestart && confirmarDescartar && (
          <div className="rounded-[14px] border p-3 mt-2.5 text-center" style={{ borderColor: "rgba(229,115,127,.32)" }}>
            <p className="text-[12.5px]" style={{ color: "var(--orbis-fg-2)" }}>Apaga as vendas de hoje e o dia sai da constância. Tem certeza?</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => { void onRestart(); }} className="flex-1 h-9 rounded-[10px] text-[12.5px] font-bold" style={{ background: "rgba(229,115,127,.15)", color: "var(--orbis-custo)" }}><RotateCcw className="w-3.5 h-3.5 inline mr-1" />Sim, reiniciar</button>
              <button onClick={() => setConfirmarDescartar(false)} className="flex-1 h-9 rounded-[10px] text-[12.5px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>Voltar</button>
            </div>
          </div>
        )}
        <button onClick={() => setPasso("custos")} className="w-full h-10 mt-2 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5" style={{ color: "var(--orbis-fg-3)" }}><ArrowLeft className="w-3.5 h-3.5" /> voltar aos custos</button>
      </div>
    );
  }

  return null;
}
