import { useCallback, useState } from "react";

/* GPS no DEFCON é OPCIONAL e começa DESLIGADO (Rick, 02/09).
   Motivo: no iPhone instalado como app, a pergunta "quer usar sua localização?"
   aparecia TODA vez que o DEFCON começava — o sistema não guarda a resposta
   pra web app. Sem o GPS ligado, o app nunca chama a geolocalização, e a
   pergunta some. Quem quiser os km andados no relatório liga aqui, uma vez. */
const KEY = "defcon-gps";

export function gpsTrackingEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function useGpsTracking() {
  const [enabled, setEnabled] = useState<boolean>(() => gpsTrackingEnabled());
  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem(KEY, next ? "1" : "0"); } catch { /* sem storage */ }
      return next;
    });
  }, []);
  return { enabled, toggle };
}
