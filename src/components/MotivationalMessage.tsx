import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, TrendingUp } from "lucide-react";

interface MotivationalMessageProps {
  totalDayProfit: number;
  dailyGoal: number;
}

export const MotivationalMessage = ({ totalDayProfit, dailyGoal }: MotivationalMessageProps) => {
  const [show, setShow] = useState(true);
  const goalPercentage = dailyGoal > 0 ? (totalDayProfit / dailyGoal) * 100 : 0;
  const goalAchieved = goalPercentage >= 100;
  const difference = Math.abs(dailyGoal - totalDayProfit);

  useEffect(() => {
    // Auto-hide after 5 seconds
    const timer = setTimeout(() => setShow(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <Alert className={`mb-4 ${goalAchieved ? 'bg-green-500/10 border-green-500/30' : 'bg-orange-500/10 border-orange-500/30'}`}>
      <div className="flex items-start gap-3">
        {goalAchieved ? (
          <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
        ) : (
          <TrendingUp className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
        )}
        <AlertDescription className="text-sm">
          {goalAchieved ? (
            <div>
              <p className="font-bold text-green-500">🔥 Visionário! Meta batida!</p>
              <p className="text-muted-foreground">Isso aqui é disciplina de verdade!</p>
            </div>
          ) : (
            <div>
              <p className="font-semibold">
                Você fez R$ {totalDayProfit.toFixed(2)} hoje.
              </p>
              <p className="text-muted-foreground">
                Faltou {goalPercentage > 0 ? (100 - goalPercentage).toFixed(0) : '100'}% para a meta de R$ {dailyGoal.toFixed(2)}. Não para. Tua história está sendo escrita.
              </p>
            </div>
          )}
        </AlertDescription>
      </div>
    </Alert>
  );
};
