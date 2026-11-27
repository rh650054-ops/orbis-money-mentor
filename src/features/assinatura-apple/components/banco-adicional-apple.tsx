import { useAuth } from "@/hooks/useAuth";
import { useOfertaAppleQuery, useProdutosAppleQuery } from "../api/use-apple-queries";
import { useCompraApple } from "../api/use-compra-apple";
import { podeComprar } from "../lib/planos";
import { BANCO_APPLE_A_VENDA, PRODUTO } from "../types";
import { EstadoDaCompra } from "./estado-da-compra";

const GOLD = "#F5B800";
const SO_O_BANCO = BANCO_APPLE_A_VENDA ? [PRODUTO.banco] : [];

/** The bank add-on on the iPhone app, inside the management of the connected banks (Rick: "sem
    poluir a tela principal de contratação"). One add-on per Apple account for now; it never gives
    the main plan, so it is offered only to an account that has one. */
export function BancoAdicionalApple({ usados, onFechar }: { usados: number; onFechar: () => void }) {
  const { user } = useAuth();
  const oferta = useOfertaAppleQuery(user?.id);
  const produtos = useProdutosAppleQuery(SO_O_BANCO);
  const compra = useCompraApple();
  const banco = produtos.data?.find((p) => p.id === PRODUTO.banco);
  const pode = podeComprar(oferta.data, PRODUTO.banco) && !!banco;
  const carregando = BANCO_APPLE_A_VENDA && (oferta.isLoading || produtos.isLoading);
  if (compra.resultado) {
    return <EstadoDaCompra resultado={compra.resultado} ocupado={compra.fase !== "parado"} onTentarDeNovo={() => void compra.tentarDeNovo()} onContinuar={onFechar} onVoltar={compra.fechar} />;
  }
  const porque = !BANCO_APPLE_A_VENDA ? "O banco adicional ainda não está disponível no iPhone."
    : oferta.data?.banco === "ja_tem" ? "Você já tem o banco adicional pela Apple. Por enquanto é um por conta."
    : oferta.data?.banco === "sem_plano" ? "O banco adicional é para quem já tem um plano da VANT ativo."
    : "Não foi possível carregar o banco adicional agora. Tente de novo em instantes.";
  return (
    <div className="rounded-[20px] p-4 text-center text-[#F4F1EA]" style={{ background: "linear-gradient(170deg,#1a1305,#0e0e10 70%)", border: "1px solid rgba(245,184,0,.42)" }}>
      <p className="text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>MAIS UM BANCO</p>
      {carregando ? (
        <div aria-busy="true" className="animate-pulse mx-auto mt-2 h-6 w-40 rounded" style={{ background: "#1c1a15" }} />
      ) : pode ? (
        <p className="text-[19px] font-black mt-1">+{banco?.precoFormatado} por mês</p>
      ) : null}
      <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: "#b9b3a6" }}>
        {carregando || pode ? <>Você já usou os bancos do seu plano ({usados} ligado{usados === 1 ? "" : "s"}). O banco adicional é uma assinatura à parte, cobrada pela Apple, e não muda o seu plano.</> : porque}
      </p>
      {pode && (
        <button type="button" onClick={() => void compra.comprar(PRODUTO.banco)} disabled={compra.fase !== "parado"}
          className="mt-3 w-full h-12 rounded-[14px] text-[14px] font-black disabled:opacity-60" style={{ background: "linear-gradient(180deg,#FFE27A 0%,#F5B800 60%,#D9A000 100%)", color: "#1A1200" }}>
          {compra.fase === "comprando" ? "Abrindo a App Store..." : "Adicionar banco"}
        </button>
      )}
      {pode && <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "#8f897c" }}>Renovação automática. Cancele quando quiser nos Ajustes da Apple.</p>}
      <button type="button" onClick={onFechar} className="mt-2 w-full h-10 text-[12.5px] font-extrabold" style={{ color: "#8f897c" }}>agora não</button>
    </div>
  );
}
