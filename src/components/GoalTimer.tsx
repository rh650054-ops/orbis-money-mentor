import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Play, Pause, CheckCircle2, Trophy, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GoalTimerProps {
  userId: string;
}

export const GoalTimer = ({ userId }: GoalTimerProps) => {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [selectedHours, setSelectedHours] = useState("4");
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const { toast } = useToast();

  // Load timer state from database
  const loadTimerState = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("goal_hours, goal_timer_started_at, goal_timer_active")
      .eq("user_id", userId)
      .single();

    if (error || !data) return;

    if (data.goal_timer_active && data.goal_timer_started_at) {
      const startTime = new Date(data.goal_timer_started_at).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      const total = (data.goal_hours || 0) * 3600;
      const remaining = Math.max(0, total - elapsed);

      setTotalSeconds(total);
      setRemainingSeconds(remaining);
      setIsActive(true);
      setIsPaused(false);
      setSelectedHours(data.goal_hours.toString());
    }
  }, [userId]);

  useEffect(() => {
    loadTimerState();
  }, [loadTimerState]);

  // Auto-start timer when any checklist activity starts
  useEffect(() => {
    if (!isActive && !hasAutoStarted) {
      const checkActiveActivities = async () => {
        const { data } = await supabase
          .from("daily_checklist")
          .select("status")
          .eq("user_id", userId)
          .eq("date", new Date().toISOString().split('T')[0])
          .eq("status", "active")
          .limit(1);

        if (data && data.length > 0) {
          setHasAutoStarted(true);
          await startTimer();
        }
      };

      checkActiveActivities();
    }
  }, [userId, isActive, hasAutoStarted]);

  // Timer countdown logic
  useEffect(() => {
    if (!isActive || isPaused || remainingSeconds <= 0) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          completeGoal();
          return 0;
        }

        // Notifications at 50% and last 5 minutes
        if (prev === Math.floor(totalSeconds / 2)) {
          toast({
            title: "⏱ Metade do tempo!",
            description: "Continue firme, você está no caminho certo! 💪",
          });
        } else if (prev === 300) {
          toast({
            title: "⚡ Últimos 5 minutos!",
            description: "Quase lá, Visionário! Finalize com força!",
          });
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, isPaused, remainingSeconds, totalSeconds]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const getProgress = () => {
    if (totalSeconds === 0) return 0;
    return ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
  };

  const startTimer = async () => {
    const hours = parseInt(selectedHours);
    const total = hours * 3600;

    const { error } = await supabase
      .from("profiles")
      .update({
        goal_hours: hours,
        goal_timer_started_at: new Date().toISOString(),
        goal_timer_active: true,
      })
      .eq("user_id", userId);

    if (error) {
      toast({
        title: "Erro ao iniciar timer",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setTotalSeconds(total);
    setRemainingSeconds(total);
    setIsActive(true);
    setIsPaused(false);

    toast({
      title: "⏱ Timer iniciado!",
      description: `Meta de ${hours}h ativada. Foco total! 🔥`,
    });
  };

  const pauseTimer = async () => {
    setIsPaused(!isPaused);
    toast({
      title: isPaused ? "▶️ Timer retomado" : "⏸ Timer pausado",
      description: isPaused ? "Continue focado!" : "Pause para descansar.",
    });
  };

  const completeGoal = async () => {
    const { error } = await supabase
      .from("profiles")
      .update({
        goal_timer_active: false,
        goal_timer_started_at: null,
      })
      .eq("user_id", userId);

    if (error) {
      console.error("Error completing goal:", error);
    }

    setIsActive(false);
    setRemainingSeconds(0);

    // Trigger AI motivational message
    try {
      await supabase.functions.invoke("chat-with-ai", {
        body: {
          messages: [
            {
              role: "user",
              content: `O usuário completou ${selectedHours} horas de foco. Envie uma frase inspiradora curta no estilo Visionário.`,
            },
          ],
        },
      });
    } catch (error) {
      console.error("Error calling AI:", error);
    }

    toast({
      title: "🏆 Meta Concluída!",
      description: `Você dominou ${selectedHours}h de foco! Cada hora focada é um passo rumo ao topo, Visionário. 🔥`,
      duration: 8000,
    });
  };

  const cancelTimer = async () => {
    await supabase
      .from("profiles")
      .update({
        goal_timer_active: false,
        goal_timer_started_at: null,
      })
      .eq("user_id", userId);

    setIsActive(false);
    setIsPaused(false);
    setRemainingSeconds(0);

    toast({
      title: "Timer cancelado",
      description: "Você pode iniciar um novo timer quando quiser.",
    });
  };

  return (
    <Card className="card-gradient-border hover:shadow-glow-primary transition-smooth">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Timer de Meta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isActive ? (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Defina sua meta de foco diário
              </p>
              <Select value={selectedHours} onValueChange={setSelectedHours}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione as horas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 hora</SelectItem>
                  <SelectItem value="2">2 horas</SelectItem>
                  <SelectItem value="3">3 horas</SelectItem>
                  <SelectItem value="4">4 horas</SelectItem>
                  <SelectItem value="5">5 horas</SelectItem>
                  <SelectItem value="6">6 horas</SelectItem>
                  <SelectItem value="8">8 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={startTimer} className="w-full" size="lg">
              <Play className="h-4 w-4 mr-2" />
              Iniciar Meta de {selectedHours}h
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Compact View */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Tempo Restante</p>
                <p className="text-2xl font-bold text-primary">
                  {formatTime(remainingSeconds)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {getProgress().toFixed(0)}% completo
                </p>
              </div>
              
              <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon" className="h-16 w-16">
                    <div className="relative flex items-center justify-center">
                      <svg className="absolute h-16 w-16 -rotate-90">
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          className="text-muted"
                        />
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 28}`}
                          strokeDashoffset={`${2 * Math.PI * 28 * (1 - getProgress() / 100)}`}
                          className="text-primary transition-all duration-1000"
                        />
                      </svg>
                      <Clock className="h-6 w-6 text-primary" />
                    </div>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-center">Timer de Meta</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col items-center space-y-6 py-6">
                    {/* Large Circular Timer */}
                    <div className="relative flex items-center justify-center">
                      <svg className="h-64 w-64 -rotate-90">
                        <circle
                          cx="128"
                          cy="128"
                          r="120"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          className="text-muted"
                        />
                        <circle
                          cx="128"
                          cy="128"
                          r="120"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 120}`}
                          strokeDashoffset={`${2 * Math.PI * 120 * (1 - getProgress() / 100)}`}
                          className="text-primary transition-all duration-1000"
                          style={{ strokeLinecap: "round" }}
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <Clock className="h-12 w-12 text-primary mb-2" />
                        <p className="text-4xl font-bold text-primary">
                          {formatTime(remainingSeconds)}
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          {getProgress().toFixed(0)}% concluído
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 w-full">
                      <Button
                        onClick={pauseTimer}
                        variant="outline"
                        size="lg"
                        className="flex-1"
                      >
                        {isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                        {isPaused ? "Retomar" : "Pausar"}
                      </Button>
                      <Button
                        onClick={completeGoal}
                        variant="default"
                        size="lg"
                        className="flex-1"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Concluir Agora
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-1000"
                  style={{ width: `${getProgress()}%` }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={pauseTimer}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                {isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                {isPaused ? "Retomar" : "Pausar"}
              </Button>
              <Button
                onClick={cancelTimer}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
