/* ============================================================
   O MASCOTE DA VANT (v3, 08/10/2026) — render 3D oficial enviado pelo Rick:
   capacete em forma da seta VANT com olhos amarelos, moletom preto, mochila
   e tênis preto/branco/amarelo. Arquivo: public/vant-mascote.webp (fundo
   recortado, brilho amarelo original preservado, 1080px de altura).
   Mostrado FIEL ao render (Rick, 08/10: "deixa igual estava antes"): sem
   filtro, sem tinta de clima por cima. Só flutua de leve; "reduzir
   movimento" desliga. O clima fica no fundo do card, não no mascote.
   ============================================================ */
export const MASCOTE_SRC = "/vant-mascote.webp";
const PROPORCAO = 596 / 1378; // largura / altura do recorte

export function VantPersonagem({ altura = 160, className }: { altura?: number; className?: string }) {
  const largura = Math.round(altura * PROPORCAO);
  return (
    <span aria-hidden className={`vant-mascote block ${className ?? ""}`} style={{ width: largura, height: altura, position: className?.includes("absolute") ? undefined : "relative" }}>
      <span className="absolute left-1/2 bottom-0 -translate-x-1/2 rounded-[50%] blur-md" style={{ width: largura * 1.1, height: altura * 0.05, background: "rgba(0,0,0,.55)" }} />
      <img src={MASCOTE_SRC} alt="" width={largura} height={altura} decoding="async" draggable={false}
        className="vm-corpo relative block select-none" style={{ width: largura, height: altura }} />
      <style>{`
        @keyframes vm-flutua { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        .vant-mascote .vm-corpo { animation: vm-flutua 3.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .vant-mascote .vm-corpo { animation: none !important; } }
      `}</style>
    </span>
  );
}
