/* ============================================================
   CLIMA · DECISÃO (08/10/2026, redesenho da tela de Clima).
   Tudo que a tela RECOMENDA sai daqui, de um lugar só, a partir dos mesmos
   números do hora a hora. Por isso o hero, as janelas e o plano do dia nunca
   se contradizem (antes o plano vinha da IA e às vezes brigava com a chuva).
   A IA fica só com a "Opinião da Vant". Funções puras: testáveis sem abrir o app.
   ============================================================ */
import type { AlertaOficial, Confianca, DiaClima, HoraClima, Tempo } from "@/hooks/useClima";
import { formatCurrency } from "@/shared/lib/utils";
import { horasFortes, melhoresPicos, type PerfilHora, type Pico } from "./picos";

export type Nivel = "bom" | "atencao" | "risco" | "neutro";
export const COR_NIVEL: Record<Nivel, string> = { bom: "#3DD68C", atencao: "#F5B800", risco: "#FF6B5E", neutro: "#8f897f" };

export const chanceDe = (h: Pick<HoraClima, "chance" | "fontes" | "total" | "prob">) =>
  Math.round(h.chance ?? (h.total > 0 ? (h.fontes / h.total) * 100 : h.prob ?? 0));

export const confDe = (h: Pick<HoraClima, "conf" | "chance" | "fontes" | "total" | "prob">): Confianca => {
  if (h.conf) return h.conf;
  const c = chanceDe(h) / 100; const a = Math.max(c, 1 - c);
  return a >= 0.8 ? "alta" : a >= 0.62 ? "media" : "baixa";
};
export const CONF_TXT: Record<Confianca, { curto: string; longo: string }> = {
  alta: { curto: "Alta confiança", longo: "quase todos os modelos concordam" },
  media: { curto: "Média confiança", longo: "parte dos modelos diverge" },
  baixa: { curto: "Baixa confiança", longo: "previsão instável, pode mudar" },
};

export type Intensidade = "tempestade" | "chuva forte" | "chuva" | "chuvisco" | "instável" | "abrindo" | "seco";

export function intensidade(h: HoraClima, anterior?: HoraClima): Intensidade {
  const c = chanceDe(h); const cod = h.codigo ?? 0;
  if (cod >= 95 && c >= 40) return "tempestade";
  if (c >= 50 && (h.mm >= 4 || cod === 65 || cod === 82)) return "chuva forte";
  if (c >= 60) return h.mm >= 1 || (cod >= 61 && cod <= 82) ? "chuva" : "chuvisco";
  if (c >= 30) return "instável";
  if (anterior && chanceDe(anterior) >= 50) return "abrindo";
  return "seco";
}

export interface StatusHora { nivel: Nivel; texto: string; intensidade: Intensidade }

/** O que fazer naquela hora, em 2 ou 3 palavras. */
export function statusHora(h: HoraClima, anterior?: HoraClima): StatusHora {
  const i = intensidade(h, anterior);
  if (h.hora < 5) return { nivel: "neutro", texto: "rua vazia", intensidade: i };
  if (i === "tempestade" || i === "chuva forte" || i === "chuva") return { nivel: "risco", texto: "não sair", intensidade: i };
  if (i === "chuvisco") return { nivel: "atencao", texto: "só coberto", intensidade: i };
  if (i === "instável") return { nivel: "atencao", texto: "espera mais", intensidade: i };
  if ((h.temp ?? 0) >= 35) return { nivel: "atencao", texto: "fica na sombra", intensidade: i };
  if (i === "abrindo") return { nivel: "bom", texto: "janela curta", intensidade: i };
  return { nivel: "bom", texto: "boa pra vender", intensidade: i };
}

