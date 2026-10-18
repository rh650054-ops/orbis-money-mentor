/* "Privacidade e visibilidade": who sees what, changed on the spot. */
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import type { Conta } from "../types";
import { useRankingVisivelMutation, useSalvarPerfilMutation } from "../api/use-conta-mutations";
import { COR, LinhaToggle, Secao } from "@/shared/components/vant-ui";

export function PrivacidadeCard({ conta }: { conta: Conta }) {
  const perfil = useSalvarPerfilMutation(conta.user_id);
  const ranking = useRankingVisivelMutation(conta.user_id);
  const erro = () => toast({ title: "Não deu pra salvar", description: "Tenta de novo.", variant: "destructive" });
  const mudar = (campo: "show_city" | "show_instagram" | "show_whatsapp") => (v: boolean) => perfil.mutate({ [campo]: v }, { onError: erro });

  return (
    <Secao titulo="PRIVACIDADE E VISIBILIDADE" id="sec-privacidade">
      <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-1" style={{ background: "#141416" }}>
        <Users className="w-4 h-4 shrink-0" style={{ color: COR.ouro }} />
        <p className="text-[12.5px] leading-snug" style={{ color: COR.suave }}>
          Seu perfil público só aparece para <b style={{ color: COR.texto }}>vendedores logados na VANT</b>. Telefone, e-mail e CPF da conta nunca aparecem.
        </p>
      </div>
      <div className="divide-y divide-[#1b1a17]">
        <LinhaToggle titulo="Aparecer no ranking" sub={conta.ranking_oculto ? "Seu faturamento e posição estão ocultos" : "Seu faturamento conta no ranking"}
          ligado={!conta.ranking_oculto} disabled={ranking.isPending}
          onChange={(v) => ranking.mutate(v, { onSuccess: () => toast({ title: v ? "Você voltou pro ranking" : "Seu resultado está oculto" }), onError: erro })} />
        <LinhaToggle titulo="Mostrar cidade" ligado={conta.show_city} onChange={mudar("show_city")} disabled={perfil.isPending} />
        <LinhaToggle titulo="Mostrar Instagram" sub={conta.instagram ? undefined : "Você ainda não colocou seu Instagram"} ligado={conta.show_instagram} onChange={mudar("show_instagram")} disabled={perfil.isPending} />
        <LinhaToggle titulo="Mostrar WhatsApp" sub={conta.whatsapp_public ? undefined : "Você ainda não colocou um WhatsApp público"} ligado={conta.show_whatsapp} onChange={mudar("show_whatsapp")} disabled={perfil.isPending} />
      </div>
      <div className="flex gap-4 pt-3 text-[12px] font-bold" style={{ color: COR.apagado }}>
        <Link to="/privacidade" className="underline underline-offset-2">Política de Privacidade</Link>
        <Link to="/termos" className="underline underline-offset-2">Termos de Uso</Link>
      </div>
    </Secao>
  );
}
