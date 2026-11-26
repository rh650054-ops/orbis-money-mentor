/* After the reload: "Você ganhou 30 dias de teste — até 25/12/2026" (once). 26/11: the exact end
   date comes from the server (cortesia_teste_loja_minha), so the promise is the real one. */
import { useEffect } from "react";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/shared/api";
import { AVISO_CORTESIA } from "./cortesia-teste-loja-gate";

export const dataBRCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function AvisoCortesia() {
  const { toast } = useToast();
  useEffect(() => {
    let mostrar = false;
    try { mostrar = sessionStorage.getItem(AVISO_CORTESIA) === "1"; sessionStorage.removeItem(AVISO_CORTESIA); } catch { /* sem aviso */ }
    if (!mostrar) return;
    void (async () => {
      let fim: string | null = null;
      try {
        const { data } = await supabase.rpc("cortesia_teste_loja_minha" as never);
        fim = typeof data === "string" && /^\d{4}-\d{2}-\d{2}/.test(data) ? data : null;
      } catch { /* sem a data: o aviso sai sem ela */ }
      toast({
        title: fim ? `Você ganhou 30 dias de teste: até ${dataBRCurta(fim)}` : "Você ganhou 30 dias de teste",
        description: "Teste especial para quem testa a VANT na loja. A jornada guiada tem 3 dias; o acesso continua até a data acima.",
      });
    })();
  }, [toast]);
  return null;
}
