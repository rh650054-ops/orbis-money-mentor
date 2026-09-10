/* ============================================================
   O QUE O ORBIS VIU — duas ou três frases, de graça, sem IA.

   Lê os números do período e a ficha do vendedor (orbis_ficha, o cofre) e
   diz o que importa em português de gente. O botão "Analisar com IA" fica
   pra quem quer mais. Regra da casa: compara o vendedor com ELE MESMO —
   nunca com os outros de forma agressiva.
   ============================================================ */
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";

export interface FichaResumo {
  melhor_hora?: number | null;
  gargalo?: string | null;
  conversao?: number | null;   // 0-100
  dias_de_rua?: number | null;
}

interface Props {
  conversao: number;            // 0-100 do período
  abordagens: number;
  vendas: number;
  ritmoMin: number;             // minutos por venda (0 = sem dado)
  melhorHoraHoje?: { hora: number; total: number } | null;
  variacaoPct?: number | null;  // vs período anterior (null = sem base)
  isSingleDay: boolean;
  ficha?: FichaResumo | null;
}

type Tom = "ok" | "ouro" | "neutro";

export function montarDicas(p: Props): { tom: Tom; texto: ReactNode }[] {
  const out: { tom: Tom; texto: ReactNode }[] = [];
  const conv = Math.round(p.conversao);
  let falouVolume = false;

  // 1) conversão — o diagnóstico mais útil que existe
  if (p.abordagens >= 10) {
    if (conv >= 45) {
      falouVolume = true;
      out.push({ tom: "ok", texto: <>Conversão alta ({conv}%). Seu gargalo não é a abordagem — é <b>volume</b>. Mais gente abordada, mais venda.</> });
    } else if (conv < 20) {
      const de10 = Math.round(conv / 10);
      out.push({ tom: "neutro", texto: <>Conversão baixa ({conv}%): de cada 10 abordagens, {de10 || "menos de 1"} {de10 === 1 ? "virou" : "viraram"} venda. O que muda aqui não é abordar mais — é a <b>primeira frase</b>.</> });
    } else if (p.ficha?.conversao != null && conv >= Math.round(Number(p.ficha.conversao)) + 8) {
      out.push({ tom: "ok", texto: <>Conversão de {conv}% — acima do seu normal ({Math.round(Number(p.ficha.conversao))}%). Alguma coisa na abordagem de hoje funcionou: repete.</> });
    }
  }

  // 2) melhor hora — só num dia único, quando há hora
  if (p.isSingleDay && p.melhorHoraHoje) {
    const h = p.melhorHoraHoje.hora;
    const fh = p.ficha?.melhor_hora;
    if (fh != null && Number(fh) === h) {
      out.push({ tom: "ouro", texto: <>Sua melhor hora foi {h}h ({formatCurrency(p.melhorHoraHoje.total)}). Como sempre — <b>chega 20 min antes</b> amanhã.</> });
    } else if (fh != null) {
      out.push({ tom: "ouro", texto: <>Hoje a melhor hora foi {h}h ({formatCurrency(p.melhorHoraHoje.total)}). Normalmente é às {Number(fh)}h — vale ficar nas duas.</> });
    } else {
      out.push({ tom: "ouro", texto: <>Sua melhor hora foi {h}h ({formatCurrency(p.melhorHoraHoje.total)}).</> });
    }
  }

  // 3) variação vs anterior (períodos) ou ritmo (dia)
  if (!p.isSingleDay && p.variacaoPct != null && Math.abs(p.variacaoPct) >= 10) {
    out.push(p.variacaoPct > 0
      ? { tom: "ok", texto: <>+{Math.round(p.variacaoPct)}% em relação ao período anterior. O que você mudou está funcionando — <b>mantém</b>.</> }
      : { tom: "neutro", texto: <>{Math.round(p.variacaoPct)}% em relação ao período anterior. Confere o Dia a dia: a queda foi em todos os dias ou num só?</> });
  } else if (p.isSingleDay && p.ritmoMin > 0 && p.vendas >= 5) {
    const m = Math.floor(p.ritmoMin), s = Math.round((p.ritmoMin - m) * 60);
    out.push({ tom: "neutro", texto: <>Você levou <b>{m}:{String(s).padStart(2, "0")}</b> por venda. Quanto menor esse tempo, mais venda cabe no mesmo dia de rua.</> });
  }

  // 4) gargalo da ficha, se ainda sobrou espaço
  if (out.length < 3 && p.ficha?.gargalo && (p.ficha.dias_de_rua ?? 0) >= 7) {
    const g = p.ficha.gargalo;
    if (g === "volume" && !falouVolume) {
      out.push({ tom: "neutro", texto: <>Pelo seu histórico, o que mais te trava é <b>volume</b>: nos dias em que você aborda mais, vende mais. Simples assim.</> });
    } else if (g === "constancia") {
      out.push({ tom: "neutro", texto: <>Você fatura bem quando trabalha — o que te segura é a <b>constância</b>. Dias na rua contam mais que dias perfeitos.</> });
    } else if (g === "ticket") {
      out.push({ tom: "neutro", texto: <>Sua conversão é boa; o que puxa o dia pra baixo é o <b>ticket</b>. Combo de 2 unidades sobe a média sem abordar ninguém a mais.</> });
    }
  }

  return out.slice(0, 3);
}

export function OrbisViu(p: Props) {
  const dicas = montarDicas(p);
  if (dicas.length === 0) return null;
  const cor = (t: Tom) => t === "ouro" ? "var(--orbis-gold)" : t === "ok" ? "var(--orbis-ok)" : "var(--orbis-fg-2)";
  const borda = (t: Tom) => t === "ouro" ? "rgba(245,184,0,.35)" : t === "ok" ? "rgba(61,214,140,.3)" : "var(--orbis-line)";
  return (
    <div>
      <p className="orbis-section mb-2.5 px-1">O que o Orbis viu</p>
      <div className="flex flex-col gap-2">
        {dicas.map((d, i) => (
          <div key={i} className="orbis-card-in flex items-start gap-2.5 rounded-[14px] px-3.5 py-3" style={{ border: `1px solid ${borda(d.tom)}`, background: "var(--orbis-surf)" }}>
            <Sparkles className="w-[18px] h-[18px] shrink-0 mt-0.5" style={{ color: cor(d.tom) }} strokeWidth={2} />
            <p className="text-[13.5px] leading-[1.45] text-foreground">{d.texto}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
