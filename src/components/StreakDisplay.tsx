import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStreak } from "@/hooks/useStreak";

interface StreakDisplayProps {
  userId: string;
}

export const StreakDisplay = ({ userId }: StreakDisplayProps) => {
  const { streak } = useStreak(userId);
  const [visionPoints, setVisionPoints] = useState(0);

  useEffect(() => {
    loadVisionPoints();

    // Realtime subscription for vision points only
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
      .single();

    if (data) {
      setVisionPoints(data.vision_points || 0);
    }
  };

  // Determinar cor baseada na constância
  const getConstancyColor = () => {
    if (streak >= 51) return "text-purple-500"; // 51-100 dias
    if (streak >= 26) return "text-blue-500"; // 26-50 dias
    if (streak >= 8) return "text-green-500"; // 8-25 dias
    return "text-orange-500"; // 1-7 dias
  };

  const getConstancyBorderColor = () => {
    if (streak >= 51) return "border-purple-500/20";
    if (streak >= 26) return "border-blue-500/20";
    if (streak >= 8) return "border-green-500/20";
    return "border-orange-500/20";
  };

  const getConstancyBgColor = () => {
    if (streak >= 51) return "from-purple-500/10 to-primary/10";
    if (streak >= 26) return "from-blue-500/10 to-primary/10";
    if (streak >= 8) return "from-green-500/10 to-primary/10";
    return "from-orange-500/10 to-primary/10";
  };

  const getConstancyMessage = () => {
    if (streak >= 51) return "👑 Lendário!";
    if (streak >= 26) return "💎 Diamante!";
    if (streak >= 8) return "⚡ Avançado!";
    if (streak >= 3) return "💪 Continue!";
    return "⚡ Boa!";
  };

  return (
    <div className="grid gap-2 md:grid-cols-2">
      {/* Constância */}
      <Card className="card-gradient-border hover:shadow-glow-primary transition-smooth">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Constância</p>
              <div className="flex items-center gap-1.5">
                <Flame className={`w-4 h-4 ${streak > 0 ? `${getConstancyColor()} animate-pulse` : "text-muted-foreground"}`} />
                <span className={`text-2xl font-bold ${getConstancyColor()}`}>
                  {streak}
                </span>
                <span className="text-sm text-muted-foreground">
                  {streak === 1 ? "dia" : "dias"}
                </span>
              </div>
            </div>
          </div>
          {streak > 0 && (
            <div className={`mt-2 p-1.5 bg-gradient-to-r ${getConstancyBgColor()} border ${getConstancyBorderColor()} rounded`}>
              <p className={`text-xs font-semibold ${getConstancyColor()}`}>
                {getConstancyMessage()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vision Points */}
      <Card className="card-gradient-border hover:shadow-glow-secondary transition-smooth">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Vision Points</p>
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-secondary animate-pulse" />
                <span className="text-2xl font-bold gradient-text">
                  {visionPoints}
                </span>
                <span className="text-sm text-muted-foreground">VP</span>
              </div>
            </div>
          </div>
          {visionPoints >= 100 && (
            <div className="mt-2 p-1.5 bg-gradient-to-r from-secondary/10 to-primary/10 border border-secondary/20 rounded">
              <p className="text-xs font-semibold text-secondary">
                {visionPoints >= 500 ? "👑 Lendário!" : 
                 visionPoints >= 200 ? "⭐ Avançado!" : 
                 "🌟 Ascensão!"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
