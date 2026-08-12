import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Loader2, X, Plus, Menu, Trash2, Sparkles, Pencil, Mic, MicOff, Square, Download } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { useAIConversations } from "@/hooks/useAIConversations";
import { useAuth } from "@/hooks/useAuth";
import EstudioMarca, { type EstudioBrief } from "@/components/estudio/EstudioMarca";
import { supabase } from "@/integrations/supabase/client";
import { OrbisSphere, type SphereState } from "@/components/ai/OrbisSphere";
import { cn } from "@/shared/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Voz do modo VOZ: false = voz do servidor (Gemini TTS oficial, com fallbacks — natural, toca no iPhone).
// true = voz do aparelho (instantânea, robótica). Se o servidor falhar, cai nela sozinho.
const USE_INSTANT_VOICE = false;

export default function FloatingChatButton() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  // Briefing do adesivo montado na conversa (fallback: abre o Estúdio pra gerar por lá)
  const [estudioBrief, setEstudioBrief] = useState<EstudioBrief | null>(null);
  // Arte que a IA gerou DENTRO do chat — abre o editor só pra encaixar o QR Pix e baixar
  const [estudioArte, setEstudioArte] = useState<string | null>(null);
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
    speakingRef.current = false;
  };
  // Reconhecimento nativo do navegador (Chrome/Safari). Onde NÃO existe (Firefox,
  // vários WebViews Android), caímos no plano B: gravar com MediaRecorder e
  // transcrever no servidor — o microfone funciona em TODO aparelho.
  const nativeSpeech =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const speechSupported =
    nativeSpeech ||
    (typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined");
  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const voiceModeRef = useRef(false);
  useEffect(() => { voiceModeRef.current = voiceMode; }, [voiceMode]);

  // ---- Plano B do microfone: grava e transcreve no servidor (Gemini) ----
  const startRecFallback = async (onText: (t: string) => void) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]
        .find((m) => MediaRecorder.isTypeSupported?.(m)) || "";
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false); isRecordingRef.current = false; mediaRecRef.current = null;
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        if (blob.size < 1500) return; // gravação vazia/curtíssima
        setTranscribing(true);
        try {
          const b64 = await new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result).split(",")[1] || "");
            fr.onerror = reject;
            fr.readAsDataURL(blob);
          });
          const { data } = await supabase.functions.invoke("bright-action", { body: { stt: b64, mime: blob.type } });
          const text = ((data as any)?.text || "").trim();
          if (text) onText(text);
        } catch { /* transcrição falhou: usuário grava de novo */ }
        setTranscribing(false);
      };
      mediaRecRef.current = mr;
      mr.start();
      setIsRecording(true); isRecordingRef.current = true;
    } catch {
      setIsRecording(false); isRecordingRef.current = false; mediaRecRef.current = null;
    }
  };
  const stopRecFallback = () => { try { mediaRecRef.current?.stop(); } catch { /* noop */ } };

  const requestClose = () => {
    if (typeof window !== "undefined" && (window.history.state as any)?.orbisChat) {
      window.history.back();
    } else {
      setIsOpen(false);
    }
  };

  const toggleRecording = () => {
    if (!speechSupported) return;
    // Navegador SEM reconhecimento nativo: grava e transcreve no servidor.
    if (!nativeSpeech) {
      if (isRecording) { stopRecFallback(); return; }
      stopSpeaking();
      const base = voiceMode ? "" : (input ? input.trim() + " " : "");
      if (voiceMode) setInput("");
      startRecFallback((text) => {
        if (voiceModeRef.current) { sendMessage(text, { voz: true }); setInput(""); }
        else setInput(base + text);
      });
      return;
    }
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
    action,
    clearAction,
  } = useAIConversations();

  // A IA montou o briefing do adesivo na conversa -> abre o Estúdio já preenchido
  useEffect(() => {
    if (action?.tipo === "gerar_adesivo") {
      setEstudioBrief((action.dados as EstudioBrief) || {});
      clearAction();
    }
  }, [action, clearAction]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  // Desenhar o adesivo leva ~1 minuto (IA de imagem e' lenta mesmo). Sem aviso, o
  // vendedor acha que travou e fecha o app no meio da geracao. Depois de 6s de espera
  // a gente conta o que esta' acontecendo, em vez de so' tres bolinhas pulando.
  const [esperaLonga, setEsperaLonga] = useState(false);
  useEffect(() => {
    if (!isSending) { setEsperaLonga(false); return; }
    const t = setTimeout(() => setEsperaLonga(true), 6000);
    return () => clearTimeout(t);
  }, [isSending]);
  const ultimaMinha = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const avisoEspera = /adesivo|arte|logo|r[óo]tulo|marca|gera/i.test(ultimaMinha)
    ? "Desenhando tua arte... leva até 1 minuto. Não fecha essa tela."
    : "Pensando com calma aqui...";

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
      stopRecFallback();
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

  // A primeira sugestão inicia a CO-CRIAÇÃO do adesivo premium (a IA conduz a conversa)
  const SUGGESTION_ADESIVO = "Quero criar o adesivo premium da minha marca";
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

  // Renderiza o conteúdo da mensagem: texto normal + artes geradas no chat
  // (o servidor manda [[adesivo:URL]] quando a IA desenha o adesivo na conversa).
  const renderContent = (content: string) => {
    const partes = content.split(/(\[\[adesivo:https?:\/\/[^\]\s]+\]\])/g);
    return partes.map((p, i) => {
      const m = /^\[\[adesivo:(https?:\/\/[^\]\s]+)\]\]$/.exec(p);
      if (m) {
        return (
          <div key={i} className="mt-2 space-y-2">
            <img
              src={m[1]} alt="Adesivo criado pela Orbis IA"
              className="w-full max-w-[260px] rounded-xl border border-border"
              loading="lazy"
            />
            <Button size="sm" onClick={() => setEstudioArte(m[1])} className="h-9 bg-gradient-primary">
              <Download className="w-4 h-4 mr-1.5" /> Colocar meu QR Pix e baixar
            </Button>
          </div>
        );
      }
      return p ? <span key={i}>{p}</span> : null;
    });
  };

  // ---- Modo voz ----
  // Quebra o texto em pedaços de ~1-2 frases: o 1º pedaço vira áudio e começa a tocar
  // em ~2s, enquanto os próximos são gerados em paralelo. Nada de esperar a fala inteira.
  const splitForSpeech = (text: string): string[] => {
    const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?…]+[.!?…]+["')\]]*|[^.!?…]+$/g) || [text];
    const chunks: string[] = [];
    let cur = "";
    for (const s of sentences) {
      // O PRIMEIRO pedaço é curto de propósito: é o que define quanto tempo o
      // vendedor fica no silêncio olhando pro celular. Os seguintes são maiores
      // (menos chamadas) porque já estão sendo gerados enquanto o 1º toca.
      const teto = chunks.length === 0 ? 90 : 220;
      if (cur && (cur + s).length > teto) { chunks.push(cur.trim()); cur = s; }
      else cur += s;
    }
    if (cur.trim()) chunks.push(cur.trim());
    return chunks.filter(Boolean);
  };

  const fetchTTS = async (text: string): Promise<string | null> => {
    try {
      const { data } = await supabase.functions.invoke("bright-action", { body: { tts: text } });
      const b64 = (data as any)?.audio;
      if (!b64) return null;
      return "data:" + ((data as any)?.mime || "audio/wav") + ";base64," + b64;
    } catch { return null; }
  };

  const playSrc = (src: string, myToken: number) =>
    new Promise<boolean>((resolve) => {
      const a = audioRef.current;
      if (!a || myToken !== ttsTokenRef.current) { resolve(false); return; }
      a.src = src;
      a.onended = () => resolve(true);
      a.onerror = () => resolve(false);
      a.play().then(undefined, () => resolve(false));
    });

  // Voz do servidor (Gemini oficial, com fallbacks) falada POR PARTES. Se falhar, voz do navegador.
  const speak = async (text: string) => {
    if (!text) return;
    stopSpeaking();                        // corta a fala anterior — foca na nova
    const myToken = ++ttsTokenRef.current; // token desta fala
    setSpeaking(true);
    speakingRef.current = true;

    if (voiceEngineRef.current === "browser") {
      setSpeaking(false); speakingRef.current = false;
      speakBrowser(text);
      return;
    }

    const chunks = splitForSpeech(text);
    // dispara a geração dos pedaços em paralelo (limitada pela ordem de consumo)
    const jobs: Promise<string | null>[] = chunks.map((c, i) =>
      i === 0 ? fetchTTS(c) : new Promise((res) => setTimeout(() => fetchTTS(c).then(res), i * 150))
    );

    let anyOk = false;
    for (let i = 0; i < jobs.length; i++) {
      let src = await jobs[i];
      if (myToken !== ttsTokenRef.current) return; // interrompida por fala nova
      // Pedaço do MEIO que falhou: tenta uma vez mais antes de desistir. Sem isso a
      // IA pulava uma frase no meio da fala e o vendedor ouvia um "nada com nada".
      if (!src && anyOk) {
        src = await fetchTTS(chunks[i]);
        if (myToken !== ttsTokenRef.current) return;
      }
      if (src) {
        anyOk = true;
        voiceEngineRef.current = "gemini";
        const ok = await playSrc(src, myToken);
        if (myToken !== ttsTokenRef.current) return;
        if (!ok && !anyOk) break; // nem tocar deu: cai pro navegador
      } else if (!anyOk) {
        break; // 1º pedaço já falhou: cai pro navegador com o texto inteiro
      } else {
        // 2ª tentativa também falhou: termina o resto na voz do aparelho em vez
        // de engolir metade da resposta.
        speakBrowser(chunks.slice(i).join(" "));
        return;
      }
    }

    if (myToken !== ttsTokenRef.current) return;
    setSpeaking(false);
    speakingRef.current = false;
    if (!anyOk) {
      if (voiceEngineRef.current !== "gemini") voiceEngineRef.current = "browser";
      speakBrowser(text);
      return;
    }
    // Conversa contínua: acabou de falar no modo voz -> volta a ouvir sozinho (fora do iPhone,
    // que exige um toque por gravação).
    if (voiceModeRef.current && nativeSpeech && !isIOS) {
      setTimeout(() => {
        if (voiceModeRef.current && !speakingRef.current && !isRecordingRef.current) startTalk();
      }, 350);
    }
  };

  // ===== VOZ POR TOQUE (1 toque por mensagem — funciona no iPhone) =====
  // Toca o microfone, fala; quando você pausa (~1,5s) ele manda sozinho. A IA responde
  // por voz. Pra próxima pergunta, toca de novo (o iPhone exige um toque a cada vez).
  // ANTI-DUPLICATA: o reconhecimento dispara um último resultado ATRASADO depois do
  // envio, que re-armava o timer e mandava a MESMA fala 2x — aí chegavam 2 respostas
  // quase juntas e a voz falava uma por cima da outra (o "nada com nada"). Agora o
  // reconhecimento é descartado ANTES do envio e envio igual em <8s é ignorado.
  const lastSentRef = useRef<{ t: string; ts: number }>({ t: "", ts: 0 });
  const sendPending = () => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (!nativeSpeech) { stopRecFallback(); return; } // plano B: parar a gravação já transcreve e envia
    const text = pendingTextRef.current.trim();
    pendingTextRef.current = "";
    const rec = recognitionRef.current;
    recognitionRef.current = null; // resultados atrasados deste reconhecimento serão ignorados
    try { rec?.stop(); } catch { /* noop */ }
    if (!text) return;
    const agora = Date.now();
    if (text === lastSentRef.current.t && agora - lastSentRef.current.ts < 8000) return; // duplicata
    lastSentRef.current = { t: text, ts: agora };
    setInput("");
    sendMessage(text, { voz: voiceModeRef.current });
  };

  const stopVoice = () => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    stopRecFallback();
    stopSpeaking();
  };

  const startTalk = () => {
    if (!speechSupported) return;
    // Navegador sem reconhecimento nativo: grava, transcreve no servidor e envia sozinho.
    if (!nativeSpeech) {
      stopSpeaking();
      setInput("");
      startRecFallback((text) => { if (voiceModeRef.current) sendMessage(text, { voz: true }); else setInput(text); });
      return;
    }
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
      if (recognitionRef.current !== rec) return; // resultado atrasado de reconhecimento já descartado
      let full = "";
      for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript;
      pendingTextRef.current = full;
      setInput(full.trim());
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      // 900ms em vez de 1500: no modo voz esse silencio e tempo morto puro — o
      // vendedor ja terminou de falar e esta so esperando. 900ms ainda absorve a
      // pausa natural do meio da frase.
      if (full.trim()) silenceTimerRef.current = setTimeout(sendPending, 900);
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
      // Escolhe a MELHOR voz: prefere aprimorada/premium/siri/google/neural, em pt-BR, e masculina.
      const score = (v: SpeechSynthesisVoice) => {
        const n = (v.name || "").toLowerCase();
        let s = 0;
        if ((v.lang || "").toLowerCase() === "pt-br") s += 2;
        if (/(enhanced|premium|aprimorad|siri|neural|google|natural)/.test(n)) s += 4;
        if (maleHint.test(n)) s += 1;
        return s;
      };
      const pt = [...ptVoices].sort((a, b) => score(b) - score(a))[0];
      if (pt) u.voice = pt;
      u.onstart = () => { setSpeaking(true); speakingRef.current = true; };
      u.onend = () => {
        setSpeaking(false); speakingRef.current = false;
        // conversa contínua também na voz do navegador (fora do iPhone)
        if (voiceModeRef.current && nativeSpeech && !isIOS) {
          setTimeout(() => {
            if (voiceModeRef.current && !speakingRef.current && !isRecordingRef.current) startTalk();
          }, 350);
        }
      };
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
      // Não lê o marcador da arte gerada no chat (a imagem aparece na tela, não na voz)
      const falavel = last.content.replace(/\[\[adesivo:[^\]]+\]\]/g, "").trim();
      if (!falavel) return;
      if (USE_INSTANT_VOICE) speakBrowser(falavel); // voz do aparelho — instantânea
      else speak(falavel);                          // voz do Gemini — bonita, porém ~30s
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

  const voiceState: SphereState = (isSending || transcribing) ? "processing" : speaking ? "responding" : isRecording ? "listening" : "idle";
  const voiceLabel = transcribing ? "ENTENDENDO" : isSending ? "PROCESSANDO" : speaking ? "RESPONDENDO" : isRecording ? "OUVINDO" : "TOQUE PRA FALAR";

  return (
    <>
      {/* Floating Button — abre direto no CHAT DE TEXTO (a voz fica a 1 toque, no topo) */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 md:bottom-8 md:right-8 h-14 w-14 rounded-full shadow-glow-primary bg-[#0a0a0a] border border-primary/30 hover:opacity-90 transition-smooth z-40 p-0 overflow-hidden flex items-center justify-center"
        size="icon"
        aria-label="Abrir Orbis IA"
      >
        <OrbisSphere size={44} state="idle" />
      </Button>

      <audio ref={audioRef} className="hidden" preload="auto" />

      {/* Estúdio de Marca: fallback com briefing OU editor de QR pra arte gerada no chat */}
      {estudioBrief && user && <EstudioMarca userId={user.id} brief={estudioBrief} onClose={() => setEstudioBrief(null)} />}
      {estudioArte && user && <EstudioMarca userId={user.id} arteInicial={estudioArte} onClose={() => setEstudioArte(null)} />}

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
                <span id="floating-chat-title" className="font-bold text-sm tracking-[0.12em] text-primary">ORBIS IA</span>
                <p className="text-xs text-success">● online</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {speechSupported && (
                <button
                  onClick={enterVoiceMode}
                  className="flex items-center gap-1.5 h-10 px-3.5 rounded-full bg-primary/15 border border-primary/40 text-primary hover:bg-primary/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Conversar por voz"
                >
                  <Mic className="w-4 h-4" />
                  <span className="text-xs font-bold tracking-wide">VOZ</span>
                </button>
              )}
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
                    Pergunte sobre vendas, metas, finanças ou rotina — por texto ou tocando em VOZ.
                  </p>
                  <button
                    onClick={() => sendSuggestion(SUGGESTION_ADESIVO)}
                    className="mt-5 w-full max-w-xs h-12 rounded-2xl bg-gradient-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Sparkles className="w-4 h-4" /> Gerar seu adesivo premium
                  </button>
                  <div className="flex flex-wrap gap-2 justify-center mt-3 max-w-xs">
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
                        {renderContent(m.content)}
                      </div>
                    </div>
                  ))}
                  {isSending && (
                    <div className="flex gap-3 justify-start">
                      <div className="shrink-0"><OrbisSphere size={30} state="processing" /></div>
                      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex gap-2 items-center">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.15s]" />
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.3s]" />
                        {esperaLonga && (
                          <span className="ml-1 text-xs text-muted-foreground">{avisoEspera}</span>
                        )}
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
                    isRecording && "bg-destructive hover:bg-destructive/90 text-destructive-foreground animate-pulse"
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
                  <span className="font-bold text-sm tracking-[0.12em] text-primary">ORBIS IA</span>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-primary/15 border border-primary/30 text-primary/80 tracking-[0.15em]">VOZ</span>
              </header>

              <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-7">
                <OrbisSphere size={210} state={voiceState} />
                <div className="space-y-2">
                  <p className="text-xs tracking-[0.35em] text-muted-foreground uppercase">{voiceLabel}</p>
                  <p className="text-base text-foreground/80 italic min-h-[3.5rem] max-w-[16rem] mx-auto leading-relaxed">
                    {input || (transcribing ? "Entendendo o que você falou..." : isSending ? "..." : isRecording ? "Pode falar..." : "Toque no microfone pra falar")}
                  </p>
                </div>
                <button
                  onClick={isRecording ? sendPending : startTalk}
                  className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center transition-colors",
                    isRecording
                      ? "bg-destructive/15 border border-destructive/40 text-destructive"
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
