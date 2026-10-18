/* Edit the public profile in four separate parts — never one giant form. */
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { avisar } from "@/shared/lib/avisar";
import type { Conta, PerfilPublico } from "../types";
import { useRankingVisivelMutation, useSalvarPerfilMutation } from "../api/use-conta-mutations";
import { Botao, Campo, COR, Folha, INPUT, LinhaToggle } from "@/shared/components/vant-ui";
import { FotoConta } from "./foto-conta";

const doConta = (c: Conta): PerfilPublico => ({
  nickname: c.nickname ?? "", bio: c.bio ?? "", what_i_sell: c.what_i_sell ?? "", where_i_sell: c.where_i_sell ?? "",
  instagram: c.instagram ?? "", whatsapp_public: c.whatsapp_public ?? "",
  show_city: c.show_city, show_instagram: c.show_instagram, show_whatsapp: c.show_whatsapp,
});

function Parte({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-3.5 flex flex-col gap-3" style={{ background: "#121214", border: `1px solid ${COR.borda}` }}>
      <p className="text-[10.5px] font-black tracking-[.16em]" style={{ color: COR.ouro }}>{titulo}</p>
      {children}
    </div>
  );
}

type Props = { aberta: boolean; onFechar: () => void; conta: Conta; onFoto: () => void };

export function EditarPerfilFolha({ aberta, onFechar, conta, onFoto }: Props) {
  const [f, setF] = useState<PerfilPublico>(() => doConta(conta));
  const [salvo, setSalvo] = useState(false);
  const salvar = useSalvarPerfilMutation(conta.user_id);
  const ranking = useRankingVisivelMutation(conta.user_id);
  useEffect(() => { if (aberta) { setF(doConta(conta)); setSalvo(false); } }, [aberta, conta]);
  const set = <K extends keyof PerfilPublico>(k: K, v: PerfilPublico[K]) => setF((x) => ({ ...x, [k]: v }));

  const enviar = () => {
    const nome = f.nickname.trim();
    if (!nome) { toast({ title: "Coloque um nome público", variant: "destructive" }); return; }
    if (nome.length > 20) { toast({ title: "Nome público com no máximo 20 letras", variant: "destructive" }); return; }
    salvar.mutate(f, {
      onSuccess: () => { setSalvo(true); toast({ title: "Perfil atualizado" }); setTimeout(onFechar, 450); },
      onError: (e) => { avisar.erro("conta: salvar perfil público", e); toast({ title: "Não deu pra salvar", description: "Tenta de novo.", variant: "destructive" }); },
    });
  };

  return (
    <Folha aberta={aberta} onFechar={onFechar} titulo="Editar perfil público" sub="O que outros vendedores veem no ranking, nas competições e no X1.">
      <Parte titulo="IDENTIDADE">
        <div className="flex items-center gap-3">
          <FotoConta url={conta.avatar_url} nome={f.nickname} tamanho={56} />
          <Botao onClick={onFoto}>Trocar foto ou avatar</Botao>
        </div>
        <Campo rotulo="NOME PÚBLICO" dica={`${f.nickname.length}/20`}>
          <input className={INPUT} value={f.nickname} maxLength={20} onChange={(e) => set("nickname", e.target.value)} />
        </Campo>
      </Parte>
      <Parte titulo="APRESENTAÇÃO">
        <Campo rotulo="BIO" dica={`${f.bio.length}/120`}>
          <textarea className={`${INPUT} h-20 py-2 resize-none`} value={f.bio} maxLength={120} placeholder="Ex: Batidas geladas no farol da Raposo desde 2023" onChange={(e) => set("bio", e.target.value)} />
        </Campo>
        <Campo rotulo="O QUE VENDE"><input className={INPUT} value={f.what_i_sell} maxLength={60} placeholder="Ex: batidas, trufas" onChange={(e) => set("what_i_sell", e.target.value)} /></Campo>
        <Campo rotulo="ONDE VENDE"><input className={INPUT} value={f.where_i_sell} maxLength={60} placeholder="Ex: semáforos de Cotia" onChange={(e) => set("where_i_sell", e.target.value)} /></Campo>
      </Parte>
      <Parte titulo="CONTATO PÚBLICO">
        <Campo rotulo="INSTAGRAM"><input className={INPUT} value={f.instagram} placeholder="@seuperfil" onChange={(e) => set("instagram", e.target.value)} /></Campo>
        <Campo rotulo="WHATSAPP PÚBLICO" dica="Pode ser diferente do WhatsApp da sua conta.">
          <input className={INPUT} inputMode="numeric" value={f.whatsapp_public} maxLength={15} placeholder="11999999999" onChange={(e) => set("whatsapp_public", e.target.value.replace(/\D/g, ""))} />
        </Campo>
      </Parte>
      <Parte titulo="VISIBILIDADE">
        <LinhaToggle titulo="Mostrar cidade" ligado={f.show_city} onChange={(v) => set("show_city", v)} />
        <LinhaToggle titulo="Mostrar Instagram" ligado={f.show_instagram} onChange={(v) => set("show_instagram", v)} />
        <LinhaToggle titulo="Mostrar WhatsApp" ligado={f.show_whatsapp} onChange={(v) => set("show_whatsapp", v)} />
        <LinhaToggle titulo="Aparecer no ranking" sub="Vale na hora, sem precisar salvar" ligado={!conta.ranking_oculto} disabled={ranking.isPending}
          onChange={(v) => ranking.mutate(v, { onError: () => toast({ title: "Não deu pra mudar o ranking", variant: "destructive" }) })} />
      </Parte>
      <Botao tipo="ouro" className="w-full h-12 text-[15px]" onClick={enviar} disabled={salvar.isPending || salvo}>
        {salvo ? <span className="inline-flex items-center gap-1.5"><Check className="w-4 h-4" /> Salvo</span> : salvar.isPending ? "Salvando…" : "Salvar perfil"}
      </Botao>
    </Folha>
  );
}
