import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StreakDisplayProps {
  userId: string;
}

export const StreakDisplay = ({ userId }: StreakDisplayProps) => {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    loadStreak();
    checkAndResetStreak();

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
      .select("streak_days, last_check_in_date")
      .eq("user_id", userId)
      .single();

    if (data) {
      setStreak(data.streak_days || 0);
    }
  };

  const checkAndResetStreak = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    // Verificar se há vendas registradas hoje
    const { data: todaySales } = await supabase
      .from("daily_sales")
      .select("id")
      .eq("user_id", userId)
      .eq("date", today);

    const { data: profile } = await supabase
      .from("profiles")
      .select("last_check_in_date, streak_days")
      .eq("user_id", userId)
      .single();

    if (profile) {
      const lastCheckIn = profile.last_check_in_date;
      
      // Se não há vendas hoje E última venda não foi ontem, zerar streak
      if (!todaySales || todaySales.length === 0) {
        if (lastCheckIn) {
          const lastDate = new Date(lastCheckIn);
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          
          // Se última venda foi antes de ontem, zerar
          if (lastDate < yesterday) {
            await supabase
              .from("profiles")
              .update({ streak_days: 0 })
              .eq("user_id", userId);
            setStreak(0);
          }
        }
      }
    }
  };

  const getMotivationMessage = () => {
    if (streak === 0) return "Para manter sua ofensiva, registre sua venda do dia.";
    if (streak === 1) return "Começo poderoso!";
    if (streak === 3) return "Você está pegando fogo!";
    if (streak >= 7) return "Semana Visionária!";
    if (streak >= 14) return "Constância mortal!";
    if (streak >= 30) return "Você é imparável! 👑";
    return "Continue assim!";
  };

  return (
    <Card className="card-gradient-border hover:shadow-glow-primary transition-smooth overflow-hidden">
      <CardContent className="p-8">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <Flame 
              className={`w-24 h-24 ${streak > 0 ? "text-orange-500 animate-pulse" : "text-muted-foreground/30"}`} 
              strokeWidth={1.5}
            />
            {streak > 0 && (
              <div className="absolute inset-0 animate-pulse">
                <Flame className="w-24 h-24 text-orange-400 opacity-50" strokeWidth={1} />
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground uppercase tracking-wide font-semibold">
              Ofensiva Visionária
            </p>
            <div className="flex items-baseline justify-center gap-3">
              <span className="text-7xl font-bold gradient-text">
                {streak}
              </span>
              <span className="text-2xl text-muted-foreground">
                {streak === 1 ? "dia" : "dias"}
              </span>
            </div>
          </div>

          <div className={`w-full p-4 rounded-xl border ${
            streak === 0 
              ? "bg-muted/30 border-muted" 
              : "bg-gradient-to-r from-orange-500/10 to-primary/10 border-orange-500/20"
          }`}>
            <p className={`text-sm font-semibold ${
              streak === 0 ? "text-muted-foreground" : "text-orange-500"
            }`}>
              {getMotivationMessage()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
