import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Sparkles, ChevronRight, Edit3 } from "lucide-react";

export interface RoutineItem {
  time: string;
  emoji: string;
  text: string;
  enabled: boolean;
  isBase: boolean; // base routine items can't be deleted
}

interface Props {
  profileData: {
    wakeTime: string;
    workStart: string;
    workEnd: string;
    hasLunch: boolean;
    lunchTime: string;
    sleepTime: string;
    challenge: string;
  };
  onComplete: (items: RoutineItem[]) => void;
  onBack: () => void;
}

function generateRoutine(p: Props["profileData"]): RoutineItem[] {
  const items: RoutineItem[] = [];

  // Wake up
  items.push({ time: p.wakeTime, emoji: "⏰", text: "Acorde e beba água antes de qualquer coisa", enabled: true, isBase: true });

  // 15 min after wake
  const wakeMin = timeToMinutes(p.wakeTime);
  items.push({ time: minutesToTime(wakeMin + 15), emoji: "💪", text: "10 minutos de alongamento ou caminhada", enabled: true, isBase: false });
  items.push({ time: minutesToTime(wakeMin + 30), emoji: "🧠", text: "Revise sua meta do dia no Orbis", enabled: true, isBase: false });

  // 30 min before work
  const workMin = timeToMinutes(p.workStart);
  items.push({ time: minutesToTime(workMin - 30), emoji: "🛒", text: "Separe e organize sua mercadoria", enabled: true, isBase: false });
  items.push({ time: p.workStart, emoji: "🚀", text: "Comece o DEFCON 4. Primeiro bloco.", enabled: true, isBase: true });

  if (p.hasLunch) {
    items.push({ time: p.lunchTime, emoji: "🍽️", text: "Pausa para almoço. Descanse 30 min.", enabled: true, isBase: true });
    const lunchMin = timeToMinutes(p.lunchTime);
    items.push({ time: minutesToTime(lunchMin + 60), emoji: "⚡", text: "Retome. Segundo turno.", enabled: true, isBase: false });
  }

  items.push({ time: p.workEnd, emoji: "✅", text: "Encerre o dia no app. Registre tudo.", enabled: true, isBase: true });

  const endMin = timeToMinutes(p.workEnd);
  items.push({ time: minutesToTime(endMin + 15), emoji: "📊", text: "Veja seu relatório e comemore.", enabled: true, isBase: false });

  items.push({ time: p.sleepTime, emoji: "😴", text: "Durma. Amanhã é novo dia.", enabled: true, isBase: true });

  // Challenge-specific tip
  const challengeTips: Record<string, RoutineItem> = {
    "Foco": { time: minutesToTime(wakeMin + 25), emoji: "🎯", text: "5 min de meditação para alinhar o foco", enabled: true, isBase: false },
    "Disciplina": { time: minutesToTime(workMin - 45), emoji: "📝", text: "Escreva 3 metas do dia em papel", enabled: true, isBase: false },
    "Ansiedade": { time: minutesToTime(wakeMin + 20), emoji: "🧘", text: "Respiração 4-7-8 para acalmar a mente", enabled: true, isBase: false },
    "Procrastinação": { time: minutesToTime(workMin - 10), emoji: "🔥", text: "Comece pela tarefa mais difícil primeiro", enabled: true, isBase: false },
    "Energia": { time: minutesToTime(wakeMin + 10), emoji: "🥤", text: "Café + fruta para começar com energia", enabled: true, isBase: false },
  };

  if (p.challenge && challengeTips[p.challenge]) {
    items.push(challengeTips[p.challenge]);
  }

  items.sort((a, b) => a.time.localeCompare(b.time));
  return items;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const totalMin = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(totalMin / 60).toString().padStart(2, "0");
  const min = (totalMin % 60).toString().padStart(2, "0");
  return `${h}:${min}`;
}

export default function RoutineOnboardingStep2({ profileData, onComplete, onBack }: Props) {
  const [items, setItems] = useState<RoutineItem[]>(() => generateRoutine(profileData));
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const toggleItem = (idx: number) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, enabled: !it.enabled } : it));
  };

  const updateText = (idx: number, text: string) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, text } : it));
  };

  const updateTime = (idx: number, time: string) => {
    setItems((prev) => {
      const updated = prev.map((it, i) => i === idx ? { ...it, time } : it);
      return updated.sort((a, b) => a.time.localeCompare(b.time));
    });
    setEditingIdx(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          <h2 className="text-2xl font-bold gradient-text">Sua Rotina Personalizada</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Etapa 2 de 3 — Ajuste como preferir, depois confirme
        </p>
        <div className="h-2 bg-muted rounded-full overflow-hidden max-w-md mx-auto">
          <div className="h-full bg-gradient-to-r from-primary to-secondary w-2/3 transition-all duration-500" />
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-3 max-w-lg mx-auto">
        {items.map((item, idx) => (
          <Card
            key={idx}
            className={`glass border transition-all duration-300 ${
              item.enabled ? "border-primary/20 opacity-100" : "border-border/30 opacity-50"
            }`}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <Switch
                checked={item.enabled}
                onCheckedChange={() => toggleItem(idx)}
              />
              <span className="text-2xl">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                {editingIdx === idx ? (
                  <div className="space-y-2">
                    <Input
                      type="time"
                      value={item.time}
                      onChange={(e) => updateTime(idx, e.target.value)}
                      className="h-8 w-24 bg-card/50 text-sm"
                    />
                    <Input
                      value={item.text}
                      onChange={(e) => updateText(idx, e.target.value)}
                      onBlur={() => setEditingIdx(null)}
                      autoFocus
                      className="h-8 bg-card/50 text-sm"
                    />
                  </div>
                ) : (
                  <div onClick={() => setEditingIdx(idx)} className="cursor-pointer">
                    <span className="text-xs font-mono text-primary">{item.time}</span>
                    <p className={`text-sm ${item.enabled ? "text-foreground" : "text-muted-foreground"}`}>
                      {item.text}
                    </p>
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 max-w-lg mx-auto">
        <Button
          onClick={() => onComplete(items)}
          className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-[0_0_20px_hsl(var(--primary)/0.3)] gap-2 text-lg h-14"
        >
          Confirmar Rotina <ChevronRight className="w-5 h-5" />
        </Button>
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground">
          ← Voltar
        </Button>
      </div>
    </div>
  );
}
