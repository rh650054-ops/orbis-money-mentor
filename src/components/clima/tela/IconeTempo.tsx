/* Ícone do tempo pelo código WMO — a nuvem que todo mundo conhece (lucide, traço 2px). */
import { iconeDo } from "./icone-tempo";
export { ehDiaHora } from "./icone-tempo";

export function IconeTempo({ codigo, dia = true, tamanho = 22 }: { codigo: number | null | undefined; dia?: boolean; tamanho?: number }) {
  const { Icone, cor } = iconeDo(codigo, dia);
  return <Icone aria-hidden width={tamanho} height={tamanho} strokeWidth={2} style={{ color: cor }} className="shrink-0" />;
}
