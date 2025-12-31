import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, Send, X, Volume2, VolumeX } from "lucide-react";
import { VoiceParticleVisualizer } from "./VoiceParticleVisualizer";
import { useAudioSettings } from "@/hooks/useAudioSettings";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useOrbisIntents } from "@/hooks/useOrbisIntents";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface OrbisAssistantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
}

export function OrbisAssistantModal({
  open,
  onOpenChange,
  userId,
}: OrbisAssistantModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const {
    settings: audioSettings,
    speak,
    stopSpeaking,
    isSpeechSupported,
    isMicSupported,
  } = useAudioSettings(userId);

  const { processMessage } = useOrbisIntents(userId);

  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported: isSpeechRecognitionSupported,
  } = useSpeechRecognition({
    audioInputEnabled: audioSettings.audioInputEnabled,
    onResult: (result) => {
      setInputMessage(result);
      // Auto-send after voice input
      setTimeout(() => {
        handleSendMessage(result);
      }, 500);
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Welcome message when opening
  useEffect(() => {
    if (open && messages.length === 0) {
      const welcome: Message = {
        role: "assistant",
        content: "Olá! Sou o Orbis, seu assistente de vendas. Pergunte sobre seu faturamento, meta, ou como está o dia!",
        timestamp: new Date(),
      };
      setMessages([welcome]);
      
      if (audioSettings.audioOutputEnabled && isSpeechSupported) {
        speakWithTracking(welcome.content);
      }
    }
  }, [open]);

  // Track speaking state
  const speakWithTracking = useCallback((text: string) => {
    if (!audioSettings.audioOutputEnabled || !isSpeechSupported) return;

    setIsSpeaking(true);
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    
    switch (audioSettings.speechRate) {
      case "slow": utterance.rate = 0.7; break;
      case "fast": utterance.rate = 1.3; break;
      default: utterance.rate = 1.0;
    }
    
    switch (audioSettings.speechVolume) {
      case "low": utterance.volume = 0.3; break;
      case "high": utterance.volume = 1.0; break;
      default: utterance.volume = 0.7;
    }

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [audioSettings, isSpeechSupported]);

  // Handle sending message
  const handleSendMessage = useCallback(async (text?: string) => {
    const messageText = text || inputMessage.trim();
    if (!messageText) return;

    stopSpeaking();
    setIsSpeaking(false);

    const userMessage: Message = {
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsProcessing(true);

    try {
      const result = await processMessage(messageText);
      
      const assistantMessage: Message = {
        role: "assistant",
        content: result.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Speak the response
      if (audioSettings.audioOutputEnabled) {
        speakWithTracking(result.response);
      }
    } catch (error) {
      const errorMsg: Message = {
        role: "assistant",
        content: "Desculpe, ocorreu um erro. Tente novamente.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  }, [inputMessage, processMessage, audioSettings, speakWithTracking, stopSpeaking]);

  // Handle voice button
  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      if (!audioSettings.audioInputEnabled) {
        toast({
          title: "Voz desativada",
          description: "Ative a entrada por voz no Perfil",
          variant: "destructive",
        });
        return;
      }
      startListening();
    }
  }, [isListening, audioSettings, startListening, stopListening, toast]);

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle close
  const handleClose = () => {
    stopSpeaking();
    stopListening();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] h-[80vh] flex flex-col p-0 gap-0 bg-background/95 backdrop-blur border-border/50">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-foreground">
              Assistente Orbis
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Particle Visualizer */}
        <div className="h-40 flex-shrink-0 bg-black/90 relative overflow-hidden">
          <VoiceParticleVisualizer
            isListening={isListening}
            isSpeaking={isSpeaking}
            audioLevel={audioLevel}
          />
          
          {/* Status overlay */}
          <div className="absolute bottom-2 left-0 right-0 text-center">
            <span className={cn(
              "text-xs px-3 py-1 rounded-full",
              isListening ? "bg-green-500/20 text-green-400" :
              isSpeaking ? "bg-blue-500/20 text-blue-400" :
              "bg-muted/20 text-muted-foreground"
            )}>
              {isListening ? "🎤 Ouvindo..." : 
               isSpeaking ? "🔊 Falando..." : 
               isProcessing ? "⏳ Processando..." : "✨ Pronto"}
            </span>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {message.content}
                </div>
              </div>
            ))}
            
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-muted text-foreground max-w-[85%] rounded-2xl px-4 py-2 text-sm">
                  <span className="animate-pulse">Pensando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="p-4 border-t border-border/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Voice button */}
            {isMicSupported && isSpeechRecognitionSupported && (
              <Button
                variant={isListening ? "default" : "outline"}
                size="icon"
                onClick={handleVoiceToggle}
                className={cn(
                  "h-10 w-10 flex-shrink-0",
                  isListening && "bg-green-500 hover:bg-green-600"
                )}
              >
                {isListening ? (
                  <Mic className="h-4 w-4 animate-pulse" />
                ) : (
                  <MicOff className="h-4 w-4" />
                )}
              </Button>
            )}

            {/* Text input */}
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isListening ? "Ouvindo..." : "Digite sua pergunta..."}
              className="flex-1"
              disabled={isListening || isProcessing}
            />

            {/* Send button */}
            <Button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isProcessing}
              size="icon"
              className="h-10 w-10 flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Hint */}
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Pergunte: "Como tá meu faturamento?" • "Quanto falta pra meta?" • "Melhor hora?"
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
