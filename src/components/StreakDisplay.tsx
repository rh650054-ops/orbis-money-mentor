import { useEffect, useState } from "react";
import { Card, CardContent } from "@/shared/ui/card";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStreak } from "@/hooks/useStreak";
import VisionPointsCard from "@/components/VisionPointsCard";

interface StreakDisplayProps {
  userId: string;
}

export const StreakDisplay = ({ userId }: StreakDisplayProps) => {
  const { streak } = useStreak(userId);
  const [visionPoints, setVisionPoints] = useState(0);

  useEffect(() => {
    loadVisionPoints();

    const channel = supabase
      .channel('vision-points-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          if (payload.new.vision_points !== undefined) {
            setVisionPoints(payload.new.vision_points);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadVisionPoints = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("vision_points")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      setVisionPoints(data.vision_points || 0);
    }
  };

  const getFireSize = () => {
    if (streak >= 30) return "text-4xl";
    if (streak >= 7) return "text-3xl";
    return "text-2xl";
  };

  const getConstancyColor = () => {
    if (streak >= 30) return "text-streak-legendary";
    if (streak >= 7) return "text-streak-strong";
    if (streak >= 3) return "text-streak-warm";
    return "text-muted-foreground";
  };

  const getMessage = () => {
    if (streak === 0) return "Sua sequência foi reiniciada. Recomece hoje.";
    if (streak <= 2) return "Bom começo! Continue.";
    if (streak <= 6) return "Você está criando um hábito!";
    if (streak <= 29) return "Semana completa! Imparável.";
    return "Lenda. Você é um Visionário.";
  };

  return (
    <div className="space-y-3">
      {/* Streak + VP side by side */}
      <div className="grid gap-3 grid-cols-1">
        {/* Streak Card */}
        <Card className="card-gradient-border hover:shadow-glow-primary transition-smooth">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className={getFireSize()}>🔥</span>
              <div className="flex-1">
                <div className="flex items-center gap-1">
                  <Flame className={`w-4 h-4 ${streak > 0 ? getConstancyColor() : "text-muted-foreground"}`} />
                  <span className="text-xs text-muted-foreground">Constância</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${getConstancyColor()}`}>{streak}</span>
                  <span className="text-sm text-muted-foreground">dias seguidos</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{getMessage()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vision Points Card with levels and modal */}
        <VisionPointsCard points={visionPoints} />
      </div>
    </div>
  );
};
