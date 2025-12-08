import { useState, useEffect } from "react";
import { Check, Clock, AlertCircle, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { celebrationSounds } from "@/utils/celebrationSounds";

interface ActivityCardProps {
  id: string;
  name: string;
  time: string | null;
  emoji?: string;
  completed: boolean;
  durationMinutes?: number;
  currentTimeMinutes: number;
  onToggle: (id: string, currentStatus: boolean) => void;
  index: number;
}

export default function ActivityCard({
  id,
  name,
  time,
  emoji,
  completed,
  durationMinutes,
  currentTimeMinutes,
  onToggle,
  index,
}: ActivityCardProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const getStatus = () => {
    if (completed) return "completed";
    if (!time) return "pending";
    
    const [h, m] = time.split(":").map(Number);
    const itemMinutes = h * 60 + m;
    
    if (itemMinutes < currentTimeMinutes - 30) return "late";
    if (itemMinutes <= currentTimeMinutes + 15) return "inProgress";
    return "pending";
  };

  const status = getStatus();

  const handleToggle = () => {
    if (!completed) {
      setIsAnimating(true);
      celebrationSounds.playSuccess();
      setTimeout(() => setIsAnimating(false), 600);
    }
    onToggle(id, completed);
  };

  const getStatusStyles = () => {
    switch (status) {
      case "completed":
        return {
          card: "bg-gradient-to-r from-success/20 to-success/5 border-success/50 shadow-[0_0_30px_hsl(var(--success)/0.2)]",
          icon: "bg-success text-success-foreground",
          text: "text-muted-foreground line-through"
        };
      case "inProgress":
        return {
          card: "bg-gradient-to-r from-primary/20 to-primary/5 border-primary/50 shadow-[0_0_40px_hsl(var(--primary)/0.3)] animate-pulse",
          icon: "bg-primary text-primary-foreground",
          text: "text-foreground"
        };
      case "late":
        return {
          card: "bg-gradient-to-r from-destructive/20 to-destructive/5 border-destructive/50 shadow-[0_0_30px_hsl(var(--destructive)/0.2)]",
          icon: "bg-destructive text-destructive-foreground",
          text: "text-destructive"
        };
      default:
        return {
          card: "bg-card/50 border-border/50 hover:border-primary/30 hover:shadow-glow-primary",
          icon: "bg-muted text-muted-foreground",
          text: "text-foreground"
        };
    }
  };

  const styles = getStatusStyles();

  return (
    <Card 
      className={`relative overflow-hidden transition-all duration-500 transform hover:scale-[1.02] ${styles.card} ${
        isAnimating ? "scale-105" : ""
      }`}
      style={{ 
        opacity: 0,
        animation: `fadeIn 0.5s ease-out forwards`,
        animationDelay: `${index * 80}ms`
      }}
    >
      {/* Progress indicator for in-progress items */}
      {status === "inProgress" && (
        <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-primary to-secondary animate-pulse" style={{ width: "100%" }} />
      )}

      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          {/* Checkbox with animation */}
          <div 
            className={`relative transition-all duration-300 ${isAnimating ? "scale-125 rotate-12" : ""}`}
            onClick={handleToggle}
          >
            <Checkbox
              checked={completed}
              onCheckedChange={() => {}}
              className="h-7 w-7 border-2 cursor-pointer"
            />
            {isAnimating && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Check className="w-6 h-6 text-success animate-ping" />
              </div>
            )}
          </div>

          {/* Emoji / Icon */}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${styles.icon} transition-all duration-300 shadow-lg`}>
            {emoji ? (
              <span className={`text-3xl ${completed ? "grayscale" : ""}`}>{emoji}</span>
            ) : status === "inProgress" ? (
              <Play className="w-6 h-6" />
            ) : status === "late" ? (
              <AlertCircle className="w-6 h-6" />
            ) : (
              <Clock className="w-6 h-6" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className={`text-lg font-bold truncate transition-all duration-300 ${styles.text}`}>
              {name}
            </h4>
            <div className="flex items-center gap-3 mt-1">
              {time && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {time}
                </span>
              )}
              {durationMinutes && durationMinutes > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {durationMinutes}min
                </span>
              )}
            </div>
          </div>

          {/* Status badge */}
          {status === "inProgress" && (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/20 text-primary border border-primary/40">
              <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span className="text-xs font-bold">EM PROGRESSO</span>
            </div>
          )}
          {status === "late" && (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-destructive/20 text-destructive border border-destructive/40">
              <AlertCircle className="w-3 h-3" />
              <span className="text-xs font-bold">ATRASADO</span>
            </div>
          )}
          {status === "completed" && (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-success/20 text-success border border-success/40">
              <Check className="w-4 h-4" />
            </div>
          )}
        </div>
      </CardContent>

      {/* Keyframes for fade in */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Card>
  );
}
