/* Insights do "O que a VANT aprendeu": cruza vendas por tempo, padrão da região,
   custo da chuva e o modelo que mais acerta ali (confirmado pelos vendedores). */
import { Brain, CloudRain, MapPinned, Target, TrendingUp } from "lucide-react";
import type { ModeloNota, PadraoRegiao } from "@/hooks/useClima";
import { formatCurrency } from "@/shared/lib/utils";

export interface AprendizadoVendas { dias: number; melhor: { estado: string; media: number; dias: number } | null; queda_chuva_pct: number | null }
const NOME: Record<string, string> = { sol: "de sol", calor: "de calor", nublado: "nublados", chuva: "de chuva", tempestade: "de tempestade", frio: "de frio", noite: "à noite" };

export interface Insight { icone: typeof Brain; titulo: string; apoio: string }

export function montarInsights(a: AprendizadoVendas | null, p: PadraoRegiao | null | undefined, modelos: ModeloNota[]): Insight[] {
  const out: Insight[] = [];
  if (a?.melhor) out.push({ icone: TrendingUp, titulo: `Você vende melhor em dias ${NOME[a.melhor.estado] ?? a.melhor.estado}`, apoio: `média de ${formatCurrency(a.melhor.media)} em ${a.melhor.dias} dias.` });
  if (p && p.diasChuva >= 3) {
    if (p.abreFimTarde * 2 >= p.diasChuva) out.push({ icone: MapPinned, titulo: "Na sua região, a chuva costuma abrir no fim da tarde", apoio: `isso aconteceu em ${p.abreFimTarde} dos últimos ${p.diasChuva} dias com chuva.` });
    else out.push({ icone: MapPinned, titulo: `Choveu em ${p.diasChuva} dos últimos ${p.dias} dias na sua região`, apoio: p.horaTipica != null ? `a chuva costuma começar por volta das ${p.horaTipica}h.` : "sem horário fixo: confere o hora a hora." });
  }
  if (a?.queda_chuva_pct != null && a.queda_chuva_pct !== 0) {
    out.push(a.queda_chuva_pct > 0
      ? { icone: CloudRain, titulo: `Com chuva você vende ${Math.abs(a.queda_chuva_pct)}% menos`, apoio: "por isso a VANT segura você durante o pico da chuva." }
      : { icone: CloudRain, titulo: `Com chuva você vende ${Math.abs(a.queda_chuva_pct)}% mais`, apoio: "rua vazia de vendedor é rua sua: a VANT não te segura à toa." });
  }
  const melhor = [...modelos].filter((m) => m.total >= 3).sort((x, y) => y.acertos / y.total - x.acertos / x.total)[0];
  if (melhor) out.push({ icone: Target, titulo: `Aqui, o modelo que mais acerta é o ${melhor.nome.split(" · ")[0]}`, apoio: `${melhor.acertos} de ${melhor.total} confirmações dos vendedores: ele pesa mais na sua previsão.` });
  return out.slice(0, 4);
}

