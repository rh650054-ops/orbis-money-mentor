/* The vendor's picture anywhere on this screen: photo, VANT icon, old emoji or initial. */
import { useState } from "react";
import { fotoValida } from "@/shared/lib/avatar";
import { COR } from "@/shared/components/vant-ui";

export function FotoConta({ url, nome, tamanho = 64, destaque = false }: { url: string | null; nome: string | null; tamanho?: number; destaque?: boolean }) {
  const [quebrou, setQuebrou] = useState(false);
  const src = fotoValida(url);
  const anel = destaque ? { boxShadow: `0 0 0 2px ${COR.ouro}, 0 0 18px -2px rgba(245,184,0,.55)` } : { boxShadow: `0 0 0 1px ${COR.borda}` };
  const base = { width: tamanho, height: tamanho, ...anel };
  if (src && !quebrou) {
    return <img src={src} alt={nome || "Foto"} onError={() => setQuebrou(true)} className="rounded-full object-cover shrink-0" style={base} />;
  }
  const emoji = url && !src && url.trim().length <= 4 ? url.trim() : null;
  return (
    <span className="rounded-full shrink-0 grid place-items-center font-black" aria-label={nome || "Foto"}
      style={{ ...base, background: "#16140f", color: COR.ouro, fontSize: tamanho * (emoji ? 0.5 : 0.42) }}>
      {emoji || (nome || "V").trim().charAt(0).toUpperCase()}
    </span>
  );
}
