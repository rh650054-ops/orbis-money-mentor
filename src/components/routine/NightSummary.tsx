import { useState, useEffect } from "react";
import { Moon, Zap, Trophy, CheckCircle2, Star, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import confetti from "canvas-confetti";
import { celebrationSounds } from "@/utils/celebrationSounds";

interface NightSummaryProps {
  completedCount: number;
  totalCount: number;
  energy: number;
  sleepTime: string;
  currentTime: string;
  onSaveDay: () => void;
}

export default function NightSummary({
  completedCount,
  totalCount,
  energy,
  sleepTime,
  currentTime,
  onSaveDay,
}: NightSummaryProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [xpGained, setXpGained] = useState(0);

  useEffect(() => {
    // Check if it's time to show the night summary
    if (!sleepTime || !currentTime) return;
    
    const [sleepH, sleepM] = sleepTime.split(":").map(Number);
    const [currentH, currentM] = currentTime.split(":").map(Number);
    
    const sleepMinutes = sleepH * 60 + sleepM;
    const currentMinutes = currentH * 60 + currentM;
    
    // Show summary when within 30 minutes of sleep time
    if (currentMinutes >= sleepMinutes - 30 && currentMinutes <= sleepMinutes + 60) {
      setIsVisible(true);
      
      // Calculate XP based on completion and energy
      const baseXP = completedCount * 10;
      const energyBonus = Math.floor(energy / 10) * 5;
      const completionBonus = completedCount === totalCount ? 50 : 0;
      setXpGained(baseXP + energyBonus + completionBonus);
    } else {
      setIsVisible(false);
    }
  }, [sleepTime, currentTime, completedCount, totalCount, energy]);

  const handleSaveDay = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    celebrationSounds.playLevelUp();
    onSaveDay();
  };

  if (!isVisible) return null;

  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <Card className="relative overflow-hidden border-2 border-primary/50 bg-gradient-to-br from-primary/10 via-card to-secondary/10 backdrop-blur-xl shadow-[0_0_50px_hsl(var(--primary)/0.3)]">
      {/* Animated stars background */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <Star 
            key={i} 
            className="absolute text-primary/20 animate-pulse" 
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${8 + Math.random() * 12}px`,
              animationDelay: `${Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      <CardHeader className="relative text-center pb-2">
        <div className="flex justify-center mb-2">
          <div className="p-4 rounded-full bg-primary/20 border border-primary/30">
            <Moon className="w-10 h-10 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl gradient-text">Fechamento do Dia</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">Hora de descansar, visionário.</p>
      </CardHeader>

      <CardContent className="relative space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4">
          {/* Completed */}
          <div className="text-center p-4 rounded-xl bg-card/50 border border-success/30">
            <CheckCircle2 className="w-8 h-8 mx-auto text-success mb-2" />
            <div className="text-3xl font-bold text-success">{completedCount}</div>
            <p className="text-xs text-muted-foreground">Concluídas</p>
          </div>

          {/* Energy */}
          <div className="text-center p-4 rounded-xl bg-card/50 border border-warning/30">
            <Zap className="w-8 h-8 mx-auto text-warning mb-2" />
            <div className="text-3xl font-bold text-warning">{energy}</div>
            <p className="text-xs text-muted-foreground">Energia Final</p>
          </div>

          {/* XP */}
          <div className="text-center p-4 rounded-xl bg-card/50 border border-primary/30">
            <Trophy className="w-8 h-8 mx-auto text-primary mb-2" />
            <div className="text-3xl font-bold text-primary">+{xpGained}</div>
            <p className="text-xs text-muted-foreground">XP Ganho</p>
          </div>
        </div>

        {/* Progress summary */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Taxa de conclusão</span>
            <span className="font-bold text-primary">{percentage}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary via-secondary to-success transition-all duration-1000"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Achievement badges */}
        <div className="flex flex-wrap justify-center gap-2">
          {completedCount === totalCount && (
            <Badge className="bg-success/20 text-success border-success/50 animate-pulse">
              ⭐ Dia Perfeito
            </Badge>
          )}
          {energy >= 80 && (
            <Badge className="bg-warning/20 text-warning border-warning/50">
              ⚡ Alta Energia
            </Badge>
          )}
          {percentage >= 80 && (
            <Badge className="bg-primary/20 text-primary border-primary/50">
              🎯 Focado
            </Badge>
          )}
        </div>

        {/* Save button */}
        <Button 
          onClick={handleSaveDay}
          className="w-full h-14 text-lg font-bold bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-[0_0_30px_hsl(var(--primary)/0.4)] transition-all duration-300 hover:scale-[1.02]"
        >
          <Save className="w-5 h-5 mr-2" />
          Salvar Dia
        </Button>
      </CardContent>
    </Card>
  );
}
