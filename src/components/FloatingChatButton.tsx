import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Loader2, X, Plus, Menu, Trash2, Sparkles, Pencil, Mic, MicOff, Square } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { useAIConversations } from "@/hooks/useAIConversations";
import { supabase } from "@/integrations/supabase/client";
import { OrbisSphere, type SphereState } from "@/components/ai/OrbisSphere";
import { cn } from "@/shared/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Voz do modo VOZ: false = voz do Gemini (natural, melhor, leva ~poucos seg pra gerar);
// true = voz do aparelho (instantânea, porém robótica). Se o Gemini falhar, cai no aparelho.
const USE_INSTANT_VOICE = false;

export default function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef("");
  const [voiceMode, setVoiceMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const lastSpokenRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ttsTokenRef = useRef(0); // cada fala tem um token; uma fala nova invalida a anterior
  const voiceEngineRef = useRef<"gemini" | "browser" | null>(null); // trava o motor da voz por sessão (sem flip-flop)
  const isRecordingRef = useRef(false); // espelho de isRecording pra checar dentro de callbacks
  const speakingRef = useRef(false);    // espelho de speaking (a IA está falando agora)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTextRef = useRef("");    // transcrição atual da fala do usuário
  const stopSpeaking = () => {
    ttsTokenRef.current++; // invalida qualquer TTS em andamento (foca na fala nova)
    try { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; } } catch { /* noop */ }
    try { if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel(); } catch { /* noop */ }
    setSpeaking(false);
  };
  const speechSupported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const requestClose = () => {
    if (typeof window !== "undefined" && (window.history.state as any)?.orbisChat) {
      window.history.back();
    } else {
      setIsOpen(false);
    }
  };

  const toggleRecording = () => {
    if (!speechSupported) return;
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }
    stopSpeaking(); // corta a fala da IA quando o usuario vai falar de novo
    // garante que nenhum reconhecimento anterior ficou preso (causa de não gravar na 2a vez)
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    recognitionRef.current = null;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    // No modo voz, cada fala recomeça do zero (foca na mensagem nova, não junta com a anterior).
    if (voiceMode) {
      baseInputRef.current = "";
      setInput("");
    } else {
      baseInputRef.current = input ? input.trim() + " " : "";
    }
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setInput(baseInputRef.current + transcript);
    };
    rec.onstart = () => { setIsRecording(true); isRecordingRef.current = true; }; // só marca quando começou DE VERDADE
    rec.onend = () => {
      setIsRecording(false);
      isRecordingRef.current = false;
      recognitionRef.current = null;
    };
    rec.onerror = () => {
      setIsRecording(false);
      isRecordingRef.current = false;
      recognitionRef.current = null;
    };
    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      // não conseguiu iniciar (estado preso): zera tudo pra o usuario tocar de novo e funcionar
      setIsRecording(false);
      isRecordingRef.current = false;
      recognitionRef.current = null;
    }
  };

  const {
    conversations,
    activeId,
    setActiveId,
    messages,
    isLoading,
    isSending,
    createConversation,
    renameConversation,
    deleteConversation,
    sendMessage,
  } = useAIConversations();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  // Fecha o chat com o botão/gesto de voltar do celular (sem reabrir)
  useEffect(() => {
    if (!isOpen) return;
    window.history.pushState({ orbisChat: true }, "");
    const onPopState = () => setIsOpen(false);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [isOpen]);

  // Para a gravação de voz ao fechar o chat
  useEffect(() => {
    if (!isOpen) {
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
      recognitionRef.current?.stop();
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
      setVoiceMode(false);
      stopSpeaking();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  useEffect(() => {
    if (!isOpen || sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, sidebarOpen]);

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    recognitionRef.current?.stop();
    sendMessage(input.trim());
    setInput("");
  };

  const SUGGESTIONS = [
    "Como melhorar minha conversão?",
    "Me motiva pra hoje",
    "Os 5 princípios da abordagem",
    "Como não tomar calote?",
  ];
  const sendSuggestion = (text: string) => {
    if (isSending) return;
    recognitionRef.current?.stop();
    sendMessage(text);
  };

  // ---- Modo voz ----
  // Voz do Gemini (servidor) — melhor e funciona no celular. Cai pra voz do navegador se falhar.
  const speak = async (text: string) => {
    if (!text) return;
    stopSpeaking();                       // corta a fala anterior — foca na nova
    const myToken = ++ttsTokenRef.current; // token desta fala
    setSpeaking(true);

    // Se nesta sessão a voz do Gemini já se mostrou indisponível, mantém a voz do
    // navegador (consistência — não fica alternando robô/voz-boa no meio da conversa).
    if (voiceEngineRef.current === "browser") {
      setSpeaking(false);
      speakBrowser(text);
      return;
    }

    // Tenta a voz do Gemini até 2x.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data } = await supabase.functions.invoke("bright-action", { body: { tts: text } });
        if (myToken !== ttsTokenRef.current) return; // já começou uma fala mais nova: ignora esta
        const b64 = (data as any)?.audio;
        if (b64 && audioRef.current) {
          voiceEngineRef.current = "gemini"; // funcionou: trava na voz boa nesta sessão
          const a = audioRef.current;
          a.src = "data:" + ((data as any)?.mime || "audio/wav") + ";base64," + b64;
          a.onended = () => { if (myToken === ttsTokenRef.current) setSpeaking(false); };
          a.onerror = () => { if (myToken === ttsTokenRef.current) { setSpeaking(false); speakBrowser(text); } };
          await a.play();
          return;
        }
      } catch (e) {
        if (myToken !== ttsTokenRef.current) return; // cancelada por uma fala nova
        console.warn("TTS Gemini falhou (tentativa " + (attempt + 1) + ")", e);
      }
      if (myToken !== ttsTokenRef.current) return;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 600)); // respira e tenta de novo
    }

    // Gemini falhou 2x. Se NUNCA funcionou nesta sessão, trava no navegador (consistência).
    if (voiceEngineRef.current !== "gemini") voiceEngineRef.current = "browser";
    if (myToken !== ttsTokenRef.current) return;
    setSpeaking(false);
    speakBrowser(text);
  };

  // ===== VOZ POR TOQUE (1 toque por mensagem — funciona no iPhone) =====
  // Toca o microfone, fala; quando você pausa (~1,5s) ele manda sozinho. A IA responde
  // por voz. Pra próxima pergunta, toca de novo (o iPhone exige um toque a cada vez).
  const sendPending = () => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    const text = pendingTextRef.current.trim();
    pendingTextRef.current = "";
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    if (text) { setInput(""); sendMessage(text); }
  };

  const stopVoice = () => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    stopSpeaking();
  };

  const startTalk = () => {
    if (!speechSupported) return;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    stopSpeaking(); // corta a fala da IA (se estiver falando) e passa a te ouvir
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    recognitionRef.current = null;
    // desbloqueia o áudio DENTRO do toque (necessário no iPhone pra IA conseguir falar depois)
    try {
      window.speechSynthesis?.resume();
      const warm = new SpeechSynthesisUtterance(" "); warm.volume = 0; window.speechSynthesis?.speak(warm);
    } catch { /* noop */ }
    // desbloqueia também o player de áudio (a voz do Gemini toca por ele — sem isso o iPhone bloqueia)
    if (audioRef.current) {
      try {
        audioRef.current.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
        audioRef.current.play().catch(() => {});
      } catch { /* noop */ }
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    setInput("");
    pendingTextRef.current = "";
    rec.onresult = (e: any) => {
      let full = "";
      for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript;
      pendingTextRef.current = full;
      setInput(full.trim());
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (full.trim()) silenceTimerRef.current = setTimeout(sendPending, 1500); // pausou ~1,5s: manda
    };
    rec.onstart = () => { setIsRecording(true); isRecordingRef.current = true; };
    rec.onend = () => { setIsRecording(false); isRecordingRef.current = false; recognitionRef.current = null; };
    rec.onerror = () => {
      setIsRecording(false); isRecordingRef.current = false; recognitionRef.current = null;
      if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    };
    recognitionRef.current = rec;
    try { rec.start(); } catch { /* noop */ }
  };

  const speakBrowser = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const run = () => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-BR";
      u.rate = 1.05;
      const voices = synth.getVoices();
      const ptVoices = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("pt"));
      const maleHint = /(daniel|male|masc|homem|felipe|ricardo|jo[a\u00e3]o|ant[o\u00f4]nio|carlos|paulo|thiago|lucas)/i;
      const pt = ptVoices.find((v) => maleHint.test(v.name)) || ptVoices[0];
      if (pt) u.voice = pt;
      u.onstart = () => { setSpeaking(true); speakingRef.current = true; };
      u.onend = () => { setSpeaking(false); speakingRef.current = false; };
      u.onerror = () => { setSpeaking(false); speakingRef.current = false; };
      try { synth.resume(); } catch { /* noop */ }
      synth.speak(u);
    };
    if (synth.getVoices().length) {
      run();
    } else {
      synth.onvoiceschanged = () => { synth.onvoiceschanged = null; run(); };
    }
  };
  const enterVoiceMode = () => {
    voiceEngineRef.current = null; // recomeça avaliando a voz do Gemini a cada sessão de voz
    setVoiceMode(true);
  };
  const exitVoiceMode = () => {
    stopVoice();
    recognitionRef.current?.stop();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    stopSpeaking();
    setVoiceMode(false);
  };
  const voiceSend = () => {
    // Desbloqueia o audio do navegador dentro do gesto do usuario (necessario em alguns browsers/celular)
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.resume();
        const warm = new SpeechSynthesisUtterance(" ");
        warm.volume = 0;
        window.speechSynthesis.speak(warm);
      } catch { /* noop */ }
    }
    if (audioRef.current) {
      try {
        audioRef.current.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
        audioRef.current.play().catch(() => {});
      } catch { /* noop */ }
    }
    const text = input.trim();
    recognitionRef.current?.stop();
    if (text) { sendMessage(text); setInput(""); }
  };
  const voiceListen = () => {
    if (!isRecording) toggleRecording();
  };

  // Fala a resposta da IA quando chega (só no modo voz)
  useEffect(() => {
    if (!voiceMode) return;
    if (isRecordingRef.current) return; // usuário está falando: não fala por cima (interrompeu)
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && last.id !== lastSpokenRef.current) {
      lastSpokenRef.current = last.id;
      // Não fala mensagem de erro do chat (evita ouvir "Desculpe, tive um problema...")
      if (last.content.startsWith("Desculpe, tive um problema")) return;
      if (USE_INSTANT_VOICE) speakBrowser(last.content); // voz do aparelho — instantânea
      else speak(last.content);                          // voz do Gemini — bonita, porém ~30s
    }
  }, [messages, voiceMode]);

  // Pre-carrega as vozes do navegador (algumas so ficam disponiveis de forma assincrona)
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    const onVoices = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", onVoices);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", onVoices);
  }, []);

  const handleNewChat = async () => {
    await createConversation();
    setSidebarOpen(false);
  };

  const handleSelect = (id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
  };

  const startRename = (id: string, current: string) => {
    setRenamingId(id);
    setRenameValue(current);
  };

  const confirmRename = async () => {
    if (renamingId && renameValue.trim()) {
      await renameConversation(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const voiceState: SphereState = isSending ? "processing" : speaking ? "responding" : isRecording ? "listening" : "idle";
  const voiceLabel = isSending ? "PROCESSANDO" : speaking ? "RESPONDENDO" : isRecording ? "OUVINDO" : "TOQUE PRA FALAR";

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => { voiceEngineRef.current = null; setIsOpen(true); setVoiceMode(true); }}
        className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 md:bottom-8 md:right-8 h-14 w-14 rounded-full shadow-glow-primary bg-[#0a0a0a] border border-primary/30 hover:opacity-90 transition-smooth z-40 p-0 overflow-hidden flex items-center justify-center"
        size="icon"
        aria-label="Abrir Orbis IA"
      >
        <OrbisSphere size={44} state="idle" />
      </Button>

      <audio ref={audioRef} className="hidden" preload="auto" />

      {/* Full-screen ChatGPT-style overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex flex-col animate-in fade-in duration-200"
          style={{ background: "radial-gradient(ellipse 110% 38% at 50% 0%, rgba(201,168,76,0.10), transparent 60%), hsl(var(--background))" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="floating-chat-title"
        >
          {/* Top bar */}
          <header className="flex items-center justify-between px-3 min-h-[3.5rem] border-b border-border/60 bg-background/95 backdrop-blur safe-top">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} aria-label="Conversas">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <OrbisSphere size={28} state="idle" />
              <div className="leading-tight">
                <span id="floating-chat-title" className="font-bold text-sm tracking-[0.12em] bg-gradient-to-r from-[#C9A84C] to-[#F5D78E] bg-clip-text text-transparent">ORBIS IA</span>
                <p className="text-[10px] text-emerald-400/80 -mt-0.5">● online</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={enterVoiceMode}
                className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-primary/10 border border-primary/30 text-primary/80 tracking-[0.15em]"
                aria-label="Modo voz"
              >
                VOZ
              </button>
              <Button variant="ghost" size="icon" onClick={requestClose} aria-label="Fechar">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </header>

          {/* Messages */}
          <ScrollArea className="flex-1" ref={scrollRef}>
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
              {!activeId && messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16">
                  <div className="mb-4"><OrbisSphere size={88} state="listening" /></div>
                  <h2 className="text-2xl font-bold mb-2">Como posso ajudar?</h2>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Pergunte sobre vendas, metas, finanças ou rotina.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center mt-5 max-w-xs">
                    {SUGGESTIONS.map((sug) => (
                      <button
                        key={sug}
                        onClick={() => sendSuggestion(sug)}
                        className="px-3 py-1.5 rounded-full text-xs bg-primary/10 border border-primary/30 text-primary/90 hover:bg-primary/20 transition-colors"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              ) : isLoading && messages.length === 0 ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}
                    >
                      {m.role === "assistant" && (
                        <div className="shrink-0"><OrbisSphere size={30} state="responding" /></div>
                      )}
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed",
                          m.role === "user"
                            ? "bg-primary/15 border border-primary/30 text-foreground rounded-br-md"
                            : "bg-muted/60 border border-border text-foreground rounded-bl-md"
                        )}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {isSending && (
                    <div className="flex gap-3 justify-start">
                      <div className="shrink-0"><OrbisSphere size={30} state="processing" /></div>
                      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.15s]" />
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.3s]" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t border-border/60 bg-background/95 backdrop-blur safe-bottom">
            <div className="max-w-2xl mx-auto p-3 flex items-end gap-2">
              {speechSupported && (
                <Button
                  type="button"
                  onClick={toggleRecording}
                  variant={isRecording ? "default" : "ghost"}
                  className={cn(
                    "h-11 w-11 p-0 rounded-full shrink-0",
                    isRecording && "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                  )}
                  aria-label={isRecording ? "Parar gravação de voz" : "Falar por voz"}
                >
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
              )}
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Pergunte algo..."
                disabled={isSending}
                rows={1}
                className="flex-1 resize-none min-h-[44px] max-h-32 rounded-2xl bg-muted/40 border-border/60"
              />
              <Button
                onClick={handleSend}
                disabled={isSending || !input.trim()}
                className="h-11 w-11 p-0 rounded-full bg-gradient-primary hover:opacity-90"
                aria-label="Enviar"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Voice mode */}
          {voiceMode && (
            <div
              className="absolute inset-0 z-[66] flex flex-col animate-in fade-in duration-200"
              style={{ background: "radial-gradient(ellipse 120% 50% at 50% 18%, rgba(201,168,76,0.10), transparent 62%), hsl(var(--background))" }}
              role="dialog"
              aria-modal="true"
            >
              <header className="flex items-center justify-between px-4 min-h-[3.5rem] safe-top">
                <div className="flex items-center gap-2">
                  <OrbisSphere size={26} state="idle" />
                  <span className="font-bold text-sm tracking-[0.12em] bg-gradient-to-r from-[#C9A84C] to-[#F5D78E] bg-clip-text text-transparent">ORBIS IA</span>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-primary/15 border border-primary/30 text-primary/80 tracking-[0.15em]">VOZ</span>
              </header>

              <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-7">
                <OrbisSphere size={210} state={voiceState} />
                <div className="space-y-2">
                  <p className="text-[11px] tracking-[0.35em] text-muted-foreground uppercase">{voiceLabel}</p>
                  <p className="text-base text-foreground/80 italic min-h-[3.5rem] max-w-[16rem] mx-auto leading-relaxed">
                    {input || (isSending ? "..." : isRecording ? "Pode falar..." : "Toque no microfone pra falar")}
                  </p>
                </div>
                <button
                  onClick={isRecording ? sendPending : startTalk}
                  className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center transition-all",
                    isRecording
                      ? "bg-red-500/15 border border-red-500/40 text-red-400"
                      : "bg-primary/15 border border-primary/40 text-primary"
                  )}
                  aria-label={isRecording ? "Enviar" : "Falar"}
                >
                  {isRecording ? <Square className="w-6 h-6" /> : <Mic className="w-7 h-7" />}
                </button>
              </div>

              <div className="pb-8 flex justify-center safe-bottom">
                <button onClick={exitVoiceMode} className="text-xs text-muted-foreground hover:text-foreground">
                  usar o chat de texto
                </button>
              </div>
            </div>
          )}

          {/* Sidebar (conversation list) */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-[70] bg-black/60 animate-in fade-in"
              onClick={() => setSidebarOpen(false)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="floating-chat-sidebar-title"
            >
              <aside
                className="absolute left-0 top-0 bottom-0 w-[82%] max-w-xs bg-card border-r border-border/60 flex flex-col animate-in slide-in-from-left duration-200 safe-top safe-bottom"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id="floating-chat-sidebar-title" className="sr-only">
                  Conversas
                </h2>
                <div className="p-3 border-b border-border/60 flex items-center gap-2">
                  <Button onClick={handleNewChat} className="flex-1 justify-start gap-2 bg-gradient-primary hover:opacity-90">
                    <Plus className="h-4 w-4" /> Nova conversa
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {conversations.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8 px-4">
                        Nenhuma conversa ainda. Crie uma nova para começar.
                      </p>
                    ) : (
                      conversations.map((c) => (
                        <div
                          key={c.id}
                          className={cn(
                            "group rounded-lg px-3 py-2 cursor-pointer transition-colors",
                            activeId === c.id ? "bg-muted" : "hover:bg-muted/60"
                          )}
                          onClick={() => handleSelect(c.id)}
                        >
                          {renamingId === c.id ? (
                            <Input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onBlur={confirmRename}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") confirmRename();
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="h-7 text-sm"
                            />
                          ) : (
                            <>
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium truncate flex-1">{c.title}</p>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startRename(c.id, c.title);
                                    }}
                                    className="p-1 rounded hover:bg-background"
                                    aria-label="Renomear"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm("Apagar esta conversa?")) deleteConversation(c.id);
                                    }}
                                    className="p-1 rounded hover:bg-background text-destructive"
                                    aria-label="Apagar"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatDistanceToNow(new Date(c.last_message_at), { locale: ptBR, addSuffix: true })}
                              </p>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </aside>
            </div>
          )}
        </div>
      )}
    </>
  );
}
