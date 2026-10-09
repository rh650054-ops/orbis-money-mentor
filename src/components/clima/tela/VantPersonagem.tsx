/* ============================================================
   O MASCOTE DA VANT (v3, 08/10/2026) — render 3D oficial enviado pelo Rick:
   capacete em forma da seta VANT com olhos amarelos, moletom preto, mochila
   e tênis preto/branco/amarelo. Arquivo: public/vant-mascote.webp (fundo
   recortado, 720px de altura, ~60 KB).
   O render é um só; o clima entra como LUZ e EFEITO em volta dele:
   • sol/calor → halo dourado;  • chuva/tempestade → luz fria + gotas na frente;
   • frio → contorno azul gelo; • noite → mais escuro, os olhos seguem acesos.
   Flutua de leve; "reduzir movimento" desliga.
   ============================================================ */
import type { Estado } from "@/components/clima/ClimaTipos";

export const MASCOTE_SRC = "/vant-mascote.webp";
const PROPORCAO = 595 / 1359; // largura / altura do recorte

const LUZ: Record<Estado, { halo: string; filtro: string }> = {
  sol: { halo: "rgba(245,184,0,.30)", filtro: "drop-shadow(0 6px 14px rgba(0,0,0,.45))" },
  calor: { halo: "rgba(255,140,40,.30)", filtro: "drop-shadow(0 6px 14px rgba(0,0,0,.45))" },
  nublado: { halo: "rgba(245,184,0,.14)", filtro: "drop-shadow(0 6px 14px rgba(0,0,0,.5))" },
  chuva: { halo: "rgba(91,155,255,.26)", filtro: "brightness(.9) drop-shadow(0 0 10px rgba(91,155,255,.35))" },
  tempestade: { halo: "rgba(150,110,255,.26)", filtro: "brightness(.82) drop-shadow(0 0 12px rgba(150,110,255,.4))" },
  frio: { halo: "rgba(150,210,255,.24)", filtro: "drop-shadow(0 0 10px rgba(150,210,255,.35))" },
  noite: { halo: "rgba(245,184,0,.16)", filtro: "brightness(.78) drop-shadow(0 6px 14px rgba(0,0,0,.55))" },
};

const GOTAS = [12, 30, 52, 70, 88].map((x, i) => ({ x, d: 0.75 + (i % 3) * 0.18, a: -i * 0.27 }));

export function VantPersonagem({ estado, altura = 160, className }: { estado: Estado; altura?: number; className?: string }) {
  const largura = Math.round(altura * PROPORCAO);
  const luz = LUZ[estado];
  const chovendo = estado === "chuva" || estado === "tempestade";
  return (
    <span aria-hidden className={`vant-mascote block ${className ?? ""}`} style={{ width: largura, height: altura, position: className?.includes("absolute") ? undefined : "relative" }}>
      <span className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl" style={{ width: largura * 1.6, height: largura * 1.6, background: luz.halo }} />
      <span className="absolute left-1/2 bottom-0 -translate-x-1/2 rounded-[50%] blur-md" style={{ width: largura * 1.1, height: altura * 0.05, background: "rgba(0,0,0,.55)" }} />
      <img src={MASCOTE_SRC} alt="" width={largura} height={altura} decoding="async" draggable={false}
        className="vm-corpo relative block select-none" style={{ width: largura, height: altura, filter: luz.filtro }} />
      {chovendo && GOTAS.map((g, i) => (
        <i key={i} className="vm-gota absolute top-0 w-px rounded-full" style={{ left: `${g.x}%`, height: altura * 0.09, background: "linear-gradient(transparent, rgba(156,196,255,.8))", animation: `vm-gota ${g.d}s linear ${g.a}s infinite` }} />
      ))}
      <style>{`
        @keyframes vm-flutua { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        @keyframes vm-gota { 0% { transform: translateY(-10%); opacity: 0 } 20% { opacity: .9 } 100% { transform: translateY(${Math.round(altura * 0.9)}px); opacity: 0 } }
        .vant-mascote .vm-corpo { animation: vm-flutua 3.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .vant-mascote .vm-corpo, .vant-mascote .vm-gota { animation: none !important; } .vant-mascote .vm-gota { display: none; } }
      `}</style>
    </span>
  );
}
