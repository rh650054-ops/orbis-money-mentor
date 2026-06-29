import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// Slot do extrato do dia (pix ou cartao). Reenvio substitui o slot.
export interface ExtratoSlot {
  tipo: "pix" | "cartao";
  total_verificado: number;
  qtd_vendas: number;
  motor: string | null;
  updated_at: string;
}

export function useMeuExtrato(userId: string | undefined, dia: string) {
  const [pix, setPix] = useState<ExtratoSlot | null>(null);
  const [cartao, setCartao] = useState<ExtratoSlot | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("extrato_uploads")
      .select("tipo,total_verificado,qtd_vendas,motor,updated_at")
      .eq("user_id", userId)
      .eq("dia", dia);
    const rows = (data ?? []) as ExtratoSlot[];
    setPix(rows.find((r) => r.tipo === "pix") ?? null);
    setCartao(rows.find((r) => r.tipo === "cartao") ?? null);
    setLoading(false);
  }, [userId, dia]);

  useEffect(() => {
    reload();
  }, [reload]);

  const totalDia = (pix?.total_verificado ?? 0) + (cartao?.total_verificado ?? 0);
  return { pix, cartao, totalDia, loading, reload };
}
