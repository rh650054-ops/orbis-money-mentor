import { useState, useEffect } from "react";
import { Clock, Zap, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DayStatusHeaderProps {
  completedCount: number;
  totalCount: number;
  currentTime: string;
  energy: number;
  checklist: Array<{ activity_time: string | null; completed: boolean }>;
}

export default function DayStatusHeader({
  completedCount,
  totalCount,
  currentTime,
  energy,
  checklist,
}: DayStatusHeaderProps) {
  const [motivationalPhrase, setMotivationalPhrase] = useState("");

  const getStatus = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinutes;

    // Count activities that should be done by now
    const shouldBeDone = checklist.filter((item) => {
      if (!item.activity_time) return false;
      const [h, m] = item.activity_time.split(":").map(Number);
      return h * 60 + m <= currentTimeMinutes;
    }).length;

    const actuallyDone = checklist.filter((item, index) => {
      if (!item.activity_time) return false;
      const [h, m] = item.activity_time.split(":").map(Number);
      return h * 60 + m <= currentTimeMinutes && item.completed;
    }).length;

    if (actuallyDone > shouldBeDone * 0.8) {
      return { status: "ahead", label: "Adiantado", icon: TrendingUp, color: "text-success" };
    } else if (actuallyDone >= shouldBeDone * 0.5) {
      return { status: "ontime", label: "No tempo", icon: Minus, color: "text-primary" };
    } else {
      return { status: "late", label: "Atrasado", icon: TrendingDown, color: "text-destructive" };
    }
  };

  useEffect(() => {
    const phrases = [
      "Cada minuto conta. Faça valer.",
      "Disciplina é liberdade.",
      "Você está construindo seu futuro agora.",
      "A constância vence o talento.",
      "Hoje é dia de vitória.",
      "Foco no processo, não no resultado.",
      "Visionários não param.",
    ];
    setMotivationalPhrase(phrases[Math.floor(Math.random() * phrases.length)]);
  }, []);

  const statusInfo = getStatus();
  const StatusIcon = statusInfo.icon;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/20 via-card to-card/80 backdrop-blur-xl">
      {/* Animated background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-secondary/10 animate-pulse" />
      
      {/* Neon border effect */}
      <div className="absolute inset-0 rounded-lg p-[1px] bg-gradient-to-r from-primary via-secondary to-primary opacity-50" />
      
      <CardContent className="relative p-6 space-y-4">
        {/* Top row: Title and Time */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold gradient-text">Status do Dia</h2>
            <p className="text-muted-foreground text-sm mt-1 italic">"{motivationalPhrase}"</p>
          </div>
          <div className="flex items-center gap-2 bg-card/80 px-4 py-2 rounded-full border border-primary/30">
            <Clock className="w-5 h-5 text-primary animate-pulse" />
            <span className="text-xl font-mono font-bold text-primary">{currentTime}</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Activities completed */}
          <div className="text-center p-4 rounded-xl bg-card/50 border border-border/50 hover:border-primary/50 transition-all duration-300">
            <div className="text-4xl font-bold gradient-text">{completedCount}/{totalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Atividades</p>
            <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Status */}
          <div className="text-center p-4 rounded-xl bg-card/50 border border-border/50 hover:border-primary/50 transition-all duration-300">
            <div className={`flex items-center justify-center gap-2 ${statusInfo.color}`}>
              <StatusIcon className="w-8 h-8" />
            </div>
            <Badge 
              className={`mt-2 ${
                statusInfo.status === "ahead" 
                  ? "bg-success/20 text-success border-success/50" 
                  : statusInfo.status === "ontime"
                  ? "bg-primary/20 text-primary border-primary/50"
                  : "bg-destructive/20 text-destructive border-destructive/50"
              }`}
            >
              {statusInfo.label}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">Ritmo</p>
          </div>

          {/* Energy */}
          <div className="text-center p-4 rounded-xl bg-card/50 border border-border/50 hover:border-warning/50 transition-all duration-300">
            <div className="flex items-center justify-center gap-1">
              <Zap className="w-6 h-6 text-warning animate-pulse" />
              <span className="text-4xl font-bold text-warning">{energy}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Energia</p>
            <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-warning to-warning/50 transition-all duration-500"
                style={{ width: `${Math.min(energy, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
