import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Plus, X, UtensilsCrossed, UserRound, FileText, Coins, Pause, MessageCircle, Phone } from "lucide-react";
import { DefconBlock } from "@/hooks/useDefconChallenge";
import { DefconQuickSaleButtons } from "./DefconQuickSaleButtons";
import { DefconOccurrenceModal } from "./DefconOccurrenceModal";
import { DefconSmartNotification } from "./DefconSmartNotification";

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
  onAddSale: (amount: number) => void;
  onAddApproach: () => void;
  onAddOccurrence: (description: string) => void;
  onEnd: () => void;
  onLunchPause: (minutes: number) => void;
  onAddTip?: (amount: number) => void;
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
  const [salePhone, setSalePhone] = useState("");
  const [tipPhone, setTipPhone] = useState("");
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

  const registerSale = (amount: number) => {
    onAddSale(amount);
    setSaleHistory((prev) => [...prev, amount]);
    pushFloater(`+${formatCurrency(amount)}`, "sale");
  };

  const handleAddSale = () => {
    const amount = parseFloat(saleValue) || 0;
    if (amount > 0) {
      registerSale(amount);
      setSaleValue("");
      setSalePhone("");
      setShowAddSale(false);
    }
  };

  const sanitizePhone = (raw: string) => raw.replace(/\D/g, "");

  const openWhatsAppCharge = (rawPhone: string, amount: number) => {
    const digits = sanitizePhone(rawPhone);
    if (!digits || amount <= 0) return;
    const phone = digits.length <= 11 ? `55${digits}` : digits;
    const msg = encodeURIComponent(
      `Olá! Passando para confirmar sua compra no valor de ${formatCurrency(amount)}. Pode me enviar o comprovante por aqui? Obrigado! 🙏`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  const handleSaleAndCharge = () => {
    const amount = parseFloat(saleValue) || 0;
    if (amount <= 0) return;
    registerSale(amount);
    openWhatsAppCharge(salePhone, amount);
    setSaleValue("");
    setSalePhone("");
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
    setApproachPulse(true);
    setTimeout(() => setApproachPulse(false), 280);
    pushFloater("+1", "approach");
  };

  const handleAddTip = () => {
    const amount = parseFloat(tipValue) || 0;
    if (amount > 0) {
      // gorjeta entra no faturamento como venda
      onAddSale(amount);
      setSaleHistory((prev) => [...prev, amount]);
      onAddTip?.(amount);
      pushFloater(`+${formatCurrency(amount)} 🎯`, "tip");
      setTipValue("");
      setTipPhone("");
      setShowAddTip(false);
    }
  };

  const handleTipAndCharge = () => {
    const amount = parseFloat(tipValue) || 0;
    if (amount <= 0) return;
    onAddSale(amount);
    setSaleHistory((prev) => [...prev, amount]);
    onAddTip?.(amount);
    pushFloater(`+${formatCurrency(amount)} 🎯`, "tip");
    openWhatsAppCharge(tipPhone, amount);
    setTipValue("");
    setTipPhone("");
    setShowAddTip(false);
  };

  const impactPhrase =
    remaining <= 0
      ? "Meta batida. Continue empilhando."
      : totalSold === 0
      ? "Sem ação, sem dinheiro."
      : conversionRate > 0 && conversionRate < 15
      ? "Mais abordagem = mais venda."
      : `Você está a ${formatCurrency(remaining)} da meta.`;

  // Confirm end screen
  if (showConfirmEnd) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 select-none">
        <div className="text-center space-y-3 mb-8">
          <div className="text-6xl">⚠️</div>
          <div className="text-xl font-bold text-white">Encerrar o desafio?</div>
          <p className="text-sm text-neutral-500 font-mono">
            Você perde a streak. Tem certeza?
          </p>
        </div>
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={onEnd}
            className="w-full h-14 bg-red-600 text-white font-black text-lg rounded-xl active:scale-95 transition-transform"
          >
            SIM, ENCERRAR
          </button>
          <button
            onClick={() => setShowConfirmEnd(false)}
            className="w-full h-14 bg-neutral-900 border border-neutral-700 text-neutral-400 font-bold text-lg rounded-xl active:scale-95 transition-transform"
          >
            VOLTAR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col select-none">
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
      {/* Mission header */}
      <div className="pt-10 pb-3 px-6 text-center">
        <div className="text-[10px] font-mono text-[#A1A1A1] tracking-[0.3em] uppercase mb-1.5">
          🔥 MISSÃO
        </div>
        <div className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
          Faltam <span className="text-[#F5B400]">{formatCurrency(Math.max(0, remaining))}</span> para a meta
        </div>
        <div className="mt-1.5 text-[11px] font-mono text-[#A1A1A1]">
          Meta: {formatCurrency(dailyGoal)} • Feito: <span className="text-[#22C55E]">{formatCurrency(totalSold)}</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-between px-5 pb-2 gap-3 relative">
        {/* Floating feedback */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {floaters.map((f) => (
            <div
              key={f.id}
              className={`absolute left-1/2 -translate-x-1/2 top-[42%] font-black text-2xl animate-fade-in ${
                f.tone === "sale" ? "text-[#22C55E]" : f.tone === "tip" ? "text-[#F5B400]" : "text-white/80"
              }`}
              style={{ animation: "fire-rise 1s ease-out forwards" }}
            >
              {f.text}
            </div>
          ))}
        </div>

        {/* Block label */}
        <div className="text-[10px] font-mono text-[#A1A1A1]/70 tracking-[0.3em] uppercase">
          Bloco #{currentBlockIndex + 1} • {formatTime(blockStartedAt)} → {formatTime(blockEndTime)}
        </div>

        {/* Timer - foco visual absoluto */}
        <div className="flex flex-col items-center gap-2 my-1">
          <div
            className={`text-[88px] md:text-9xl font-black font-mono tabular-nums tracking-tighter leading-none ${
              isUrgent ? "text-red-500 animate-pulse" : "text-white"
            }`}
            style={{
              textShadow: isUrgent
                ? "0 0 40px rgba(239,68,68,0.5)"
                : "0 0 32px rgba(245,180,0,0.18)",
            }}
          >
            {String(minutes).padStart(2, "0")}
            <span className={isUrgent ? "text-red-500/50" : "text-[#F5B400]/40"}>:</span>
            {String(seconds).padStart(2, "0")}
          </div>

          {/* Progress bar */}
          <div className="w-56 h-[3px] bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                isUrgent ? "bg-red-500" : "bg-[#F5B400]"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Bloco info compacto - linha única */}
        <div className="flex items-center justify-center gap-3 text-[13px] font-mono">
          <span className="font-black text-[#22C55E]">{formatCurrency(blockSold)}</span>
          <span className="text-white/15">•</span>
          <span className="text-white/80">
            <span className="font-bold text-white">{blockSalesCount}</span> <span className="text-[#A1A1A1]">vendas</span>
          </span>
          <span className="text-white/15">•</span>
          <span className={`text-white/80 ${approachPulse ? "scale-110" : ""} transition-transform`}>
            <span className="font-bold text-white">{blockApproaches}</span> <span className="text-[#A1A1A1]">abord.</span>
          </span>
          {blockApproaches > 0 && (
            <>
              <span className="text-white/15">•</span>
              <span className="text-[#F5B400] font-bold">{conversionRate}%</span>
            </>
          )}
        </div>

        {/* Quick sale buttons */}
        <DefconQuickSaleButtons
          saleHistory={saleHistory}
          onQuickSale={registerSale}
        />

        {/* Botões de ação - linha horizontal com hierarquia */}
        <div className="w-full flex items-stretch justify-center gap-2.5 px-1">
          {/* Abordagem - neutro */}
          <button
            onClick={handleApproachClick}
            className={`flex-1 h-14 rounded-2xl bg-[#1A1A1A] border border-white/10 flex items-center justify-center gap-2 active:scale-95 transition-all ${
              approachPulse ? "ring-2 ring-white/30" : ""
            }`}
          >
            <UserRound className="w-4 h-4 text-[#A1A1A1]" strokeWidth={2.5} />
            <span className="text-[13px] font-bold text-[#A1A1A1]">Abordagem</span>
          </button>

          {/* Venda - destaque dourado */}
          <button
            onClick={() => setShowAddSale(true)}
            className="flex-[1.4] h-14 rounded-2xl bg-[#F5B400] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_8px_28px_-8px_rgba(245,180,0,0.7)]"
          >
            <Plus className="w-5 h-5 text-black" strokeWidth={3} />
            <span className="text-[15px] font-black text-black tracking-tight">Venda</span>
          </button>

          {/* Gorjeta - outline discreto */}
          <button
            onClick={() => (onAddTip ? setShowAddTip(true) : pushFloater("+1 🎯", "tip"))}
            className="flex-1 h-14 rounded-2xl bg-transparent border border-[#F5B400]/40 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Coins className="w-4 h-4 text-[#F5B400]" strokeWidth={2.5} />
            <span className="text-[13px] font-bold text-[#F5B400]">Gorjeta</span>
          </button>
        </div>

        {/* Frase de impacto */}
        <p className="text-[12px] text-[#A1A1A1] font-mono text-center">
          {impactPhrase}
        </p>
      </div>

      {/* Footer - controles discretos */}
      <div className="pb-5 pt-2 px-6 flex justify-between items-center border-t border-white/5">
        <span className="text-[10px] font-mono text-[#A1A1A1]/50 tracking-widest uppercase">
          {currentBlockIndex + 1}/{totalBlocks}
        </span>
        <div className="flex items-center gap-5">
          <button
            onClick={() => setShowOccurrence(true)}
            className="text-[10px] font-mono text-[#A1A1A1]/60 active:text-white transition-colors flex items-center gap-1"
          >
            <FileText className="w-3 h-3" />
            ocorrência
          </button>
          {!lunchPauseUsed && (
            <button
              onClick={() => setShowLunchPicker(true)}
              className="text-[10px] font-mono text-[#A1A1A1]/60 active:text-[#F5B400] transition-colors flex items-center gap-1"
            >
              <UtensilsCrossed className="w-3 h-3" />
              almoço
            </button>
          )}
          <button
            onClick={() => setShowConfirmEnd(true)}
            className="text-[10px] font-mono text-[#A1A1A1]/40 active:text-red-500 transition-colors"
          >
            encerrar
          </button>
        </div>
      </div>

      {/* Add sale modal */}
      {showAddSale && (
        <div className="fixed inset-0 bg-black/90 flex items-end justify-center z-50">
          <div className="w-full max-w-md bg-neutral-900 rounded-t-3xl p-6 pb-10 space-y-6 animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Registrar venda</h3>
              <button onClick={() => { setShowAddSale(false); setSaleValue(""); }}>
                <X className="w-6 h-6 text-neutral-500" />
              </button>
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-neutral-600 font-bold">
                R$
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={saleValue}
                onChange={(e) => setSaleValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSale()}
                placeholder="0"
                autoFocus
                className="w-full h-20 bg-black border-2 border-neutral-700 rounded-xl text-center text-4xl font-black text-white pl-16 pr-4 focus:outline-none focus:border-green-500 transition-colors placeholder:text-neutral-700"
              />
            </div>

            <button
              onClick={handleAddSale}
              disabled={!saleValue || parseFloat(saleValue) <= 0}
              className="w-full h-16 bg-green-600 text-white font-black text-xl rounded-xl disabled:opacity-30 active:scale-95 transition-transform"
            >
              + REGISTRAR
            </button>
          </div>
        </div>
      )}

      {/* Lunch pause duration picker */}
      {showLunchPicker && (
        <div className="fixed inset-0 bg-black/90 flex items-end justify-center z-50">
          <div className="w-full max-w-md bg-neutral-900 rounded-t-3xl p-6 pb-10 space-y-6 animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">🍽️ Pausa para almoço</h3>
              <button onClick={() => { setShowLunchPicker(false); setCustomLunchMinutes(""); }}>
                <X className="w-6 h-6 text-neutral-500" />
              </button>
            </div>
            <p className="text-sm text-neutral-500 font-mono">
              Escolha o tempo de pausa. Você só pode usar 1 vez por dia.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[15, 30, 45, 60].map((min) => (
                <button
                  key={min}
                  onClick={() => setCustomLunchMinutes(String(min))}
                  className={`h-12 rounded-xl font-bold text-sm active:scale-95 transition-all border ${
                    customLunchMinutes === String(min)
                      ? "bg-amber-600 border-amber-500 text-white"
                      : "bg-neutral-800 border-neutral-700 text-neutral-300"
                  }`}
                >
                  {min} min
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-neutral-600 font-mono">
                min
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={customLunchMinutes}
                onChange={(e) => setCustomLunchMinutes(e.target.value)}
                placeholder="Ou digite os minutos"
                className="w-full h-14 bg-black border-2 border-neutral-700 rounded-xl text-center text-2xl font-black text-white pl-12 pr-4 focus:outline-none focus:border-amber-500 transition-colors placeholder:text-neutral-700 placeholder:text-sm"
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
              className="w-full h-14 bg-amber-600 text-white font-black text-lg rounded-xl disabled:opacity-30 active:scale-95 transition-transform"
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
      {showAddTip && onAddTip && (
        <div className="fixed inset-0 bg-black/90 flex items-end justify-center z-50">
          <div className="w-full max-w-md bg-neutral-900 rounded-t-3xl p-6 pb-10 space-y-6 animate-in slide-in-from-bottom duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">🎯 Registrar gorjeta</h3>
              <button onClick={() => { setShowAddTip(false); setTipValue(""); }}>
                <X className="w-6 h-6 text-neutral-500" />
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-neutral-600 font-bold">
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
                className="w-full h-20 bg-black border-2 border-neutral-700 rounded-xl text-center text-4xl font-black text-white pl-16 pr-4 focus:outline-none focus:border-[#F5B400] transition-colors placeholder:text-neutral-700"
              />
            </div>
            <button
              onClick={handleAddTip}
              disabled={!tipValue || parseFloat(tipValue) <= 0}
              className="w-full h-16 bg-[#F5B400] text-black font-black text-xl rounded-xl disabled:opacity-30 active:scale-95 transition-transform"
            >
              + REGISTRAR GORJETA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
