import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useOfertaAppleQuery, useProdutosAppleQuery } from "../api/use-apple-queries";
import { useCompraApple } from "../api/use-compra-apple";
import { avisoDaOferta, planosDaTela, podeComprar } from "../lib/planos";
import { PLANOS_PRINCIPAIS, PRODUTO } from "../types";
import { PlanosAppleAviso, PlanosAppleSkeleton, PlanosAppleTela } from "./planos-apple-tela";

/** The native plans screen of the iPhone app. Prices come from StoreKit, the permission to offer a
    purchase comes from the server, and the purchase is confirmed on Apple's own sheet. */
export function PlanosApple({ onLiberada, aoTerPlano }: {
  onLiberada?: () => void;
  /** Blocking screen (end of trial): an account whose Apple plan is already on is told so and goes on. */
  aoTerPlano?: () => void;
}) {
  const { user } = useAuth();
  const oferta = useOfertaAppleQuery(user?.id);
  const produtos = useProdutosAppleQuery(PLANOS_PRINCIPAIS);
  const compra = useCompraApple();
  const [selecionado, setSelecionado] = useState<string>(PRODUTO.proAnual);
  const continuar = () => (onLiberada ? onLiberada() : window.location.assign("/"));

  const planos = planosDaTela(produtos.data ?? []);
  const tela = (
    <PlanosAppleTela planos={planos} selecionado={selecionado} onSelecionar={setSelecionado}
      planoAtual={oferta.data?.plano === "trocar" ? oferta.data.apple?.produto : null}
      fase={compra.fase} resultado={compra.resultado} aviso={compra.aviso}
      onAssinar={() => { if (podeComprar(oferta.data, selecionado)) void compra.comprar(selecionado); }}
      onRestaurar={() => void compra.restaurar()} onGerenciar={compra.gerenciar}
      onTentarDeNovo={() => void compra.tentarDeNovo()} onContinuar={continuar} onVoltar={compra.fechar}
      onAbrirLink={(caminho) => window.location.assign(caminho)} />
  );
  // a purchase that already ended in something to say is shown whatever else is loading
  if (compra.resultado) return tela;
  if (oferta.isLoading || produtos.isLoading) return <PlanosAppleSkeleton />;
  if (oferta.isError || !oferta.data) {
    return <PlanosAppleAviso titulo="Não foi possível carregar os planos" texto="Verifique sua internet e tente de novo."
      acao={{ rotulo: "Tentar de novo", onClick: () => void oferta.refetch() }} />;
  }
  if (oferta.data.plano === "trocar" && aoTerPlano) {
    const titulo = planos.find((x) => x.id === oferta.data?.apple?.produto)?.titulo;
    return <PlanosAppleAviso titulo="Sua assinatura está ativa" texto={`${titulo ? `O ${titulo}` : "Seu plano"} pela Apple já está liberado nesta conta.`}
      acao={{ rotulo: "Continuar", onClick: aoTerPlano }} />;
  }
  if (oferta.data.plano === "bloqueado") {
    const a = avisoDaOferta(oferta.data) ?? { titulo: "Plano indisponível para esta conta", texto: "Fale com o suporte da VANT." };
    return <PlanosAppleAviso titulo={a.titulo} texto={a.texto} />;
  }
  if (produtos.isError || planos.length === 0) {
    return <PlanosAppleAviso titulo="Planos indisponíveis agora" texto="A App Store não respondeu. Nada foi cobrado."
      acao={{ rotulo: "Tentar de novo", onClick: () => void produtos.refetch() }} />;
  }
  return tela;
}
