import { CSSProperties, useEffect, useState } from "react";
import { fotoValida } from "@/shared/lib/avatar";

/**
 * Foto do vendedor no ranking. Se nao tem foto valida OU a foto falhar ao
 * carregar (link morto, 403, arquivo apagado), cai no ESCUDO DA LIGA — nunca
 * mais o icone quebrado do navegador.
 */
export function AvatarRanking({
  url, name, imgClassName, imgStyle, icon, iconClassName, iconStyle, lazy,
}: {
  url: string | null | undefined;
  name: string | null | undefined;
  imgClassName?: string;
  imgStyle?: CSSProperties;
  icon: string;
  iconClassName?: string;
  iconStyle?: CSSProperties;
  lazy?: boolean;
}) {
  const src = fotoValida(url);
  const [erro, setErro] = useState(false);
  useEffect(() => { setErro(false); }, [src]);
  if (src && !erro) {
    return (
      <img
        src={src}
        alt={name || ""}
        loading={lazy ? "lazy" : undefined}
        decoding="async"
        onError={() => setErro(true)}
        className={imgClassName}
        style={imgStyle}
      />
    );
  }
  return <img src={icon} alt={name || ""} className={iconClassName} style={iconStyle} />;
}

/** Selo de verificado no estilo do Instagram (Rick, 02/10/2026): estrela azul
 *  serrilhada com check branco, ao lado do nome. Quem tem é quem ligou o banco. */
const ESTRELA = "M12 1.5l2.6 2.3 3.4-.6.6 3.4 3.1 1.6-1.6 3.1 1.6 3.1-3.1 1.6-.6 3.4-3.4-.6L12 22.5l-2.6-2.3-3.4.6-.6-3.4-3.1-1.6 1.6-3.1-1.6-3.1 3.1-1.6.6-3.4 3.4.6z";
export function SeloVerificado({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Verificado"
      className={className}
      style={{ width: size, height: size, display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
    >
      <path fill="#0095F6" d={ESTRELA} />
      <path d="M8 12.5l2.6 2.6L16.5 9" stroke="#fff" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
