/* ============================================================
   KIT DE MOVIMENTO DO ORBIS
   - useReducedMotion(): respeita "reduzir movimento" do celular
   - AnimatedNumber: número que CONTA até o valor (600ms)
   - AnimatedCurrency: idem, formatado em R$
   - FillBar: barra que enche na entrada
   - Ring: anel de progresso que enche na entrada
   - PageTransition: toda troca de tela desliza igual (250ms)
   Sem biblioteca externa — só React + CSS (orbis.css).
   ============================================================ */
import { ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { formatCurrency } from "@/shared/lib/utils";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return !!reduced;
}

/** Conta de 0 até `value` em ~600ms com a curva do Orbis (desacelera no fim). */
export function useCountUp(value: number, duration = 600): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const fromRef = useRef(0);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    if (reduced) { setShown(value); return; }
    const from = fromRef.current === 0 && shownRef.current !== 0 ? shownRef.current : fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic ~ curva do Orbis
      setShown(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, reduced]);

  return shown;
}

export function AnimatedNumber({ value, format, className }: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const n = useCountUp(value);
  return <span className={`orbis-num ${className ?? ""}`}>{format ? format(n) : Math.round(n).toString()}</span>;
}

export function AnimatedCurrency({ value, className }: { value: number; className?: string }) {
  return <AnimatedNumber value={value} format={(n) => formatCurrency(n)} className={className} />;
}

/** Barra que enche da esquerda na entrada. pct 0–100. */
export function FillBar({ pct, color, trackClassName, height = 6, glow = false }: {
  pct: number;
  color?: string;
  trackClassName?: string;
  height?: number;
  glow?: boolean;
}) {
  const reduced = useReducedMotion();
  const [w, setW] = useState(reduced ? pct : 0);
  useEffect(() => {
    if (reduced) { setW(pct); return; }
    const id = requestAnimationFrame(() => setW(pct));
    return () => cancelAnimationFrame(id);
  }, [pct, reduced]);
  return (
    <div className={`rounded-full overflow-hidden bg-white/10 ${trackClassName ?? ""}`} style={{ height }}>
      <div
        className="orbis-fill h-full rounded-full"
        style={{
          width: `${Math.min(100, Math.max(0, w))}%`,
          background: color ?? "linear-gradient(90deg, var(--orbis-gold-light), var(--orbis-gold))",
          boxShadow: glow ? "0 0 12px rgba(245,184,0,.5)" : undefined,
        }}
      />
    </div>
  );
}

/** Anel de progresso que enche na entrada. */
export function Ring({ pct, size = 80, stroke = 8, color = "var(--orbis-gold)", label }: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const target = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  const [off, setOff] = useState(reduced ? target : c);
  useEffect(() => {
    if (reduced) { setOff(target); return; }
    const id = requestAnimationFrame(() => setOff(target));
    return () => cancelAnimationFrame(id);
  }, [target, reduced]);
  return (
    <div style={{ width: size, height: size, position: "relative", flex: "none" }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,.08)" strokeWidth={stroke} fill="none" />
        <circle
          className="orbis-ring-arc"
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {label && (
        <div className="orbis-num" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
          {label}
        </div>
      )}
    </div>
  );
}

/**
 * Toda troca de tela anima IGUAL: a tela nova sobe com fade (250ms);
 * quando o usuário VOLTA (POP do histórico), desce. Envolver o {children}
 * do Layout:  <PageTransition>{children}</PageTransition>
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [cls, setCls] = useState("orbis-page-enter");
  const lastKey = useRef(location.key);
  useEffect(() => {
    if (location.key === lastKey.current) return;
    lastKey.current = location.key;
    // navigationType não está disponível aqui sem hook extra; POP = voltar
    const isBack = (window.history.state?.idx ?? 0) < (PageTransition as any)._idx;
    (PageTransition as any)._idx = window.history.state?.idx ?? 0;
    setCls("");
    requestAnimationFrame(() => setCls(isBack ? "orbis-page-back" : "orbis-page-enter"));
  }, [location.key]);
  useEffect(() => { (PageTransition as any)._idx = window.history.state?.idx ?? 0; }, []);
  return <div key={location.pathname} className={cls}>{children}</div>;
}
