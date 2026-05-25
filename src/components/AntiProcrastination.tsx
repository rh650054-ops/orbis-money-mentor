import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface AntiProcrastinationProps {
  visible: boolean;
}

export default function AntiProcrastination({ visible }: AntiProcrastinationProps) {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!visible || dismissed) return;

    const timer = setTimeout(() => {
      setShow(true);
    }, 30000); // 30 seconds idle

    return () => clearTimeout(timer);
  }, [visible, dismissed]);

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => {
      setShow(false);
      setDismissed(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[100] animate-fade-in">
      <div className="bg-card/95 border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h3 className="text-foreground font-bold text-base">Só 2 minutos.</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Não precisa vender agora. Só aperta iniciar. Se em 2 minutos não quiser continuar, para.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShow(false);
              setDismissed(true);
              navigate("/defcon");
            }}
            className="flex-1 h-11 rounded-xl font-bold text-primary-foreground bg-primary text-sm active:scale-[0.97] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Iniciar 2 minutos
          </button>
          <button
            onClick={() => {
              setShow(false);
              setDismissed(true);
            }}
            className="px-4 h-11 rounded-xl text-muted-foreground border border-border text-sm active:scale-[0.97] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
