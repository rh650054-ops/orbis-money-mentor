import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/shared/ui/dialog";

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
      const today = getBrazilDate();
      if (localStorage.getItem("orbis_morning_commit_" + today)) return;

      const { data: routine } = await supabase
        .from("routines")
        .select("work_start")
        .eq("user_id", userId)
        .maybeSingle();

      if (!routine?.work_start) return;

      setConfiguredTime(routine.work_start);

      const now = new Date();
      const [h = 0, m = 0] = routine.work_start.split(":").map(Number);
      const scheduled = new Date();
      scheduled.setHours(h, m, 0, 0);
      const diffMinutes = (now.getTime() - scheduled.getTime()) / 60000;

      if (diffMinutes >= 15) {
        setShow(true);
      }
    };
    check();
  }, [userId]);

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
    <Dialog open={show} onOpenChange={(open) => { if (!open) handleSkip(); }}>
      <DialogContent className="bg-card border-border max-w-sm rounded-2xl">
        <div className="text-center space-y-5">
          <DialogTitle className="sr-only">Honre seu compromisso de hoje</DialogTitle>
          <DialogDescription className="text-base text-foreground leading-relaxed">
            <span className="text-primary font-bold">{nome}</span>. Você decidiu ontem que hoje começaria às{" "}
            <span className="text-primary font-bold">{configuredTime}</span>. Seu eu de ontem estava certo.
          </DialogDescription>
          <button
            onClick={handleCommit}
            className="w-full h-12 rounded-xl font-bold text-primary-foreground bg-primary text-base active:scale-[0.97] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Honrar meu compromisso →
          </button>
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            Pular
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
