import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { OrbisAssistantModal } from "./OrbisAssistantModal";
import { useWakeWord } from "@/hooks/useWakeWord";
import { useAudioSettings } from "@/hooks/useAudioSettings";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface OrbisAssistantButtonProps {
  userId: string | undefined;
  className?: string;
}

export function OrbisAssistantButton({
  userId,
  className,
}: OrbisAssistantButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const { settings: audioSettings } = useAudioSettings(userId);

  // Wake word detection
  const { isPassiveListening, isSupported: isWakeWordSupported } = useWakeWord({
    enabled: audioSettings.audioInputEnabled && !isOpen,
    onWakeWordDetected: () => {
      toast({
        title: "🎤 Eae! Orbis ativado",
        description: "Assistente pronto para ouvir",
      });
      setIsOpen(true);
    },
  });

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  return (
    <>
      {/* Floating button */}
      <Button
        onClick={handleOpen}
        className={cn(
          "fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg",
          "bg-gradient-to-br from-primary to-primary/80",
          "hover:scale-105 transition-all duration-200",
          "flex items-center justify-center",
          isPassiveListening && "ring-2 ring-green-400 ring-offset-2 ring-offset-background",
          className
        )}
        size="icon"
      >
        <Sparkles className="h-6 w-6 text-primary-foreground" />
        
        {/* Listening indicator */}
        {isPassiveListening && (
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-400 rounded-full animate-pulse" />
        )}
      </Button>

      {/* Wake word hint */}
      {audioSettings.audioInputEnabled && isWakeWordSupported && !isOpen && (
        <div className="fixed bottom-36 right-4 z-40 text-xs text-muted-foreground bg-background/80 backdrop-blur px-2 py-1 rounded-full border border-border/30">
          Diga "Eae Orbis"
        </div>
      )}

      {/* Assistant Modal */}
      <OrbisAssistantModal
        open={isOpen}
        onOpenChange={setIsOpen}
        userId={userId}
      />
    </>
  );
}
