import { useEffect, useState } from "react";
import { emitMissionEvent } from "@/shared/lib/missionEvents";
import { useTheme } from "next-themes";
import { formatCurrency } from "@/shared/lib/utils";
import { Plus, X, UtensilsCrossed, UserRound, FileText, Coins, Pause, MessageCircle, Phone, Minus, User, Package, Sun, Moon } from "lucide-react";
import { DefconBlock } from "@/hooks/useDefconChallenge";
import { DefconQuickSaleButtons } from "./DefconQuickSaleButtons";
import { DefconOccurrenceModal } from "./DefconOccurrenceModal";
import { DefconSmartNotification } from "./DefconSmartNotification";
import { DefconX1Live } from "./DefconX1Live";
import type { X1LiveState } from "@/hooks/useX1DefconAlert";
import QuickExpenseButton from "@/components/QuickExpenseButton";
import { supabase } from "@/integrations/supabase/client";
import { useDefconLoadout } from "@/hooks/useDefconLoadout";
import { BRAND_COLORS } from "@/shared/lib/theme-colors";

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
  const [saleHistory, setSaleHistory] = useState<number[]>([]);
  const [showAddTip, setShowAddTip] = useState(false);
  const [tipValue, setTipValue] = useState("");
  const [showExpense, setShowExpense] = useState(false);
  const [salePhone, setSalePhone] = useState("");
  const [saleName, setSaleName] = useState("");
  const [showClientFields, setShowClientFields] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [pixCharge, setPixCharge] = useState<{ key: string; name: string } | null>(null);
  const [saleMessage, setSaleMessage] = useState("");
  const [showChargePreview, setShowChargePreview] = useState(false);
  const [showBlockSales, setShowBlockSales] = useState(false);

  const { loadout, incrementSold } = useDefconLoadout(userId);
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

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const progress = ((60 * 60 - remainingSeconds) / (60 * 60)) * 100;
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

  const registerSale = (amount: number, method: "dinheiro" | "pix" | "cartao" = "dinheiro") => {
    onAddSale(amount, method);
    setSaleHistory((prev) => [...prev, amount]);
    const tag = method === "pix" ? " 💸" : method === "cartao" ? " 💳" : "";
    pushFloater(`+${formatCurrency(amount)}${tag}`, "sale");
    // Debita do loadout/estoque se houver produto selecionado
    if (!onboardingMode && selectedProductId) {
      incrementSold(selectedProductId, 1).catch((e) =>
        console.warn("[defcon] failed to debit loadout", e)
      );
    }
    // Onboarding: qualquer venda no DEFCON (rápida ou manual) avança a missão.
    emitMissionEvent("sale-registered");
  };

  const resetSaleForm = () => {
    setSaleValue("");
    setSalePhone("");
    setSaleName("");
    setSaleMessage("");
    setShowChargePreview(false);
    setShowClientFields(false);
    // Mantém o produto selecionado se houver só 1; reseta se múltiplos
    if (loadout.length > 1) setSelectedProductId(null);
  };

  const handleAddSale = (method: "dinheiro" | "pix" | "cartao" = "dinheiro") => {
    const amount = parseFloat(saleValue) || 0;
    if (amount > 0) {
      registerSale(amount, method);
      persistClient(amount, method);
      resetSaleForm();
      setShowAddSale(false);
    }
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
    registerSale(amount, "pix");
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

  // Vendas-linha do BLOCO ATUAL (para o modal "Vendas deste bloco").
  const blockSales = (sessionSales || []).filter(
    (s) => Number(s?.block_index) === currentBlockIndex
  );

  // Horário curto (HH:mm) a partir do created_at da venda.
  const saleTime = (iso: string | null | undefined) => {
    if (!iso) return "--:--";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "--:--";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const methodLabel = (m: string) =>
    m === "pix" ? "Pix" : m === "cartao" ? "Cartão" : "Dinheiro";

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
    <div className="relative min-h-[100dvh] bg-background pt-safe pb-safe flex flex-col select-none">
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
      <div className="pt-7 pb-2 px-6 text-center">
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

        {/* Timer — elemento dominante */}
        <div className="flex flex-col items-center gap-3 -my-1">
          <div
            className={`text-[104px] md:text-[128px] font-black font-mono tabular-nums tracking-tighter leading-none ${
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

        {/* Bloco info — métricas em colunas com label */}
        <div className="flex items-center justify-center gap-6 px-2">
          {/* Faturado */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs font-mono text-muted-foreground/70 tracking-[0.2em] uppercase">Bloco</span>
            <span className="font-black text-success text-[20px] font-mono tabular-nums leading-none">
              {formatCurrency(blockSold)}
            </span>
          </div>

          <span className="w-px h-8 bg-border" />

          {/* Vendas — tocável: abre o detalhe por venda do bloco */}
          <button
            type="button"
            onClick={() => setShowBlockSales(true)}
            aria-label="Ver vendas deste bloco"
            className="flex flex-col items-center gap-0.5 active:scale-95 transition-transform"
          >
            <span className="text-xs font-mono text-muted-foreground/70 tracking-[0.2em] uppercase">Vendas</span>
            <span className="font-black text-foreground text-[20px] font-mono tabular-nums leading-none underline decoration-dotted decoration-foreground/30 underline-offset-4">
              {blockSalesCount}
            </span>
          </button>

          <span className="w-px h-8 bg-border" />

          {/* Abordagens */}
          <div className={`flex flex-col items-center gap-0.5 transition-transform ${approachPulse ? "scale-110" : ""}`}>
            <span className="text-xs font-mono text-muted-foreground/70 tracking-[0.2em] uppercase">Abord.</span>
            <span className="font-black text-foreground text-[20px] font-mono tabular-nums leading-none">
              {blockApproaches}
            </span>
          </div>

          {blockApproaches > 0 && (
            <>
              <span className="w-px h-8 bg-border" />
              {/* Conversão */}
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xs font-mono text-muted-foreground/70 tracking-[0.2em] uppercase">Conv.</span>
                <span className="font-black text-primary text-[20px] font-mono tabular-nums leading-none">
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
            onQuickSale={(amount) => registerSale(amount, "pix")}
          />
        </div>

        {/* Botão de custo rápido — discreto, alinhado ao tom DEFCON */}
        <div className="w-full flex justify-center px-1">
          <button
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
            onClick={() => setShowOccurrence(true)}
            className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5 active:scale-95 active:bg-foreground/5 transition-[colors,transform,opacity]"
          >
            <FileText className="w-3 h-3 text-muted-foreground/60" />
            <span className="text-xs font-mono text-muted-foreground/70 tracking-wider uppercase">Ocorrência</span>
          </button>
          {!lunchPauseUsed && (
            <>
              <span className="text-foreground/10">|</span>
              <button
                onClick={() => setShowLunchPicker(true)}
                className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5 active:scale-95 active:bg-foreground/5 transition-[colors,transform,opacity]"
              >
                <UtensilsCrossed className="w-3 h-3 text-muted-foreground/60" />
                <span className="text-xs font-mono text-muted-foreground/70 tracking-wider uppercase">Almoço</span>
              </button>
            </>
          )}
          <span className="text-foreground/10">|</span>
          <button
            onClick={() => setShowConfirmEnd(true)}
            className="flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5 active:scale-95 active:bg-destructive/10 transition-[colors,transform,opacity]"
          >
            <span className="text-xs font-mono text-destructive/70 tracking-wider uppercase font-bold">Encerrar</span>
          </button>
        </div>
        <div className="mt-1.5 text-center text-xs font-mono text-muted-foreground/30 tracking-[0.3em] uppercase">
          Bloco {currentBlockIndex + 1}/{totalBlocks}
        </div>
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

            {/* Seletor de produto — só aparece se loadout tem 2+ produtos */}
            {loadout.length >= 2 && (
              <div className="space-y-2">
                <p className="text-xs font-mono text-muted-foreground tracking-wider uppercase">
                  Qual produto?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {loadout.map((item) => {
                    const restante = Math.max(0, Number(item.qty_initial) - Number(item.qty_sold));
                    const selected = selectedProductId === item.product_id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedProductId(item.product_id)}
                        className={`p-3 rounded-xl border text-left active:scale-95 transition-[colors,transform,opacity] ${
                          selected
                            ? "bg-primary/15 border-primary text-foreground"
                            : "bg-background/40 border-border text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Package className={`w-3.5 h-3.5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="text-xs font-bold truncate">{item.product_name}</span>
                        </div>
                        <p className={`text-xs mt-1 font-mono ${selected ? "text-primary" : "text-muted-foreground"}`}>
                          {restante} restantes
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mostra info do produto único */}
            {loadout.length === 1 && selectedProductId && (
              <div className="rounded-xl bg-primary/10 border border-primary/30 px-3 py-2 flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{loadout[0]!.product_name}</p>
                  <p className="text-xs text-primary font-mono">
                    {Math.max(0, Number(loadout[0]!.qty_initial) - Number(loadout[0]!.qty_sold))} restantes
                  </p>
                </div>
              </div>
            )}

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-muted-foreground font-bold">
                R$
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={saleValue}
                onChange={(e) => setSaleValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSale("dinheiro")}
                placeholder="0"
                autoFocus
                className="w-full h-20 bg-background border-2 border-border rounded-xl text-center text-4xl font-black text-foreground pl-16 pr-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success transition-colors placeholder:text-muted-foreground"
              />
            </div>

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

            <div className="flex gap-2">
              <button
                onClick={() => handleAddSale("dinheiro")}
                disabled={!saleValue || parseFloat(saleValue) <= 0}
                className="flex-1 h-16 bg-success text-success-foreground font-black text-base rounded-xl disabled:opacity-30 active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <Coins className="w-5 h-5" strokeWidth={2.5} />
                DINHEIRO
              </button>
              <button
                onClick={() => handleAddSale("pix")}
                disabled={!saleValue || parseFloat(saleValue) <= 0}
                style={{ backgroundColor: BRAND_COLORS.PIX }}
                className="flex-1 h-16 text-white font-black text-base rounded-xl disabled:opacity-30 active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <span className="text-lg font-black">PIX</span>
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
                value={customLunchMinutes}
                onChange={(e) => setCustomLunchMinutes(e.target.value)}
                placeholder="Ou digite os minutos"
                className="w-full h-14 bg-background border-2 border-border rounded-xl text-center text-2xl font-black text-foreground pl-12 pr-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning transition-colors placeholder:text-muted-foreground placeholder:text-sm"
              />
            </div>
            <button
              onClick={() => {
                const mins = parseInt(customLunchMinutes) || 0;
                if (mins > 0 && mins <= 180) {
                  setShowLunchPicker(false);
                  setCustomLunchMinutes("");
                  onLunchPause(mins);
                }
              }}
              disabled={!customLunchMinutes || parseInt(customLunchMinutes) <= 0 || parseInt(customLunchMinutes) > 180}
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
            <div className="flex justify-between items-center">
              <div>
                <h3 id="defcon-blocksales-title" className="text-lg font-bold text-foreground">Vendas deste bloco</h3>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">Bloco #{currentBlockIndex + 1}</p>
              </div>
              <button onClick={() => setShowBlockSales(false)}>
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
                        <span className="text-sm font-black text-success tabular-nums leading-tight">
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

            <button
              onClick={() => { setShowBlockSales(false); setShowAddSale(true); }}
              className="w-full h-12 rounded-xl bg-card border border-dashed border-primary/50 text-primary font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] active:bg-primary/10 transition-[colors,transform,opacity]"
            >
              <Plus className="w-4 h-4" strokeWidth={3} />
              Registrar venda
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
