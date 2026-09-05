import { useEffect, useState, useRef, useMemo } from "react";
import { emitMissionEvent } from "@/shared/lib/missionEvents";
import { useTheme } from "next-themes";
import { formatCurrency } from "@/shared/lib/utils";
import { Plus, X, UtensilsCrossed, UserRound, FileText, Coins, Pause, MessageCircle, Phone, Minus, User, Package, Sun, Moon, Smartphone, CreditCard, ChevronLeft, ChevronRight, Camera, Check } from "lucide-react";
import { DefconBlock } from "@/hooks/useDefconChallenge";
import { DefconQuickSaleButtons } from "./DefconQuickSaleButtons";
import { DefconOccurrenceModal } from "./DefconOccurrenceModal";
import { DefconSmartNotification } from "./DefconSmartNotification";
import { DefconX1Live } from "./DefconX1Live";
import { DefconBlockReport } from "./DefconBlockReport";
import type { X1LiveState } from "@/hooks/useX1DefconAlert";
import QuickExpenseButton from "@/components/QuickExpenseButton";
import { supabase } from "@/integrations/supabase/client";
import { useDefconLoadout } from "@/hooks/useDefconLoadout";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { BRAND_COLORS } from "@/shared/lib/theme-colors";

/* Travas de lançamento — ver comentário no estado do componente. */
const CONFIRMA_ACIMA = 300;   // acima disso: pergunta antes
const TETO_VENDA = 50_000;    // acima disso: não registra

interface DefconRunningProps {
  userId: string;
  dailyGoal: number;
  totalSold: number;
  currentBlock: DefconBlock | null;
  currentBlockIndex: number;
  totalBlocks: number;
  remainingSeconds: number;
  blockStartedAt: Date | null;
  blockEndTime: Date | null;
  lunchPauseUsed: boolean;
  blockApproaches: number;
  totalApproaches: number;
  totalSalesCount: number;
  blockSalesCount: number;
  onAddSale: (amount: number, method?: "dinheiro" | "pix" | "cartao") => void;
  onAddApproach: () => void;
  onAddOccurrence: (description: string) => void;
  onEnd: () => void;
  onLunchPause: (minutes: number) => void;
  onAddTip?: (amount: number) => void;
  sessionSales?: any[];
  onDeleteSale?: (sale: any) => void;
  onboardingMode?: boolean;
  quickSaleValue?: number;
  /** X1 do dia (se houver): faixa de placar ao vivo + banner de virada na tela */
  x1Live?: X1LiveState;
}

