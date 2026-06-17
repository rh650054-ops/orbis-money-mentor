import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Loader2, X, Plus, Menu, Trash2, Sparkles, Pencil, Mic, MicOff } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { useAIConversations } from "@/hooks/useAIConversations";
import { OrbisSphere } from "@/components/ai/OrbisSphere";
import { cn } from "@/shared/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    baseInputRef.current = input ? input.trim() + " " : "";
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setInput(baseInputRef.current + transcript);
    };
    rec.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };
    rec.onerror = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = rec;
    setIsRecording(true);
    try {
      rec.start();
    } catch {
      /* já em gravação */
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
    if (!isOpen && recognitionRef.current) {
      recognitionRef.current.stop();
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

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 md:bottom-8 md:right-8 h-14 w-14 rounded-full shadow-glow-primary bg-[#0a0a0a] border border-primary/30 hover:opacity-90 transition-smooth z-40 p-0 overflow-hidden flex items-center justify-center"
        size="icon"
        aria-label="Abrir Orbis IA"
      >
        <OrbisSphere size={44} state="idle" />
      </Button>

      {/* Full-screen ChatGPT-style overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex flex-col animate-in fade-in duration-200"
          style={{ background: "radial-gradient(ellipse 110% 38% at 50% 0%, rgba(201,168,76,0.07), #060608 55%)" }}
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
            <Button variant="ghost" size="icon" onClick={requestClose} aria-label="Fechar">
              <X className="h-5 w-5" />
            </Button>
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
                            ? "bg-primary/15 border border-primary/30 text-[#F5D78E] rounded-br-md"
                            : "bg-white/[0.04] border border-white/10 text-white/90 rounded-bl-md"
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
