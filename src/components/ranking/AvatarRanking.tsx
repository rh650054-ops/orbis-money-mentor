import { CSSProperties, useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
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

/** Selo azul de verificado — 3+ meses de Orbis (ou marcado pela equipe). */
export function SeloVerificado({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <BadgeCheck
      aria-label="Verificado"
      className={className}
      style={{ width: size, height: size, display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
      color="#ffffff"
      fill="#2F9BFF"
      strokeWidth={2}
    />
  );
}
