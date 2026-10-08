/* ============================================================
   PICOS DO DIA — as horas que o vendedor não pode perder (Rick, 11/09).
   Junta três coisas que ninguém junta sozinho:
     1. o que os 6 modelos dizem de chuva naquela hora;
     2. sol e temperatura (calor demais esvazia a rua igual chuva);
     3. o histórico DELE: as horas em que ele mais vende de verdade.
   Sai uma nota por hora e as janelas boas emendadas viram "picos".
   Função pura de propósito: dá pra testar sem abrir o app.
   ============================================================ */
export interface HoraTempo { hora: number; iso: string; fontes: number; total: number; mm: number; temp: number | null; prob: number | null; codigo?: number | null; chance?: number }
export interface PerfilHora { hora: number; vendas: number; blocos: number }
export interface Pico { de: number; ate: number; nota: number; etiquetas: string[]; seuPico: boolean; iso: string; isos: string[] }

/** Movimento típico de rua no Brasil: almoço e saída do trabalho são os cheios. */
function movimentoRua(h: number): number {
  if (h >= 11 && h <= 14) return 14;   // almoço
  if (h >= 17 && h <= 20) return 12;   // saída do trabalho
  if (h >= 7 && h <= 9) return 8;      // ida pro trabalho
  if (h >= 0 && h <= 5) return -45;    // madrugada: rua vazia e risco
  if (h >= 21) return -10;
  return 0;
}

/* 08/10: os MOTIVOS têm que bater com o dado. Antes "sol bom" aparecia só pela
   temperatura, mesmo com o céu fechado o dia todo. Agora:
   • "sem chuva"            → chance < 20%;
   • "céu aberto"           → código do tempo de céu limpo/poucas nuvens, de dia;
   • "temperatura agradável"→ 18° a 28°;
   • "movimento bom"        → almoço ou saída do trabalho;
   • "seu horário forte"    → uma das 3 horas em que ELE mais vende. */
export const MOTIVOS = ["seu horário forte", "sem chuva", "movimento bom", "céu aberto", "temperatura agradável"] as const;

export function notaDaHora(h: HoraTempo, topo: number[], medio: number[]): { nota: number; etiquetas: string[] } {
  const etiquetas: string[] = [];
  let nota = 50;

  // 1) chuva: chance ponderada pelos modelos (ou a fração de modelos, no cache antigo)
  const chuva = (h.chance ?? (h.total > 0 ? (h.fontes / h.total) * 100 : h.prob ?? 0)) / 100;
  nota -= chuva * 60;
  if (chuva < 0.2) etiquetas.push("sem chuva");
  if (h.codigo != null && h.codigo <= 1 && h.hora >= 7 && h.hora <= 17 && chuva < 0.3) etiquetas.push("céu aberto");

  // 2) temperatura: tem faixa boa, e o calor extremo esvazia a rua igual chuva
  const t = h.temp;
  if (t != null) {
    if (t >= 18 && t <= 30) { nota += 10; if (t <= 28) etiquetas.push("temperatura agradável"); }
    else if (t > 34) { nota -= 14; }
    else if (t > 30) { nota -= 4; }
    else if (t < 12) { nota -= 10; }
  }

  // 3) movimento da rua
  const mov = movimentoRua(h.hora);
  nota += mov;
  if (mov >= 12) etiquetas.push("movimento bom");

  // 4) o histórico dele manda mais que qualquer palpite nosso
  if (topo.includes(h.hora)) { nota += 22; etiquetas.push("seu horário forte"); }
  else if (medio.includes(h.hora)) nota += 10;

  return { nota: Math.max(0, Math.min(100, Math.round(nota))), etiquetas };
}

/** As horas em que ele mais vende (top 3) e as boas (4ª a 6ª). */
export function horasFortes(perfil: PerfilHora[]): { topo: number[]; medio: number[] } {
  const bons = perfil.filter((p) => p.blocos >= 2).sort((a, b) => b.vendas / b.blocos - a.vendas / a.blocos);
  return { topo: bons.slice(0, 3).map((p) => p.hora), medio: bons.slice(3, 6).map((p) => p.hora) };
}

