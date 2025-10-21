import { useState, useRef, useEffect } from "react";
import { Send, Mic, MicOff, Sparkles, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRealtimeChat } from "@/hooks/useRealtimeChat";
import { cn } from "@/lib/utils";

export default function Chat() {
  const [inputMessage, setInputMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const {
    messages,
    isConnected,
    isRecording,
    isSpeaking,
    error,
    connect,
    disconnect,
    sendTextMessage
  } = useRealtimeChat();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    sendTextMessage(inputMessage);
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

      {/* Connection Card */}
      {!isConnected && (
        <Card className="glass card-gradient-border mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow-primary">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Orbis IA está offline</h3>
                  <p className="text-sm text-muted-foreground">
                    Inicie uma conversa para começar
                  </p>
                </div>
              </div>
              <Button
                onClick={connect}
                className="bg-gradient-primary hover:opacity-90 transition-smooth shadow-glow-primary"
              >
                <Mic className="w-4 h-4 mr-2" />
                Iniciar Conversa
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="glass border-destructive/20 bg-destructive/5 mb-6">
          <CardContent className="p-4">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Chat Messages */}
      {isConnected && (
        <Card className="glass flex-1 flex flex-col overflow-hidden">
          <CardHeader className="border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-success animate-pulse"></div>
                <span>Orbis Online</span>
              </CardTitle>
              <div className="flex items-center space-x-4">
                {isRecording && (
                  <div className="flex items-center space-x-2 text-primary">
                    <Mic className="w-4 h-4 animate-pulse" />
                    <span className="text-sm">Ouvindo...</span>
                  </div>
                )}
                {isSpeaking && (
                  <div className="flex items-center space-x-2 text-secondary">
                    <Volume2 className="w-4 h-4 animate-pulse" />
                    <span className="text-sm">Falando...</span>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disconnect}
                  className="border-destructive/20 text-destructive hover:bg-destructive/10"
                >
                  <MicOff className="w-4 h-4 mr-2" />
                  Encerrar
                </Button>
              </div>
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
                placeholder="Digite uma mensagem..."
                disabled={!isConnected}
                className="flex-1"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!isConnected || !inputMessage.trim()}
                className="bg-gradient-primary hover:opacity-90 transition-smooth"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Use sua voz ou digite mensagens para conversar com o Orbis
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