/* ---------------------------------------------------------------- alertas */
const dataLocal = (s: string) => new Date(`${s.replace(" ", "T")}:00-03:00`);
/** Alerta oficial valendo AGORA (ou começando nas próximas 3 h). */
export function alertaAtivo(oficiais: AlertaOficial[] | undefined, agora = new Date()): AlertaOficial | null {
  return (oficiais ?? []).find((a) => {
    const ini = dataLocal(a.inicio), fim = dataLocal(a.fim);
    if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime())) return true;
    return fim >= agora && ini.getTime() - agora.getTime() <= 3 * 3600_000;
  }) ?? null;
}
/** Tem que parar a venda? Alerta oficial laranja/vermelho ou tempestade pelos modelos. */
export function riscoSevero(t: Tempo, agora = new Date()): { titulo: string; oficial: AlertaOficial | null } | null {
  const of = alertaAtivo(t.oficiais, agora);
  if (of && of.nivel !== "amarelo") return { titulo: of.tipo, oficial: of };
  if (t.estado === "tempestade" || /^tempestade/i.test(t.alerta?.titulo ?? "")) return { titulo: t.alerta?.titulo ?? "Tempestade", oficial: null };
  return null;
}

/* ---------------------------------------------------------------- janelas de venda */
export interface Janela extends Pico { rotulo: string; amanha: boolean; conf: Confianca; boa: boolean; confPct: number; temp: number | null }

const rotuloJanela = (p: Pico) => (p.de === p.ate ? `${p.de}h–${p.de + 1}h` : `${p.de}h–${p.ate + 1}h`);

export function janelasDeVenda(t: Tempo, perfil: PerfilHora[]): Janela[] {
  const hoje = t.horas[0]?.iso.slice(0, 10) ?? "";
  const horas = t.horas.slice(0, 18);
  const picos = melhoresPicos(horas, perfil);
  const ordemConf: Confianca[] = ["baixa", "media", "alta"];
  return picos.map((p) => {
    const hs = horas.filter((h) => p.isos.includes(h.iso));
    const conf = hs.reduce<Confianca>((pior, h) => (ordemConf.indexOf(confDe(h)) < ordemConf.indexOf(pior) ? confDe(h) : pior), "alta");
    // confiança em % = o quanto as horas da janela estão longe do "cara ou coroa" (50%)
    const confPct = hs.length ? Math.round(hs.reduce((s, h) => s + Math.max(chanceDe(h), 100 - chanceDe(h)), 0) / hs.length) : 50;
    const temps = hs.map((h) => h.temp).filter((v): v is number => v != null);
    const temp = temps.length ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null;
    return { ...p, rotulo: rotuloJanela(p), amanha: p.iso.slice(0, 10) !== hoje, conf, boa: p.nota >= 66, confPct, temp };
  });
}

/* ---------------------------------------------------------------- decisão de agora */
export interface Decisao { titulo: string; sub: string; nivel: Nivel }

function proximaBoa(horas: HoraClima[], desde: number): number {
  for (let i = desde; i < Math.min(horas.length, 12); i++) if (statusHora(horas[i]!, horas[i - 1]).nivel === "bom") return i;
  return -1;
}
function proximaRuim(horas: HoraClima[], desde: number): number {
  for (let i = desde; i < Math.min(horas.length, 12); i++) {
    const s = statusHora(horas[i]!, horas[i - 1]);
    if (s.nivel === "risco" || s.intensidade === "instável" || s.intensidade === "chuvisco") return i;
  }
  return -1;
}

