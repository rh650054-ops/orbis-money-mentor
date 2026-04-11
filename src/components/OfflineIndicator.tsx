import { CloudOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const [show, setShow] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShow(true);
      setJustReconnected(false);
    } else if (show) {
      // Was offline, now online — show "reconnected" briefly
      setJustReconnected(true);
      const timer = setTimeout(() => {
        setShow(false);
        setJustReconnected(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!show) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-1.5 px-4 text-xs font-medium transition-all duration-300",
        justReconnected
          ? "bg-emerald-600/90 text-white"
          : "bg-[#888888]/90 text-white"
      )}
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 6px)' }}
    >
      {justReconnected ? (
        <span>✅ Conexão restaurada — sincronizando dados...</span>
      ) : (
        <>
          <CloudOff className="w-3.5 h-3.5" />
          <span>Modo offline — dados salvos localmente</span>
        </>
      )}
    </div>
  );
}
