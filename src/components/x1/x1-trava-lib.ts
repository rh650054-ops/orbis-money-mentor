/* Trava do X1: só luta quem tem banco ligado (lê orbis_pro_status uma vez). */
import { useEffect, useState } from "react";
import { carregarPro } from "@/components/conectar/pluggy";

export function useTravaBanco(uid: string | undefined) {
  const [temBanco, setTemBanco] = useState<boolean | null>(null);
  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    carregarPro().then((p) => { if (vivo) setTemBanco(p.bancos > 0); });
    return () => { vivo = false; };
  }, [uid]);
  // null = ainda não sei (não trava nem libera); false = sem banco; true = liberado
  return { temBanco, semBanco: temBanco === false, carregando: temBanco === null };
}
