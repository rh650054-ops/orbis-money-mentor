/* DETALHES DE AGORA (27/10/2026) — os quadrinhos do Clima do iPhone/Android, só os que
   importam pra quem vende na rua: sensação, vento (guarda-sol), umidade e chuva do dia.
   Cada um traz o número e uma frase curta do que ele significa na rua. */
import type { Tempo } from "@/hooks/useClima";
import { COR } from "./comum";
import { CLIMA } from "./paleta";

function Quadro({ titulo, valor, unidade, frase, barra }: { titulo: string; valor: string; unidade?: string; frase: string; barra?: number }) {
  return (
    <div className="flex min-h-[104px] flex-col rounded-[16px] border px-3 py-2.5" style={{ borderColor: COR.borda, background: COR.surface }}>
      <span className="text-[11px] font-bold uppercase tracking-[.08em]" style={{ color: COR.mute }}>{titulo}</span>
      <span className="mt-1 text-[24px] font-medium leading-none tracking-tight tabular-nums" style={{ color: COR.texto }}>
        {valor}{unidade && <small className="ml-1 text-[13px] font-semibold" style={{ color: COR.sub }}>{unidade}</small>}
      </span>
      {barra != null && (
        <span className="mt-2 block h-1 overflow-hidden rounded-full" style={{ background: "#232323" }}>
          <i className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, barra))}%`, background: CLIMA.chuvaLeve }} />
        </span>
      )}
      <span className="mt-auto pt-1.5 text-[12px] leading-snug" style={{ color: COR.sub }}>{frase}</span>
    </div>
  );
}

export function fraseSensacao(temp: number, sens: number): string {
  const d = Math.round(sens - temp);
  if (sens >= 32) return "Calor forte: água e sombra.";
  if (d >= 2) return "Parece mais quente que o termômetro.";
  if (d <= -2) return "O vento deixa mais frio.";
  return "Igual à temperatura real.";
}

export function fraseVento(vento: number, rajada: number | null): string {
  const r = rajada ?? vento;
  if (r >= 50) return "Rajada forte: recolhe guarda-sol e lona.";
  if (r >= 30) return `Rajadas de até ${Math.round(r)} km/h. Segura o guarda-sol.`;
  return "Vento fraco, sem problema.";
}

export function DetalhesAgora({ t }: { t: Tempo }) {
  const h0 = t.horas[0];
  const umid = h0?.umid ?? null;
  const hoje = t.dias?.[0], amanha = t.dias?.[1];
  const mmHoje = hoje?.mm ?? 0;
  return (
    <section aria-label="Detalhes de agora" className="grid grid-cols-2 gap-2.5">
      <Quadro titulo="Sensação" valor={`${Math.round(t.sensacao)}°`} frase={fraseSensacao(t.temp, t.sensacao)} />
      <Quadro titulo="Vento" valor={`${Math.round(t.vento)}`} unidade="km/h" frase={fraseVento(t.vento, t.rajada)} />
      <Quadro titulo="Umidade" valor={umid != null ? `${Math.round(umid)}%` : "–"} barra={umid ?? undefined}
        frase={umid == null ? "Sem leitura agora." : umid >= 80 ? "Ar úmido: abafa no calor, gela no frio." : umid <= 30 ? "Ar seco: bebe água." : "Umidade normal."} />
      <Quadro titulo="Chuva hoje" valor={mmHoje.toFixed(1).replace(".", ",")} unidade="mm"
        frase={amanha?.mm != null ? `Amanhã: ${amanha.mm.toFixed(1).replace(".", ",")} mm.` : "Total previsto pro dia."} />
    </section>
  );
}