/**
 * Junta as horas boas que estão emendadas e devolve no máximo 3 picos,
 * do melhor pro pior. `corte` é a nota mínima pra hora entrar num pico.
 */
export function calcularPicos(horas: HoraTempo[], perfil: PerfilHora[], corte = 62): Pico[] {
  const { topo, medio } = horasFortes(perfil);
  const notas = horas.map((h) => ({ h, ...notaDaHora(h, topo, medio) }));
  const picos: Pico[] = [];
  let atual: typeof notas = [];
  const fecha = () => {
    if (atual.length === 0) return;
    // um motivo só vale pra janela se vale pra MAIORIA das horas dela
    const conta = (e: string) => atual.filter((x) => x.etiquetas.includes(e)).length;
    picos.push({
      de: atual[0]!.h.hora,
      ate: atual[atual.length - 1]!.h.hora,
      nota: Math.round(atual.reduce((s, x) => s + x.nota, 0) / atual.length),
      etiquetas: MOTIVOS.filter((e) => (e === "seu horário forte" ? conta(e) > 0 : conta(e) * 2 > atual.length)),
      seuPico: atual.some((x) => x.etiquetas.includes("seu horário forte")),
      iso: atual[0]!.h.iso,
      isos: atual.map((x) => x.h.iso),
    });
    atual = [];
  };
  for (const n of notas) {
    const virouDia = atual.length > 0 && atual[atual.length - 1]!.h.iso.slice(0, 10) !== n.h.iso.slice(0, 10);
    if (virouDia) fecha();
    if (n.nota >= corte) atual.push(n);
    else fecha();
  }
  fecha();
  return picos.sort((a, b) => b.nota - a.nota || a.de - b.de).slice(0, 3);
}

/**
 * O que a tela usa. Começa exigente (só hora muito boa vira pico) e vai
 * afrouxando: num dia ruim ainda mostra a MENOS ruim, em vez de não mostrar
 * nada. Em dia de tempestade ou de madrugada volta vazio mesmo — e aí a tela
 * fala de descansar, que é o certo.
 */
export function melhoresPicos(horas: HoraTempo[], perfil: PerfilHora[]): Pico[] {
  for (const corte of [76, 68, 60]) {
    const p = calcularPicos(horas, perfil, corte);
    if (p.length > 0) return p.map(encurta);
  }
  return [];
}

/** Janela de 6 horas não é pico, é expediente: corta em 3 h no melhor pedaço. */
function encurta(p: Pico): Pico {
  const dur = p.ate - p.de;
  if (dur <= 2) return p;
  return { ...p, ate: p.de + 2, isos: p.isos.slice(0, 3) };
}

export const rotuloPico = (p: Pico) => (p.de === p.ate ? `${p.de}h` : `${p.de}h–${p.ate + 1}h`);


/* ============================================================
   NOME DE CIDADE QUE CABE NA TELA (Rick, 11/09)
   O serviço de geolocalização devolve coisas como "Região Metropolitana de
   São Paulo" — que empurrava o "6 fontes" pra fora do celular. Aqui vira
   "São Paulo".
   ============================================================ */
const PREFIXOS = /^(regi(ã|a)o\s+(metropolitana|geogr(á|a)fica\s+(imediata|intermedi(á|a)ria)|administrativa)\s+d[eoa]s?|microrregi(ã|a)o\s+d[eoa]s?|mesorregi(ã|a)o\s+d[eoa]s?|munic(í|i)pio\s+d[eoa]s?|cidade\s+d[eoa]s?|distrito\s+d[eoa]s?)\s+/i;

export function cidadeCurta(nome: string, uf?: string, max = 22): string {
  let c = (nome || "").trim();
  let antes = "";
  while (c !== antes) { antes = c; c = c.replace(PREFIXOS, "").trim(); }
  if (!c) return ""; // sem nome: a tela mostra "sua região"
  if (c.length > max) c = `${c.slice(0, max - 1).trim()}…`;
  return uf ? `${c}, ${uf}` : c;
}