export function decisaoAgora(t: Tempo, opts: { noturno?: boolean; agora?: Date } = {}): Decisao {
  const h = t.horas;
  const h0 = h[0];
  const sev = riscoSevero(t, opts.agora);
  if (sev) return { titulo: "Pausa a venda", sub: `${sev.titulo}${sev.oficial ? " · alerta oficial" : ""}. Procura abrigo.`, nivel: "risco" };
  if (!h0) return { titulo: "Lendo o céu…", sub: "", nivel: "neutro" };
  if (h0.hora < 5 && !opts.noturno) {
    const b = h.findIndex((x) => x.hora >= 6 && statusHora(x).nivel === "bom");
    return { titulo: "Hora de descansar", sub: b >= 0 ? `Rua vazia agora. Boa janela a partir das ${h[b]!.hora}h.` : "Rua vazia agora.", nivel: "neutro" };
  }
  const chovendo = t.estado === "chuva";
  const s0 = statusHora(h0);
  if (!chovendo && s0.nivel === "bom") {
    const r = proximaRuim(h, 1);
    if (r > 0 && r <= 3) return { titulo: `Janela curta até ${h[r]!.hora}h`, sub: `Depois vem ${intensidade(h[r]!, h[r - 1]).replace("instável", "tempo instável")}.`, nivel: "atencao" };
    return { titulo: "Dá pra vender agora", sub: r > 0 ? `Seco até umas ${h[r]!.hora}h.` : "Seco pelas próximas horas.", nivel: "bom" };
  }
  const b = proximaBoa(h, 1);
  if (b > 0) return { titulo: `Espera até ${h[b]!.hora}h`, sub: chovendo || s0.nivel === "risco" ? "A chuva perde força depois." : "O tempo firma depois.", nivel: "atencao" };
  return { titulo: "Hoje o clima aperta", sub: "Sem janela seca nas próximas 12 horas.", nivel: "risco" };
}

/* ---------------------------------------------------------------- plano de ação */
export interface Passo { quando: string; acao: string; texto: string; nivel: Nivel }
export interface ContextoPlano { meta?: number; vendidoHoje?: number; contas?: { nome: string; dias: number; valor: number }[]; noturno?: boolean }

export function planoDoDia(t: Tempo, janelas: Janela[], c: ContextoPlano = {}, agora?: Date): Passo[] {
  const passos: Passo[] = [];
  const h = t.horas;
  const d = decisaoAgora(t, { noturno: c.noturno, agora });
  const sev = riscoSevero(t, agora);
  if (sev) {
    passos.push({ quando: "Agora", acao: "procura abrigo", texto: `${sev.titulo}. Pausa a venda e evita deslocamento.`, nivel: "risco" });
  } else if (d.nivel === "neutro") {
    passos.push({ quando: "Agora", acao: "descansa", texto: d.sub || "Rua vazia. Prepara o estoque de amanhã.", nivel: "neutro" });
  } else if (d.nivel === "bom" || d.titulo.startsWith("Janela curta")) {
    passos.push({ quando: "Agora", acao: "sair pra vender", texto: d.sub, nivel: d.nivel });
  } else {
    const fim = h.findIndex((x, i) => i > 0 && chanceDe(x) < 30);
    const i0 = intensidade(h[0]!);
    passos.push({ quando: "Agora", acao: "espera", texto: `${i0 === "seco" ? "Tempo instável" : i0[0]!.toUpperCase() + i0.slice(1)}${fim > 0 ? ` até ${h[fim]!.hora}h` : ""}. Fica em local coberto.`, nivel: "atencao" });
  }

  const melhor = janelas.find((j) => !j.amanha);
  const falta = Math.max(0, (c.meta ?? 0) - (c.vendidoHoje ?? 0));
  const conta = (c.contas ?? []).find((x) => x.dias <= 1);
  if (melhor && !sev) {
    const comeca = h[0] && melhor.de === h[0].hora;
    const motivos = melhor.etiquetas.slice(0, 2).join(", ");
    const extra = falta > 0 ? ` Falta ${formatCurrency(falta)} da meta: é aqui que fecha.` : conta ? ` ${conta.nome} vence ${conta.dias <= 0 ? "hoje" : "amanhã"}.` : "";
    if (!comeca) passos.push({ quando: melhor.rotulo, acao: "sair pra vender", texto: `${melhor.boa ? "Melhor janela do dia" : "Janela curta"}${motivos ? `: ${motivos}` : ""}.${extra}`, nivel: melhor.boa ? "bom" : "atencao" });
    else if (extra) passos[0] = { ...passos[0]!, texto: `${passos[0]!.texto}${extra}` };
    passos.push({ quando: `Depois das ${melhor.ate + 1}h`, acao: "reavaliar", texto: "Confere a chuva de novo e decide se vale seguir.", nivel: "neutro" });
  } else if (!sev && d.nivel === "risco") {
    passos.push({ quando: "Hoje", acao: "não força", texto: falta > 0 ? `A meta recupera amanhã. ${conta ? `${conta.nome} vence ${conta.dias <= 0 ? "hoje" : "amanhã"}: resolve pelo app.` : ""}`.trim() : "Dia de organizar estoque e descansar.", nivel: "neutro" });
  }
  return passos.slice(0, 4);
}

