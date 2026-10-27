/* "Lendo seu corre": HUD with a scan line; the 4 sources come online one by one.
   The last one only completes when `pronto`, so the wait reads as analysis. */
import { useEffect, useState } from "react";
import { Check, Landmark, Package, Smartphone, TriangleAlert, type LucideIcon } from "lucide-react";
import { COR } from "./ui";

const PASSOS: Array<{ icon: LucideIcon; titulo: string; texto: string }> = [
  { icon: Landmark, titulo: "Banco · Open Finance", texto: "saídas do corre, 60 dias" },
  { icon: Smartphone, titulo: "Vendas no app", texto: "ritmo, recorde, dias fortes" },
  { icon: TriangleAlert, titulo: "Calotes", texto: "vendido e não recebido" },
  { icon: Package, titulo: "Custo por produto", texto: "receita + calote médio" },
];

export function LendoCorre({ pronto, nome }: { pronto: boolean; nome?: string | null }) {
  const [feitos, setFeitos] = useState(0);
  useEffect(() => {
    if (feitos >= PASSOS.length - 1) return;
    const t = window.setTimeout(() => setFeitos((n) => n + 1), 900);
    return () => window.clearTimeout(t);
  }, [feitos]);
  const concluidos = pronto ? PASSOS.length : feitos;
  const pct = Math.round((concluidos / PASSOS.length) * 100);

  return (
    <section className="vant-hud mt-5 rounded-[22px] p-5 overflow-hidden" aria-live="polite" style={{ border: "1px solid rgba(245,184,0,.35)" }}>
      <span className="vant-canto" />
      <span className="vant-scan" />
      <p className="orbis-section inline-flex items-center gap-2" style={{ color: COR.ouro }}>
        <span className="vant-blink w-1.5 h-1.5 rounded-full" style={{ background: COR.ouro, boxShadow: `0 0 8px ${COR.ouro}` }} /> Vant · análise em curso
      </p>
      <div className="flex items-end justify-between gap-3 mt-2">
        <p className="vant-missao-num text-[30px] leading-none text-foreground">Lendo {nome ? `o corre do ${nome}` : "seu corre"}</p>
        <p className="vant-missao-num text-[34px] leading-none" style={{ color: COR.ouro }}>{pct}%</p>
      </div>
      <ul className="mt-5 flex flex-col gap-2">
        {PASSOS.map((p, i) => {
          const ok = i < concluidos;
          const agora = i === concluidos;
          const Icon = p.icon;
          return (
            <li key={p.titulo} className="flex items-center gap-3 rounded-[12px] px-3 py-2 transition-all duration-300"
              style={{ opacity: ok || agora ? 1 : 0.35, background: agora ? "rgba(245,184,0,.08)" : "transparent", border: `1px solid ${agora ? "rgba(245,184,0,.35)" : "transparent"}` }}>
              <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: ok ? "rgba(61,214,140,.15)" : "rgba(255,255,255,.05)", border: `1px solid ${ok ? "rgba(61,214,140,.45)" : COR.linha}` }}>
                {ok ? <Check className="w-4 h-4" style={{ color: COR.verde }} strokeWidth={3} />
                  : <Icon className={`w-4 h-4 ${agora ? "animate-pulse" : ""}`} style={{ color: agora ? COR.ouro : COR.mute }} strokeWidth={2.2} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-extrabold" style={{ color: COR.texto }}>{p.titulo}</span>
                <span className="block text-[11.5px]" style={{ color: COR.sub }}>{agora && !ok ? "lendo…" : p.texto}</span>
              </span>
              <span className="orbis-num text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: ok ? COR.verde : agora ? COR.ouro : COR.mute }}>{ok ? "ok" : agora ? "···" : "fila"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
