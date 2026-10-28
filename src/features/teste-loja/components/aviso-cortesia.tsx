/* After the reload: "Você ganhou 30 dias de teste" (once). */
import { useEffect } from "react";
import { useToast } from "@/shared/hooks/use-toast";
import { AVISO_CORTESIA } from "./cortesia-teste-loja-gate";

export function AvisoCortesia() {
  const { toast } = useToast();
  useEffect(() => {
    let mostrar = false;
    try { mostrar = sessionStorage.getItem(AVISO_CORTESIA) === "1"; sessionStorage.removeItem(AVISO_CORTESIA); } catch { /* sem aviso */ }
    if (mostrar) toast({ title: "Você ganhou 30 dias de teste", description: "Obrigado por testar a VANT na Play Store. Usa à vontade e conta pra gente o que achou." });
  }, [toast]);
  return null;
}
