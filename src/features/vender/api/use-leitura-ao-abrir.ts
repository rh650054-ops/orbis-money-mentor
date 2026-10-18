/* Opened Vender with the bank last read over 1 h ago → ask for a fresh read,
   then refresh the numbers when the bank usually answers (25 s and 60 s). */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { puxarBancoAoAbrir } from "@/components/conectar/banco-pix";
import type { BancoLigado } from "@/components/conectar/pluggy";
import { venderKeys } from "./keys";

export function useLeituraAoAbrir(bancos: BancoLigado[] | undefined) {
  const qc = useQueryClient();
  const feito = useRef(false);
  useEffect(() => {
    if (feito.current || !bancos?.length) return;
    const ultima = Math.max(...bancos.map((b) => (b.last_synced_at ? Date.parse(b.last_synced_at) : 0)));
    if (Date.now() - ultima < 60 * 60_000) return;
    feito.current = true;
    void puxarBancoAoAbrir();
    const ir = () => void qc.invalidateQueries({ queryKey: venderKeys.all });
    const t1 = setTimeout(ir, 25_000);
    const t2 = setTimeout(ir, 60_000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [bancos, qc]);
}
