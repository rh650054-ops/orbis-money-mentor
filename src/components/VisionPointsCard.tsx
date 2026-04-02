import { useState } from "react";
import { Diamond, ChevronRight, X } from "lucide-react";

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
      <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Diamond className="h-5 w-5 text-[#F4A100]" />
            <span className="font-bold text-white text-sm">Vision Points</span>
          </div>
          <span className="text-[#F4A100] font-bold text-lg">{points} VP</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-lg">{currentLevel.icon}</span>
          <span className="text-sm text-white font-medium">{currentLevel.name}</span>
          {nextLevel && (
            <span className="text-xs text-[#888888] ml-auto">
              {nextLevel.min - points} VP p/ {nextLevel.name}
            </span>
          )}
        </div>

        <div className="h-2 bg-[#333333] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#F4A100] rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progressInLevel, 100)}%` }}
          />
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-1 text-xs text-[#F4A100] hover:text-[#F4A100]/80 transition-colors w-full pt-1"
        >
          Ver como ganhar VP <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div
            className="bg-[#1A1A1A] border border-[#333333] rounded-xl p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Como ganhar VP</h3>
              <button onClick={() => setShowModal(false)} className="text-[#888888] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {vpRules.map((rule, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-[#0D0D0D] rounded-lg border border-[#333333]/50">
                  <span className="text-lg">{rule.icon}</span>
                  <span className="text-sm text-[#888888] flex-1">{rule.action}</span>
                  <span className="text-sm font-bold text-[#F4A100] whitespace-nowrap">{rule.vp}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-[#0D0D0D] rounded-lg border border-[#F4A100]/30">
              <p className="text-xs text-[#888888] text-center">
                <span className="text-[#F4A100] font-bold">500 VP</span> = 10% desc •{" "}
                <span className="text-[#F4A100] font-bold">1.000 VP</span> = 20% •{" "}
                <span className="text-[#F4A100] font-bold">2.000 VP</span> = 30%
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