/* ---------------------------------------------------------------- próximos dias */
const faixa = (d: DiaClima, de: number, ate: number) => {
  const hs = d.horas.filter((x) => x.hora >= de && x.hora <= ate && x.chance != null);
  return hs.length ? hs.reduce((s, x) => s + (x.chance ?? 0), 0) / hs.length : null;
};
const estadoFaixa = (v: number | null) => (v == null ? null : v >= 55 ? "chuva" : v >= 30 ? "instável" : "seco");

/** "ruim cedo, melhora no fim da tarde" — curto e coerente com as horas do dia. */
export function resumoDia(d: DiaClima): string {
  const m = estadoFaixa(faixa(d, 6, 11)), t = estadoFaixa(faixa(d, 12, 17)), n = estadoFaixa(faixa(d, 18, 22));
  const partes = [m, t, n].filter(Boolean);
  if (partes.length === 0) return (d.prob ?? 0) >= 55 ? "chuva provável" : "sem chuva forte prevista";
  if (partes.every((x) => x === "seco")) return "seco o dia todo";
  if (partes.every((x) => x === "chuva")) return "chuva o dia todo";
  if (m === "chuva" && (t === "seco" || n === "seco")) return t === "seco" ? "ruim cedo, melhora à tarde" : "ruim cedo, melhora no fim da tarde";
  if (m === "seco" && (t === "chuva" || t === "instável")) return "bom de manhã, chuva à tarde";
  if (t === "seco" && n === "chuva") return "seco de dia, chuva à noite";
  if (partes.includes("instável")) return "instável, com abertas";
  return "chuva em parte do dia";
}

/** Melhor bloco seco (2h+) entre 7h e 21h, preferindo almoço e saída do trabalho. */
export function janelaDoDia(d: DiaClima): string | null {
  const ok = d.horas.filter((x) => x.hora >= 7 && x.hora <= 21);
  let melhor: { de: number; ate: number; pontos: number } | null = null;
  let ini = -1, pontos = 0;
  const peso = (hh: number) => (hh >= 11 && hh <= 14 ? 3 : hh >= 17 && hh <= 20 ? 3 : 1);
  ok.forEach((x, i) => {
    const seco = (x.chance ?? 0) < 30 && x.mm < 0.5;
    if (seco) { if (ini < 0) { ini = i; pontos = 0; } pontos += peso(x.hora); }
    const fecha = !seco || i === ok.length - 1;
    if (fecha && ini >= 0) {
      const fimI = seco ? i : i - 1;
      if (fimI - ini >= 1 && (!melhor || pontos > melhor.pontos)) melhor = { de: ok[ini]!.hora, ate: ok[fimI]!.hora, pontos };
      ini = -1;
    }
  });
  if (!melhor) return null;
  const m = melhor as { de: number; ate: number };
  const ate = Math.min(m.ate + 1, m.de + 4); // janela, não expediente
  return `${m.de}h–${ate}h`;
}

/** Resumo de VENDA em 2 palavras pro card do dia ("boa manhã", "dia de chuva"). */
export function resumoVenda(d: DiaClima): string {
  const j = janelaDoDia(d);
  if (!j) return (d.prob ?? 0) >= 55 ? "dia de chuva" : "dia fraco";
  const de = Number(j.split("h")[0]);
  const seco = resumoDia(d) === "seco o dia todo";
  if (seco) return "dia todo bom";
  return de < 12 ? "boa manhã" : de < 17 ? "boa tarde" : "boa noite";
}

export const nomeDia = (iso: string, i: number) =>
  i === 0 ? "Hoje" : i === 1 ? "Amanhã" : new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").replace(/^\w/, (l) => l.toUpperCase());

export { horasFortes };
