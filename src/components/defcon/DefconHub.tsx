import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { getBrazilDate, getBrazilDateDaysAgo, getBrazilTime } from "@/shared/lib/date-utils";
import { formatCurrency } from "@/shared/lib/utils";
import { getTier } from "@/components/ranking/tier";
import { useToast } from "@/shared/hooks/use-toast";
import { generateDefconDayPDF } from "@/utils/generateDefconDayPDF";
import { DefconLoadoutManager } from "@/components/defcon/DefconLoadoutManager";
import { usePixDoBanco } from "@/components/conectar/banco-pix";
import { WeeklyChallengeIcon } from "@/components/competitions/WeeklyChallenge";
import { EditPlanningModal } from "@/components/EditPlanningModal";
import { RetomarLugar, SinalDeHoje } from "@/components/defcon/FocoExtras";
import { MissaoDoDia } from "@/components/jornada/MissaoDoDia";
import { garantirPlanoDoDia } from "@/shared/lib/plano-do-dia";
import { useMetaDoDia } from "@/hooks/useMetaDoDia";
import { useQueryClient } from "@tanstack/react-query";
import { ReplanejarMes, type TipoReplanejar } from "@/components/metas/ReplanejarMes";
import { MissaoAcoesSheet, NovoDesafioSheet, useSobrarMesQuery } from "@/features/objetivo-lucro";
import { conferirLugar, gravarMelhor, lerMelhor } from "@/components/defcon/retomar-lugar";
import { ArrowRight } from "lucide-react";
import { FocoCabecalho } from "./foco/foco-cabecalho";
import { FocoHero } from "./foco/foco-hero";
import { AcoesRapidas } from "./foco/acoes-rapidas";
import { MercadoriaDoDia } from "./foco/mercadoria-do-dia";
import { CustoRapido, type CustosDia } from "./foco/custo-rapido";
import { MesCard } from "./foco/mes-card";
import { MetaAdaptativaCard } from "./foco/meta-adaptativa-card";
import { travaPro, useAcessoQuery } from "@/shared/api/acesso";
import { mostraFaixas } from "@/shared/lib/meta-viavel";
import { ComoRecebeu } from "./foco/como-recebeu";
import { UltimasCompras } from "./foco/ultimas-compras";
import { useAcessoProdutosQuery } from "@/features/produtos";
import { AvisoRenovacaoPix } from "@/features/renovacao";
import { Utilitarios } from "./foco/utilitarios";
import { BlocosDeHoje } from "./foco/blocos-de-hoje";
import { CATEGORIAS_CUSTO, PRESS, type CategoriaCusto, type DayTotals, type ItemCarga } from "./foco/foco-tipos";

/* ============================================================
   FOCO — a central de execução do dia (redesign 18/10/2026).
   Ordem: cabeçalho → DEFCON → seu mês → ações rápidas → mercadoria → operação
   do dia (custo rápido, como recebeu) → últimas compras → utilitários.
   Cada função aparece UMA vez: compra só pelo atalho (e "Repor X"), ajustar a
   carga só pelo atalho, ajustar ontem só pelo atalho.
   Este arquivo carrega os dados e orquestra; cada bloco mora em ./foco/.
   ============================================================ */
