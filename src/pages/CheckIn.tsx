import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sunrise, Target, Clock, Heart, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import NumericKeyboard from "@/components/NumericKeyboard";

export default function CheckIn() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [salesGoal, setSalesGoal] = useState("");
  const [startTime, setStartTime] = useState("");
  const [focus, setFocus] = useState("");
  const [mood, setMood] = useState("");
  const [showNumericKeyboard, setShowNumericKeyboard] = useState(false);

  const moods = [
    { emoji: "😊", label: "Motivado", value: "motivado" },
    { emoji: "💪", label: "Determinado", value: "determinado" },
    { emoji: "🔥", label: "Energizado", value: "energizado" },
    { emoji: "😌", label: "Tranquilo", value: "tranquilo" },
    { emoji: "😴", label: "Cansado", value: "cansado" },
  ];

  useEffect(() => {
    checkIfAlreadyCheckedIn();
  }, [user]);

  const checkIfAlreadyCheckedIn = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("last_check_in_date")
      .eq("user_id", user.id)
      .single();

    const today = new Date().toISOString().split('T')[0];
    if (profile?.last_check_in_date === today) {
      navigate("/");
    }
  };

  const handleSkip = () => {
    navigate("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Campos não são mais obrigatórios - usar valores padrão se vazios
    const goal = salesGoal || "0";
    const time = startTime || new Date().toTimeString().slice(0, 5);
    const userFocus = focus || "Minha meta de hoje";
    const userMood = mood || "motivado";

    setIsLoading(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Buscar perfil atual
      const { data: profile } = await supabase
        .from("profiles")
        .select("streak_days, last_check_in_date, vision_points")
        .eq("user_id", user.id)
        .single();

      let newStreak = 1;
      let pointsToAdd = 20;

      if (profile) {
        const lastCheckIn = profile.last_check_in_date;
        if (lastCheckIn) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          
          if (lastCheckIn === yesterdayStr) {
            newStreak = (profile.streak_days || 0) + 1;
            pointsToAdd = 20 + (newStreak * 5); // Bônus por streak
          } else if (lastCheckIn !== today) {
            newStreak = 1;
          }
        }
      }

      // Atualizar perfil com check-in
      const { error } = await supabase
        .from("profiles")
        .update({
          last_check_in_date: today,
          streak_days: newStreak,
          vision_points: (profile?.vision_points || 0) + pointsToAdd,
          daily_sales_goal: parseFloat(goal),
          check_in_start_time: time,
          check_in_focus: userFocus,
          check_in_mood: userMood,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "✅ Check-in realizado!",
        description: `🔥 Streak: ${newStreak} dias | +${pointsToAdd} Vision Points`,
        duration: 5000,
      });

      navigate("/");
    } catch (error) {
      console.error("Error during check-in:", error);
      toast({
        title: "Erro no check-in",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNumberClick = (num: string) => {
    if (num === "." && salesGoal.includes(".")) return;
    setSalesGoal(prev => prev + num);
  };

  const handleDelete = () => {
    setSalesGoal(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setSalesGoal("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-primary/5 to-background">
      <Card className="w-full max-w-2xl card-gradient-border shadow-glow-primary animate-fade-in relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-10"
          onClick={handleSkip}
          title="Pular check-in"
        >
          <X className="h-5 w-5" />
        </Button>
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center mb-4 animate-pulse">
            <Sunrise className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl md:text-4xl font-bold gradient-text">
            Bom dia, Visionário! 🌅
          </CardTitle>
          <p className="text-muted-foreground">
            Vamos definir as metas do dia e começar com tudo!
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Meta de Vendas */}
            <div className="space-y-3">
              <Label htmlFor="salesGoal" className="flex items-center gap-2 text-base">
                <Target className="w-5 h-5 text-primary" />
                Meta de vendas hoje (R$)
              </Label>
              <Input
                id="salesGoal"
                type="text"
                value={salesGoal}
                onFocus={() => setShowNumericKeyboard(true)}
                readOnly
                placeholder="0.00"
                className="text-2xl font-bold text-center h-14 cursor-pointer"
              />
              {showNumericKeyboard && (
                <div className="animate-fade-in">
                  <NumericKeyboard
                    onNumberClick={handleNumberClick}
                    onDelete={handleDelete}
                    onClear={handleClear}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => setShowNumericKeyboard(false)}
                  >
                    Confirmar
                  </Button>
                </div>
              )}
            </div>

            {!showNumericKeyboard && (
              <>
                {/* Horário de Início */}
                <div className="space-y-3">
                  <Label htmlFor="startTime" className="flex items-center gap-2 text-base">
                    <Clock className="w-5 h-5 text-primary" />
                    Que horas você começa?
                  </Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-12 text-lg"
                    required
                  />
                </div>

                {/* Foco Principal */}
                <div className="space-y-3">
                  <Label htmlFor="focus" className="flex items-center gap-2 text-base">
                    <Target className="w-5 h-5 text-primary" />
                    Qual seu foco principal hoje?
                  </Label>
                  <Textarea
                    id="focus"
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    placeholder="Ex: Bater meta de vendas, fazer 20 atendimentos..."
                    className="min-h-20 resize-none"
                    maxLength={200}
                    required
                  />
                </div>

                {/* Humor do Dia */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-base">
                    <Heart className="w-5 h-5 text-primary" />
                    Como você está se sentindo?
                  </Label>
                  <div className="grid grid-cols-5 gap-3">
                    {moods.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setMood(m.value)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                          mood === m.value
                            ? "border-primary bg-primary/10 shadow-glow-primary scale-105"
                            : "border-border hover:border-primary/50 hover:bg-muted"
                        }`}
                      >
                        <span className="text-3xl">{m.emoji}</span>
                        <span className="text-xs font-medium">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-14 text-lg font-bold"
                  disabled={isLoading}
                >
                  {isLoading ? "Processando..." : "Começar o dia! 🚀"}
                </Button>
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
