/* /my-account — "Minha conta" redesigned (Rick, 18/10/2026): four clear ideas —
   my data (private), my public profile, my activity, who sees what — plus the plan.
   Order: card · public profile · activity · account data · plan · privacy · actions. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SkeletonCard } from "@/shared/components/skeletons";
import PublicProfileModal from "@/components/PublicProfileModal";
import { useContaQuery } from "../api/use-conta-query";
import { useAtividadeQuery } from "../api/use-atividade-query";
import { planoDe } from "../lib/plano";
import { ehFoto } from "../lib/avatares";
import { COR } from "@/shared/components/vant-ui";
import { CardPrincipal } from "../components/card-principal";
import { PerfilPublicoCard } from "../components/perfil-publico-card";
import { AtividadeCard } from "../components/atividade-card";
import { DadosContaCard, EditarDadosFolha } from "../components/dados-conta";
import { PlanoCard } from "../components/plano-card";
import { PrivacidadeCard } from "../components/privacidade-card";
import { AcoesConta } from "../components/acoes-conta";
import { EditarPerfilFolha } from "../components/editar-perfil-folha";
import { FotoMenu } from "../components/foto-menu";

type Folha = "dados" | "perfil" | "foto" | "ver" | null;

export default function ContaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useContaQuery(user?.id);
  const atividade = useAtividadeQuery(user?.id);
  const [folha, setFolha] = useState<Folha>(null);
  const [voltarPraPerfil, setVoltarPraPerfil] = useState(false);

  const cabecalho = (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => navigate("/profile")} aria-label="Voltar" className="-ml-1 p-1" style={{ color: COR.apagado }}><ChevronLeft className="w-6 h-6" /></button>
      <p className="text-[13px] font-black tracking-[.14em]" style={{ color: COR.apagado }}>MINHA CONTA</p>
    </div>
  );

  if (isLoading || !user) {
    return <div className="max-w-md mx-auto flex flex-col gap-3 pt-2">{cabecalho}<SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
  }
  if (isError || !data) {
    return (
      <div className="max-w-md mx-auto flex flex-col gap-3 pt-2 text-[#F4F1EA]">
        {cabecalho}
        <p className="font-bold mt-6 text-center">Não consegui abrir sua conta.</p>
        <button type="button" onClick={() => refetch()} className="underline font-extrabold" style={{ color: COR.ouro }}>Tentar de novo</button>
      </div>
    );
  }

  const { conta, pro } = data;
  const plano = planoDe(conta, pro);
  // photo menu opened from inside the profile editor goes back to it when closed
  const abrirFotoDoPerfil = () => { setVoltarPraPerfil(true); setFolha("foto"); };
  const fecharFoto = () => { setFolha(voltarPraPerfil ? "perfil" : null); setVoltarPraPerfil(false); };

  return (
    <div className="max-w-md mx-auto flex flex-col gap-5 pt-2 pb-2" style={{ color: COR.texto }}>
      {cabecalho}
      <CardPrincipal conta={conta} plano={plano} onFoto={() => setFolha("foto")} onEditar={() => setFolha("dados")} />
      <PerfilPublicoCard conta={conta} onVer={() => setFolha("ver")} onEditar={() => setFolha("perfil")} />
      <AtividadeCard atividade={atividade.data} carregando={atividade.isLoading} />
      <DadosContaCard conta={conta} onEditar={() => setFolha("dados")} />
      <PlanoCard plano={plano} />
      <PrivacidadeCard conta={conta} />
      <AcoesConta />

      <EditarDadosFolha aberta={folha === "dados"} onFechar={() => setFolha(null)} conta={conta} />
      <EditarPerfilFolha aberta={folha === "perfil"} onFechar={() => setFolha(null)} conta={conta} onFoto={abrirFotoDoPerfil} />
      <FotoMenu aberta={folha === "foto"} onFechar={fecharFoto} userId={conta.user_id} atual={conta.avatar_url} temFoto={ehFoto(conta.avatar_url)} />
      <PublicProfileModal open={folha === "ver"} onOpenChange={(v) => !v && setFolha(null)} userId={conta.user_id} />
    </div>
  );
}
