import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";

interface Props {
  userId: string;
  onDismiss: () => void;
}

export default function MorningCommitModal({ userId, onDismiss }: Props) {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [configuredTime, setConfiguredTime] = useState("");
  const nome = localStorage.getItem("orbis_nome") || "Vendedor";

  useEffect(() => {
    const check = async () => {
      // Check if already dismissed today
      const today = getBrazilDate();
      if (localStorage.getItem("orbis_morning_commit_" + today)) return;

      // Get routine wake/work time
      const { data: routine } = await supabase
        .from("routines")
        .select("work_start")
        .eq("user_id", userId)
        .maybeSingle();

      if (!routine?.work_start) return;

      setConfiguredTime(routine.work_start);

      // Check if 15+ minutes late
      const now = new Date();
      const [h, m] = routine.work_start.split(":").map(Number);
      const scheduled = new Date();
      scheduled.setHours(h, m, 0, 0);
      const diffMinutes = (now.getTime() - scheduled.getTime()) / 60000;

      if (diffMinutes >= 15) {
        setShow(true);
      }
    };
    check();
  }, [userId]);

  if (!show) return null;

  const handleCommit = () => {
    const today = getBrazilDate();
    localStorage.setItem("orbis_morning_commit_" + today, "true");
    setShow(false);
    onDismiss();
    navigate("/daily-goals");
  };

  const handleSkip = () => {
    const today = getBrazilDate();
    localStorage.setItem("orbis_morning_commit_" + today, "true");
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-6" style={{ pointerEvents: 'auto' }}>
      <div className="max-w-sm w-full text-center space-y-5 animate-fade-in">
        <span className="text-6xl block">🔥</span>
        <p className="text-lg text-white leading-relaxed">
          <span className="text-[#F4A100] font-bold">{nome}</span>. Você decidiu ontem que hoje começaria às{" "}
          <span className="text-[#F4A100] font-bold">{configuredTime}</span>. Seu eu de ontem estava certo.
        </p>
        <button
          onClick={handleCommit}
          className="w-full py-4 rounded-xl font-bold text-black bg-[#F4A100] text-lg active:scale-[0.97] transition-transform"
        >
          Honrar meu compromisso →
        </button>
        <button
          onClick={handleSkip}
          className="text-sm text-[#888888] hover:text-white transition-colors"
        >
          Pular
        </button>
      </div>
    </div>
  );
}
