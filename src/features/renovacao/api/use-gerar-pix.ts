import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/shared/api";
import { renovacaoKeys } from "./use-renovacao-pix";

/* "Gerar Pix" (26/11/2026): the overdue subscriber asks Hotmart, through the edge function
   hotmart-negociar, for a Pix of the pending monthly fee. The function answers what happened:
     gerado / reutilizar / pix_existente → there is a Pix to pay (never a second one)
     em_andamento / falhou / recusar / ja_paga / indisponivel → no Pix here (see motivo)
     incerto → Hotmart's answer was lost and a charge MAY exist: "Gerar Pix" stays blocked until
               the server reconciles (it reads Hotmart again on the next call; it never asks twice) */
const pixSchema = z.object({
  pix_code: z.string().min(20), pix_qrcode: z.string().nullable().optional(),
  vence_em: z.string().nullable().optional(), valor: z.coerce.number().nullable().optional(),
});
const respostaSchema = z.object({ acao: z.string(), motivo: z.string().optional() }).passthrough();

export type PixGerado = z.infer<typeof pixSchema>;
export type RespostaGerarPix = { acao: string; motivo?: string; pix: PixGerado | null };
const COM_PIX = new Set(["gerado", "reutilizar", "pix_existente"]);

export function lerRespostaGerarPix(data: unknown): RespostaGerarPix {
  const r = respostaSchema.safeParse(data);
  if (!r.success) return { acao: "indisponivel", pix: null };
  const pix = COM_PIX.has(r.data.acao) ? pixSchema.safeParse(r.data) : null;
  if (COM_PIX.has(r.data.acao) && !pix?.success) return { acao: "indisponivel", pix: null };
  return { acao: r.data.acao, motivo: r.data.motivo, pix: pix?.success ? pix.data : null };
}

export type EstadoGerarPix = { pix: PixGerado | null; bloqueado: boolean };

/** The logged-in person's own negotiated Pix that is still valid, and whether a request is uncertain (blocked). */
export function useNegociacaoPixQuery(userId: string | undefined, ativo: boolean) {
  return useQuery({
    queryKey: [...renovacaoKeys.byUser(userId ?? ""), "negociacao"],
    enabled: !!userId && ativo,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<EstadoGerarPix> => {
      const { data, error } = await supabase.rpc("hotmart_negociacao_minha" as never);
      if (error) throw error;
      const p = pixSchema.safeParse(data);
      return { pix: p.success ? p.data : null, bloqueado: (data as { bloqueado?: unknown } | null)?.bloqueado === true };
    },
  });
}

/** Asks for the Pix. token = /assinar?t=… opened from the store app (no session). Never retried on its own. */
export function useGerarPixMutation(token?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (): Promise<RespostaGerarPix> => {
      const { data, error } = await supabase.functions.invoke("hotmart-negociar", { body: token ? { t: token } : {} });
      return error ? { acao: "indisponivel", pix: null } : lerRespostaGerarPix(data);
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: renovacaoKeys.all }); },
  });
}
