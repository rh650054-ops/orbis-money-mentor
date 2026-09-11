/* ============================================================
   PICOS DO DIA — as horas que o vendedor não pode perder (Rick, 11/09).
   Junta três coisas que ninguém junta sozinho:
     1. o que os 6 modelos dizem de chuva naquela hora;
     2. sol e temperatura (calor demais esvazia a rua igual chuva);
     3. o histórico DELE: as horas em que ele mais vende de verdade.
   Sai uma nota por hora e as janelas boas emendadas viram "picos".
   Função pura de propósito: dá pra testar sem abrir o app.
   ============================================================ */
export interface HoraTempo { hora: number; iso: string; fontes: number; total: number; mm: number; temp: number | null; prob: number | null }
export interface PerfilHora { hora: number; vendas: number; blocos: number }
export interface Pico { de: number; ate: number; nota: number; etiquetas: string[]; seuPico: boolean }

/** Movimento típico de rua no Brasil: almoço e saída do trabalho são os cheios. */
function movimentoRua(h: number): number {
  if (h >= 11 && h <= 14) return 14;   // almoço
  if (h >= 17 && h <= 20) return 12;   // saída do trabalho
  if (h >= 7 && h <= 9) return 8;      // ida pro trabalho
  if (h >= 0 && h <= 5) return -45;    // madrugada: rua vazia e risco
  if (h >= 21) return -10;
  return 0;
}

export function notaDaHora(h: HoraTempo, topo: number[], medio: number[]): { nota: number; etiquetas: string[] } {
  const etiquetas: string[] = [];
  let nota = 50;

  // 1) chuva: quanto mais modelos concordam, mais pesa
  const chuva = h.total > 0 ? h.fontes / h.total : (h.prob ?? 0) / 100;
  nota -= chuva * 60;
  if (chuva <= 0.17) etiquetas.push("sem chuva");

  // 2) temperatura: tem faixa boa, e o calor extremo esvazia a rua igual chuva
  const t = h.temp;
  if (t != null) {
    if (t >= 18 && t <= 30) { nota += 10; if (t >= 22 && chuva <= 0.34) etiquetas.push("sol bom"); }
    else if (t > 34) { nota -= 14; }
    else if (t > 30) { nota -= 4; }
    else if (t < 12) { nota -= 10; }
  }

  // 3) movimento da rua
  const mov = movimentoRua(h.hora);
  nota += mov;
  if (mov >= 12) etiquetas.push("rua cheia");

  // 4) o histórico dele manda mais que qualquer palpite nosso
  if (topo.includes(h.hora)) { nota += 22; etiquetas.push("seu pico"); }
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
    const etiquetas = [...new Set(atual.flatMap((x) => x.etiquetas))];
    picos.push({
      de: atual[0]!.h.hora,
      ate: atual[atual.length - 1]!.h.hora,
      nota: Math.round(atual.reduce((s, x) => s + x.nota, 0) / atual.length),
      etiquetas: ["seu pico", "rua cheia", "sem chuva", "sol bom"].filter((e) => etiquetas.includes(e)),
      seuPico: atual.some((x) => x.etiquetas.includes("seu pico")),
    });
    atual = [];
  };
  for (const n of notas) {
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
  return { ...p, ate: p.de + 2 };
}

export const rotuloPico = (p: Pico) => (p.de === p.ate ? `${p.de}h` : `${p.de}h–${p.ate + 1}h`);
