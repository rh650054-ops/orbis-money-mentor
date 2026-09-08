import { useState } from "react";
import { foto, iniciais } from "./x1-lib";

/* Foto REAL do vendedor (pedido do Rick) com anel colorido: dourado = você,
   vermelho = rival. Sem foto válida → iniciais no mesmo anel (nunca "?" quebrado). */
export function X1Avatar({ url, nome, size = 44, cor = "#F5B800", className = "", style }: {
  url: string | null | undefined; nome: string | null | undefined; size?: number; cor?: string; className?: string; style?: React.CSSProperties;
}) {
  const [quebrou, setQuebrou] = useState(false);
  const src = quebrou ? null : foto(url);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 font-black select-none ${className}`}
      style={{ width: size, height: size, border: `2px solid ${cor}`, background: `${cor}22`, color: cor, fontSize: Math.max(10, Math.round(size * 0.3)), boxShadow: `0 0 ${Math.round(size / 3)}px ${cor}44`, ...style }}
    >
      {src ? <img src={src} alt="" className="w-full h-full object-cover" onError={() => setQuebrou(true)} /> : iniciais(nome)}
    </span>
  );
}

/** Duas fotos sobrepostas (você × rival) — usado nas faixas curtas. */
export function X1Faces({ eu, ele, size = 30 }: { eu: { url: string | null | undefined; nome: string | null | undefined }; ele: { url: string | null | undefined; nome: string | null | undefined }; size?: number }) {
  return (
    <span className="inline-flex items-center shrink-0">
      <X1Avatar url={eu.url} nome={eu.nome} size={size} cor="#F5B800" />
      <X1Avatar url={ele.url} nome={ele.nome} size={size} cor="#F2465A" style={{ marginLeft: -Math.round(size * 0.3) }} />
    </span>
  );
}
