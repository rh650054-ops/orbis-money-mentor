/* Insights do "O que a VANT aprendeu": cruza vendas por tempo, padrão da região,
   custo da chuva e o modelo que mais acerta ali (confirmado pelos vendedores). */
import { Brain, CloudRain, MapPinned, Target, TrendingUp } from "lucide-react";
import type { ModeloNota, PadraoRegiao } from "@/hooks/useClima";
import { formatCurrency } from "@/shared/lib/utils";

export interface AprendizadoVendas { dias: number; melhor: { estado: string; media: number; dias: number } | null; queda_chuva_pct: number | null; por_estado?: { estado: string; dias: number; media: number }[] }
const NOME: Record<string, string> = { sol: "de sol", calor: "de calor", nublado: "nublados", chuva: "de chuva", tempestade: "de tempestade", frio: "de frio", noite: "à noite" };

export interface Insight { icone: typeof Brain; cor: string; titulo: string; apoio: string }

export function montarInsights(a: AprendizadoVendas | null, p: PadraoRegiao | null | undefined, modelos: ModeloNota[]): Insight[] {
  const out: Insight[] = [];
  if (a?.melhor) {
    // "X% melhor" contra a média de TODOS os dias dele (não só contra o pior)
    const pe = a.por_estado ?? [];
    const dias = pe.reduce((s, e) => s + e.dias, 0);
    const geral = dias > 0 ? pe.reduce((s, e) => s + e.media * e.dias, 0) / dias : 0;
    const pct = geral > 0 ? Math.round((a.melhor.media / geral - 1) * 100) : 0;
    const nome = NOME[a.melhor.estado] ?? a.melhor.estado;
    out.push(pct >= 5 && pe.length >= 2
      ? { icone: TrendingUp, cor: "#3DD68C", titulo: `Você vende ${pct}% melhor em dias ${nome}`, apoio: `média de ${formatCurrency(a.melhor.media)} em ${a.melhor.dias} dias.` }
      : { icone: TrendingUp, cor: "#3DD68C", titulo: `Seu melhor tempo é o de dias ${nome}`, apoio: `média de ${formatCurrency(a.melhor.media)} em ${a.melhor.dias} dias.` });
  }
  if (p && p.diasChuva >= 3) {
    if (p.abreFimTarde * 2 >= p.diasChuva) out.push({ icone: MapPinned, cor: "#F5B800", titulo: "Na sua região, a chuva costuma aliviar no fim da tarde", apoio: `isso aconteceu em ${p.abreFimTarde} dos últimos ${p.diasChuva} dias com chuva.` });
    else out.push({ icone: MapPinned, cor: "#F5B800", titulo: `Choveu em ${p.diasChuva} dos últimos ${p.dias} dias na sua região`, apoio: p.horaTipica != null ? `a chuva costuma começar por volta das ${p.horaTipica}h.` : "sem horário fixo: confere o hora a hora." });
  }
  if (a?.queda_chuva_pct != null && a.queda_chuva_pct !== 0) {
    out.push(a.queda_chuva_pct > 0
      ? { icone: CloudRain, cor: "#9CC4FF", titulo: `Com chuva suas vendas caem ${Math.abs(a.queda_chuva_pct)}%`, apoio: "por isso a VANT segura você durante o pico da chuva." }
      : { icone: CloudRain, cor: "#9CC4FF", titulo: `Com chuva suas vendas sobem ${Math.abs(a.queda_chuva_pct)}%`, apoio: "rua vazia de vendedor é rua sua: a VANT não te segura à toa." });
  }
  const melhor = [...modelos].filter((m) => m.total >= 3).sort((x, y) => y.acertos / y.total - x.acertos / x.total)[0];
  if (melhor) out.push({ icone: Target, cor: "#9B7BFF", titulo: `Aqui, o modelo que mais acerta é o ${melhor.nome.split(" · ")[0]}`, apoio: `${melhor.acertos} de ${melhor.total} confirmações dos vendedores: ele pesa mais na sua previsão.` });
  return out.slice(0, 4);
}

