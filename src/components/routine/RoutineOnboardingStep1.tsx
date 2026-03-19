import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sunrise, Briefcase, Utensils, Sunset, Moon, ArrowRight, ChevronRight } from "lucide-react";

interface Step1Data {
  wakeTime: string;
  workStart: string;
  workEnd: string;
  hasLunch: boolean;
  lunchTime: string;
  sleepTime: string;
  challenge: string;
}

interface Props {
  onComplete: (data: Step1Data) => void;
}

const challenges = [
  { label: "Foco", emoji: "🎯" },
  { label: "Disciplina", emoji: "💪" },
  { label: "Ansiedade", emoji: "😰" },
  { label: "Procrastinação", emoji: "⏳" },
  { label: "Energia", emoji: "⚡" },
];

interface QuizQuestion {
  key: keyof Step1Data;
  title: string;
  subtitle: string;
  emoji: string;
  icon: React.ReactNode;
  type: "time" | "yesno" | "chips";
}

const questions: QuizQuestion[] = [
  { key: "wakeTime", title: "Que horas você costuma acordar?", subtitle: "Comece o dia com intenção", emoji: "☀️", icon: <Sunrise className="w-6 h-6 text-primary" />, type: "time" },
  { key: "workStart", title: "Que horas você começa a vender?", subtitle: "Seu horário de batalha", emoji: "💼", icon: <Briefcase className="w-6 h-6 text-secondary" />, type: "time" },
  { key: "workEnd", title: "Que horas você para de vender?", subtitle: "Hora de encerrar o dia", emoji: "🏁", icon: <Sunset className="w-6 h-6 text-warning" />, type: "time" },
  { key: "hasLunch", title: "Você tem pausa para almoço?", subtitle: "Descansar é parte da estratégia", emoji: "🍽️", icon: <Utensils className="w-6 h-6 text-success" />, type: "yesno" },
  { key: "lunchTime", title: "Que horas você almoça?", subtitle: "Recarregue suas energias", emoji: "🍽️", icon: <Utensils className="w-6 h-6 text-success" />, type: "time" },
  { key: "sleepTime", title: "Que horas você dorme?", subtitle: "Descanso é combustível", emoji: "🌙", icon: <Moon className="w-6 h-6 text-primary" />, type: "time" },
  { key: "challenge", title: "Qual seu maior desafio?", subtitle: "Vou te ajudar a superar isso", emoji: "🧠", icon: null, type: "chips" },
];

export default function RoutineOnboardingStep1({ onComplete }: Props) {
  const [currentQ, setCurrentQ] = useState(0);
  const [data, setData] = useState<Step1Data>({
    wakeTime: "06:30",
    workStart: "08:00",
    workEnd: "18:00",
    hasLunch: true,
    lunchTime: "12:00",
    sleepTime: "22:00",
    challenge: "",
  });

  const visibleQuestions = questions.filter((q) => {
    if (q.key === "lunchTime") return data.hasLunch;
    return true;
  });

  const q = visibleQuestions[currentQ];
  const isLast = currentQ === visibleQuestions.length - 1;
  const progress = ((currentQ + 1) / visibleQuestions.length) * 100;

  const canAdvance = () => {
    if (q.type === "chips") return !!data.challenge;
    if (q.type === "yesno") return true;
    const val = data[q.key as keyof Step1Data];
    return typeof val === "string" && val.length > 0;
  };

  const next = () => {
    if (isLast) {
      onComplete(data);
    } else {
      setCurrentQ((p) => p + 1);
    }
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6 animate-fade-in">
      {/* Progress bar */}
      <div className="w-full max-w-md">
        <div className="flex justify-between text-xs text-muted-foreground mb-2">
          <span>Etapa 1 de 3</span>
          <span>{currentQ + 1}/{visibleQuestions.length}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <Card className="glass border-primary/20 w-full max-w-md shadow-[0_0_30px_hsl(var(--primary)/0.15)]">
        <CardContent className="p-8 text-center space-y-6">
          <div className="text-5xl animate-bounce">{q.emoji}</div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{q.title}</h2>
            <p className="text-muted-foreground text-sm mt-1">{q.subtitle}</p>
          </div>

          {q.type === "time" && (
            <Input
              type="time"
              value={data[q.key as keyof Step1Data] as string}
              onChange={(e) => setData({ ...data, [q.key]: e.target.value })}
              className="text-center text-2xl h-16 bg-card/50 border-primary/30 focus:border-primary max-w-[200px] mx-auto"
            />
          )}

          {q.type === "yesno" && (
            <div className="flex gap-4 justify-center">
              {[
                { label: "Sim ✅", value: true },
                { label: "Não ❌", value: false },
              ].map((opt) => (
                <Button
                  key={String(opt.value)}
                  variant={data.hasLunch === opt.value ? "default" : "outline"}
                  className={`px-8 py-6 text-lg ${data.hasLunch === opt.value ? "bg-primary shadow-[0_0_20px_hsl(var(--primary)/0.3)]" : "border-primary/30"}`}
                  onClick={() => {
                    setData({ ...data, hasLunch: opt.value });
                    // Auto-advance after selection
                    setTimeout(() => setCurrentQ((p) => p + 1), 400);
                  }}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          )}

          {q.type === "chips" && (
            <div className="flex flex-wrap gap-3 justify-center">
              {challenges.map((c) => (
                <Button
                  key={c.label}
                  variant={data.challenge === c.label ? "default" : "outline"}
                  className={`px-5 py-3 text-base ${data.challenge === c.label ? "bg-primary shadow-[0_0_20px_hsl(var(--primary)/0.3)]" : "border-primary/30"}`}
                  onClick={() => setData({ ...data, challenge: c.label })}
                >
                  {c.emoji} {c.label}
                </Button>
              ))}
            </div>
          )}

          {q.type !== "yesno" && (
            <Button
              onClick={next}
              disabled={!canAdvance()}
              className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-[0_0_20px_hsl(var(--primary)/0.3)] gap-2 text-lg h-14"
            >
              {isLast ? "Gerar Minha Rotina" : "Próximo"}
              {isLast ? <ChevronRight className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Back button */}
      {currentQ > 0 && (
        <Button
          variant="ghost"
          onClick={() => setCurrentQ((p) => p - 1)}
          className="text-muted-foreground"
        >
          ← Voltar
        </Button>
      )}
    </div>
  );
}
