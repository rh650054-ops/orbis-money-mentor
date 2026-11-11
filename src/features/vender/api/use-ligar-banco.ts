/* Opens the Pluggy widget, saves the connection and tells the vendor what happened.
   The bank password is typed inside Pluggy's screen; the Vant never sees it. */
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/shared/hooks/use-toast";
import { ligarBanco, salvarBanco, type ErroPluggy } from "@/components/conectar/pluggy";
import { venderKeys } from "./keys";

/** Why the bank screen did not open or did not finish, in the vendor's words. Each message says
 *  whose problem it is; none tells the vendor to disconnect and connect again. */
export const AVISO_DO_ERRO: Partial<Record<ErroPluggy, { titulo: string; texto: string }>> = {
  precisa_pro: { titulo: "Não deu certo", texto: "Assine a Vant Pro pra ligar seu banco." },
  pluggy_nao_configurado: { titulo: "Não deu certo", texto: "A Vant ainda não está configurada pra isso. Avisa o suporte." },
  sem_internet: { titulo: "Sem internet", texto: "Não deu pra abrir a tela do banco. Confira sua conexão e toque de novo." },
  sem_login: { titulo: "Sua sessão venceu", texto: "Entre de novo na Vant e toque em ligar o banco." },
  provedor_fora: { titulo: "A tela do banco não abriu", texto: "Não é com você. Tente de novo em alguns minutos." },
  banco_nao_encontrado: { titulo: "Esse banco não está mais ligado aqui", texto: "Atualizamos a sua lista de bancos." },
  nao_concluiu: { titulo: "A conexão não foi concluída", texto: "O banco não confirmou. Você pode tentar de novo quando quiser." },
};
const AVISO_PADRAO = { titulo: "Não deu certo", texto: "Tenta de novo em instantes." };

export function useLigarBanco(jaTemBanco: boolean) {
  const qc = useQueryClient();
  const [ligando, setLigando] = useState(false);
  const [precisaExtra, setPrecisaExtra] = useState(false);
  const ocupado = useRef(false); // a second tap before the button re-renders as disabled
  const recarregar = () => qc.invalidateQueries({ queryKey: venderKeys.all });

  const ligar = async (reautorizar?: string) => {
    if (ocupado.current) return;
    ocupado.current = true;
    setLigando(true);
    const soltar = () => { ocupado.current = false; setLigando(false); };
    let r: Awaited<ReturnType<typeof ligarBanco>>;
    try { r = await ligarBanco(soltar, reautorizar); }
    catch { r = { erro: "erro" }; }
    finally { soltar(); }
    if ("erro" in r) {
      if (r.erro === "ja_aberto") return;
      if (r.erro === "cancelou") { void recarregar(); return; }
      if (r.erro === "precisa_banco_extra") { setPrecisaExtra(true); return; }
      if (r.erro === "banco_nao_encontrado") void recarregar();
      const aviso = AVISO_DO_ERRO[r.erro] ?? AVISO_PADRAO;
      toast({ title: aviso.titulo, description: aviso.texto, variant: "destructive" });
      return;
    }
    setLigando(true);
    const salvo = await salvarBanco(r.itemId).catch(() => ({ ok: false as const }));
    setLigando(false);
    await recarregar(); // the Pluggy webhook may have saved it on its own
    if (!salvo.ok) { toast({ title: "Não deu pra salvar", description: "Tenta de novo.", variant: "destructive" }); return; }
    toast({
      title: reautorizar ? `${salvo.banco} autorizado de novo` : jaTemBanco ? `${salvo.banco} conectado · diga pra que serve` : `${salvo.banco} conectado`,
      description: salvo.entradas > 0
        ? `${salvo.entradas} ${salvo.entradas === 1 ? "entrada" : "entradas"} dos últimos 7 dias já estão aqui.`
        : salvo.verificado ? "Você agora é verificado." : "Estamos puxando seus recebimentos.",
    });
  };

  return { ligar, ligando, precisaExtra, fecharExtra: () => setPrecisaExtra(false) };
}
