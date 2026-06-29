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

function fileToB64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^;]+;base64,/, ""));
    r.onerror = () => reject(new Error("read_error"));
    r.readAsDataURL(file);
  });
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

  // Manda o arquivo pra IA (verificar-extrato) que le, audita e SALVA no extrato_uploads.
  const upload = useCallback(
    async (tipo: "pix" | "cartao", file: File): Promise<{ ok: boolean }> => {
      try {
        const b64 = await fileToB64(file);
        const { data, error } = await supabase.functions.invoke("verificar-extrato", {
          body: { file: b64, mime: file.type || "application/pdf", salvar: true, tipo, dia },
        });
        const res = data as { ok?: boolean; salvo?: boolean } | null;
        if (error || !res?.ok || !res?.salvo) return { ok: false };
        await reload();
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
    [dia, reload],
  );

  // Exclui o extrato ja enviado (slot pix ou cartao) do dia.
  const remove = useCallback(
    async (tipo: "pix" | "cartao"): Promise<{ ok: boolean }> => {
      if (!userId) return { ok: false };
      try {
        const { error } = await supabase
          .from("extrato_uploads")
          .delete()
          .eq("user_id", userId)
          .eq("dia", dia)
          .eq("tipo", tipo);
        if (error) return { ok: false };
        await reload();
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
    [userId, dia, reload],
  );

  const totalDia = (pix?.total_verificado ?? 0) + (cartao?.total_verificado ?? 0);
  return { pix, cartao, totalDia, loading, reload, upload, remove };
}
