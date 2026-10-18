/* "Seu perfil público": a real preview of how other vendors see you. */
import { Instagram, MapPin, MessageCircle, Package, Store } from "lucide-react";
import type { Conta } from "../types";
import { Botao, COR, Secao } from "@/shared/components/vant-ui";
import { FotoConta } from "./foto-conta";

export function PerfilPublicoCard({ conta, onVer, onEditar }: { conta: Conta; onVer: () => void; onEditar: () => void }) {
  const cidade = conta.show_city ? [conta.city, conta.state].filter(Boolean).join(" · ") : "";
  const insta = conta.show_instagram && conta.instagram ? `@${conta.instagram.replace(/^@/, "")}` : null;
  const zap = conta.show_whatsapp && conta.whatsapp_public ? "WhatsApp" : null;
  const vazio = !conta.bio && !conta.what_i_sell && !conta.where_i_sell;
  return (
    <Secao titulo="SEU PERFIL PÚBLICO" id="sec-publico">
      <div className="rounded-2xl p-3.5 flex flex-col gap-2.5" style={{ background: "#141416", border: "1px dashed #2a2823" }}>
        <div className="flex items-center gap-3">
          <FotoConta url={conta.avatar_url} nome={conta.nickname} tamanho={48} />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-black truncate">{conta.nickname || "Vendedor"}</p>
            {cidade && <p className="text-[12px] flex items-center gap-1" style={{ color: COR.suave }}><MapPin className="w-3 h-3" />{cidade}</p>}
          </div>
        </div>
        {conta.bio && <p className="text-[13.5px] leading-snug" style={{ color: "#dcd6ca" }}>{conta.bio}</p>}
        {(conta.what_i_sell || conta.where_i_sell) && (
          <div className="flex flex-wrap gap-1.5">
            {conta.what_i_sell && <Chip icone={<Package className="w-3 h-3" />} texto={conta.what_i_sell} />}
            {conta.where_i_sell && <Chip icone={<Store className="w-3 h-3" />} texto={conta.where_i_sell} />}
          </div>
        )}
        {(insta || zap) && (
          <div className="flex flex-wrap gap-1.5">
            {insta && <Chip icone={<Instagram className="w-3 h-3" />} texto={insta} ouro />}
            {zap && <Chip icone={<MessageCircle className="w-3 h-3" />} texto={zap} ouro />}
          </div>
        )}
        {vazio && <p className="text-[12.5px]" style={{ color: COR.apagado }}>Seu perfil está vazio. Conte o que você vende e onde — ajuda outros vendedores a te reconhecer.</p>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Botao onClick={onVer}>Ver como os outros veem</Botao>
        <Botao tipo="ouro" onClick={onEditar}>Editar perfil</Botao>
      </div>
    </Secao>
  );
}

function Chip({ icone, texto, ouro }: { icone: React.ReactNode; texto: string; ouro?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold max-w-full truncate"
      style={{ background: ouro ? "rgba(245,184,0,.1)" : "#1b1a17", color: ouro ? COR.ouro : COR.suave }}>
      {icone}<span className="truncate">{texto}</span>
    </span>
  );
}
