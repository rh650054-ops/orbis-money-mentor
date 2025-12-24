import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Loader2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatAI } from "@/hooks/useChatAI";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAudioSettings } from "@/hooks/useAudioSettings";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useToast } from "@/hooks/use-toast";

export default function Chat() {
  const [inputMessage, setInputMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Audio settings - source of truth from user profile
  const { settings: audioSettings, speak, stopSpeaking, isSpeechSupported, isMicSupported } = useAudioSettings(user?.id);
  
  const {
    messages,
    isLoading,
    sendMessage,
    clearMessages
  } = useChatAI();

  // Speech recognition for voice input
  const { isListening, startListening, stopListening, error: speechError } = useSpeechRecognition({
    audioInputEnabled: audioSettings.audioInputEnabled,
    onResult: (transcript) => {
      setInputMessage(transcript);
      toast({ title: "🎤 Reconhecido", description: transcript });
    },
    onError: (error) => {
      toast({ title: "Erro na voz", description: error, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Speak AI response when it arrives (only if audio output enabled)
  useEffect(() => {
    if (messages.length > 0 && audioSettings.audioOutputEnabled) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "assistant") {
        // Speak the response (respecting settings)
        speak(lastMessage.content);
      }
    }
  }, [messages, audioSettings.audioOutputEnabled, speak]);

  const handleSendMessage = () => {
    if (!inputMessage.trim() || isLoading) return;
    // Stop any ongoing speech before sending new message
    stopSpeaking();
    sendMessage(inputMessage);
    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceInput = () => {
    // RULE: Only work if audio_input_enabled = true
    if (!audioSettings.audioInputEnabled) {
      toast({ 
        title: "Voz desativada", 
        description: "Ative a entrada por voz nas configurações do perfil", 
        variant: "destructive" 
      });
      return;
    }
    
    if (isListening) {
      stopListening();
    } else {
      startListening();
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
              placeholder={audioSettings.audioInputEnabled ? "Digite ou use o microfone..." : "Digite sua mensagem..."}
              disabled={isLoading}
              className="flex-1"
            />
            {audioSettings.audioInputEnabled && isMicSupported && (
              <Button
                onClick={handleVoiceInput}
                disabled={isLoading}
                variant={isListening ? "default" : "outline"}
                className={cn(isListening && "bg-red-500 hover:bg-red-600")}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </Button>
            )}
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
            {isListening ? "🎤 Ouvindo..." : isLoading ? "Orbis está pensando..." : "Digite sua mensagem e pressione Enter"}
          </p>
          {!audioSettings.audioInputEnabled && (
            <p className="text-xs text-muted-foreground/60 mt-1 text-center">
              Entrada por voz desativada nas configurações
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
