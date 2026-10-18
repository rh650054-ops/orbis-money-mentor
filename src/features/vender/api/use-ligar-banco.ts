/* Opens the Pluggy widget, saves the connection and tells the vendor what happened.
   The bank password is typed inside Pluggy's screen; the Vant never sees it. */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/shared/hooks/use-toast";
import { ligarBanco, salvarBanco } from "@/components/conectar/pluggy";
import { venderKeys } from "./keys";

const ERRO: Record<string, string> = {
  precisa_pro: "Assine a Vant Pro pra ligar seu banco.",
  pluggy_nao_configurado: "A Vant ainda não está configurada pra isso. Avisa o suporte.",
  sem_internet: "Sem internet pra abrir a tela do banco.",
};

export function useLigarBanco(jaTemBanco: boolean) {
  const qc = useQueryClient();
  const [ligando, setLigando] = useState(false);
  const [precisaExtra, setPrecisaExtra] = useState(false);
  const recarregar = () => qc.invalidateQueries({ queryKey: venderKeys.all });

  const ligar = async (reautorizar?: string) => {
    setLigando(true);
    let r: Awaited<ReturnType<typeof ligarBanco>>;
    try { r = await ligarBanco(() => setLigando(false), reautorizar); }
    catch { r = { erro: "erro" }; }
    finally { setLigando(false); }
    if ("erro" in r) {
      if (r.erro === "cancelou") { void recarregar(); return; }
      if (r.erro === "precisa_banco_extra") { setPrecisaExtra(true); return; }
      toast({ title: "Não deu certo", description: ERRO[r.erro] ?? "Tenta de novo em instantes.", variant: "destructive" });
      return;
    }
    setLigando(true);
    const salvo = await salvarBanco(r.itemId).catch(() => ({ ok: false as const }));
    setLigando(false);
    await recarregar(); // the Pluggy webhook may have saved it on its own
    if (!salvo.ok) { toast({ title: "Não deu pra salvar", description: "Tenta de novo.", variant: "destructive" }); return; }
    toast({
      title: jaTemBanco ? `${salvo.banco} conectado · diga pra que serve` : `${salvo.banco} conectado`,
      description: salvo.entradas > 0
        ? `${salvo.entradas} ${salvo.entradas === 1 ? "entrada" : "entradas"} dos últimos 7 dias já estão aqui.`
        : salvo.verificado ? "Você agora é verificado." : "Estamos puxando seus recebimentos.",
    });
  };

  return { ligar, ligando, precisaExtra, fecharExtra: () => setPrecisaExtra(false) };
}
