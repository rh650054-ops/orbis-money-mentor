import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Loader2, X, Plus, Menu, Trash2, Sparkles, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAIConversations } from "@/hooks/useAIConversations";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    sendMessage(input.trim());
    setInput("");
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
        className="fixed bottom-24 right-4 md:bottom-8 md:right-8 h-14 w-14 rounded-full shadow-glow-primary bg-gradient-primary hover:opacity-90 transition-smooth z-40"
        size="icon"
        aria-label="Abrir Orbis IA"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      {/* Full-screen ChatGPT-style overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] bg-background flex flex-col animate-in fade-in duration-200">
          {/* Top bar */}
          <header className="flex items-center justify-between px-3 h-14 border-b border-border/60 bg-background/95 backdrop-blur safe-top">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} aria-label="Conversas">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-primary flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sm">Orbis IA</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} aria-label="Fechar">
              <X className="h-5 w-5" />
            </Button>
          </header>

          {/* Messages */}
          <ScrollArea className="flex-1" ref={scrollRef}>
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
              {!activeId && messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center mb-4 shadow-glow-primary">
                    <Sparkles className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Como posso ajudar?</h2>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Pergunte sobre vendas, metas, finanças ou rotina.
                  </p>
                </div>
              ) : isLoading ? (
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
                        <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-primary flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed",
                          m.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        )}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {isSending && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-primary flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
                        <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" />
                        <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0.15s]" />
                        <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0.3s]" />
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
            >
              <aside
                className="absolute left-0 top-0 bottom-0 w-[82%] max-w-xs bg-card border-r border-border/60 flex flex-col animate-in slide-in-from-left duration-200 safe-top safe-bottom"
                onClick={(e) => e.stopPropagation()}
              >
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
                              <p className="text-[10px] text-muted-foreground mt-0.5">
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
