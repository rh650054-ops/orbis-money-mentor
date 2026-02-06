import { formatCurrency } from "@/lib/utils";

interface DefconMissionProps {
  goal: number;
  totalSold: number;
}

export function DefconMission({ goal, totalSold }: DefconMissionProps) {
  const remaining = Math.max(0, goal - totalSold);
  const now = new Date();
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 0, 0);
  const deadline = `${String(endOfDay.getHours()).padStart(2, "0")}:${String(endOfDay.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="pt-12 pb-6 px-6 text-center">
      <div className="text-xs font-mono text-red-500/60 tracking-[0.3em] uppercase mb-3">
        🎯 Missão
      </div>
      <div className="text-3xl md:text-4xl font-black text-white tracking-tight">
        Vender {formatCurrency(goal)} até {deadline}
      </div>
      {totalSold > 0 && (
        <div className="mt-3 text-sm font-mono text-neutral-500">
          Faltam {formatCurrency(remaining)}
        </div>
      )}
    </div>
  );
}
