import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { X } from "lucide-react";

interface SmartNotification {
  id: string;
  icon: string;
  message: string;
  timestamp: number;
  holdingDown: boolean;
}

interface DefconSmartNotificationProps {
  userId: string;
  totalApproaches: number;
  totalSalesCount: number;
  blockApproaches: number;
  blockSalesCount: number;
  phase: string;
  currentBlockIndex: number;
}

const NOTIFICATION_DURATION = 12000; // 12 seconds — tempo para ler com calma
const DEFAULT_BENCHMARK = 8;
const COACH_DAILY_CAP = 5;            // teto de mensagens por dia (4-5, escolha do usuario)
const COACH_COOLDOWN_APPROACHES = 4;  // intervalo minimo de abordagens entre mensagens (anti-spam)
const COACH_AI_TIMEOUT_MS = 6000;     // tempo p/ a IA enriquecer (o template já apareceu na hora)

// Escolhe um item aleatório — garante variedade mesmo quando a IA não reescreve.
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function DefconSmartNotification({
  userId,
  totalApproaches,
  totalSalesCount,
  blockApproaches,
  blockSalesCount,
  phase,
  currentBlockIndex,
}: DefconSmartNotificationProps) {
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [historicalAvg, setHistoricalAvg] = useState<number>(DEFAULT_BENCHMARK);
  const [historicalLoaded, setHistoricalLoaded] = useState(false);
  const [longestDryStreak, setLongestDryStreak] = useState(DEFAULT_BENCHMARK);
  const [hasRealHistory, setHasRealHistory] = useState(false);
  const [realConvPct, setRealConvPct] = useState(0);

  const prevSalesRef = useRef(0);
  const prevApproachesRef = useRef(0);
  const approachesSinceLastSaleRef = useRef(0);
  const shownTriggersRef = useRef<Set<string>>(new Set());
  const holdingRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const liveApproachesRef = useRef(0);
  const lastMsgApproachesRef = useRef(-99);
  const aiAvailableRef = useRef(true);
  const aiFailuresRef = useRef(0);       // só desliga a IA após erros REPETIDOS (não por 1 timeout)
  const coachShownRef = useRef(0);       // teto POR SESSAO de DEFCON (em memoria, nao trava no dia)
  const sessionFreshRef = useRef(false);

  // Limpa TODOS os timeouts pendentes ao desmontar (troca de fase: running -> break/
  // finished desmonta o DefconRunning). Sem isto, os setTimeout de 12s continuavam
  // chamando setState num componente já desmontado (warning + timer órfão entre blocos).
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadHistory();
  }, [userId]);

  const loadHistory = async () => {
    const today = getBrazilDate();
    const { data: sessions } = await supabase
      .from("challenge_sessions")
      .select("id, date")
      .eq("user_id", userId)
      .neq("date", today)
      .in("status", ["completed", "abandoned"])
      .order("date", { ascending: false })
      .limit(7);

    if (!sessions || sessions.length === 0) {
      setHistoricalAvg(DEFAULT_BENCHMARK);
      setHasRealHistory(false);
      setHistoricalLoaded(true);
      return;
    }

    let totalApp = 0;
    let totalSales = 0;
    const maxDry = 0;

    for (const session of sessions) {
      const { data: blocks } = await supabase
        .from("challenge_blocks")
        .select("approaches_count, sales_count")
        .eq("session_id", session.id);

      if (blocks) {
        const dayApp = blocks.reduce((s, b) => s + (b.approaches_count || 0), 0);
        const daySales = blocks.reduce((s, b) => s + Number((b as any).sales_count || 0), 0);
        totalApp += dayApp;
        totalSales += daySales;
      }
    }

    // So consideramos "media de verdade" se houver histórico minimo (senao nada de número chumbado)
    const real = totalApp >= 10 && totalSales >= 2;
    setHasRealHistory(real);
    setRealConvPct(real ? Math.round((totalSales / totalApp) * 100) : 0);
    const avg = totalSales > 0 ? totalApp / totalSales : DEFAULT_BENCHMARK;
    setHistoricalAvg(Math.round(avg * 10) / 10);
    setLongestDryStreak(Math.max(maxDry, Math.round(avg * 1.5)));
    setHistoricalLoaded(true);
  };

  // ---- Reinicia o coach a cada novo DEFCON (zera contador e re-arma os gatilhos) ----
  useEffect(() => {
    if (phase === "running" && totalApproaches === 0 && totalSalesCount === 0) {
      if (!sessionFreshRef.current) {
        sessionFreshRef.current = true;
        shownTriggersRef.current = new Set();
        prevSalesRef.current = 0;
        prevApproachesRef.current = 0;
        approachesSinceLastSaleRef.current = 0;
        lastMsgApproachesRef.current = -99;
        coachShownRef.current = 0;
        aiAvailableRef.current = true;
        aiFailuresRef.current = 0;
      }
    } else if (totalApproaches > 0 || totalSalesCount > 0) {
      sessionFreshRef.current = false;
    }
  }, [phase, totalApproaches, totalSalesCount]);

  // ---- Voz de IA: reescreve o template; cai no template se faltar IA/cota/timeout ----
  const aiRewrite = useCallback(async (templateMsg: string): Promise<string> => {
    if (!aiAvailableRef.current) return templateMsg;
    try {
      const invoke = supabase.functions.invoke("defcon-coach", {
        body: {
          template: templateMsg,
          dayApproaches: liveApproachesRef.current,
          avgApproachesPerSale: hasRealHistory ? Math.round(historicalAvg * 10) / 10 : 0,
          realConvPct: hasRealHistory ? realConvPct : 0,
        },
      });
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), COACH_AI_TIMEOUT_MS));
      const res: any = await Promise.race([invoke, timeout]);
      if (res?.error) {
        // Erro REAL da função (cota/chave): conta e só desliga após 3 seguidos
        aiFailuresRef.current += 1;
        if (aiFailuresRef.current >= 3) aiAvailableRef.current = false;
        return templateMsg;
      }
      const msg = res?.data?.message?.toString().trim();
      aiFailuresRef.current = 0; // sucesso: zera o contador
      return msg && msg.length > 0 ? msg : templateMsg;
    } catch {
      // Timeout/rede: NÃO desliga a IA — só não enriqueceu desta vez (o template já apareceu).
      return templateMsg;
    }
  }, [historicalAvg, hasRealHistory, realConvPct]);

  const showNotification = useCallback((icon: string, message: string) => {
    // Anti-spam: teto por sessao + intervalo minimo entre mensagens
    if (coachShownRef.current >= COACH_DAILY_CAP) return;
    if (lastMsgApproachesRef.current >= 0 &&
        (liveApproachesRef.current - lastMsgApproachesRef.current) < COACH_COOLDOWN_APPROACHES) return;
    lastMsgApproachesRef.current = liveApproachesRef.current;
    coachShownRef.current += 1;

    // Mostra NA HORA com o template (garante que sempre aparece, sem depender da rede)
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    setNotifications(prev => [...prev, { id, icon, message, timestamp: Date.now(), holdingDown: false }]);
    const timer = setTimeout(() => {
      if (!holdingRef.current.has(id)) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
      timersRef.current.delete(id);
    }, NOTIFICATION_DURATION);
    timersRef.current.set(id, timer);

    // IA enriquece em segundo plano: troca o texto se vier algo melhor (so quando publicada)
    aiRewrite(message).then((finalMsg) => {
      if (finalMsg && finalMsg !== message) {
        setNotifications(prev => prev.map(n => (n.id === id ? { ...n, message: finalMsg } : n)));
      }
    });
  }, [aiRewrite]);

  const dismissNotification = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
    holdingRef.current.delete(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const holdStart = useCallback((id: string) => {
    holdingRef.current.add(id);
  }, []);

  const holdEnd = useCallback((id: string) => {
    holdingRef.current.delete(id);
    // Start a new dismiss timer
    const timer = setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
      timersRef.current.delete(id);
    }, 3000);
    timersRef.current.set(id, timer);
  }, []);

  // Track approach-without-sale streaks
  useEffect(() => {
    if (phase !== "running" || !historicalLoaded) return;
    liveApproachesRef.current = totalApproaches;

    const newSale = totalSalesCount > prevSalesRef.current;
    const newApproach = totalApproaches > prevApproachesRef.current;

    if (newApproach && !newSale) {
      approachesSinceLastSaleRef.current += (totalApproaches - prevApproachesRef.current);
    }

    const convPct = totalApproaches > 0 ? Math.round((totalSalesCount / totalApproaches) * 100) : 0;

    if (newSale) {
      // TRIGGER 1 — Primeira venda (números reais da sessão)
      if (prevSalesRef.current === 0 && totalSalesCount > 0 && !shownTriggersRef.current.has("first_sale")) {
        shownTriggersRef.current.add("first_sale");
        if (hasRealHistory && totalApproaches <= historicalAvg) {
          showNotification("⚡", pick([
            `Primeira venda em ${totalApproaches} abordagens!\nMais rápido que o teu normal. Mantém esse pique. 🔥`,
            `Boom! Primeira em ${totalApproaches} abordagens.\nSaiu mais rápido que de costume. Emenda a próxima! ⚡`,
            `${totalApproaches} abordagens e já fechou a primeira!\nAcima do teu ritmo. Bora surfar essa onda. 🔥`,
          ]));
        } else {
          showNotification("⚡", pick([
            `Primeira venda em ${totalApproaches} abordagens!\nO jogo abriu — agora é emendar a próxima. 🔥`,
            `Fechou a primeira em ${totalApproaches} abordagens!\nQuebrou o gelo. A próxima vem mais fácil. 💪`,
            `Primeira do dia em ${totalApproaches} abordagens!\nEngata a segunda sem dar pausa. ⚡`,
          ]));
        }
      }

      approachesSinceLastSaleRef.current = 0;

      // TRIGGER 2/3 — Conversão real do dia
      if (totalSalesCount >= 2) {
        const triggerKey = `perf_check_${totalSalesCount}`;
        if (!shownTriggersRef.current.has(triggerKey)) {
          shownTriggersRef.current.add(triggerKey);
          if (hasRealHistory && convPct >= realConvPct) {
            showNotification("🔥", pick([
              `${totalSalesCount} vendas em ${totalApproaches} abordagens — ${convPct}% de conversão.\nAcima do teu normal (${realConvPct}%). Tá voando! Repete o que tá dando certo.`,
              `${convPct}% de conversão (${totalSalesCount}/${totalApproaches}).\nMelhor que o teu padrão de ${realConvPct}%. Não muda nada, segue assim! 🔥`,
              `${totalSalesCount} vendas, ${convPct}% de conversão.\nAcima do teu ${realConvPct}%. Dia de cobrar caro de si mesmo! 💪`,
            ]));
          } else if (hasRealHistory) {
            showNotification("🎯", pick([
              `${totalSalesCount} vendas em ${totalApproaches} abordagens — ${convPct}% de conversão.\nTeu normal é ${realConvPct}%. Capricha na abordagem que tu vira o jogo.`,
              `${convPct}% de conversão até agora (${totalSalesCount}/${totalApproaches}).\nDá pra subir — teu padrão é ${realConvPct}%. Sorri mais e vai com firmeza.`,
              `${totalSalesCount} vendas, ${convPct}%.\nTá abaixo do teu ${realConvPct}%. Respira, escolhe melhor a abordagem e ataca.`,
            ]));
          } else {
            showNotification("📈", pick([
              `${totalSalesCount} vendas em ${totalApproaches} abordagens — ${convPct}% de conversão.\nTá montando o teu ritmo. Cada abordagem conta — segue firme!`,
              `Já são ${totalSalesCount} vendas (${convPct}%).\nTá construindo o teu padrão. Mantém a constância! 📈`,
              `${totalSalesCount} vendas, ${convPct}% de conversão.\nDia tá tomando forma. Não afrouxa o ritmo! 💪`,
            ]));
          }
        }
      }
    }

    // TRIGGER 4 — Marco a cada 10 abordagens (conversão real)
    if (totalApproaches > 0 && totalApproaches % 10 === 0 && newApproach) {
      const triggerKey = `milestone_${totalApproaches}`;
      if (!shownTriggersRef.current.has(triggerKey)) {
        shownTriggersRef.current.add(triggerKey);
        if (hasRealHistory && convPct >= realConvPct) {
          showNotification("📊", pick([
            `${totalApproaches} abordagens, ${totalSalesCount} vendas — ${convPct}%.\nAcima do teu normal (${realConvPct}%). Não para agora!`,
            `Marco de ${totalApproaches} abordagens! ${convPct}% de conversão.\nAcima do teu ${realConvPct}%. Tá no modo elite. 🔥`,
          ]));
        } else {
          showNotification("📊", pick([
            `${totalApproaches} abordagens, ${totalSalesCount} vendas — ${convPct}% de conversão.\nMantém o ritmo que a meta vem. 💪`,
            `${totalApproaches} abordagens já! ${totalSalesCount} vendas no bolso.\nConstância é tudo — segue empilhando. 📊`,
            `Bateu ${totalApproaches} abordagens. ${convPct}% de conversão.\nNão afrouxa agora, o dia tá rendendo. 💪`,
          ]));
        }
      }
    }

    // TRIGGER 5 — sequência sem vender
    if (approachesSinceLastSaleRef.current >= 5 && newApproach) {
      const dryCount = approachesSinceLastSaleRef.current;
      const triggerKey = `dry_${Math.floor(dryCount / 5) * 5}`;
      if (!shownTriggersRef.current.has(triggerKey)) {
        shownTriggersRef.current.add(triggerKey);
        showNotification("💪", pick([
          `${dryCount} abordagens sem vender.\nFicou frio, mas a próxima tá logo ali. Vai com tudo!`,
          `${dryCount} sem fechar. Acontece.\nTroca a abordagem, sorri, oferece o kit. A virada vem!`,
          `${dryCount} abordagens secas.\nQuem insiste fura a seca. A próxima é tua! 💪`,
          `Sequência de ${dryCount} sem venda.\nRespira, muda o script e ataca a próxima com tudo.`,
        ]));
      }
    }

    prevSalesRef.current = totalSalesCount;
    prevApproachesRef.current = totalApproaches;
  }, [totalApproaches, totalSalesCount, phase, historicalLoaded]);

  if (notifications.length === 0) return null;

  return (
    <div
      className="fixed left-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}
    >
      {notifications.map((n) => (
        <NotificationCard
          key={n.id}
          notification={n}
          onDismiss={() => dismissNotification(n.id)}
          onHoldStart={() => holdStart(n.id)}
          onHoldEnd={() => holdEnd(n.id)}
        />
      ))}
    </div>
  );
}

