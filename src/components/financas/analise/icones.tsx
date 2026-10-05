/* Ícones das categorias — uma família só (lucide, traço 2px), sem emoji. */
import {
  Banknote, Bike, Briefcase, Bus, Car, CircleEllipsis, CircleHelp, CreditCard, Dices, Fuel, House, Landmark,
  Package, Pill, Receipt, Repeat, Send, Shirt, ShoppingCart, Smartphone, Snowflake, Ticket, UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

const MAPA: Record<string, LucideIcon> = {
  mercadoria: Package, insumos: Snowflake, onibus: Bus, combustivel: Fuel, impostos: Landmark,
  transporte_app: Car, delivery: Bike, restaurante: UtensilsCrossed, mercado: ShoppingCart, pix_pessoas: Send,
  assinaturas: Repeat, contas_casa: House, celular_internet: Smartphone, farmacia: Pill, roupas: Shirt,
  lazer: Ticket, parcelas: CreditCard, compras_debito: CreditCard, saque: Banknote, taxas: Receipt,
  apostas: Dices, outros: CircleEllipsis, nao_identificado: CircleHelp, __negocio: Briefcase,
};

export function IconeCategoria({ slug, cor = "#d8d3c9", tamanho = 36 }: { slug: string; cor?: string; tamanho?: number }) {
  const Icone = MAPA[slug] ?? CircleEllipsis;
  return (
    <span className="shrink-0 rounded-[11px] flex items-center justify-center" style={{ width: tamanho, height: tamanho, background: "#1A1A1A" }} aria-hidden>
      <Icone className="w-5 h-5" strokeWidth={2} style={{ color: cor }} />
    </span>
  );
}
