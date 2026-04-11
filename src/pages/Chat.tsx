import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatAI } from "@/hooks/useChatAI";
import { cn } from "@/lib/utils";
import { useOfflineGuard } from "@/hooks/useOfflineGuard";

export default function Chat() {
  const [inputMessage, setInputMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const {
    messages,
    isLoading,
    sendMessage,
    clearMessages
  } = useChatAI();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const { requireOnline } = useOfflineGuard();

  const handleSendMessage = () => {
    if (!inputMessage.trim() || isLoading) return;
    if (!requireOnline("A análise por IA")) return;
    sendMessage(inputMessage);
    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] flex flex-col pb-20 md:pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold gradient-text">Chat com Orbis IA</h1>
        <p className="text-muted-foreground mt-1">
          Converse com seu assistente financeiro pessoal
        </p>
      </div>

      {/* Welcome Card */}
      <Card className="glass card-gradient-border mb-6">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow-primary">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Orbis IA - Seu Assistente Financeiro</h3>
              <p className="text-sm text-muted-foreground">
                Tire suas dúvidas sobre vendas, finanças e gestão do seu negócio
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chat Messages */}
      <Card className="glass flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b border-border/50">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-success animate-pulse"></div>
              <span>Chat Ativo</span>
            </CardTitle>
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearMessages}
                className="text-muted-foreground hover:text-foreground"
              >
                Limpar Chat
              </Button>
            )}
          </div>
        </CardHeader>

          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
                  <p className="text-lg font-medium mb-2">Olá! Eu sou o Orbis.</p>
                  <p className="text-sm">
                    Fale comigo ou digite sua mensagem para começar.
                  </p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg p-4",
                        message.role === "user"
                          ? "bg-primary/10 border border-primary/20"
                          : "bg-secondary/10 border border-secondary/20"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {message.timestamp.toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

        {/* Input */}
        <div className="border-t border-border/50 p-4">
          <div className="flex space-x-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !inputMessage.trim()}
              className="bg-gradient-primary hover:opacity-90 transition-smooth"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {isLoading ? "Orbis está pensando..." : "Digite sua mensagem e pressione Enter"}
          </p>
        </div>
      </Card>
    </div>
  );
}