export default function DefconHub() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const acessoProdutos = useAcessoProdutosQuery(user?.id);
  const produtosTravados = acessoProdutos.data?.liberado === false;
  const { toast } = useToast();
  const [dailyGoal, setDailyGoal] = useState(0);
  const [planId, setPlanId] = useState<string | null>(null);
  const [workHours, setWorkHours] = useState(8);
  const [totals, setTotals] = useState<DayTotals>({ cash: 0, card: 0, pix: 0, debt: 0, profit: 0, cost: 0, tips: 0, transport: 0, food: 0 });
  const [hasSession, setHasSession] = useState(false);
  // Sessão de ONTEM ainda aberta (virou meia-noite com o DEFCON rodando).
  const [overnightOpen, setOvernightOpen] = useState(false);
  // Deslocamento REAL (GPS) somado das sessões: semana (últimos 7 dias) e total geral.
  const [gps, setGps] = useState({ kmSemana: 0, minSemana: 0, kmTotal: 0, diasSemana: 0 });
  const [exporting, setExporting] = useState(false);
  const [pdfDate, setPdfDate] = useState(getBrazilDate()); // dia do PDF (padrão: hoje)
  const [quickCost, setQuickCost] = useState("");
  const [quickCostCat, setQuickCostCat] = useState<CategoriaCusto>("transporte");
  const [custoDescricao, setCustoDescricao] = useState("");
  const [outroHoje, setOutroHoje] = useState(0);
  const [mercHoje, setMercHoje] = useState(0); // quick-cost Mercadoria (personal_expenses), 21/10
  const [showEdit, setShowEdit] = useState(false);
  // Foco redesign (18/10): sheet da compra, carga em edição
  const [versaoCompras] = useState(0);
  const [editandoCarga, setEditandoCarga] = useState(false);
  const [custosOntem, setCustosOntem] = useState<CustosDia>({ mercadoria: 0, transporte: 0, alimentacao: 0, outro: 0 });
  const today = getBrazilDate();
  // meta viável (11/10): a meta do cérebro, as faixas e o replanejamento do mês
  const qc = useQueryClient();
  const { meta: metaViavel, replanejar, definirModo } = useMetaDoDia(user?.id, today);
  const acesso = useAcessoQuery(user?.id);
  const [replanOpen, setReplanOpen] = useState(false);
  // 29/10 (Rick): "a meta do mês continua faturamento, o objetivo é o lucro no bolso" —
  // SOBRAR no card do mês; a dica tocada no Foco abre o replanejamento já nela
  const [replanInicial, setReplanInicial] = useState<TipoReplanejar | null>(null);
  const sobrar = useSobrarMesQuery(user?.id);
  // 29/10: "Editar planejamento" pergunta lucro × faturamento; lucro abre a missão aqui mesmo
  const [desafioOpen, setDesafioOpen] = useState(false);
  const [missaoOpen, setMissaoOpen] = useState(false);
  const abrirReplanejar = (tipo?: TipoReplanejar) => { setReplanInicial(tipo ?? null); setReplanOpen(true); };
  // 13/10 (Rick): mudou a meta no Planejar e a conta nova diz que não chega no mês →
  // a Vant avisa e já abre o replanejamento (máximo / realista / manter).
  const acabouDePlanejar = useRef(false);
  useEffect(() => {
    if (!acabouDePlanejar.current || !metaViavel) return;
    acabouDePlanejar.current = false;
    if (metaViavel.status === "inviavel") setReplanOpen(true);
  }, [metaViavel]);

  /* ---- Foco v2 (Rick, 05/09): um card que muda com o momento do dia ---- */
  const [sessao, setSessao] = useState<{ id: string; status: string; current_block_index: number; total_blocks: number; started_at: string | null; ended_at: string | null; worked_minutes: number | null } | null>(null);
  const [blocoFimEm, setBlocoFimEm] = useState<number | null>(null); // ms: quando fecha a hora atual
  // trilha de blocos (Rick, 10/09 — prancha "Foco"): cada hora do dia como um degrau
  const [blocosHoje, setBlocosHoje] = useState<{ i: number; vendido: number; vendas: number; rodando: boolean; feito: boolean }[]>([]);
  const [contadores, setContadores] = useState({ vendas: 0, abord: 0 });
  const [ontem, setOntem] = useState({ vendido: 0, meta: 0 });
  const [semana, setSemana] = useState(0);
  const [rank, setRank] = useState<{ pos: number | null; dias: number; acimaValor: number | null }>({ pos: null, dias: 0, acimaValor: null });
  // RETOMAR MEU LUGAR (Lote 4): a melhor posição de hoje fica no aparelho; se caiu, avisa
  const [caiuDe, setCaiuDe] = useState<number | null>(null);
  const [horaInicio, setHoraInicio] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [carga, setCarga] = useState<ItemCarga[]>([]);
  // Banco que conta (Open Finance) — mesma regra do servidor (banco_conta_de_venda):
  // conta de trabalho, conta sem papel ou banco único. Pix e cartão vêm do banco,
  // então nem "Corrigir recebimentos" nem "Pix que caiu depois" aparecem (Rick, 18/10).
  // Antes só olhava papel = 'trabalho' e quem tinha um banco só via as edições à mão.
  const { pix: bancoDoDia } = usePixDoBanco(!!user?.id, 10 * 60_000);
  const temBancoTrabalho = bancoDoDia.temBanco;
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 30000); return () => clearInterval(id); }, []);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const loadAll = async () => {
    if (!user) return;
    const weekStart = getBrazilDateDaysAgo(6); // últimos 7 dias (hoje incluso)
    const [{ data: plan }, { data: sales }, { data: session }, { data: gpsRows }, { data: overnightSession }] = await Promise.all([
      supabase
        .from("daily_goal_plans")
        .select("id, daily_goal, work_hours")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
      supabase
        .from("daily_sales")
        .select("cash_sales, card_sales, pix_sales, total_debt, total_profit, cost, tip_sales, transport_cost, food_cost")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle(),
      supabase
        .from("challenge_sessions")
        .select("id, status, current_block_index, total_blocks, started_at, ended_at, worked_minutes")
        .eq("user_id", user.id)
        .eq("date", today)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("challenge_sessions")
        .select("date, distance_meters, worked_minutes")
        .eq("user_id", user.id),
      supabase
        .from("challenge_sessions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .is("ended_at", null)
        .eq("date", getBrazilDateDaysAgo(1))
        .maybeSingle(),
    ]);

    // Deslocamento GPS: soma metros/minutos das sessões. Semana = últimos 7 dias.
    {
      const rows = (gpsRows || []) as Array<{ date: string; distance_meters?: number | null; worked_minutes?: number | null }>;
      let distSemana = 0, minSemana = 0, distTotal = 0, diasSemana = 0;
      for (const r of rows) {
        const d = Number(r.distance_meters) || 0;
        distTotal += d;
        if (r.date >= weekStart) {
          distSemana += d;
          minSemana += Number(r.worked_minutes) || 0;
          if (d > 0) diasSemana += 1;
        }
      }
      setGps({ kmSemana: distSemana / 1000, minSemana, kmTotal: distTotal / 1000, diasSemana });
    }

    {
      // meta viável (11/10): o plano de hoje nasce da meta do cérebro (metas_dia)
      // e os blocos seguem a curva real de hora; plano velho é alinhado se o DEFCON não começou
      const p = await garantirPlanoDoDia(user.id, today);
      if (p) {
        setDailyGoal(Number(p.daily_goal));
        setPlanId(p.id);
        setWorkHours(Number(p.work_hours) || 8);
      }
      void qc.invalidateQueries({ queryKey: ["meta-do-dia"] });
    }

    setTotals({
      cash: Number((sales as any)?.cash_sales || 0),
      card: Number((sales as any)?.card_sales || 0),
      pix: Number((sales as any)?.pix_sales || 0),
      debt: Number((sales as any)?.total_debt || 0),
      profit: Number((sales as any)?.total_profit || 0),
      cost: Number((sales as any)?.cost || 0),
      tips: Number((sales as any)?.tip_sales || 0),
      transport: Number((sales as any)?.transport_cost || 0),
      food: Number((sales as any)?.food_cost || 0),
    });
    // "Outro" do Custo rápido mora em personal_expenses (categoria Outros), com a descrição
    {
      const { data: outros } = await supabase.from("personal_expenses").select("amount, category").eq("user_id", user.id).eq("date", today).in("category", ["Outros", "Mercadoria"]);
      const linhas = (outros as { amount: number | null; category: string | null }[] | null) ?? [];
      const soma = (cat: string) => linhas.filter((o) => o.category === cat).reduce((t, o) => t + (Number(o.amount) || 0), 0);
      setOutroHoje(soma("Outros"));
      setMercHoje(soma("Mercadoria"));
    }
    const sessaoHoje = ((session as any[]) || [])[0] ?? null;
    setHasSession(!!sessaoHoje);
    setSessao(sessaoHoje);
    // Só oferece "continuar o de ontem" na MADRUGADA (até 6h). De manhã em diante a
    // sessão velha é fechada sozinha ao abrir o DEFCON — dia novo começa limpo.
    const horaBR = parseInt(getBrazilTime().slice(0, 2), 10) || 0;
    setOvernightOpen(!!overnightSession && horaBR < 6);

    /* ---- Foco v2: bloco atual, contadores, ontem, semana, ranking, hora, carga ---- */
    const ontemData = getBrazilDateDaysAgo(1);
    const mes = today.slice(0, 7);
    const [bl, vl, ds7, planOntem, lb, plano, perfil, ld, prods] = await Promise.all([
      sessaoHoje ? supabase.from("challenge_blocks").select("block_index, started_at, ended_at, status, approaches_count, sales_count, sold_amount").eq("session_id", sessaoHoje.id).order("block_index", { ascending: true }) : Promise.resolve({ data: [] as any[] }),
      // Vendas-linha da sessão: é daqui que sai o valor EXATO de cada hora (sold_amount do bloco não é confiável).
      sessaoHoje ? supabase.from("defcon_sales").select("block_index, amount, method").eq("session_id", sessaoHoje.id) : Promise.resolve({ data: [] as any[] }),
      supabase.from("daily_sales").select("date, cash_sales, card_sales, pix_sales, total_debt, cost, transport_cost, food_cost").eq("user_id", user.id).gte("date", weekStart).lte("date", today),
      supabase.from("daily_goal_plans").select("daily_goal").eq("user_id", user.id).eq("date", ontemData).maybeSingle(),
      supabase.from("leaderboard_stats").select("posicao_faturamento, faturamento_total_mes, dias_trabalhados_mes").eq("user_id", user.id).eq("mes_referencia", mes).maybeSingle(),
      supabase.from("onboarding_planos").select("hora_inicio").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("nickname").eq("user_id", user.id).maybeSingle(),
      supabase.from("defcon_daily_loadout").select("product_id, product_name, qty_initial, qty_sold").eq("user_id", user.id).eq("date", today),
      supabase.from("products").select("id, sale_price, cost").eq("user_id", user.id).eq("is_active", true),
    ]);
    {
      const blocos = ((bl.data as any[]) || []);
      // Valor e nº de vendas por hora vêm das vendas-linha ligadas ao block_index (exclui gorjeta).
      const vendidoPorBloco: Record<number, number> = {};
      const vendasPorBloco: Record<number, number> = {};
      for (const v of ((vl.data as any[]) || [])) {
        if (v.method === "gorjeta") continue;
        const k = Number(v.block_index);
        if (!Number.isFinite(k)) continue;
        vendidoPorBloco[k] = (vendidoPorBloco[k] || 0) + (Number(v.amount) || 0);
        vendasPorBloco[k] = (vendasPorBloco[k] || 0) + 1;
      }
      // Qual hora está rodando / já passou: a sessão é a fonte da verdade
      // (blocos antigos nunca recebiam ended_at, então "feito" ficava sempre falso).
      const sessaoAtiva = sessaoHoje && (sessaoHoje.status === "active" || sessaoHoje.status === "running" || sessaoHoje.status === "paused");
      const idxAtual = Number(sessaoHoje?.current_block_index);
      const temIdx = Number.isFinite(idxAtual);
      setBlocosHoje(blocos.map((b) => {
        const k = Number(b.block_index) || 0;
        const fechado = !!b.ended_at || b.status === "done" || (temIdx && k < idxAtual) || (!!sessaoHoje?.ended_at);
        const rodando = !fechado && !!b.started_at && (!!sessaoAtiva && (!temIdx || k === idxAtual));
        return {
          i: k,
          vendido: vendidoPorBloco[k] ?? (Number(b.sold_amount) || 0),
          vendas: vendasPorBloco[k] ?? (Number(b.sales_count) || 0),
          rodando,
          feito: fechado,
        };
      }));
      const vendas = Object.values(vendasPorBloco).reduce((t, n) => t + n, 0) || blocos.reduce((t, b) => t + (Number(b.sales_count) || 0), 0);
      const abord = blocos.reduce((t, b) => t + (Number(b.approaches_count) || 0), 0);
      setContadores({ vendas, abord });
      const rodando = sessaoAtiva
        ? (blocos.find((b) => temIdx ? Number(b.block_index) === idxAtual && !!b.started_at && !b.ended_at : (b.status === "running" || (b.started_at && !b.ended_at))))
        : undefined;
      setBlocoFimEm(rodando?.started_at ? new Date(rodando.started_at).getTime() + 60 * 60000 : null);
    }
    {
      let sem = 0, ont = 0;
      for (const r of ((ds7.data as any[]) || [])) {
        // vendido = o que caiu (dinheiro + cartão + Pix) + o que ainda falta cair (total_debt)
        const v = (Number(r.cash_sales) || 0) + (Number(r.card_sales) || 0) + (Number(r.pix_sales) || 0) + (Number(r.total_debt) || 0);
        sem += v;
        if (r.date === ontemData) {
          ont += v;
          setCustosOntem({ mercadoria: 0, transporte: Number(r.transport_cost) || 0, alimentacao: Number(r.food_cost) || 0, outro: 0 });
        }
      }
      setSemana(sem);
      setOntem({ vendido: ont, meta: Number((planOntem.data as any)?.daily_goal) || 0 });
    }
    {
      const eu = lb.data as any;
      const pos = eu ? Number(eu.posicao_faturamento) || null : null;
      let acimaValor: number | null = null;
      if (pos && pos > 1) {
        const { data: ac } = await supabase.from("leaderboard_stats").select("faturamento_total_mes").eq("mes_referencia", mes).eq("posicao_faturamento", pos - 1).limit(1).maybeSingle();
        acimaValor = ac ? Math.max(0, (Number((ac as any).faturamento_total_mes) || 0) - (Number(eu.faturamento_total_mes) || 0)) : null;
      }
      setRank({ pos, dias: eu ? Number(eu.dias_trabalhados_mes) || 0 : 0, acimaValor });
      if (user?.id) {
        const dia = getBrazilDate();
        const r = conferirLugar(lerMelhor(user.id, dia), pos);
        gravarMelhor(user.id, dia, r.melhor);
        setCaiuDe(r.caiu > 0 ? r.melhor : null);
      }
    }
    const hi = (plano.data as any)?.hora_inicio;
    setHoraInicio(hi == null ? null : Number(hi));
    setNome(String((perfil.data as any)?.nickname || "").trim());
    {
      const ps = ((prods.data as any[]) || []);
      setCarga(((ld.data as any[]) || []).map((l) => {
        const p = ps.find((x) => x.id === l.product_id);
        return { nome: String(l.product_name || "produto"), levou: Number(l.qty_initial) || 0, vendeu: Number(l.qty_sold) || 0, preco: Number(p?.sale_price) || 0, custo: Number(p?.cost) || 0 };
      }));
    }
  };

  useEffect(() => {
    if (user) loadAll();
  }, [user, today]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("hub-daily-sales")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_sales", filter: `user_id=eq.${user.id}` },
        () => loadAll()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // VENDIDO (Rick, 04/10): é tudo que ele vendeu no DEFCON, inclusive o que
  // ainda não caiu na conta. Antes a Foco mostrava só o que caiu (dinheiro +
  // cartão + Pix) e o dia de R$ 880 aparecia como R$ 796. O que falta cair
  // (total_debt) entra no vendido e aparece separado embaixo.
  const totalCaiu = totals.cash + totals.card + totals.pix;
  const faltaCair = Math.max(0, totals.debt);
  const totalVendido = totalCaiu + faltaCair;

  // GPS da semana: pace (min/km) e velocidade real (km/h) a partir de km + minutos trabalhados.
  const gpsPaceMin = gps.kmSemana > 0 ? gps.minSemana / gps.kmSemana : null;
  const gpsVelocidade = gps.minSemana > 0 ? gps.kmSemana / (gps.minSemana / 60) : 0;
  const gpsPaceLabel = gpsPaceMin != null
    ? (() => { const s = Math.round(gpsPaceMin * 60); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; })()
    : null;

  const handlePDF = async () => {
    if (!user) return;
    setExporting(true);
    try {
      await generateDefconDayPDF(user.id, pdfDate);
      const label = pdfDate === getBrazilDate() ? "de hoje" : `de ${pdfDate.split("-").reverse().slice(0, 2).join("/")}`;
      toast({ title: "PDF gerado", description: `Relatório ${label} baixado com sucesso.` });
    } catch (e) {
      avisar.erro("DefconHub: gerar PDF", e);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleAddCost = async (valorDireto?: number) => {
    if (!user) return;
    const amount = valorDireto ?? parseFloat(quickCost);
    if (!amount || amount <= 0) return;
    // "Outro": gasto avulso com descrição — entra no relatório como "outros custos" e abate do líquido
    // "Mercadoria" (21/10, Mohamed): same table, category Mercadoria — the report counts it as mercadoria
    if (quickCostCat === "outro" || quickCostCat === "mercadoria") {
      const merc = quickCostCat === "mercadoria";
      const nomeGasto = merc ? "Mercadoria" : custoDescricao.trim();
      if (!nomeGasto) return;
      const { error: outroErr } = await supabase.from("personal_expenses").insert({
        user_id: user.id, name: nomeGasto.slice(0, 80), category: merc ? "Mercadoria" : "Outros", icon: merc ? "📦" : "🧾", amount, type: "variable", date: today,
      });
      if (outroErr) { avisar.usuario("Não consegui salvar o gasto. Tenta de novo.", outroErr, "DefconHub: gasto outro"); return; }
      setQuickCost(""); setCustoDescricao("");
      toast({ title: "Custo lançado", description: `${nomeGasto} · ${formatCurrency(amount)}` });
      loadAll();
      return;
    }
    // Cada categoria vai pra coluna certa do daily_sales — e TODAS entram no relatório
    // e ABATEM do líquido: mercadoria -> "Custo de mercadoria"; transporte/almoço ->
    // "Transporte e alimentação". (Antes ia pra personal_expenses e sumia do relatório.)
    const col = CATEGORIAS_CUSTO.find((c) => c.id === quickCostCat)?.col ?? "transport_cost";
    const { data: rows } = await supabase
      .from("daily_sales")
      .select("id, cost, transport_cost, food_cost")
      .eq("user_id", user.id)
      .eq("date", today)
      .order("created_at", { ascending: true })
      .limit(1);
    let costErr: unknown = null;
    if (rows && rows.length > 0) {
      const prev = Number((rows[0] as any)[col]) || 0;
      ({ error: costErr } = await supabase
        .from("daily_sales")
        .update({ [col]: prev + amount } as any)
        .eq("id", (rows[0] as any).id));
    } else {
      ({ error: costErr } = await supabase
        .from("daily_sales")
        .insert({ user_id: user.id, date: today, [col]: amount } as any));
    }
    if (costErr) {
      avisar.usuario("Não consegui salvar o gasto. Tenta de novo.", costErr, "DefconHub: gasto rápido");
      return;
    }
    setQuickCost("");
    const catLabel = CATEGORIAS_CUSTO.find((c) => c.id === quickCostCat)?.label ?? "Custo";
    toast({ title: "Custo lançado", description: `${catLabel} · ${formatCurrency(amount)}` });
    loadAll();
  };

  /* ---- Foco v2: derivados ---- */
  const estado: "antes" | "rodando" | "encerrado" = sessao?.status === "active" ? "rodando" : sessao ? "encerrado" : "antes";
  // faixas Mínimo · Meta · Turbo: só na meta adaptativa e quando o plano de hoje já segue ela
  // (trocou de modo com o DEFCON rodando → a régua volta no próximo DEFCON)
  const temFaixas = mostraFaixas(metaViavel) && !!metaViavel && Math.abs(metaViavel.meta - dailyGoal) < 1;
  const agora = Date.now();
  const minRestantes = blocoFimEm ? Math.max(0, Math.round((blocoFimEm - agora) / 60000)) : null;
  const blocoN = (Number(sessao?.current_block_index) || 0) + 1;
  const blocosTot = Number(sessao?.total_blocks) || 0;
  const conv = contadores.abord > 0 ? Math.min(100, Math.round((contadores.vendas / contadores.abord) * 100)) : 0;
  const pctOntem = ontem.meta > 0 ? Math.round((ontem.vendido / ontem.meta) * 100) : 0;
  const liga = rank.pos ? getTier(rank.pos) : null;
  const ligaLabel = liga ? liga.label.charAt(0) + liga.label.slice(1).toLowerCase() : "";
  const naRua = (() => { const m = Number(sessao?.worked_minutes) || 0; return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`; })();
  const projecao = estado === "rodando" && sessao?.started_at ? (() => { const h = Math.max(0.25, (agora - new Date(sessao.started_at).getTime()) / 3600000); return (totalVendido / h) * Math.max(h, blocosTot || workHours); })() : 0;
  const dataLabel = new Date(`${today}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "short" }).replace(/\./g, "").replace("-feira", "");
  if (loading || !user) return null;

  // compra de mercadoria = "Tô no mercado" (tela cheia de Produtos), volta pro Foco no fim
  const irAoMercado = () => navigate("/products/mercado?de=foco");

  const custosHoje: CustosDia = { mercadoria: mercHoje, transporte: totals.transport, alimentacao: totals.food, outro: outroHoje };

  return (
    <div className="pb-8 max-w-md mx-auto px-1 orbis-stagger">
      <FocoCabecalho estado={estado} dataLabel={dataLabel} nome={nome} diasNoMes={rank.dias} horaInicio={horaInicio}
        blocoN={blocoN} blocosTot={blocosTot} minRestantes={minRestantes} naRua={naRua} vendas={contadores.vendas} />

      <FocoHero estado={estado} meta={metaViavel} temFaixas={temFaixas}
        overnightOpen={overnightOpen} exporting={exporting}
        onEditar={() => setShowEdit(true)} onIrDefcon={() => navigate("/defcon")} onPDF={() => void handlePDF()}
        onMissao={estado === "antes" ? () => setMissaoOpen(true) : undefined}
        n={{
          dailyGoal, totalVendido, totalCaiu, faltaCair, lucro: totals.profit, workHours, blocosTot, projecao,
          ontem: ontem.vendido, pctOntem, semana, vendas: contadores.vendas, abord: contadores.abord, conv,
          rankPos: rank.pos, ligaCor: liga?.color ?? null, ligaLabel, horaInicio, ativoDesde: sessao?.started_at ?? null,
        }} />

      {/* o mês: com o que ele faz por dia, bate a meta final? (bloco próprio, não embola com a meta de hoje) */}
      {metaViavel && metaViavel.status !== "aprendendo" && (
        <MesCard m={metaViavel} onReplanejar={abrirReplanejar} sobrar={sobrar.data ?? null}
          onDefinirLucro={() => setDesafioOpen(true)} onProduto={() => navigate("/products")} />
      )}

      {/* 25/10: meta padrão = a do planejamento; a adaptativa (3 faixas) é opcional, a partir do 3º dia vendido */}
      <MetaAdaptativaCard m={metaViavel} estado={estado} salvando={definirModo.isPending}
        travado={travaPro(acesso)} onPro={() => navigate("/pro")}
        onTrocar={(adaptativa) => definirModo.mutate(adaptativa, { onSuccess: () => { void loadAll(); } })} />

      {/* Pix da renovação em aberto (Hotmart): paga aqui, sem procurar e-mail (23/10/2026) */}
      <AvisoRenovacaoPix className="mt-4" />

      <AcoesRapidas onMercado={irAoMercado} />

      {estado !== "antes" && <BlocosDeHoje blocos={blocosHoje} total={blocosTot || workHours} dailyGoal={dailyGoal} rodandoAgora={estado === "rodando"} />}

      {/* jornada do teste, retomar lugar, caça-sinal e a ponte do ranking — como antes */}
      {estado !== "rodando" && <MissaoDoDia />}
      {estado === "encerrado" && rank.pos && caiuDe != null && <RetomarLugar de={caiuDe} para={rank.pos} falta={rank.acimaValor} />}
      {estado === "antes" && <SinalDeHoje />}
      {estado === "encerrado" && rank.pos && caiuDe == null && (
        <button type="button" onClick={() => navigate("/ranking")} className={`w-full mt-3.5 flex items-center gap-2.5 px-3.5 py-3 rounded-[14px] text-left text-[12.5px] leading-snug ${PRESS}`} style={{ border: "1px dashed rgba(245,184,0,.35)", color: "var(--orbis-fg-2)" }}>
          <ArrowRight className="w-4 h-4 shrink-0" style={{ color: "var(--orbis-gold)" }} strokeWidth={2.4} />
          <span>Você está em <b style={{ color: "var(--orbis-gold)" }}>#{rank.pos}</b> este mês.{rank.acimaValor != null && rank.pos > 1 ? <> Faltam {formatCurrency(rank.acimaValor)} pra passar o #{rank.pos - 1} — </> : " "}<b style={{ color: "var(--orbis-gold)" }}>ver o ranking</b></span>
        </button>
      )}

      <div id="foco-mercadoria">
        {produtosTravados ? (
          <button type="button" onClick={() => navigate("/products")} className={`w-full mt-6 flex items-center gap-3 px-4 py-3.5 rounded-[18px] text-left ${PRESS}`}
            style={{ border: "1px solid rgba(245,184,0,.35)", background: "linear-gradient(170deg,#1a1305,var(--orbis-surf) 70%)" }}>
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] font-black tracking-[.14em]" style={{ color: "var(--orbis-gold)" }}>VANT PRO</span>
              <span className="block text-[14.5px] font-extrabold mt-0.5">Mercadoria e estoque do dia</span>
              <span className="block text-[12px] font-semibold" style={{ color: "var(--orbis-fg-3)" }}>o que levou, o que vendeu e o que acaba · libera no Pro</span>
            </span>
            <ArrowRight className="w-5 h-5 shrink-0" style={{ color: "var(--orbis-gold)" }} />
          </button>
        ) : (
        <MercadoriaDoDia estado={estado} carga={carga} editando={editandoCarga && estado === "antes"}
          onVerEstoque={() => navigate("/products")} onRepor={() => irAoMercado()}>
          <DefconLoadoutManager userId={user.id} />
          <button type="button" onClick={() => { setEditandoCarga(false); void loadAll(); }} className="mt-2 text-[12px] font-bold" style={{ color: "var(--orbis-gold)" }}>fechar</button>
        </MercadoriaDoDia>
        )}
      </div>

      <div className="mt-3"><WeeklyChallengeIcon /></div>

      <section id="foco-operacao" className="mt-6 px-0.5 scroll-mt-4" aria-label="Operação do dia">
        <p className="orbis-mini mb-2.5">Operação do dia</p>
        <CustoRapido estado={estado} categoria={quickCostCat} valor={quickCost} descricao={custoDescricao} hoje={custosHoje} ontem={custosOntem}
          onCategoria={setQuickCostCat} onValor={setQuickCost} onDescricao={setCustoDescricao} onLancar={() => void handleAddCost()}
          onRepetir={(c, v) => { setQuickCostCat(c); void handleAddCost(v); }} onChanged={() => void loadAll()} />
        {totalVendido > 0 && <ComoRecebeu userId={user.id} planId={planId} totals={totals} totalVendido={totalVendido} pelobanco={temBancoTrabalho} onChanged={() => void loadAll()} />}
      </section>

      <UltimasCompras userId={user.id} versao={versaoCompras} onChanged={() => void loadAll()} />

      <Utilitarios temBancoTrabalho={temBancoTrabalho} gps={{ kmSemana: gps.kmSemana, kmTotal: gps.kmTotal, diasSemana: gps.diasSemana, velocidade: gpsVelocidade, pace: gpsPaceLabel }}
        pdfDate={pdfDate} exporting={exporting} onPdfDate={setPdfDate} onPDF={() => void handlePDF()}
        onHistorico={() => navigate("/history")} />

      <EditPlanningModal userId={user.id} isOpen={showEdit} onSalvo={() => { acabouDePlanejar.current = true; }}
        onClose={() => { setShowEdit(false); void qc.invalidateQueries({ queryKey: ["meta-do-dia"] }); void loadAll(); }}
        onLucro={() => setDesafioOpen(true)} proTravado={travaPro(acesso)} onPro={() => navigate("/pro")} />
      <MissaoAcoesSheet open={missaoOpen} onOpenChange={(o) => { setMissaoOpen(o); if (!o) { void qc.invalidateQueries({ queryKey: ["meta-do-dia"] }); void sobrar.refetch(); void loadAll(); } }}
        onEditar={() => setDesafioOpen(true)} />
      <NovoDesafioSheet open={desafioOpen} onOpenChange={(o) => { setDesafioOpen(o); if (!o) { void sobrar.refetch(); void loadAll(); } }} />
      {metaViavel && (
        <ReplanejarMes aberto={replanOpen} onFechar={() => setReplanOpen(false)} m={metaViavel} salvando={replanejar.isPending}
          inicial={replanInicial} sobrar={sobrar.data ?? null} onVerFinancas={() => navigate("/finances")}
          onEscolher={(tipo) => { replanejar.mutate(tipo, { onSuccess: () => { setReplanOpen(false); void sobrar.refetch(); void loadAll(); } }); }} />
      )}
    </div>
  );
}
