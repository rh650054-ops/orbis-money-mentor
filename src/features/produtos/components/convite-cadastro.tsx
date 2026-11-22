/* "Você vende bem. Mas sabe quanto realmente lucra?" — dashboard banner for who has no product yet
   (22/11, Etapa 2). Lives at the END of the "one notice at a time" queue, so it never jumps ahead of
   another notice. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
    <section aria-label="Cadastrar produtos" className="rounded-[22px] p-5 flex flex-col gap-3"
      style={{ background: `radial-gradient(120% 90% at 100% 0%, rgba(245,184,0,.16), rgba(0,0,0,0) 60%), ${VANT.cartao}`, border: "1px solid rgba(245,184,0,.35)" }}>
      <h2 className="text-[22px] font-black leading-[1.12] tracking-tight" style={{ color: VANT.texto }}>
        Você vende bem. Mas sabe quanto <span style={{ color: VANT.ouro }}>realmente lucra?</span>
      </h2>
      <p className="text-[14px] leading-snug" style={{ color: "#c9c9c9" }}>Cadastre seus produtos para acompanhar seus custos, estoque e produção.</p>
      <button type="button" onClick={() => navigate("/products/novo")} className="w-full h-[54px] rounded-2xl text-[15px] font-black mt-1"
        style={{ background: VANT.ouro, color: "#1A1200" }}>
        Cadastrar meus produtos
      </button>
      <div className="flex justify-between">
        <button type="button" onClick={() => fechar(false)} className="h-11 px-2 text-[13.5px] font-extrabold" style={{ color: "#d6d6d6" }}>Mais tarde</button>
        <button type="button" onClick={() => fechar(true)} className="h-11 px-2 text-[13px] font-bold" style={{ color: VANT.cinza }}>Não mostrar novamente</button>
      </div>
    </section>
  );
}
