/* ============================================================
   SELO DE VERIFICADO — a medalha do Orbis (Rick, 09/09/2026).
   Desenhada em SVG por código: 32 pontas onduladas, gradiente do azul claro
   ao azul profundo, anel interno, brilho no topo e sombra colorida embaixo.
   Vetor puro: fica nítido em qualquer tamanho e não pesa nada.
   ============================================================ */
import { useId, useMemo } from "react";

/** caminho da roseta (borda ondulada da medalha) */
function caminhoRoseta(pontas = 32, R = 50, r = 45.5, c = 56) {
  let d = "";
  for (let i = 0; i < pontas; i++) {
    const a = (i / pontas) * Math.PI * 2 - Math.PI / 2;
    const meio = ((i + 0.5) / pontas) * Math.PI * 2 - Math.PI / 2;
    const prox = ((i + 1) / pontas) * Math.PI * 2 - Math.PI / 2;
    if (i === 0) d += `M ${(c + Math.cos(a) * R).toFixed(2)} ${(c + Math.sin(a) * R).toFixed(2)}`;
    d += ` Q ${(c + Math.cos(meio) * r).toFixed(2)} ${(c + Math.sin(meio) * r).toFixed(2)} ${(c + Math.cos(prox) * R).toFixed(2)} ${(c + Math.sin(prox) * R).toFixed(2)}`;
  }
  return d + " Z";
}

export function Selo({ size = 96, cinza = false, className, style }: { size?: number; cinza?: boolean; className?: string; style?: React.CSSProperties }) {
  const id = useId().replace(/:/g, "");
  const d = useMemo(() => caminhoRoseta(), []);
  const claro = cinza ? "#6a7480" : "#8FD8FF";
  const meio = cinza ? "#454e57" : "#3FA9FF";
  const escuro = cinza ? "#272c32" : "#0F5FBF";
  return (
    <svg width={size} height={size} viewBox="0 0 112 112" className={className} style={{ display: "block", ...style }} aria-hidden>
      <defs>
        <radialGradient id={`g${id}`} cx="50%" cy="28%" r="78%">
          <stop offset="0" stopColor={claro} /><stop offset="42%" stopColor={meio} /><stop offset="100%" stopColor={escuro} />
        </radialGradient>
        <linearGradient id={`r${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#BFE8FF" stopOpacity={cinza ? ".4" : ".95"} />
          <stop offset="100%" stopColor={escuro} stopOpacity=".2" />
        </linearGradient>
        <filter id={`s${id}`} x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="6" stdDeviation="9" floodColor={escuro} floodOpacity={cinza ? ".3" : ".55"} />
        </filter>
      </defs>
      <path d={d} fill={`url(#g${id})`} filter={`url(#s${id})`} />
      <path d={d} fill="none" stroke={`url(#r${id})`} strokeWidth="1.6" />
      <circle cx="56" cy="56" r="38.5" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth="1.4" />
      <path d="M40 57.5 L51 68 L73 45" fill="none" stroke="#fff" strokeWidth="8.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity=".22" />
      <path d="M40 57.5 L51 68 L73 45" fill="none" stroke="#fff" strokeWidth="6.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 40 A38 38 0 0 1 74 24" fill="none" stroke="#fff" strokeOpacity=".38" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** raios de luz atrás do selo */
export function Raios({ className }: { className?: string }) {
  return (
    <span aria-hidden className={`absolute pointer-events-none ${className ?? ""}`} style={{
      left: "50%", top: -120, width: 520, height: 520, marginLeft: -260,
      background: "conic-gradient(from 200deg, transparent 0 18deg, rgba(63,169,255,.10) 18deg 24deg, transparent 24deg 46deg, rgba(63,169,255,.07) 46deg 52deg, transparent 52deg 74deg, rgba(63,169,255,.10) 74deg 80deg, transparent 80deg 110deg, rgba(63,169,255,.06) 110deg 116deg, transparent 116deg 360deg)",
    }} />
  );
}

/** grão fino: tira o "plástico" do preto chapado */
export function Grao() {
  return (
    <span aria-hidden className="absolute inset-0 pointer-events-none" style={{
      opacity: 0.5,
      backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='.035'/%3E%3C/svg%3E\")",
    }} />
  );
}

/** logo quadrada da carteira */
export function LogoCarteira({ sigla, fundo, cor, size = 44 }: { sigla: string; fundo: string; cor: string; size?: number }) {
  return (
    <span className="inline-flex items-center justify-center shrink-0 font-black"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.31), background: fundo, color: cor, fontSize: Math.max(9, Math.round(size * 0.28)), letterSpacing: "-.03em", boxShadow: "inset 0 1px 0 rgba(255,255,255,.28), 0 6px 16px rgba(0,0,0,.5)" }}>
      {sigla}
    </span>
  );
}

/** as carteiras que existem e as que estão na fila */
export interface Carteira { id: string; nome: string; sigla: string; fundo: string; cor: string; linha: string; fn?: string }
export const CARTEIRAS: Carteira[] = [
  { id: "mercadopago", nome: "Mercado Pago", sigla: "MP", fundo: "linear-gradient(180deg,#33C6F2,#00A5DB)", cor: "#012", linha: "Pix, QR e maquininha Point", fn: "mp-connect" },
  { id: "pagbank", nome: "PagBank", sigla: "PB", fundo: "linear-gradient(180deg,#5FE3A8,#2FC57E)", cor: "#032", linha: "Pix e maquininha", fn: "pb-connect" },
  { id: "infinitepay", nome: "InfinitePay", sigla: "IP", fundo: "#131316", cor: "#7b766e", linha: "em breve" },
  { id: "sumup", nome: "SumUp", sigla: "SU", fundo: "#131316", cor: "#7b766e", linha: "em breve" },
  { id: "picpay", nome: "PicPay", sigla: "PP", fundo: "#131316", cor: "#7b766e", linha: "em breve" },
];
