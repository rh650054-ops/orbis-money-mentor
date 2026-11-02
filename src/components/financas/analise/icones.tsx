/* Ícones das categorias — uma família só (lucide, traço 2px), sem emoji.
   01/11 (Rick: "quando eu escrever outro ele identifique o nome e crie um ícone"):
   tópico criado pelo vendedor (slug u_…) ganha o ícone pelo NOME, por palavra-chave. */
import {
  Baby, Banknote, Beer, Bike, BookOpen, Briefcase, Bus, Car, Cat, Church, CircleEllipsis, CircleHelp, Coffee, CreditCard,
  Croissant, Dices, Dog, Droplet, Dumbbell, Flame, Fuel, Gamepad2, Gift, GraduationCap, HandCoins, Heart, House, Landmark,
  Lightbulb, Music, Package, PawPrint, PiggyBank, Pill, Plane, Receipt, Repeat, Scissors, Send, Shirt, ShoppingBag,
  ShoppingCart, Smartphone, Snowflake, Sparkles, Stethoscope, Tag, Ticket, TrendingUp, Tv, UtensilsCrossed, Wifi, Wrench,
  type LucideIcon,
} from "lucide-react";

const MAPA: Record<string, LucideIcon> = {
  mercadoria: Package, insumos: Snowflake, onibus: Bus, combustivel: Fuel, impostos: Landmark,
  transporte_app: Car, delivery: Bike, restaurante: UtensilsCrossed, mercado: ShoppingCart, pix_pessoas: Send,
  assinaturas: Repeat, contas_casa: House, celular_internet: Smartphone, farmacia: Pill, roupas: Shirt,
  lazer: Ticket, parcelas: CreditCard, compras_debito: CreditCard, saque: Banknote, taxas: Receipt,
  apostas: Dices, outros: CircleEllipsis, nao_identificado: CircleHelp, __negocio: Briefcase,
};

/** Palavra-chave (sem acento, minúscula) → ícone. A primeira que aparecer no nome ganha. */
const PALAVRAS: [RegExp, LucideIcon][] = [
  [/mercad|rancho|supermerc|feira|hortifruti|acougue/, ShoppingCart],
  [/padaria|pao\b|paes/, Croissant],
  [/cafe|cafeteria/, Coffee],
  [/lanche|comida|restaur|almoco|janta|marmita|ifood|pizza|hamburg/, UtensilsCrossed],
  [/cerveja|bebida|bar\b|balada|role/, Beer],
  [/gasolina|combust|posto|etanol|diesel/, Fuel],
  [/uber|99|taxi|carro|oficina|mecanic|estacion|pedagio|ipva|seguro do carro/, Car],
  [/moto|bike|bicicleta|entrega/, Bike],
  [/onibus|metro|trem|passagem|bilhete/, Bus],
  [/aluguel|casa|condominio|reforma|moveis|movel/, House],
  [/luz|energia|eletric/, Lightbulb],
  [/agua|sabesp/, Droplet],
  [/gas\b|botijao/, Flame],
  [/internet|wifi|fibra/, Wifi],
  [/celular|telefone|chip|recarga/, Smartphone],
  [/netflix|streaming|tv\b|globoplay|disney|prime/, Tv],
  [/spotify|musica|show/, Music],
  [/jogo|game|playstation|xbox/, Gamepad2],
  [/academia|treino|crossfit|suplement|whey/, Dumbbell],
  [/remedio|farmacia|drogaria/, Pill],
  [/medic|saude|consulta|exame|dentista|hospital|plano de saude/, Stethoscope],
  [/cabelo|salao|barbe|unha|manicure|estetica/, Scissors],
  [/beleza|maquiag|perfume|cosmetic|skincare/, Sparkles],
  [/roupa|tenis|calcado|sapato|camis/, Shirt],
  [/loja|shopping|compras|shein|shopee|amazon|mercado livre/, ShoppingBag],
  [/escola|faculdade|curso|mensalidade|material escolar/, GraduationCap],
  [/livro|apostila|estudo/, BookOpen],
  [/bebe|fralda|filh|crianca|creche|leite em po/, Baby],
  [/cachorro|cao\b|dog/, Dog],
  [/gato|gata/, Cat],
  [/pet|racao|veterin/, PawPrint],
  [/igreja|dizimo|oferta|templo/, Church],
  [/presente|aniversario|natal/, Gift],
  [/namor|esposa|marido|mulher|familia|mae\b|pai\b/, Heart],
  [/viagem|viajar|hotel|aviao|passeio/, Plane],
  [/cinema|lazer|ingresso|parque/, Ticket],
  [/investiment|acoes|cripto|bitcoin/, TrendingUp],
  [/poupanca|reserva|guardar|cofrinho/, PiggyBank],
  [/emprestimo|divida|agiota|parcela|financiamento|carne/, HandCoins],
  [/cartao|fatura|nubank|credito/, CreditCard],
  [/aposta|bet\b|bets|cassino|loteria|bicho/, Dices],
  [/imposto|das\b|mei\b|taxa|multa/, Landmark],
  [/ferrament|conserto|manutenc|peca/, Wrench],
  [/estoque|mercadoria|insumo|embalag|copo|isopor|gelo/, Package],
  [/pix|transferenc/, Send],
];

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Ícone pro nome que o vendedor digitou; etiqueta quando não reconhece. */
export function iconePorNome(nome: string): LucideIcon {
  const n = semAcento(nome);
  return PALAVRAS.find(([re]) => re.test(n))?.[1] ?? Tag;
}

/** Categoria do app: ícone fixo pelo slug. Tópico do vendedor (u_…): ícone pelo nome. */
export function iconeDaCategoria(slug: string, rotulo?: string): LucideIcon {
  return MAPA[slug] ?? (rotulo ? iconePorNome(rotulo) : CircleEllipsis);
}

export function IconeCategoria({ slug, rotulo, cor = "#d8d3c9", tamanho = 36 }: { slug: string; rotulo?: string; cor?: string; tamanho?: number }) {
  const Icone = iconeDaCategoria(slug, rotulo);
  return (
    <span className="shrink-0 rounded-[11px] flex items-center justify-center" style={{ width: tamanho, height: tamanho, background: "#1A1A1A" }} aria-hidden>
      <Icone className="w-5 h-5" strokeWidth={2} style={{ color: cor }} />
    </span>
  );
}
