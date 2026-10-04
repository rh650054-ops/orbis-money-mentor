/* ============================================================
   GAVETA — a folha de baixo do app (04/10/2026, Mohamed).
   "Não conseguia sair dessa tela puxando pra baixo": as gavetas tinham a
   alcinha desenhada, mas era só enfeite (o Radix Sheet não arrasta) e o X
   estava escondido. Aqui a alça é de verdade: puxa pra baixo e fecha. E tem
   um X visível no canto, pra quem não sabe do gesto.
   O arrasto só começa com a gaveta rolada até o topo, pra não brigar com a
   rolagem do conteúdo.
   ============================================================ */
import { useRef } from "react";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { cn } from "@/shared/lib/utils";

const FECHA_EM = 90;      // px puxados pra fechar
const RAPIDO = 0.6;       // px/ms: um "peteleco" pra baixo também fecha

interface GavetaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** lido pelo leitor de tela */
  titulo: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function Gaveta({ open, onOpenChange, titulo, className, style, children }: GavetaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const toque = useRef<{ y: number; t: number; dy: number; ativo: boolean } | null>(null);

  const mover = (dy: number, animar: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = animar ? "transform .22s ease-out" : "none";
    el.style.transform = dy > 0 ? `translateY(${dy}px)` : "";
  };

  const inicio = (e: React.TouchEvent) => {
    const y = e.touches[0]?.clientY;
    if (y == null) return;
    toque.current = { y, t: Date.now(), dy: 0, ativo: (ref.current?.scrollTop ?? 0) <= 0 };
  };
  const meio = (e: React.TouchEvent) => {
    const tq = toque.current;
    const y = e.touches[0]?.clientY;
    if (!tq || !tq.ativo || y == null) return;
    const dy = y - tq.y;
    if (dy <= 0) { if (tq.dy > 0) { tq.dy = 0; mover(0, false); } return; }
    tq.dy = dy;
    mover(dy, false);
  };
  const fim = () => {
    const tq = toque.current;
    toque.current = null;
    if (!tq || tq.dy <= 0) return;
    const vel = tq.dy / Math.max(1, Date.now() - tq.t);
    if (tq.dy > FECHA_EM || vel > RAPIDO) {
      mover(0, false);
      onOpenChange(false);
    } else {
      mover(0, true);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={ref}
        side="bottom"
        className={cn("rounded-t-[24px] border-t p-0 max-h-[92vh] overflow-y-auto overscroll-contain [&>button]:hidden", className)}
        style={style}
        onTouchStart={inicio}
        onTouchMove={meio}
        onTouchEnd={fim}
        onTouchCancel={fim}
      >
        <SheetTitle className="sr-only">{titulo}</SheetTitle>
        <div className="sticky top-0 z-10 h-7 flex items-start justify-center pt-2.5" style={{ background: "inherit" }}>
          <span aria-hidden className="block w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,.22)" }} />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className="absolute right-3 top-2 w-8 h-8 rounded-full flex items-center justify-center active:scale-95"
            style={{ background: "rgba(255,255,255,.07)", color: "#b9b3a6" }}
          >
            <X className="w-4 h-4" strokeWidth={2.4} />
          </button>
        </div>
        {children}
      </SheetContent>
    </Sheet>
  );
}
