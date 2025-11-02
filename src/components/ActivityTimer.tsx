import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Pause, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ActivityTimerProps {
  taskId: string;
  taskName: string;
  currentStatus: string;
  currentProgress: number;
  durationMinutes: number;
  startedAt: string | null;
  onTimerComplete: () => void;
}

export function ActivityTimer({
  taskId,
  taskName,
  currentStatus,
  currentProgress,
  durationMinutes,
  startedAt,
  onTimerComplete
}: ActivityTimerProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState(currentStatus);
  const [progress, setProgress] = useState(currentProgress);
  const [remainingTime, setRemainingTime] = useState("");
  const [duration, setDuration] = useState(durationMinutes || 25);
  const [customDuration, setCustomDuration] = useState(25);
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const updateRef = useRef<NodeJS.Timeout | null>(null);
  const notificationRef = useRef({ halfway: false, lastFive: false });

  useEffect(() => {
    if (status === "active" && startedAt) {
      startTimerCountdown();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (updateRef.current) clearInterval(updateRef.current);
    };
  }, [status, startedAt]);

  const formatTime = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs}h${mins > 0 ? ` ${mins}min` : ''}`;
    }
    return `${mins}min`;
  };

  const calculateRemainingTime = (start: Date, durationMs: number) => {
    const now = new Date();
    const elapsed = now.getTime() - start.getTime();
    const remaining = Math.max(0, durationMs - elapsed);
    const remainingMinutes = Math.ceil(remaining / 60000);
    return { remaining, remainingMinutes };
  };

  const startTimerCountdown = () => {
    if (!startedAt || !durationMinutes) return;

    const startTime = new Date(startedAt);
    const durationMs = durationMinutes * 60000;

    // Update countdown every second
    timerRef.current = setInterval(() => {
      const { remaining, remainingMinutes } = calculateRemainingTime(startTime, durationMs);
      
      if (remaining <= 0) {
        completeTimer();
        return;
      }

      setRemainingTime(formatTime(remainingMinutes));

      // Calculate progress percentage
      const currentProgress = Math.min(100, ((durationMs - remaining) / durationMs) * 100);
      setProgress(currentProgress);

      // Notifications
      const progressPercent = Math.floor(currentProgress);
      
      // 50% notification
      if (progressPercent >= 50 && !notificationRef.current.halfway) {
        notificationRef.current.halfway = true;
        toast({
          title: "🔥 Metade concluída!",
          description: "Continue firme, Visionário! Você está no caminho certo.",
        });
      }

      // Last 5 minutes notification
      if (remainingMinutes <= 5 && remainingMinutes > 0 && !notificationRef.current.lastFive) {
        notificationRef.current.lastFive = true;
        toast({
          title: "⚡ Reta final!",
          description: "Só mais 5 minutos de foco. Quase lá!",
        });
      }
    }, 1000);

    // Update database every minute
    updateRef.current = setInterval(async () => {
      const { remaining } = calculateRemainingTime(startTime, durationMs);
      const currentProgress = Math.min(100, ((durationMs - remaining) / durationMs) * 100);
      
      await supabase
        .from("daily_checklist")
        .update({ progress: currentProgress })
        .eq("id", taskId);
    }, 60000);
  };

  const startTimer = async () => {
    try {
      const startTime = new Date();
      
      const { error } = await supabase
        .from("daily_checklist")
        .update({
          status: "active",
          started_at: startTime.toISOString(),
          duration_minutes: duration,
          progress: 0,
        })
        .eq("id", taskId);

      if (error) throw error;

      setStatus("active");
      setProgress(0);
      notificationRef.current = { halfway: false, lastFive: false };
      
      toast({
        title: "⏱️ Timer iniciado!",
        description: `Foco total por ${formatTime(duration)}. Vamos lá!`,
      });

      startTimerCountdown();
    } catch (error) {
      console.error("Erro ao iniciar timer:", error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar o timer.",
        variant: "destructive",
      });
    }
  };

  const pauseTimer = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (updateRef.current) clearInterval(updateRef.current);

    try {
      const { error } = await supabase
        .from("daily_checklist")
        .update({
          status: "pending",
          started_at: null,
        })
        .eq("id", taskId);

      if (error) throw error;

      setStatus("pending");
      toast({
        title: "⏸️ Timer pausado",
        description: "Você pode retomar quando quiser.",
      });
    } catch (error) {
      console.error("Erro ao pausar timer:", error);
    }
  };

  const completeTimer = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (updateRef.current) clearInterval(updateRef.current);

    try {
      const completedTime = new Date();
      
      const { error } = await supabase
        .from("daily_checklist")
        .update({
          status: "completed",
          completed_at: completedTime.toISOString(),
          progress: 100,
          completed: true,
        })
        .eq("id", taskId);

      if (error) throw error;

      setStatus("completed");
      setProgress(100);

      // Call AI for motivational message
      try {
        await supabase.functions.invoke('chat-with-ai', {
          body: {
            messages: [{
              role: "user",
              content: `O usuário completou a atividade "${taskName}" com ${duration} minutos de foco. Envie uma mensagem motivacional curta e direta no estilo Visionário (máximo 2 linhas).`
            }]
          }
        });
      } catch (aiError) {
        console.error("Erro ao chamar IA:", aiError);
      }

      toast({
        title: "🔥 Atividade concluída!",
        description: `Parabéns! Você completou ${formatTime(duration)} de foco total.`,
      });

      onTimerComplete();
    } catch (error) {
      console.error("Erro ao completar timer:", error);
    }
  };

  const selectCustomDuration = () => {
    setDuration(customDuration);
    setShowCustomDialog(false);
    toast({
      title: "⏱️ Duração definida",
      description: `Timer configurado para ${formatTime(customDuration)}.`,
    });
  };

  if (status === "completed") {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-success animate-bounce" />
        <span className="text-success font-semibold text-sm">Concluída!</span>
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 transform -rotate-90">
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              className="text-muted"
            />
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 20}`}
              strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress / 100)}`}
              className="text-primary transition-all duration-1000"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Clock className="w-4 h-4 text-primary animate-pulse" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-primary">{remainingTime}</span>
          <span className="text-xs text-muted-foreground">{Math.floor(progress)}%</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={pauseTimer}
          className="ml-2"
        >
          <Pause className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
        <SelectTrigger className="w-24 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="15">15min</SelectItem>
          <SelectItem value="25">25min</SelectItem>
          <SelectItem value="30">30min</SelectItem>
          <SelectItem value="45">45min</SelectItem>
          <SelectItem value="60">1h</SelectItem>
          <SelectItem value="90">1h30</SelectItem>
          <SelectItem value="120">2h</SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs">
            Custom
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir tempo personalizado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="custom-duration">Minutos</Label>
              <Input
                id="custom-duration"
                type="number"
                min="1"
                max="480"
                value={customDuration}
                onChange={(e) => setCustomDuration(parseInt(e.target.value) || 25)}
              />
            </div>
            <Button onClick={selectCustomDuration} className="w-full">
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Button
        size="sm"
        onClick={startTimer}
        className="gap-1"
      >
        <Play className="w-3 h-3" />
        Iniciar
      </Button>
    </div>
  );
}
