import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface MotivationalCardProps {
  percentage: number;
  visible: boolean;
  onHide: () => void;
}

export const MotivationalCard = ({ percentage, visible, onHide }: MotivationalCardProps) => {
  const [message, setMessage] = useState({ icon: "", title: "", description: "" });

  useEffect(() => {
    if (!visible) return;

    if (percentage >= 100) {
      setMessage({
        icon: "🔥",
        title: "META BATIDA, Visionário!",
        description: "Você é imparável! Continue dominando!",
      });
    } else if (percentage >= 51) {
      const missing = 100 - percentage;
      setMessage({
        icon: "⚡",
        title: `Visionário, faltou apenas ${missing.toFixed(0)}%!`,
        description: "Continua! Você está quase lá!",
      });
    } else if (percentage > 0) {
      setMessage({
        icon: "💪",
        title: "Primeiro passo dado!",
        description: "Agora é manter o ritmo. Só não pare!",
      });
    } else {
      setMessage({
        icon: "🌟",
        title: "Cada dia é uma chance nova.",
        description: "Comece pequeno. Só não pare.",
      });
    }

    // Auto hide after 5 seconds
    const timer = setTimeout(() => {
      onHide();
    }, 5000);

    return () => clearTimeout(timer);
  }, [percentage, visible, onHide]);

  if (!visible) return null;

  return (
    <Card className="card-gradient-border animate-fade-in bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="text-4xl">{message.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-primary">{message.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{message.description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};