export function DefconRunning({
  userId,
  dailyGoal,
  totalSold,
  currentBlock,
  currentBlockIndex,
  totalBlocks,
  remainingSeconds,
  blockStartedAt,
  blockEndTime,
  lunchPauseUsed,
  blockApproaches,
  totalApproaches,
  totalSalesCount,
  blockSalesCount,
  onAddSale,
  onAddApproach,
  onAddOccurrence,
  onEnd,
  onLunchPause,
  onAddTip,
  sessionSales = [],
  onDeleteSale,
  onboardingMode,
  quickSaleValue,
  x1Live,
}: DefconRunningProps) {
  const [showAddSale, setShowAddSale] = useState(false);
  const [saleValue, setSaleValue] = useState("");
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [showLunchPicker, setShowLunchPicker] = useState(false);
  const [customLunchMinutes, setCustomLunchMinutes] = useState("");
  const [showOccurrence, setShowOccurrence] = useState(false);
  /* ---- VENDA RÁPIDA POR DIA (Rick, 05/09) ----
     O histórico de valores vive no aparelho por usuário+dia: aparece já na
     PRIMEIRA venda, fica em todos os blocos, sobrevive a sair e voltar do DEFCON
     e zera sozinho no outro dia (a chave muda com a data). */
  const chaveVendaRapida = `orbis_venda_rapida_${userId || "treino"}_${getBrazilDate()}`;
  const [saleHistory, setSaleHistory] = useState<number[]>(() => {
    if (onboardingMode) return [];
    try { const v = JSON.parse(localStorage.getItem(chaveVendaRapida) || "[]"); return Array.isArray(v) ? v.map((x: any) => Number(x?.amount ?? x)).filter((n: number) => n > 0) : []; } catch { return []; }
  });
  // método usado por valor — a venda rápida repete o MESMO método (antes forçava pix)
  const metodoPorValorRef = useRef<Record<string, "dinheiro" | "pix" | "cartao">>((() => {
    if (onboardingMode) return {};
    try { const v = JSON.parse(localStorage.getItem(chaveVendaRapida) || "[]"); const m: Record<string, "dinheiro" | "pix" | "cartao"> = {}; if (Array.isArray(v)) for (const x of v) if (x?.amount && x?.method) m[String(Number(x.amount))] = x.method; return m; } catch { return {}; }
  })());
  const guardarVendaRapida = (lista: number[]) => {
    if (onboardingMode) return;
    try { localStorage.setItem(chaveVendaRapida, JSON.stringify(lista.slice(-200).map((a) => ({ amount: a, method: metodoPorValorRef.current[String(a)] ?? "dinheiro" })))); } catch { /* sem espaço: segue sem persistir */ }
  };
  const [showAddTip, setShowAddTip] = useState(false);
  const [tipValue, setTipValue] = useState("");
  const [showExpense, setShowExpense] = useState(false);
  const [salePhone, setSalePhone] = useState("");
  const [saleName, setSaleName] = useState("");
  const [showClientFields, setShowClientFields] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  // Quantas unidades saem nesta venda (bug antigo: sempre debitava 1 do estoque,
  // mesmo quando a venda era de 2+ unidades).
  const [saleQty, setSaleQty] = useState(1);
  const [pixCharge, setPixCharge] = useState<{ key: string; name: string } | null>(null);
  /* ---- TRAVAS DE LANÇAMENTO (01/09, pedido do Rick) ----
     CONFIRMA_ACIMA: acima disso o app PERGUNTA antes de registrar (pode ser um zero a
     mais). Hoje só 0,6% das vendas do app passam de R$ 300 — o vendedor comum nunca vê.
     TETO: acima disso é erro de digitação com certeza (teve gente registrando
     R$ 1,6 quatrilhão) — aí não passa. */
  const [confirmarValor, setConfirmarValor] = useState<null | { amount: number; method: "dinheiro" | "pix" | "cartao" }>(null);
  const [erroValor, setErroValor] = useState<string | null>(null);
  // Rajada: guarda a hora de cada venda registrada pra perceber toque repetido rápido.
  const rajadaRef = useRef<number[]>([]);
  const [rajada, setRajada] = useState<number | null>(null); // nº de vendas na rajada
  const [apagandoRajada, setApagandoRajada] = useState(false);
  const [saleMessage, setSaleMessage] = useState("");
  const [showChargePreview, setShowChargePreview] = useState(false);
  const [showBlockSales, setShowBlockSales] = useState(false);
  // Bloco que está sendo VISTO no modal (dá pra voltar nos blocos anteriores).
  const [viewBlockIndex, setViewBlockIndex] = useState(0);
  // Relatório/imagem de um bloco já feito (pra pegar o print depois).
  const [reportBlock, setReportBlock] = useState<
    { blockIndex: number; approaches: number; sales: number; soldAmount: number } | null
  >(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const { loadout, products: loadoutProducts, incrementSold } = useDefconLoadout(userId);

  /* ---- TABELA DE PREÇO POR QUANTIDADE (Etapa 2, Rick 05/09) ----
     Carrega as faixas (2 un R$ 30…) dos produtos da carga de hoje. A faixa de
     1 un é o sale_price do produto. Na folha de venda, o VALOR digitado casa com
     uma faixa → produto + quantidade certos → o estoque desconta o número certo. */
  const [tiers, setTiers] = useState<{ product_id: string; qty: number; price: number }[]>([]);
  useEffect(() => {
    const ids = loadout.map((l) => l.product_id).filter(Boolean);
    if (!ids.length) { setTiers([]); return; }
    let vivo = true;
    (supabase as any).from("product_price_tiers").select("product_id, qty, price").in("product_id", ids)
      .then(({ data }: any) => { if (vivo) setTiers(((data as any[]) || []).map((t) => ({ product_id: t.product_id, qty: Number(t.qty), price: Number(t.price) }))); })
      .catch(() => { if (vivo) setTiers([]); });
    return () => { vivo = false; };
  }, [loadout]);

  // Casa um valor com a tabela: produto + quantas unidades (venda rápida desconta certo
  // mesmo sem a folha de venda aberta: R$ 25 = 2 balas → baixa 2, conta 1 venda)
  const casarValor = (amount: number): { product_id: string; qty: number } | null => {
    for (const l of loadout) {
      const prod = loadoutProducts.find((p) => p.id === l.product_id);
      if (Math.abs((Number(prod?.sale_price) || 0) - amount) < 0.005) return { product_id: l.product_id, qty: 1 };
      const t = tiers.find((x) => x.product_id === l.product_id && Math.abs(x.price - amount) < 0.005);
      if (t) return { product_id: l.product_id, qty: t.qty };
    }
    return null;
  };
  const tiersQty = (amount: number): number => casarValor(amount)?.qty ?? 1;
  const saleValorNum = parseFloat(saleValue) || 0;
  // Casa o valor com a tabela: [{product, qty}] — prioriza o produto já selecionado
  const casado = useMemo(() => {
    if (!(saleValorNum > 0) || loadout.length === 0) return null;
    const cands: { product_id: string; nome: string; qty: number }[] = [];
    for (const l of loadout) {
      const prod = loadoutProducts.find((p) => p.id === l.product_id);
      const p1 = Number(prod?.sale_price) || 0;
      if (p1 > 0 && Math.abs(p1 - saleValorNum) < 0.005) cands.push({ product_id: l.product_id, nome: l.product_name, qty: 1 });
      for (const t of tiers) if (t.product_id === l.product_id && Math.abs(t.price - saleValorNum) < 0.005) cands.push({ product_id: l.product_id, nome: l.product_name, qty: t.qty });
    }
    if (!cands.length) return null;
    return cands.find((c) => c.product_id === selectedProductId) ?? cands[0]!;
  }, [saleValorNum, loadout, loadoutProducts, tiers, selectedProductId]);
  // Casou → produto e quantidade seguem a tabela
  useEffect(() => {
    if (casado) { setSelectedProductId(casado.product_id); setSaleQty(casado.qty); }
  }, [casado]);
  const { theme, setTheme } = useTheme();

  // Chave Pix padrao do usuario (das configuracoes) -> entra na cobranca do WhatsApp
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("pix_accounts")
      .select("pix_key, merchant_name, is_default")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (data && data.length) {
          const def = (data as any[]).find((a) => a.is_default) || data[0];
          if (def?.pix_key) setPixCharge({ key: def.pix_key, name: def.merchant_name || "" });
        }
      });
  }, [userId]);
  const isLight = theme === "light";

  // Auto-seleciona se houver só 1 produto no loadout
  useEffect(() => {
    if (loadout.length === 1) setSelectedProductId(loadout[0]!.product_id);
    else if (loadout.length === 0) setSelectedProductId(null);
  }, [loadout]);

  // Escape closes any open inline modal
  useEffect(() => {
    if (!showAddSale && !showLunchPicker && !showAddTip && !showBlockSales) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showAddSale) { setShowAddSale(false); resetSaleForm(); }
      else if (showLunchPicker) { setShowLunchPicker(false); setCustomLunchMinutes(""); }
      else if (showAddTip) { setShowAddTip(false); setTipValue(""); }
      else if (showBlockSales) { setShowBlockSales(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showAddSale, showLunchPicker, showAddTip, showBlockSales]);

  const [floaters, setFloaters] = useState<{ id: number; text: string; tone: "sale" | "tip" | "approach" }[]>([]);
  const [approachPulse, setApproachPulse] = useState(false);

  // isUrgent vem do remainingSeconds "grosso" (atualizado a cada ~15s pelo hook);
  // o contador VISUAL de segundo em segundo vive isolado no <BlockCountdown/> —
  // assim a tela inteira não re-renderiza a cada segundo.
  const isUrgent = remainingSeconds < 300; // last 5 minutes

  const remaining = Math.max(0, dailyGoal - totalSold);

  const formatTime = (date: Date | null) => {
    if (!date) return "--:--";
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  const sanitizePhone = (raw: string) => raw.replace(/\D/g, "");

  const persistClient = async (amount: number, method: "dinheiro" | "pix" | "cartao") => {
    if (onboardingMode) return;
    const name = saleName.trim();
    const phone = sanitizePhone(salePhone);
    if (!name && !phone) return;
    try {
      await supabase.from("defcon_clients").insert({
        user_id: userId,
        amount,
        method,
        customer_name: name || null,
        customer_phone: phone || null,
      });
    } catch (e) {
      console.warn("[defcon] failed to save client", e);
    }
  };

  const registerSale = (amount: number, method: "dinheiro" | "pix" | "cartao" = "dinheiro", qty = 1, productId?: string | null) => {
    onAddSale(amount, method); // 1 venda, 1 abordagem — mesmo sendo combo de 2 unidades
    metodoPorValorRef.current[String(amount)] = method;
    setSaleHistory((prev) => { const lista = [...prev, amount]; guardarVendaRapida(lista); return lista; });
    const tag = method === "pix" ? " 💸" : method === "cartao" ? " 💳" : "";
    pushFloater(`+${formatCurrency(amount)}${tag}`, "sale");
    // Debita do loadout/estoque na QUANTIDADE da venda (vendeu 2, baixa 2)
    const pid = productId ?? selectedProductId;
    if (!onboardingMode && pid) {
      incrementSold(pid, Math.max(1, qty)).catch((e) =>
        console.warn("[defcon] failed to debit loadout", e)
      );
    }
    // Onboarding: qualquer venda no DEFCON (rápida ou manual) avança a missão.
    emitMissionEvent("sale-registered");
    // Rajada: 4+ vendas em 6 segundos = provável toque repetido sem querer.
    // NÃO trava nada — só oferece desfazer (o vendedor pode estar mesmo vendendo
    // 4 unidades de uma vez pra um grupo).
    const agora = Date.now();
    rajadaRef.current = [...rajadaRef.current, agora].filter((t) => agora - t <= 6000);
    if (rajadaRef.current.length >= 4) setRajada(rajadaRef.current.length);
  };

  const resetSaleForm = () => {
    setSaleValue("");
    setSalePhone("");
    setSaleName("");
    setSaleMessage("");
    setSaleQty(1);
    setShowChargePreview(false);
    setShowClientFields(false);
    // Mantém o produto selecionado se houver só 1; reseta se múltiplos
    if (loadout.length > 1) setSelectedProductId(null);
  };

  const confirmarVenda = (amount: number, method: "dinheiro" | "pix" | "cartao") => {
    registerSale(amount, method, saleQty);
    persistClient(amount, method);
    resetSaleForm();
    setConfirmarValor(null);
    setErroValor(null);
    setShowAddSale(false);
  };

  const handleAddSale = (method: "dinheiro" | "pix" | "cartao" = "dinheiro") => {
    const amount = parseFloat(saleValue) || 0;
    if (!(amount > 0)) return;
    if (amount > TETO_VENDA) {
      setErroValor(`R$ ${amount.toLocaleString("pt-BR")} não passa. Confere se não sobrou um zero — o limite por venda é ${formatCurrency(TETO_VENDA)}.`);
      return;
    }
    if (amount > CONFIRMA_ACIMA) { setErroValor(null); setConfirmarValor({ amount, method }); return; }
    confirmarVenda(amount, method);
  };

  // Apaga as últimas N vendas (uso do cartão de rajada). Uma de cada vez —
  // cada exclusão ajusta o bloco no servidor.
  const apagarUltimas = async (n: number) => {
    if (!onDeleteSale) { setRajada(null); return; }
    setApagandoRajada(true);
    const ultimas = [...(sessionSales || [])]
      .sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())
      .slice(0, n);
    for (const v of ultimas) { await onDeleteSale(v); }
    rajadaRef.current = [];
    setApagandoRajada(false);
    setRajada(null);
  };

  // Mensagem padrao de cobranca: salva no aparelho e reusa. O valor fica como token
  // {valor} pra ser trocado pelo valor real de cada venda (nao "congela" um valor antigo).
  const chargeTplKey = `orbis_charge_body_v3_${userId}`;
  const VALOR_TOKEN = "{valor}";

  // Primeiro nome do cliente, ou "" se nao informado.
  const firstName = (name: string) => (name || "").trim().split(/\s+/)[0] || "";

  // Saudacao SEMPRE gerada na hora com o nome do cliente — nunca e salva no
  // padrao, por isso o nome nunca "congela" e sempre aparece quando preenchido.
  const greetingLine = (name: string) => {
    const fn = firstName(name);
    return fn ? `Olá ${fn}! 🙏` : `Olá! 🙏`;
  };

  // Corpo editavel/salvo (sem a saudacao). {valor} -> valor real da venda.
  const defaultChargeBody = () => {
    const pixLine = pixCharge?.key
      ? `Chave Pix: ${pixCharge.key}${pixCharge.name ? ` (${pixCharge.name})` : ""}`
      : `Chave Pix: (toque e digite sua chave Pix)`;
    return `Confirmando sua compra de ${VALOR_TOKEN}.\n\nPra finalizar, é só pagar no meu Pix 👇\n${pixLine}\n\nDepois me envia o comprovante por aqui, por favor!`;
  };

  const loadChargeBody = () => {
    try {
      const saved = localStorage.getItem(chargeTplKey);
      if (saved && saved.trim()) return saved;
    } catch (_e) { /* ignore */ }
    return defaultChargeBody();
  };

  // Mensagem pronta = saudacao (com o nome) + corpo (com o valor da venda).
  const buildChargeMessage = (amount: number, name: string) =>
    `${greetingLine(name)}\n\n${loadChargeBody().split(VALOR_TOKEN).join(formatCurrency(amount))}`;

  // Salva SO o corpo (tudo depois da 1a linha em branco), re-tokenizando o valor.
  // A saudacao com o nome nunca e salva — fica sempre dinamica.
  const saveChargeTemplate = (msg: string, amount: number, _name: string) => {
    try {
      const idx = msg.indexOf("\n\n");
      const body = idx >= 0 ? msg.slice(idx + 2) : msg;
      localStorage.setItem(chargeTplKey, body.split(formatCurrency(amount)).join(VALOR_TOKEN));
    } catch (_e) { /* ignore */ }
  };

  const openChargePreview = () => {
    const amount = parseFloat(saleValue) || 0;
    if (amount <= 0 || sanitizePhone(salePhone).length < 10) return;
    setSaleMessage(buildChargeMessage(amount, saleName));
    setShowChargePreview(true);
  };

  const confirmCharge = () => {
    const amount = parseFloat(saleValue) || 0;
    const digits = sanitizePhone(salePhone);
    if (amount <= 0 || digits.length < 10) return;
    const phone = digits.startsWith("55") ? digits : `55${digits}`;
    const text = saleMessage.trim() ? saleMessage : buildChargeMessage(amount, saleName);
    saveChargeTemplate(text, amount, saleName);
    // Cobrança por WhatsApp é sempre PIX (a mensagem manda a chave Pix) — antes
    // registrava como "dinheiro" e o valor caía errado no split do fim do dia.
    registerSale(amount, "pix", saleQty);
    persistClient(amount, "pix");
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
    setShowChargePreview(false);
    resetSaleForm();
    setShowAddSale(false);
  };

  const blockSold = currentBlock
    ? (currentBlock.valor_dinheiro + currentBlock.valor_cartao + currentBlock.valor_pix + currentBlock.valor_calote)
    : 0;

  const conversionRate = blockApproaches > 0 ? Math.round((blockSalesCount / blockApproaches) * 100) : 0;

  const pushFloater = (text: string, tone: "sale" | "tip" | "approach") => {
    const id = Date.now() + Math.random();
    setFloaters((p) => [...p, { id, text, tone }]);
    setTimeout(() => setFloaters((p) => p.filter((f) => f.id !== id)), 1100);
  };

  const handleApproachClick = () => {
    onAddApproach();
    emitMissionEvent("approach-added");
    setApproachPulse(true);
    setTimeout(() => setApproachPulse(false), 280);
    pushFloater("+1", "approach");
  };

  const handleAddTip = () => {
    const amount = parseFloat(tipValue) || 0;
    if (amount > 0) {
      // gorjeta entra em valor_gorjeta + dinheiro (separada para relatório)
      onAddTip?.(amount);
      setSaleHistory((prev) => [...prev, amount]);
      pushFloater(`+${formatCurrency(amount)} 🎯`, "tip");
      setTipValue("");
      setShowAddTip(false);
    }
  };

  // Vendas-linha do bloco que está sendo VISTO (permite navegar nos blocos anteriores).
  const blockSales = (sessionSales || []).filter(
    (s) => Number(s?.block_index) === viewBlockIndex
  );
  const vendoBlocoAtual = viewBlockIndex === currentBlockIndex;

  // Abre o relatório (com a imagem de compartilhamento) do bloco escolhido.
  // No bloco atual usa os contadores ao vivo; nos anteriores busca em challenge_blocks.
  const abrirImagemBloco = async (idx: number) => {
    setLoadingReport(true);
    try {
      const somaBloco = (sessionSales || [])
        .filter((s) => Number(s?.block_index) === idx)
        .reduce((t, s) => t + (Number(s?.amount) || 0), 0);

      if (idx === currentBlockIndex) {
        setReportBlock({ blockIndex: idx, approaches: blockApproaches, sales: blockSalesCount, soldAmount: somaBloco });
        return;
      }

      const sid = (sessionSales || []).find((s) => s?.session_id)?.session_id;
      let approaches = 0;
      let salesCount = 0;
      if (sid) {
        const { data } = await supabase
          .from("challenge_blocks")
          .select("approaches_count, sales_count")
          .eq("session_id", sid)
          .eq("block_index", idx)
          .maybeSingle();
        approaches = Number((data as { approaches_count?: number } | null)?.approaches_count || 0);
        salesCount = Number((data as { sales_count?: number } | null)?.sales_count || 0);
      }
      setReportBlock({ blockIndex: idx, approaches, sales: salesCount, soldAmount: somaBloco });
    } finally {
      setLoadingReport(false);
    }
  };

  // Horário curto (HH:mm) a partir do created_at da venda.
  const saleTime = (iso: string | null | undefined) => {
    if (!iso) return "--:--";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "--:--";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const methodLabel = (m: string) =>
    m === "pix" ? "Pix" : m === "cartao" ? "Cartão" : m === "gorjeta" ? "Gorjeta" : "Dinheiro";

  const handleDeleteSale = (sale: any) => {
    if (!onDeleteSale) return;
    const ok = window.confirm(
      `Excluir esta venda de ${formatCurrency(Number(sale?.amount) || 0)}? Isso ajusta o faturado do bloco.`
    );
    if (ok) onDeleteSale(sale);
  };

  // Frase de impacto inteligente — empurra ação concreta
  const avgTicket =
    totalSalesCount > 0 ? totalSold / totalSalesCount : saleHistory.length > 0 ? saleHistory[saleHistory.length - 1]! : 0;
  const salesNeeded = avgTicket > 0 ? Math.ceil(remaining / avgTicket) : 0;
  const impactPhrase =
    remaining <= 0
      ? "Meta batida. Continue empilhando."
      : totalSold === 0
      ? "Sem ação, sem dinheiro."
      : isUrgent
      ? "Acelera esse bloco."
      : salesNeeded > 0 && avgTicket > 0
      ? `Faltam ${salesNeeded} ${salesNeeded === 1 ? "venda" : "vendas"} de ${formatCurrency(Math.round(avgTicket))}`
      : conversionRate > 0 && conversionRate < 15
      ? "Mais abordagem = mais venda."
      : "Mais 1 venda agora.";

  // Confirm end screen
  if (showConfirmEnd) {
    return (
      <div className="min-h-[100dvh] bg-background pt-safe pb-safe flex flex-col items-center justify-center px-6 select-none">
        <div className="text-center space-y-3 mb-8">
          <div className="text-6xl">⚠️</div>
          <div className="text-xl font-bold text-foreground">Encerrar o desafio?</div>
          <p className="text-sm text-muted-foreground font-mono">
            Você perde a streak. Tem certeza?
          </p>
        </div>
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={onEnd}
            className="w-full h-14 bg-destructive text-destructive-foreground font-black text-lg rounded-xl active:scale-95 transition-transform"
          >
            SIM, ENCERRAR
          </button>
          <button
            onClick={() => setShowConfirmEnd(false)}
            className="w-full h-14 bg-card border border-border text-muted-foreground font-bold text-lg rounded-xl active:scale-95 transition-transform"
          >
            VOLTAR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] bg-background pt-safe pb-safe flex flex-col overflow-hidden select-none">
      {/* Smart approach notifications */}
      <DefconSmartNotification
        userId={userId}
        totalApproaches={totalApproaches}
        totalSalesCount={totalSalesCount}
        blockApproaches={blockApproaches}
        blockSalesCount={blockSalesCount}
        phase="running"
        currentBlockIndex={currentBlockIndex}
      />
      {/* Toggle de tema (claro/escuro) — pro vendedor trocar ali no modo foco */}
      <button
        onClick={() => setTheme(isLight ? "dark" : "light")}
        className="absolute right-3 z-50 w-9 h-9 rounded-full bg-foreground/10 border border-border flex items-center justify-center text-muted-foreground active:scale-90 transition"
        style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}
        aria-label={isLight ? "Tema escuro" : "Tema claro"}
      >
        {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </button>

      {/* Mission header — compacto para dar espaço ao timer */}
      <div data-tour="defcon-missao" className="pt-7 pb-2 px-6 text-center">
        <div className="text-xs font-mono text-muted-foreground tracking-[0.3em] uppercase mb-1">
          🔥 MISSÃO
        </div>
        <div className="text-2xl md:text-3xl font-black text-foreground tracking-tight leading-tight">
          Faltam <span className="text-primary">{formatCurrency(Math.max(0, remaining))}</span> para a meta
        </div>
        <div className="mt-1 text-xs font-mono text-muted-foreground">
          Meta: {formatCurrency(dailyGoal)} • Feito: <span className="text-success">{formatCurrency(totalSold)}</span>
        </div>
        {/* X1 ao vivo — placar simultâneo ao DEFCON + banner quando a liderança vira */}
        {x1Live && (
          <div className="mt-2 flex justify-center">
            <DefconX1Live x1={x1Live} />
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-between px-5 pb-2 gap-3 relative">
        {/* Floating feedback */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {floaters.map((f) => (
            <div
              key={f.id}
              className={`absolute left-1/2 -translate-x-1/2 top-[42%] font-black text-2xl animate-fade-in ${
                f.tone === "sale" ? "text-success" : f.tone === "tip" ? "text-primary" : "text-foreground/80"
              }`}
              style={{ animation: "fire-rise 1s ease-out forwards" }}
            >
              {f.text}
            </div>
          ))}
        </div>

        {/* Block label */}
        <div className="text-xs font-mono text-muted-foreground/70 tracking-[0.3em] uppercase">
          Bloco #{currentBlockIndex + 1} • {formatTime(blockStartedAt)} → {formatTime(blockEndTime)}
        </div>

        {/* Timer — elemento dominante. Auto-suficiente: tem o próprio tick de 1s,
            então SÓ ele re-renderiza a cada segundo (não a tela inteira). */}
        <div data-tour="defcon-timer" className="w-full flex justify-center">
          <BlockCountdown blockStartedAt={blockStartedAt} />
        </div>

        {/* Bloco info — métricas em colunas com label. flex-wrap + gaps menores +
            fonte fluida: em telas estreitas (320–360px) nada estoura pro lado. */}
        <div data-tour="defcon-placar" className="w-full flex flex-nowrap items-center justify-center gap-x-2.5 px-1">
          {/* Faturado */}
          <div className="flex flex-col items-center gap-0.5 min-w-0">
            <span className="text-[9px] font-mono text-muted-foreground/70 tracking-[0.1em] uppercase">Bloco</span>
            <span className="font-black text-success text-[clamp(13px,3.8vw,17px)] font-mono tabular-nums leading-none">
              {formatCurrency(blockSold)}
            </span>
          </div>

          <span className="w-px h-7 bg-border shrink-0" />

          {/* Vendas — tocável: abre o detalhe por venda do bloco */}
          <button
            type="button"
            onClick={() => { setViewBlockIndex(currentBlockIndex); setShowBlockSales(true); }}
            aria-label="Ver vendas deste bloco"
            className="flex flex-col items-center gap-0.5 active:scale-95 transition-transform"
          >
            <span className="text-[9px] font-mono text-muted-foreground/70 tracking-[0.1em] uppercase">Vendas</span>
            <span className="font-black text-foreground text-[clamp(13px,3.8vw,17px)] font-mono tabular-nums leading-none underline decoration-dotted decoration-foreground/30 underline-offset-4">
              {blockSalesCount}
            </span>
          </button>

          <span className="w-px h-7 bg-border shrink-0" />

          {/* Abordagens */}
          <div className={`flex flex-col items-center gap-0.5 transition-transform ${approachPulse ? "scale-110" : ""}`}>
            <span className="text-[9px] font-mono text-muted-foreground/70 tracking-[0.1em] uppercase">Abord.</span>
            <span className="font-black text-foreground text-[clamp(13px,3.8vw,17px)] font-mono tabular-nums leading-none">
              {blockApproaches}
            </span>
          </div>

          {blockApproaches > 0 && (
            <>
              <span className="w-px h-7 bg-border shrink-0" />
              {/* Conversão */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] font-mono text-muted-foreground/70 tracking-[0.1em] uppercase">Conv.</span>
                <span className="font-black text-primary text-[clamp(13px,3.8vw,17px)] font-mono tabular-nums leading-none">
                  {conversionRate}%
                </span>
              </div>
            </>
          )}
        </div>

        {/* Quick sale buttons */}
        <div data-tour="defcon-quick-sale" className="w-full flex justify-center">
          <DefconQuickSaleButtons
            saleHistory={saleHistory}
            forcedValues={onboardingMode && quickSaleValue ? [quickSaleValue] : undefined}
            unidadesDe={tiersQty}
            onQuickSale={(amount) => { const c = casarValor(amount); registerSale(amount, metodoPorValorRef.current[String(amount)] ?? "dinheiro", c?.qty ?? 1, c?.product_id ?? null); }}
          />
        </div>

        {/* Botão de custo rápido — discreto, alinhado ao tom DEFCON */}
        <div className="w-full flex justify-center px-1">
          <button
            data-tour="defcon-custo"
            onClick={() => setShowExpense(true)}
            className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-full bg-card border border-border active:scale-95 active:bg-secondary transition-[colors,transform,opacity]"
          >
            <Minus className="w-3.5 h-3.5 text-destructive" strokeWidth={2.5} />
            <span className="text-xs font-bold text-foreground/70 tracking-wide uppercase">Custo</span>
          </button>
        </div>

        <QuickExpenseButton
          open={showExpense}
          onOpenChange={setShowExpense}
          hideFab
        />

        {/* Botões de ação — venda elevada acima dos laterais */}
        <div className="w-full flex items-end justify-center gap-2.5 px-1">
          {/* Abordagem — esquerda, mais baixo */}
          <button
            data-tour="defcon-abordagem"
            onClick={handleApproachClick}
            className={`flex-1 h-[56px] rounded-2xl bg-card border border-border flex flex-col items-center justify-center gap-0.5 active:scale-95 active:bg-secondary transition-[colors,transform,opacity] ${
              approachPulse ? "ring-2 ring-foreground/30 bg-secondary" : ""
            }`}
          >
            <UserRound className="w-4 h-4 text-foreground/80" strokeWidth={2.5} />
            <span className="text-xs font-bold text-foreground/80 leading-none">Abordagem</span>
          </button>

          {/* Venda — centro, elevado e destacado */}
          <button
            data-tour="defcon-venda"
            onClick={() => setShowAddSale(true)}
            className="flex-[1.25] h-[72px] rounded-2xl bg-primary flex items-center justify-center gap-2 active:scale-95 transition-[colors,transform,opacity] shadow-[0_12px_40px_-6px_hsl(var(--primary)/0.85)]"
          >
            <Plus className="w-7 h-7 text-primary-foreground" strokeWidth={3.5} />
            <span className="text-[18px] font-black text-primary-foreground tracking-tight">Venda</span>
          </button>

          {/* Gorjeta — direita, mais baixo */}
          <button
            data-tour="defcon-gorjeta"
            onClick={() => setShowAddTip(true)}
            className="flex-1 h-[56px] rounded-2xl bg-transparent border-2 border-primary/40 flex flex-col items-center justify-center gap-0.5 active:scale-95 active:bg-primary/10 transition-[colors,transform,opacity]"
          >
            <Coins className="w-4 h-4 text-primary" strokeWidth={2.5} />
            <span className="text-xs font-bold text-primary leading-none">Gorjeta</span>
          </button>
        </div>

        {/* Frase de impacto — acionável */}
        <p className="text-[13px] text-foreground/70 font-mono text-center font-semibold">
          {impactPhrase}
        </p>
      </div>

      {/* Footer — discreto, não compete com ações */}
      <div className="pb-4 pt-2 px-4">
        <div className="flex items-center justify-between gap-2">
          <button
            data-tour="defcon-ocorrencia"
            onClick={() => setShowOccurrence(true)}
            className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5 active:scale-95 active:bg-foreground/5 transition-[colors,transform,opacity]"
          >
            <FileText className="w-3 h-3 text-muted-foreground/60" />
            <span className="text-xs font-mono text-muted-foreground/70 tracking-wider uppercase">Ocorrência</span>
          </button>
          {/* Pausa (almoço) — sempre disponível durante o corre; pode pausar quantas vezes precisar. */}
          <span className="text-foreground/10">|</span>
          <button
            data-tour="defcon-pausar"
            onClick={() => setShowLunchPicker(true)}
            className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5 active:scale-95 active:bg-foreground/5 transition-[colors,transform,opacity]"
          >
            <UtensilsCrossed className="w-3 h-3 text-muted-foreground/60" />
            <span className="text-xs font-mono text-muted-foreground/70 tracking-wider uppercase">Pausar</span>
          </button>
          <span className="text-foreground/10">|</span>
          <button
            data-tour="defcon-encerrar"
            onClick={() => setShowConfirmEnd(true)}
            className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5 active:scale-95 active:bg-destructive/10 transition-[colors,transform,opacity]"
          >
            <span className="text-xs font-mono text-destructive/70 tracking-wider uppercase font-bold">Encerrar</span>
          </button>
        </div>
        {/* Tocar aqui abre o histórico de blocos: navega nos anteriores (◀ ▶) e
            permite conferir/excluir as vendas de cada bloco. */}
        <button
          onClick={() => { setViewBlockIndex(currentBlockIndex); setShowBlockSales(true); }}
          aria-label="Ver blocos anteriores e editar vendas"
          className="mt-1.5 w-full flex items-center justify-center gap-1.5 h-7 rounded-lg active:scale-95 active:bg-foreground/5 transition-[colors,transform,opacity]"
        >
          <span className="text-xs font-mono text-muted-foreground/50 tracking-[0.25em] uppercase">
            Bloco {currentBlockIndex + 1}/{totalBlocks}
          </span>
          <span className="text-[10px] font-mono text-primary/70 uppercase tracking-wider">· ver blocos</span>
          <ChevronRight className="w-3 h-3 text-primary/70" />
        </button>
      </div>

      {/* Add sale modal */}
      {showAddSale && (
        <div
          className="fixed inset-0 bg-background/90 flex items-end justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="defcon-sale-title"
          onClick={() => { setShowAddSale(false); resetSaleForm(); }}
        >
          <div
            className="w-full max-w-md bg-card border-t border-border rounded-t-3xl p-6 pb-10 space-y-5 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 id="defcon-sale-title" className="text-lg font-bold text-foreground">Registrar venda</h3>
              <button onClick={() => { setShowAddSale(false); resetSaleForm(); }}>
                <X className="w-6 h-6 text-muted-foreground" />
              </button>
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-muted-foreground font-bold">
                R$
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={saleValue}
                onChange={(e) => { setSaleValue(e.target.value); if (erroValor) setErroValor(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleAddSale("dinheiro")}
                placeholder="0"
                autoFocus
                className="w-full h-20 bg-background border-2 border-border rounded-xl text-center text-4xl font-black text-foreground pl-16 pr-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success transition-colors placeholder:text-muted-foreground"
              />
            </div>

            {/* O valor casou com a tabela de preço → produto + unidades certos, sem perguntar */}
            {!onboardingMode && casado && (
              <div className="rounded-[14px] border p-3.5 flex items-center gap-3" style={{ borderColor: "rgba(61,214,140,.30)", background: "rgba(61,214,140,.07)" }}>
                <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "rgba(61,214,140,.16)" }}><Check className="w-4 h-4" style={{ color: "var(--orbis-ok)" }} strokeWidth={2.8} /></span>
                <span className="flex-1 min-w-0">
                  <b className="block text-[14px] font-semibold truncate">{casado.qty} × {casado.nome}</b>
                  <small className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-2)" }}>Está na sua tabela · sai {casado.qty} do estoque</small>
                </span>
              </div>
            )}

            {/* Não casou, mas tem carga hoje → pergunta quantas saíram (e de qual, se tiver mais de um) */}
            {!onboardingMode && !casado && loadout.length > 0 && saleValorNum > 0 && (
              <div className="rounded-[14px] border p-3.5" style={{ borderColor: "rgba(245,184,0,.30)", background: "rgba(245,184,0,.06)" }}>
                <p className="text-[13.5px] font-semibold">Quantas unidades saíram?</p>
                <div className="flex gap-2 mt-2.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setSaleQty(n)} className="w-11 h-10 rounded-[10px] text-[15px] font-extrabold active:scale-95 transition"
                      style={saleQty === n ? { background: "var(--orbis-gold)", color: "#1A1200" } : { border: "1px solid rgba(245,184,0,.3)", color: "var(--orbis-gold)" }}>{n}</button>
                  ))}
                </div>
                {loadout.length >= 2 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {loadout.map((item) => (
                      <button key={item.id} type="button" onClick={() => setSelectedProductId(item.product_id)}
                        className="h-9 px-3 rounded-full text-[12.5px] font-semibold active:scale-95 transition"
                        style={selectedProductId === item.product_id ? { background: "rgba(245,184,0,.18)", border: "1px solid var(--orbis-gold)", color: "var(--orbis-fg)" } : { border: "1px solid rgba(255,255,255,.14)", color: "var(--orbis-fg-2)" }}>
                        {item.product_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Cliente — opcional */}
            {!showClientFields ? (
              <button
                onClick={() => setShowClientFields(true)}
                className="w-full h-11 rounded-xl bg-muted/60 border border-dashed border-border text-muted-foreground text-xs font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <User className="w-3.5 h-3.5" />
                Adicionar cliente <span className="text-muted-foreground">(opcional)</span>
              </button>
            ) : (
              <div className="space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-mono text-muted-foreground tracking-wider uppercase">Cliente</span>
                  <button
                    onClick={() => { setSaleName(""); setSalePhone(""); setShowClientFields(false); }}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    remover
                  </button>
                </div>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={saleName}
                    onChange={(e) => setSaleName(e.target.value)}
                    placeholder="Nome do cliente"
                    maxLength={80}
                    className="w-full h-11 bg-background border border-border rounded-xl pl-10 pr-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary placeholder:text-muted-foreground"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={salePhone}
                    onChange={(e) => setSalePhone(e.target.value)}
                    placeholder="WhatsApp (DDD + número)"
                    maxLength={20}
                    className="w-full h-11 bg-background border border-border rounded-xl pl-10 pr-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary placeholder:text-muted-foreground"
                  />
                </div>

                {sanitizePhone(salePhone).length >= 10 && parseFloat(saleValue) > 0 && (
                  <button
                    onClick={openChargePreview}
                    style={{ backgroundColor: BRAND_COLORS.WHATSAPP, boxShadow: "0 10px 28px -8px rgba(37,211,102,0.7)" }}
                    className="w-full h-14 rounded-2xl text-white flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform"
                  >
                    <MessageCircle className="w-5 h-5" strokeWidth={2.5} />
                    <span className="flex flex-col items-start leading-tight">
                      <span className="text-sm font-extrabold">Registrar e cobrar no WhatsApp</span>
                      <span className="text-[11px] font-medium opacity-90">Você revisa a mensagem antes de enviar</span>
                    </span>
                  </button>
                )}
              </div>
            )}

            {erroValor && (
              <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(229,115,127,.12)", border: "1px solid rgba(229,115,127,.35)" }}>
                <p className="text-[13px] font-semibold" style={{ color: "#E5737F" }}>{erroValor}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleAddSale("dinheiro")}
                disabled={!saleValue || parseFloat(saleValue) <= 0}
                className="flex-1 h-16 bg-success text-success-foreground font-black text-sm rounded-xl disabled:opacity-30 active:scale-95 transition-transform flex flex-col items-center justify-center gap-1"
              >
                <Coins className="w-5 h-5" strokeWidth={2.5} />
                DINHEIRO
              </button>
              <button
                onClick={() => handleAddSale("pix")}
                disabled={!saleValue || parseFloat(saleValue) <= 0}
                className="flex-1 h-16 bg-primary text-primary-foreground font-black text-sm rounded-xl disabled:opacity-30 active:scale-95 transition-transform flex flex-col items-center justify-center gap-1"
              >
                <Smartphone className="w-5 h-5" strokeWidth={2.5} />
                PIX
              </button>
              <button
                onClick={() => handleAddSale("cartao")}
                disabled={!saleValue || parseFloat(saleValue) <= 0}
                className="flex-1 h-16 bg-foreground text-background font-black text-sm rounded-xl disabled:opacity-30 active:scale-95 transition-transform flex flex-col items-center justify-center gap-1"
              >
                <CreditCard className="w-5 h-5" strokeWidth={2.5} />
                CARTÃO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Previa editavel da cobranca -> abre antes de enviar; edicao vira padrao */}
      {showChargePreview && (
        <div
          className="fixed inset-0 bg-background/90 flex items-end justify-center z-50"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowChargePreview(false)}
        >
          <div
            className="w-full max-w-md bg-card border-t border-border rounded-t-3xl p-6 pb-10 space-y-4 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <MessageCircle className="w-5 h-5" style={{ color: BRAND_COLORS.WHATSAPP }} />
                Revise a mensagem
              </h3>
              <button onClick={() => setShowChargePreview(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <span className="text-xs font-bold block" style={{ color: "#EAB308" }}>
              ✏️ Personalize sua mensagem — ela vira a sua padrão
            </span>
            <textarea
              value={saleMessage}
              onChange={(e) => setSaleMessage(e.target.value)}
              rows={7}
              className="w-full bg-background border rounded-xl p-3 text-sm text-foreground leading-relaxed resize-none focus-visible:outline-none focus-visible:ring-2"
              style={{ borderColor: "rgba(234,179,8,0.45)" }}
            />

            <button
              onClick={confirmCharge}
              style={{ backgroundColor: BRAND_COLORS.WHATSAPP, boxShadow: "0 10px 28px -8px rgba(37,211,102,0.7)" }}
              className="w-full h-14 rounded-2xl text-white flex items-center justify-center gap-2 font-extrabold active:scale-[0.98] transition-transform"
            >
              <MessageCircle className="w-5 h-5" strokeWidth={2.5} />
              Abrir WhatsApp e cobrar
            </button>
          </div>
        </div>
      )}

      {/* Lunch pause duration picker */}
      {showLunchPicker && (
        <div
          className="fixed inset-0 bg-background/90 flex items-end justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="defcon-lunch-title"
          onClick={() => { setShowLunchPicker(false); setCustomLunchMinutes(""); }}
        >
          <div
            className="w-full max-w-md bg-card border-t border-border rounded-t-3xl p-6 pb-10 space-y-6 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 id="defcon-lunch-title" className="text-lg font-bold text-foreground">🍽️ Pausa para almoço</h3>
              <button onClick={() => { setShowLunchPicker(false); setCustomLunchMinutes(""); }}>
                <X className="w-6 h-6 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              Escolha o tempo de pausa. Você só pode usar 1 vez por dia.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 45, 60].map((min) => (
                <button
                  key={min}
                  onClick={() => setCustomLunchMinutes(String(min))}
                  className={`h-12 rounded-xl font-bold text-sm active:scale-95 transition-[colors,transform,opacity] border ${
                    customLunchMinutes === String(min)
                      ? "bg-warning border-warning text-warning-foreground"
                      : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {min} min
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">
                min
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                value={customLunchMinutes}
                onChange={(e) => setCustomLunchMinutes(e.target.value)}
                placeholder="Ou digite os minutos (máx. 120)"
                className="w-full h-14 bg-background border-2 border-border rounded-xl text-center text-2xl font-black text-foreground pl-12 pr-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning transition-colors placeholder:text-muted-foreground placeholder:text-sm"
              />
            </div>
            <button
              onClick={() => {
                const mins = parseInt(customLunchMinutes) || 0;
                if (mins > 0 && mins <= 120) {
                  setShowLunchPicker(false);
                  setCustomLunchMinutes("");
                  onLunchPause(mins);
                }
              }}
              disabled={!customLunchMinutes || parseInt(customLunchMinutes) <= 0 || parseInt(customLunchMinutes) > 120}
              className="w-full h-14 bg-warning text-warning-foreground font-black text-lg rounded-xl disabled:opacity-30 active:scale-95 transition-transform"
            >
              INICIAR PAUSA
            </button>
          </div>
        </div>
      )}

      {/* Occurrence modal */}
      {showOccurrence && (
        <DefconOccurrenceModal
          onSave={(desc) => {
            onAddOccurrence(desc);
            setShowOccurrence(false);
          }}
          onClose={() => setShowOccurrence(false)}
        />
      )}

      {/* TRAVA DE VALOR ALTO: acima de R$ 300 pergunta antes de gravar.
          Não perde o que ele digitou — dá pra corrigir com um toque. */}
      {confirmarValor && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,.85)" }} role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl border p-5 text-center" style={{ background: "#111", borderColor: "rgba(245,184,0,.35)" }}>
            <p className="text-[10.5px] font-extrabold uppercase tracking-[.16em]" style={{ color: "#F5B800" }}>Confere pra mim</p>
            <h3 className="text-[22px] font-black mt-2 text-foreground">{formatCurrency(confirmarValor.amount)}</h3>
            <p className="text-[13px] mt-2 leading-relaxed text-muted-foreground">
              Essa venda é bem maior que o normal. Foi isso mesmo, ou sobrou um zero?
            </p>
            <button
              type="button"
              onClick={() => confirmarVenda(confirmarValor.amount, confirmarValor.method)}
              className="w-full h-12 mt-4 rounded-xl font-black text-[15px]"
              style={{ background: "linear-gradient(180deg,#FFC63A,#F5B800)", color: "#1A1200", boxShadow: "0 4px 0 #B88700" }}
            >
              SIM, FOI {formatCurrency(confirmarValor.amount)}
            </button>
            <button type="button" onClick={() => setConfirmarValor(null)} className="w-full h-11 mt-2 text-[13.5px] font-semibold text-muted-foreground">
              corrigir o valor
            </button>
          </div>
        </div>
      )}

      {/* RAJADA: 4+ vendas em poucos segundos. NÃO trava — só oferece desfazer. */}
      {rajada && (
        <div className="fixed inset-x-0 z-[65] flex justify-center px-4" style={{ bottom: "calc(env(safe-area-inset-bottom) + 96px)" }}>
          <div className="w-full max-w-sm rounded-2xl border p-3.5" style={{ background: "rgba(17,17,17,.97)", borderColor: "rgba(245,184,0,.35)", boxShadow: "0 18px 50px -20px rgba(0,0,0,.9)" }}>
            <p className="text-[13.5px] font-bold text-foreground">{rajada} vendas em poucos segundos</p>
            <p className="text-[12.5px] mt-0.5 text-muted-foreground">
              Se foi engano, dá pra apagar agora. Se vendeu pra um grupo de uma vez, está certo.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                disabled={apagandoRajada}
                onClick={() => apagarUltimas(rajada)}
                className="flex-1 h-10 rounded-xl text-[13px] font-bold disabled:opacity-50"
                style={{ background: "rgba(229,115,127,.15)", border: "1px solid rgba(229,115,127,.4)", color: "#E5737F" }}
              >
                {apagandoRajada ? "Apagando…" : `Apagar as últimas ${rajada}`}
              </button>
              <button
                type="button"
                disabled={apagandoRajada}
                onClick={() => { rajadaRef.current = []; setRajada(null); }}
                className="flex-1 h-10 rounded-xl text-[13px] font-bold bg-card border border-border text-foreground disabled:opacity-50"
              >
                Está certo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add tip modal */}
      {showAddTip && (
        <div
          className="fixed inset-0 bg-background/90 flex items-end justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="defcon-tip-title"
          onClick={() => { setShowAddTip(false); setTipValue(""); }}
        >
          <div
            className="w-full max-w-md bg-card border-t border-border rounded-t-3xl p-6 pb-10 space-y-5 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 id="defcon-tip-title" className="text-lg font-bold text-foreground">🎯 Registrar gorjeta</h3>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">Conta como venda no faturamento</p>
              </div>
              <button onClick={() => { setShowAddTip(false); setTipValue(""); }}>
                <X className="w-6 h-6 text-muted-foreground" />
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-muted-foreground font-bold">
                R$
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={tipValue}
                onChange={(e) => setTipValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTip()}
                placeholder="0"
                autoFocus
                className="w-full h-20 bg-background border-2 border-border rounded-xl text-center text-4xl font-black text-foreground pl-16 pr-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors placeholder:text-muted-foreground"
              />
            </div>
            <button
              onClick={handleAddTip}
              disabled={!tipValue || parseFloat(tipValue) <= 0}
              className="w-full h-14 bg-primary text-primary-foreground font-black text-base rounded-xl disabled:opacity-30 active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" strokeWidth={3} />
              REGISTRAR
            </button>
          </div>
        </div>
      )}

      {/* Vendas deste bloco — lista por venda com excluir + adicionar esquecida */}
      {showBlockSales && (
        <div
          className="fixed inset-0 bg-background/90 flex items-end justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="defcon-blocksales-title"
          onClick={() => setShowBlockSales(false)}
        >
          <div
            className="w-full max-w-md bg-card border-t border-border rounded-t-3xl p-6 pb-10 space-y-4 animate-in slide-in-from-bottom duration-200 max-h-[80dvh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center gap-2">
              <div className="min-w-0">
                <h3 id="defcon-blocksales-title" className="text-lg font-bold text-foreground">
                  {vendoBlocoAtual ? "Vendas deste bloco" : "Vendas do bloco"}
                </h3>
                {/* Navegar pelos blocos já feitos (voltar e conferir/corrigir). */}
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => setViewBlockIndex((i) => Math.max(0, i - 1))}
                    disabled={viewBlockIndex <= 0}
                    aria-label="Bloco anterior"
                    className="w-7 h-7 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground disabled:opacity-30 active:scale-90 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    Bloco #{viewBlockIndex + 1}/{totalBlocks}
                  </span>
                  <button
                    onClick={() => setViewBlockIndex((i) => Math.min(currentBlockIndex, i + 1))}
                    disabled={viewBlockIndex >= currentBlockIndex}
                    aria-label="Próximo bloco"
                    className="w-7 h-7 rounded-lg bg-background border border-border flex items-center justify-center text-muted-foreground disabled:opacity-30 active:scale-90 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <button onClick={() => setShowBlockSales(false)} className="shrink-0">
                <X className="w-6 h-6 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto -mx-1 px-1">
              {blockSales.length === 0 ? (
                <p className="text-sm text-muted-foreground font-mono text-center py-8">
                  Nenhuma venda registrada ainda neste bloco.
                </p>
              ) : (
                <ul className="space-y-2">
                  {blockSales.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 rounded-xl bg-background/60 border border-border px-3 py-2.5"
                    >
                      <span className="text-xs font-mono text-muted-foreground tabular-nums w-12">
                        {saleTime(s.created_at)}
                      </span>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <span className={`text-sm font-black tabular-nums leading-tight ${s.method === "gorjeta" ? "text-primary" : "text-success"}`}>
                          {formatCurrency(Number(s.amount) || 0)}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground leading-tight flex items-center gap-1.5">
                          {methodLabel(s.method)}
                          {s.late && (
                            <span
                              className="px-1.5 py-px rounded-full text-[10px] font-bold text-white"
                              style={{ backgroundColor: BRAND_COLORS.PIX }}
                            >
                              Pix depois
                            </span>
                          )}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteSale(s)}
                        aria-label="Excluir venda"
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-destructive active:scale-90 active:bg-destructive/10 transition-[colors,transform,opacity]"
                      >
                        <X className="w-5 h-5" strokeWidth={2.5} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Pegar a IMAGEM (print) do fim deste bloco — vale pra qualquer bloco. */}
            <button
              onClick={() => { setShowBlockSales(false); abrirImagemBloco(viewBlockIndex); }}
              disabled={loadingReport}
              className="w-full h-11 rounded-xl bg-primary/10 border border-primary/40 text-primary font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-[colors,transform,opacity] disabled:opacity-50"
            >
              <Camera className="w-4 h-4" strokeWidth={2.5} />
              {loadingReport ? "Abrindo..." : `Imagem do bloco #${viewBlockIndex + 1}`}
            </button>

            {vendoBlocoAtual ? (
              <button
                onClick={() => { setShowBlockSales(false); setShowAddSale(true); }}
                className="w-full h-12 rounded-xl bg-card border border-dashed border-primary/50 text-primary font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] active:bg-primary/10 transition-[colors,transform,opacity]"
              >
                <Plus className="w-4 h-4" strokeWidth={3} />
                Registrar venda
              </button>
            ) : (
              <button
                onClick={() => setViewBlockIndex(currentBlockIndex)}
                className="w-full h-12 rounded-xl bg-card border border-border text-muted-foreground font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-[colors,transform,opacity]"
              >
                Vendo um bloco anterior · voltar ao bloco atual
              </button>
            )}
          </div>
        </div>
      )}

      {/* Relatório/imagem de um bloco (atual ou anterior) — dá pra compartilhar/baixar */}
      {reportBlock && (
        <div className="fixed inset-0 z-[60] bg-background overflow-y-auto">
          <DefconBlockReport
            blockIndex={reportBlock.blockIndex}
            approaches={reportBlock.approaches}
            sales={reportBlock.sales}
            soldAmount={reportBlock.soldAmount}
            onContinue={() => setReportBlock(null)}
          />
        </div>
      )}
    </div>
  );
}

// Contador do bloco AUTO-SUFICIENTE: deriva os segundos do início do bloco e tem o
// próprio tick de 1s. Antes o hook atualizava o estado da página inteira a cada
// segundo — todo o DEFCON re-renderizava 60x/min (bateria + travadinhas em celular
// fraco). Agora só este componente re-renderiza por segundo.
function BlockCountdown({ blockStartedAt }: { blockStartedAt: Date | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = blockStartedAt ? Math.floor((now - blockStartedAt.getTime()) / 1000) : 0;
  const remainingSeconds = Math.max(0, 60 * 60 - elapsed);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const progress = ((60 * 60 - remainingSeconds) / (60 * 60)) * 100;
  const isUrgent = remainingSeconds < 300; // últimos 5 minutos

  return (
    <div className="flex flex-col items-center gap-3 -my-1">
      <div
        className={`text-[clamp(64px,26vw,104px)] md:text-[128px] font-black font-mono tabular-nums tracking-tighter leading-none ${
          isUrgent ? "text-destructive animate-pulse" : "text-foreground"
        }`}
        style={{
          textShadow: isUrgent
            ? "0 0 50px rgba(239,68,68,0.55), 0 0 90px rgba(239,68,68,0.3)"
            : "0 0 36px rgba(245,180,0,0.28), 0 0 70px rgba(245,180,0,0.12)",
        }}
      >
        {String(minutes).padStart(2, "0")}
        <span className={isUrgent ? "text-destructive/50" : "text-primary/50"}>:</span>
        {String(seconds).padStart(2, "0")}
      </div>

      {/* Progress bar — mais visível, reforça ritmo */}
      <div className="w-64 h-1.5 bg-foreground/8 rounded-full overflow-hidden border border-border">
        <div
          className={`h-full transition-[colors,transform,opacity] duration-1000 ease-linear rounded-full ${
            isUrgent ? "bg-destructive shadow-[0_0_12px_hsl(var(--destructive)/0.7)]" : "bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.5)]"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
