import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useVisionPoints = (userId: string | undefined) => {
  const [points, setPoints] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;

    const loadPoints = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("vision_points")
        .eq("user_id", userId)
        .single();

      if (data) {
        setPoints(data.vision_points || 0);
      }
    };

    loadPoints();

    // Realtime subscription
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
            const newPoints = payload.new.vision_points;
            const diff = newPoints - points;
            
            if (diff > 0) {
              setPoints(newPoints);
              toast({
                title: "✨ Vision Points!",
                description: `+${diff} pontos! Total: ${newPoints} VP`,
                duration: 3000,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const addPoints = async (amount: number, reason: string) => {
    if (!userId) return;

    const { data } = await supabase
      .from("profiles")
      .select("vision_points")
      .eq("user_id", userId)
      .single();

    const currentPoints = data?.vision_points || 0;
    const newTotal = currentPoints + amount;

    const { error } = await supabase
      .from("profiles")
      .update({ vision_points: newTotal })
      .eq("user_id", userId);

    if (!error) {
      setPoints(newTotal);
      toast({
        title: `🎉 +${amount} Vision Points!`,
        description: reason,
        duration: 4000,
      });
    }
  };

  return { points, addPoints };
};
