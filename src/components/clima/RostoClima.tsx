/* ============================================================
   ROSTO DO ORBIS POR CLIMA — só no chip da Home (Rick, 11/09).
   O corpo, o boné e o capuz continuam sendo a foto. Só a CARA é
   desenhada por cima, no lugar exato do círculo branco de cada
   imagem (posição medida em pixels), pra ela mudar de expressão:
   calor = derretendo com a língua de fora, frio = tremendo com os
   dentes batendo, tempestade = assustado, chuva = olhando o céu.
   ============================================================ */
import type { Estado } from "./ClimaCena";
import "@/styles/clima.css";

/* Centro e raio do círculo do rosto DENTRO de cada foto (imagem de 360 px de largura). */
const ROSTO = {
  calor: { cx: 197, cy: 133.5, r: 69 },
  frio: { cx: 182.5, cy: 132.5, r: 67 },
  chuva: { cx: 187.5, cy: 140, r: 67 },
  noite: { cx: 186.5, cy: 142, r: 63 },
} as const;
export type Foto = keyof typeof ROSTO;

/* Como o chip desenha a foto: 64 px de largura, deslocada, num círculo de 32 px. */
const ESCALA = 64 / 360, OFF_X = -24, OFF_Y = -7, CAIXA = 32;

const BRANCO = "#ffffff", LINGUA = "#ff4d5e", GELO = "#8fd8ff";

/* Traço dos olhos/boca: tudo desenhado num sistema em que o rosto tem raio 100. */
const traco = { fill: "none", stroke: BRANCO, strokeWidth: 11, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function OlhoAberto({ x, y, rx = 14, ry = 18 }: { x: number; y: number; rx?: number; ry?: number }) {
  return <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={BRANCO} />;
}
/* olho fechado "feliz" (arco pra cima) — é o olho da piscadinha original */
function OlhoFeliz({ x, y = -18 }: { x: number; y?: number }) {
  return <path d={`M ${x - 18} ${y} Q ${x} ${y - 24} ${x + 18} ${y}`} {...traco} />;
}
/* olho caído (cansado do calor) */
function OlhoCaido({ x, y = -24 }: { x: number; y?: number }) {
  return <path d={`M ${x - 18} ${y} Q ${x} ${y + 22} ${x + 18} ${y}`} {...traco} />;
}
/* olho espremido ">< " (frio) */
function OlhoEspremido({ x, lado }: { x: number; lado: 1 | -1 }) {
  return <path d={`M ${x - 16 * lado} -34 L ${x + 14 * lado} -19 L ${x - 16 * lado} -4`} {...traco} />;
}
/* sorriso com a língua vermelha — a marca registrada da carinha */
function BocaSorriso({ y = 28, largura = 26, lingua = true }: { y?: number; largura?: number; lingua?: boolean }) {
  return (
    <>
      {lingua && <ellipse cx={2} cy={y + 16} rx={15} ry={12} fill={LINGUA} />}
      <path d={`M ${-largura} ${y} Q 0 ${y + 26} ${largura} ${y}`} {...traco} />
    </>
  );
}

function Cara({ estado }: { estado: Estado }) {
  switch (estado) {
    case "calor": // derretendo: olhos caídos, língua de fora e a gota de suor
      return (
        <>
          <OlhoCaido x={-38} />
          <OlhoCaido x={38} />
          <path d="M -28 20 Q 0 30 28 20" {...traco} />
          <ellipse cx={2} cy={44} rx={16} ry={18} fill={LINGUA} />
          <path className="cl-rosto-suor" d="M 52 -56 q -15 20 -15 28 a 15 15 0 0 0 30 0 q 0 -8 -15 -28 z" fill={GELO} stroke="#0b0b0b" strokeWidth={4} />
        </>
      );
    case "frio": // tremendo: olhos espremidos e os dentes batendo
      return (
        <>
          <OlhoEspremido x={-38} lado={1} />
          <OlhoEspremido x={38} lado={-1} />
          <rect x={-26} y={22} width={52} height={30} rx={12} fill={BRANCO} />
          <rect x={-26} y={34} width={52} height={7} fill="#0b0b0b" />
        </>
      );
    case "tempestade": // assustado: olhos arregalados e a boca em "o"
      return (
        <>
          <OlhoAberto x={-38} y={-22} rx={17} ry={21} />
          <OlhoAberto x={38} y={-22} rx={17} ry={21} />
          <ellipse cx={0} cy={34} rx={13} ry={16} fill={LINGUA} />
        </>
      );
    case "chuva": // olhando o céu, sem graça
      return (
        <>
          <OlhoAberto x={-38} y={-30} rx={13} ry={16} />
          <OlhoAberto x={38} y={-30} rx={13} ry={16} />
          <path d="M -24 36 Q 0 24 24 36" {...traco} />
        </>
      );
    case "nublado": // tranquilo
      return (
        <>
          <OlhoAberto x={-38} y={-20} />
          <OlhoAberto x={38} y={-20} />
          <BocaSorriso y={26} largura={22} lingua={false} />
        </>
      );
    case "noite": // com sono
      return (
        <>
          <OlhoCaido x={-38} y={-20} />
          <OlhoCaido x={38} y={-20} />
          <path d="M -18 32 Q 0 42 18 32" {...traco} />
        </>
      );
    default: // sol: a piscadinha de sempre, dia de ralar
      return (
        <>
          <OlhoFeliz x={-38} />
          <OlhoAberto x={38} y={-20} />
          <BocaSorriso />
        </>
      );
  }
}

export function RostoClima({ estado, foto }: { estado: Estado; foto: Foto }) {
  const g = ROSTO[foto];
  const cx = g.cx * ESCALA + OFF_X, cy = g.cy * ESCALA + OFF_Y, r = g.r * ESCALA;
  return (
    <svg
      viewBox={`0 0 ${CAIXA} ${CAIXA}`} width={CAIXA} height={CAIXA} aria-hidden
      className={`absolute inset-0 pointer-events-none${estado === "frio" ? " cl-rosto-tremor" : ""}`}
      style={{ filter: "drop-shadow(0 0 2px rgba(255,255,255,.45))" }}
    >
      <g transform={`translate(${cx} ${cy}) scale(${r / 100})`}>
        {/* disco um pouco maior que o rosto da foto, pra cobrir a carinha antiga */}
        <circle r={106} fill="#0b0b0b" />
        {estado === "frio" && <circle r={100} fill={GELO} opacity=".2" />}
        <circle r={87} fill="none" stroke={BRANCO} strokeWidth={26} />
        <Cara estado={estado} />
      </g>
    </svg>
  );
}
