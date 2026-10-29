/* /verificar — the "Vender" tab: the vendor's Open Finance control panel
   (Rick, 18/10/2026). Not a dashboard, not a report. Order follows the brief:
   reconciliation today → 7 days → income proof → where you receive →
   work × personal → manage. Three cases: not Pro (the Pro showcase), Pro without bank, with bank. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SkeletonCard } from "@/shared/components/skeletons";
import { COR } from "@/shared/components/vant-ui";
import { Pilula } from "@/shared/components/vant-status";
import { SeloVerificado } from "@/components/ranking/AvatarRanking";
import { useSubscription } from "@/hooks/useSubscription";
import { useVoltaDoCheckout } from "@/hooks/useVoltaDoCheckout";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { BancoExtra } from "@/components/conectar/PapelContas";
import { useBancosQuery } from "../api/use-bancos-query";
import { useConciliacaoQuery } from "../api/use-conciliacao-query";
import { useAtualizarAgoraMutation } from "../api/use-vender-mutations";
import { useLigarBanco } from "../api/use-ligar-banco";
import { useLeituraAoAbrir } from "../api/use-leitura-ao-abrir";
import { diaDoHeroi } from "../lib/conciliacao";
import { dicasDoDia } from "../lib/dicas";
import { HeroiConciliacao } from "../components/heroi-conciliacao";
import { SemanaCard } from "../components/semana-card";
import { ComprovanteCard } from "../components/comprovante-card";
import { OndeRecebe } from "../components/onde-recebe";
import { GerenciarFolha } from "../components/gerenciar-folha";
import { PrimeiroBanco } from "../components/primeiro-banco";
import { VitrinePro } from "../components/vitrine/vitrine-pro";
import { VitrineCortesia } from "../components/vitrine/vitrine-cortesia";
import { assinaEssencial, diasRestantesDeTeste, lancadoUltimos3Dias } from "../lib/vitrine";
import { AvisoRenovacaoPix } from "@/features/renovacao";

export default function VenderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const bancosQ = useBancosQuery(user?.id);
  const temBanco = (bancosQ.data?.bancos.length ?? 0) > 0;
  const concQ = useConciliacaoQuery(user?.id, !!bancosQ.data);
  const atualizar = useAtualizarAgoraMutation();
  const banco = useLigarBanco(temBanco);
  const [gerenciar, setGerenciar] = useState(false);
  useLeituraAoAbrir(bancosQ.data?.bancos);
  const { status: assinatura } = useSubscription(user?.id);
  const semPro = !!bancosQ.data && !bancosQ.data.pro.pro && !bancosQ.data.pro.liberado;
  // checkout opened from the showcase: when the Pro lands, the screen moves on to "connect your bank"
  useVoltaDoCheckout({
    ativo: semPro,
    verificar: () => bancosQ.refetch().then((r) => !!(r.data?.pro.pro || r.data?.pro.liberado)),
    aoLiberar: () => void bancosQ.refetch(),
  });

  const d = bancosQ.data;
  const pro = d?.pro;
  const CabecalhoSo = () => (
    <header className="flex items-center justify-between px-1">
      <div>
        <p className="text-[10.5px] font-black tracking-[.16em]" style={{ color: COR.apagado }}>VENDER</p>
        <h1 className="text-[21px] font-black leading-tight flex items-center gap-1.5">
          Open Finance {pro?.verificado && <SeloVerificado size={17} />}
        </h1>
      </div>
      {pro?.pro && <Pilula tom="ok">PRO ATIVO</Pilula>}
    </header>
  );
  // o aviso do Pix da renovação vai logo abaixo do título, em todas as variações da tela
  const cabecalho = <><CabecalhoSo /><AvisoRenovacaoPix /></>;

  if (!user?.id || bancosQ.isLoading || !d || !pro) {
    return <div className="max-w-md mx-auto flex flex-col gap-3">{cabecalho}<SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
  }

  // A) not Pro yet: the VANT Pro showcase with the plans and direct checkout (25/10/2026)
  if (semPro) {
    const hoje = concQ.data?.hoje ?? getBrazilDate();
    return (
      <div className="max-w-md mx-auto flex flex-col gap-4" style={{ color: COR.texto }}>
        {/* 25/10 (Rick): sem o título "Vender · Open Finance" na vitrine; o aviso do Pix da renovação fica */}
        <AvisoRenovacaoPix />
        <div data-tour="conectar-banco">
          {/* 29/10: Pro de cortesia sem banco pago → o banco avulso, não os planos */}
          {bancosQ.data?.pro.origem === "cortesia"
            ? <VitrineCortesia email={user?.email} />
            : <VitrinePro lancado={lancadoUltimos3Dias(concQ.data?.dias ?? [], hoje)} assinaEssencial={assinaEssencial(assinatura)}
                diasDeTeste={diasRestantesDeTeste(assinatura.status, assinatura.graceUntil, hoje)} />}
        </div>
      </div>
    );
  }

  // B) Pro without a bank: one goal only
  if (!temBanco) {
    return (
      <div className="max-w-md mx-auto flex flex-col gap-4" style={{ color: COR.texto }}>
        {cabecalho}
        <PrimeiroBanco pro={pro.pro} ligando={banco.ligando} onLigar={() => void banco.ligar()} onConferir={() => void bancosQ.refetch()} />
      </div>
    );
  }

  // C) with bank
  const conc = concQ.data;
  const heroi = conc ? diaDoHeroi(conc.dias, conc.hoje) : null;
  const nomes = d.bancos.map((b) => b.institution_name);
  const atualizarAgora = () => atualizar.mutate();

  return (
    <div className="max-w-md mx-auto flex flex-col gap-5" style={{ color: COR.texto }}>
      {cabecalho}
      {heroi && conc
        ? <HeroiConciliacao dia={heroi} ehHoje={heroi.dia === conc.hoje} ultimaLeitura={conc.ultima_leitura} bancos={nomes}
            dicas={dicasDoDia(heroi, d.bancos)} atualizando={atualizar.isPending} onAtualizar={atualizarAgora} />
        : <SkeletonCard />}
      {conc && <SemanaCard dias={conc.dias} />}
      <ComprovanteCard />
      {banco.precisaExtra && <BancoExtra usados={d.bancos.length} email={user.email} onFechar={banco.fecharExtra} />}
      <OndeRecebe bancos={d.bancos} ligando={banco.ligando} onLigar={() => void banco.ligar()}
        onAbrir={() => setGerenciar(true)} onAutorizar={(b) => void banco.ligar(b.item_id)} />
      {d.cobraPix && (
        <button type="button" onClick={() => navigate("/cobrar")}
          className="group flex items-center gap-3 rounded-2xl p-4 text-left transition-colors active:bg-white/[.04]"
          style={{ background: COR.card, border: `1px solid ${COR.borda}` }}>
          <span className="flex-1 min-w-0">
            <span className="block text-[14px] font-extrabold">Cobrar quem ficou devendo</span>
            <span className="block text-[12px] mt-0.5" style={{ color: COR.apagado }}>A Vant gera o Pix e abre seu WhatsApp.</span>
          </span>
          <ChevronRight className="w-5 h-5 transition-transform group-active:translate-x-[2px]" style={{ color: COR.apagado }} />
        </button>
      )}

      <GerenciarFolha aberta={gerenciar} onFechar={() => setGerenciar(false)} bancos={d.bancos} contas={d.contas}
        atualizando={atualizar.isPending} onAtualizar={atualizarAgora} />
    </div>
  );
}
