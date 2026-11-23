/* "Você vende bem. Mas sabe quanto realmente lucra?" — dashboard banner for who has no product yet
   (22/11, Etapa 2). Lives at the END of the "one notice at a time" queue, so it never jumps ahead of
   another notice. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { useAcessoProdutosQuery } from "../api/use-acesso-produtos-query";
import { useProdutosQuery } from "../api/use-produtos-query";
import { adiarConvite, deveMostrarConvite, lerConvite, nuncaMaisConvite } from "../lib/convite-cadastro";
import { VANT } from "../lib/visual";

export function ConviteCadastro({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const acesso = useAcessoProdutosQuery(userId);
  const produtos = useProdutosQuery(acesso.data?.liberado ? userId : undefined);
  const [estado, setEstado] = useState(() => lerConvite(userId));
  if (!deveMostrarConvite({ estado, liberado: !!acesso.data?.liberado, produtos: produtos.data?.length })) return null;
  const fechar = (nunca: boolean) => {
    if (nunca) nuncaMaisConvite(userId); else adiarConvite(userId);
    setEstado(lerConvite(userId));
  };
  return (
    <section aria-label="Cadastrar produtos" className="rounded-[20px] p-4 flex flex-col gap-3"
      style={{ background: VANT.cartao, border: "1px solid rgba(245,184,0,.28)" }}>
      <div className="flex items-start justify-between">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,184,0,.14)", color: VANT.ouro }}>
          <TrendingUp className="w-[18px] h-[18px]" strokeWidth={2.5} />
        </span>
        <span className="text-[10.5px] font-black tracking-[.12em]" style={{ color: VANT.cinza }}>DICA DA VANT</span>
      </div>
      <h2 className="text-[17px] font-black leading-snug" style={{ color: VANT.texto }}>Você vende bem. Mas sabe quanto realmente lucra?</h2>
      <p className="text-[13.5px] leading-snug" style={{ color: "#bdbdbd" }}>
        Cadastre o que você vende e descubra seus custos, controle seu estoque e saiba quanto pode produzir.
      </p>
      <button type="button" onClick={() => navigate("/products/novo")} className="w-full h-[50px] rounded-2xl text-[15px] font-black"
        style={{ background: VANT.ouro, color: "#1A1200" }}>
        Cadastrar meus produtos
      </button>
      <div className="flex justify-center gap-5">
        <button type="button" onClick={() => fechar(false)} className="h-10 px-1 text-[12.5px] font-bold" style={{ color: "#bdbdbd" }}>Mais tarde</button>
        <button type="button" onClick={() => fechar(true)} className="h-10 px-1 text-[12.5px] font-bold" style={{ color: VANT.cinza }}>Não mostrar novamente</button>
      </div>
    </section>
  );
}
