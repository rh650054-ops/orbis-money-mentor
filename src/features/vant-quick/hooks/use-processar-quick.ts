import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { toast } from "@/shared/hooks/use-toast";
import { useConfirmacaoVendas } from "../api/confirmacao";
import { quick, temQuick } from "../api/ponte";
import { jaFeita, lerConfig, marcarFeita } from "../lib/memoria";
import { validarAcao } from "../lib/regras";

/** The DEFCON pieces VANT Quick uses, exactly as useDefconChallenge returns them. */
export interface DefconParaQuick {
  phase: string;
  sessionSales: { id?: string }[];
  addSale: (valor: number, metodo: "dinheiro" | "pix" | "cartao", produto: null, id: string) => Promise<void>;
  addApproach: () => Promise<void>;
}

/** Runs the widget's taps through the DEFCON's OWN sale and approach code (same rules, same
    offline queue, same ranking and Open Finance). One at a time; each tap at most once. */
export function useProcessarQuick(conta: string | null, defcon: DefconParaQuick) {
  const ultimo = useRef(defcon);
  ultimo.current = defcon;
  const emCurso = useRef(false);
  const [aguardando, setAguardando] = useState<string[]>([]);

  const processar = useCallback(async () => {
    if (!temQuick() || !conta || emCurso.current) return;
    emCurso.current = true;
    try {
      for (const bruta of await quick.pendentes()) {
        const d = ultimo.current;
        const v = validarAcao(bruta, {
          conta, agora: Date.now(), rodando: d.phase === "running", config: lerConfig(conta),
          jaFeita: (id) => jaFeita(conta, id) || d.sessionSales.some((s) => s?.id === id),
        });
        const id = (bruta as { id?: unknown })?.id;
        if (!v.ok) {
          // already executed: only the widget's status is refreshed, nothing runs again
          if (v.motivo !== "ja_feita") toast({ title: "VANT Quick", description: v.texto });
          if (typeof id === "string") await quick.concluir(id, v.motivo === "ja_feita" ? "pendente_sync" : "recusada", v.motivo === "ja_feita" ? undefined : v.texto);
          continue;
        }
        marcarFeita(conta, v.acao.id);
        if (v.acao.tipo === "venda" && v.config) {
          await d.addSale(v.config.valor, v.config.metodo, null, v.acao.id);
          setAguardando((x) => [...x, v.acao.id]);
          await quick.concluir(v.acao.id, "pendente_sync");
        } else {
          await d.addApproach();
          await quick.concluir(v.acao.id, navigator.onLine ? "confirmada" : "pendente_sync");
        }
      }
    } finally { emCurso.current = false; }
  }, [conta]);

  // taps arrive: when the DEFCON opens, when the intent fires while open, when the app comes back
  useEffect(() => {
    if (!temQuick() || !conta) return;
    void processar();
    const ouvintes = [quick.aoTocarNoWidget(() => void processar()), App.addListener("appStateChange", (s) => { if (s.isActive) void processar(); })];
    return () => { for (const o of ouvintes) void o.then((h) => h?.remove()); };
  }, [conta, processar]);
  // the DEFCON block may start only after the app opened: process again when it runs
  useEffect(() => { if (defcon.phase === "running") void processar(); }, [defcon.phase, processar]);

  // "confirmada" only once the database has the sale
  const confirmacao = useConfirmacaoVendas(conta, aguardando);
  useEffect(() => {
    const no = confirmacao.data;
    if (!no || no.length === 0) return;
    for (const id of no) void quick.concluir(id, "confirmada");
    setAguardando((x) => x.filter((id) => !no.includes(id)));
  }, [confirmacao.data]);

  return { aguardando: aguardando.length };
}