function NotificationCard({
  notification,
  onDismiss,
  onHoldStart,
  onHoldEnd,
}: {
  notification: SmartNotification;
  onDismiss: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
}) {
  const [progress, setProgress] = useState(100);
  const [dragX, setDragX] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const startTimeRef = useRef(Date.now());
  const holdingRef = useRef(false);
  const pausedAtRef = useRef<number | null>(null);
  const elapsedBeforePauseRef = useRef(0);
  const dragStartXRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (holdingRef.current) return;
      const realElapsed = elapsedBeforePauseRef.current + (Date.now() - startTimeRef.current);
      const pct = Math.max(0, 100 - (realElapsed / NOTIFICATION_DURATION) * 100);
      setProgress(pct);
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const handlePressStart = (clientX: number) => {
    holdingRef.current = true;
    elapsedBeforePauseRef.current += Date.now() - startTimeRef.current;
    dragStartXRef.current = clientX;
    draggingRef.current = false;
    onHoldStart();
  };

  const handlePressMove = (clientX: number) => {
    if (dragStartXRef.current === null) return;
    const delta = clientX - dragStartXRef.current;
    if (Math.abs(delta) > 5) draggingRef.current = true;
    setDragX(delta);
  };

  const handlePressEnd = () => {
    const delta = dragX;
    const threshold = 80;
    if (Math.abs(delta) > threshold) {
      // Swipe out
      setDismissing(true);
      setDragX(delta > 0 ? 500 : -500);
      setTimeout(() => onDismiss(), 200);
      return;
    }
    // Snap back
    setDragX(0);
    holdingRef.current = false;
    startTimeRef.current = Date.now();
    dragStartXRef.current = null;
    draggingRef.current = false;
    onHoldEnd();
  };

  const opacity = dismissing ? 0 : Math.max(0.3, 1 - Math.abs(dragX) / 200);

  return (
    <div
      className="pointer-events-auto relative rounded-2xl overflow-hidden animate-in slide-in-from-top duration-300 touch-pan-y"
      style={{
        transform: `translateX(${dragX}px)`,
        opacity,
        transition: dragStartXRef.current === null || dismissing ? "transform 0.2s ease, opacity 0.2s ease" : "none",
        background: "linear-gradient(180deg, #1c1c22, #131317)",
        border: "1px solid rgba(246,180,10,0.30)",
        boxShadow: "0 16px 40px -14px rgba(0,0,0,0.85), 0 0 26px -10px rgba(246,180,10,0.35)",
      }}
      onTouchStart={(e) => handlePressStart(e.touches[0]!.clientX)}
      onTouchMove={(e) => handlePressMove(e.touches[0]!.clientX)}
      onTouchEnd={handlePressEnd}
      onMouseDown={(e) => handlePressStart(e.clientX)}
      onMouseMove={(e) => { if (dragStartXRef.current !== null) handlePressMove(e.clientX); }}
      onMouseUp={handlePressEnd}
      onMouseLeave={() => { if (dragStartXRef.current !== null) handlePressEnd(); }}
    >
      <div className="px-3.5 py-3 flex items-start gap-3">
        <div
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-lg"
          style={{ background: "rgba(246,180,10,0.16)", border: "1px solid rgba(246,180,10,0.40)" }}
        >
          {notification.icon}
        </div>
        <p className="text-[13.5px] font-semibold text-white/90 leading-snug tracking-tight flex-1 whitespace-pre-line">
          {notification.message}
        </p>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="flex-shrink-0 -mr-0.5 mt-0.5 text-white/30 active:text-white/70"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* Progress bar dourada */}
      <div className="h-1 w-full bg-black/40">
        <div
          className="h-full transition-none"
          style={{ width: `${progress}%`, background: "linear-gradient(90deg, #FFD057, #F6B40A)" }}
        />
      </div>
    </div>
  );
}
