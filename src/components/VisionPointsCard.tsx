import { useState } from "react";
import { Diamond, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface VisionPointsCardProps {
  points: number;
}

const levels = [
  { name: "Iniciante", min: 0, max: 499, icon: "🌱" },
  { name: "Vendedor", min: 500, max: 999, icon: "💪" },
  { name: "Elite", min: 1000, max: 1999, icon: "⚡" },
  { name: "Visionário", min: 2000, max: Infinity, icon: "👑" },
];

const vpRules = [
  { icon: "🎯", action: "Bater meta do bloco de hora", vp: "+10 VP" },
  { icon: "🏆", action: "Bater meta diária completa", vp: "+50 VP" },
  { icon: "🔥", action: "Bater meta com 100%+", vp: "+75 VP" },
  { icon: "📅", action: "Usar app 3 dias seguidos", vp: "+30 VP" },
  { icon: "✅", action: "Encerrar o dia pelo app", vp: "+15 VP" },
  { icon: "💰", action: "Registrar venda no bloco ativo", vp: "+2 VP" },
  { icon: "📊", action: "Bater meta semanal", vp: "+200 VP" },
  { icon: "🧠", action: "Rotina diária 100% concluída", vp: "+20 VP" },
  { icon: "☀️", action: "Primeiro acesso do dia", vp: "+5 VP" },
];

export default function VisionPointsCard({ points }: VisionPointsCardProps) {
  const [showModal, setShowModal] = useState(false);

  const currentLevel = levels.find((l) => points >= l.min && points <= l.max) || levels[0];
  const nextLevel = levels.find((l) => l.min > points);
  const progressInLevel = nextLevel
    ? ((points - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100
    : 100;

  return (
    <>
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Diamond className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground text-sm">Vision Points</span>
          </div>
          <span className="text-primary font-bold text-lg">{points} VP</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-lg">{currentLevel.icon}</span>
          <span className="text-sm text-foreground font-medium">{currentLevel.name}</span>
          {nextLevel && (
            <span className="text-xs text-muted-foreground ml-auto">
              {nextLevel.min - points} VP p/ {nextLevel.name}
            </span>
          )}
        </div>

        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${Math.min(progressInLevel, 100)}%` }}
          />
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors w-full pt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          Ver como ganhar VP <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="bg-card border-border rounded-xl max-w-sm max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Como ganhar VP</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {vpRules.map((rule, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border">
                <span className="text-lg">{rule.icon}</span>
                <span className="text-sm text-muted-foreground flex-1">{rule.action}</span>
                <span className="text-sm font-bold text-primary whitespace-nowrap">{rule.vp}</span>
              </div>
            ))}
          </div>

          <div className="p-3 bg-background rounded-lg border border-primary/30">
            <p className="text-xs text-muted-foreground text-center">
              <span className="text-primary font-bold">500 VP</span> = 10% desc ·{" "}
              <span className="text-primary font-bold">1.000 VP</span> = 20% ·{" "}
              <span className="text-primary font-bold">2.000 VP</span> = 30%
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
