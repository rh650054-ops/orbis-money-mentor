/* "Seu plano": name, status, renewal and where to manage it. */
import { useNavigate } from "react-router-dom";
import type { Plano } from "../lib/plano";
import { Botao, COR, Secao } from "@/shared/components/vant-ui";

const STATUS: Record<Plano["status"], { txt: string; cor: string }> = {
  ativo: { txt: "Ativo", cor: COR.ok },
  cortesia: { txt: "Ativo", cor: COR.ok },
  teste: { txt: "Em teste", cor: COR.ouro },
  sem: { txt: "Inativo", cor: COR.coral },
};

/** Subscribers manage the subscription where they bought it (Hotmart). */
const HOTMART_ASSINATURAS = "https://consumer.hotmart.com/purchase";

export function PlanoCard({ plano }: { plano: Plano }) {
  const navigate = useNavigate();
  const s = STATUS[plano.status];
  return (
    <Secao titulo="SEU PLANO" id="sec-plano">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[19px] font-black tracking-tight" style={{ color: plano.status === "ativo" || plano.status === "cortesia" ? COR.ouro : COR.texto }}>{plano.nome}</p>
          {plano.detalhe && <p className="text-[12.5px] mt-0.5" style={{ color: COR.apagado }}>{plano.detalhe}</p>}
        </div>
        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-black" style={{ background: "#141416", color: s.cor }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.cor }} />{s.txt}
        </span>
      </div>
      <div className="mt-3.5 flex gap-2">
        {plano.assinante ? (
          <Botao className="flex-1" onClick={() => window.open(HOTMART_ASSINATURAS, "_blank", "noopener")}>Gerenciar assinatura</Botao>
        ) : plano.status !== "cortesia" ? (
          <Botao tipo="ouro" className="flex-1" onClick={() => navigate("/planos")}>{plano.status === "teste" ? "Ver planos" : "Assinar"}</Botao>
        ) : null}
        {plano.assinante && plano.selo !== "PRO" && <Botao tipo="texto" onClick={() => navigate("/planos")}>Conhecer o PRO</Botao>}
      </div>
    </Secao>
  );
}
