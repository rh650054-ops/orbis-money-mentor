/* "A Vant tá lendo seu corre": the 4 sources light up one by one while the AI works.
   The last one only completes when `pronto` — so the wait feels like reading, not a spinner. */
import { useEffect, useState } from "react";
import { Check, Landmark, Package, Smartphone, TriangleAlert, type LucideIcon } from "lucide-react";
import { COR } from "./ui";

const PASSOS: Array<{ icon: LucideIcon; titulo: string; texto: string }> = [
  { icon: Landmark, titulo: "Seu banco", texto: "saídas do corre nos últimos 60 dias" },
  { icon: Smartphone, titulo: "Suas vendas no app", texto: "unidades, ritmo e recorde" },
  { icon: TriangleAlert, titulo: "Calotes", texto: "o que vendeu e não recebeu" },
  { icon: Package, titulo: "Custo por produto", texto: "receita × o que saiu do banco" },
];

export function LendoCorre({ pronto }: { pronto: boolean }) {
  const [feitos, setFeitos] = useState(0);
  useEffect(() => {
    if (feitos >= PASSOS.length - 1) return;
    const t = window.setTimeout(() => setFeitos((n) => n + 1), 900);
    return () => window.clearTimeout(t);
  }, [feitos]);
  const concluidos = pronto ? PASSOS.length : feitos;

  return (
    <section className="mt-5 rounded-[22px] p-5 relative overflow-hidden" aria-live="polite"
      style={{ background: "radial-gradient(120% 90% at 50% 0%, rgba(245,184,0,.16), #0e0e10 55%)", border: "1px solid rgba(245,184,0,.3)" }}>
      <p className="orbis-section" style={{ color: COR.ouro }}>Vant analisando</p>
      <p className="text-[20px] font-black tracking-tight mt-1 text-foreground">Lendo seu corre…</p>
      <ul className="mt-4 flex flex-col gap-2.5">
        {PASSOS.map((p, i) => {
          const ok = i < concluidos;
          const agora = i === concluidos;
          const Icon = p.icon;
          return (
            <li key={p.titulo} className="flex items-center gap-3 transition-opacity duration-300" style={{ opacity: ok || agora ? 1 : 0.35 }}>
              <span className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0 transition-colors duration-300"
                style={{ background: ok ? "rgba(61,214,140,.15)" : "rgba(255,255,255,.06)", border: `1px solid ${ok ? "rgba(61,214,140,.45)" : agora ? "rgba(245,184,0,.5)" : COR.linha}` }}>
                {ok ? <Check className="w-4 h-4" style={{ color: COR.verde }} strokeWidth={3} />
                  : <Icon className={`w-4 h-4 ${agora ? "animate-pulse" : ""}`} style={{ color: agora ? COR.ouro : COR.mute }} strokeWidth={2.2} />}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-extrabold" style={{ color: COR.texto }}>{p.titulo}</span>
                <span className="block text-[12px]" style={{ color: COR.sub }}>{agora && !ok ? "lendo…" : p.texto}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(concluidos / PASSOS.length) * 100}%`, background: `linear-gradient(90deg,${COR.ouro},#FFC63A)` }} />
      </div>
    </section>
  );
}
