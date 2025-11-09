import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StreakDisplayProps {
  userId: string;
}

export const StreakDisplay = ({ userId }: StreakDisplayProps) => {
  const [streak, setStreak] = useState(0);
  const [visionPoints, setVisionPoints] = useState(0);

  useEffect(() => {
    loadStreak();

    // Realtime subscription
    const channel = supabase
      .channel('streak-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          if (payload.new.streak_days !== undefined) {
            setStreak(payload.new.streak_days);
          }
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

  const loadStreak = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("streak_days, vision_points")
      .eq("user_id", userId)
      .single();

    if (data) {
      setStreak(data.streak_days || 0);
      setVisionPoints(data.vision_points || 0);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Streak */}
      <Card className="card-gradient-border hover:shadow-glow-primary transition-smooth">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Sequência Visionária</p>
              <div className="flex items-center gap-2">
                <Flame className={`w-8 h-8 ${streak > 0 ? "text-orange-500 animate-pulse" : "text-muted-foreground"}`} />
                <span className="text-4xl font-bold gradient-text">
                  {streak}
                </span>
                <span className="text-lg text-muted-foreground">
                  {streak === 1 ? "dia" : "dias"}
                </span>
              </div>
            </div>
          </div>
          {streak > 0 && (
            <div className="mt-4 p-3 bg-gradient-to-r from-orange-500/10 to-primary/10 border border-orange-500/20 rounded-lg">
              <p className="text-sm font-semibold text-orange-500">
                {streak >= 7 ? "🔥 Você é imparável!" : 
                 streak >= 3 ? "💪 Continue assim!" : 
                 "⚡ Começou bem!"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vision Points */}
      <Card className="card-gradient-border hover:shadow-glow-secondary transition-smooth">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Vision Points</p>
              <div className="flex items-center gap-2">
                <Trophy className="w-8 h-8 text-secondary animate-pulse" />
                <span className="text-4xl font-bold gradient-text">
                  {visionPoints}
                </span>
                <span className="text-lg text-muted-foreground">VP</span>
              </div>
            </div>
          </div>
          {visionPoints >= 100 && (
            <div className="mt-4 p-3 bg-gradient-to-r from-secondary/10 to-primary/10 border border-secondary/20 rounded-lg">
              <p className="text-sm font-semibold text-secondary">
                {visionPoints >= 500 ? "👑 Visionário Lendário!" : 
                 visionPoints >= 200 ? "⭐ Visionário Avançado!" : 
                 "🌟 Visionário em ascensão!"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
