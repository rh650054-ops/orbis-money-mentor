/* One bar per day of the challenge: profit of each day against the plan's target for that day,
   today pulsing, future days as the plan (work day = faint gold, day off = empty). */
import type { Desafio } from "../types";
import { COR } from "./ui";

export function FaixaDias({ d }: { d: Desafio }) {
  const porDia = new Map(d.dias.map((x) => [x.dia, x.lucro]));
  const plano = new Map(d.plano.map((x) => [x.d, x]));
  const alvoMedio = d.alvo / Math.max(1, d.dias_trabalho);
  const n = Math.min(60, d.dias_periodo);
  const inicio = new Date(d.inicio + "T12:00:00");
  return (
    <div className="mt-3">
      <div className="flex items-end gap-[3px] h-9">
        {Array.from({ length: n }, (_, i) => {
          const dt = new Date(inicio); dt.setDate(dt.getDate() + i);
          const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
          const lucro = porDia.get(key);
          const p = plano.get(key);
          const alvoDia = p ? p.u * d.lucro_unid : alvoMedio;
          const hoje = i + 1 === d.dia_atual;
          const futuro = i + 1 > d.dia_atual;
          const folga = p ? !p.t : false;
          const hPlano = Math.max(4, Math.min(36, (alvoDia / Math.max(1, alvoMedio)) * 16));
          const h = lucro === undefined ? (futuro && p ? hPlano : 4) : Math.max(6, Math.min(36, (lucro / Math.max(1, alvoDia)) * 24));
          const cor = futuro ? (folga ? "rgba(255,255,255,.04)" : "rgba(245,184,0,.22)") : lucro === undefined ? (folga ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.16)") : lucro >= alvoDia * 0.95 ? COR.verde : COR.ouro;
          return (
            <span key={key} className={`flex-1 rounded-[3px] ${hoje && lucro === undefined ? "animate-pulse" : ""}`}
              style={{ height: h, background: cor, outline: hoje ? `1.5px solid ${COR.texto}` : undefined, outlineOffset: 1 }}
              title={`${dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}${p ? (p.t ? ` · plano ${p.u}` : " · folga") : ""}${lucro !== undefined ? ` · R$ ${lucro.toFixed(0)}` : ""}`} />
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[10px] font-bold" style={{ color: COR.mute }}>
        <span>{inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
        <span>hoje · dia {d.dia_atual}</span>
        <span>{new Date(d.fim + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
      </div>
    </div>
  );
}
