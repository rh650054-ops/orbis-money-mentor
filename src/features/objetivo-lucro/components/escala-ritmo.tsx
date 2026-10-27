/* Rhythm scale: where the goal sits between his average and his record.
   One glance says "that's near my average" or "that's past my best day". */
import { COR } from "./ui";

interface Props {
  media: number;
  meta: number;
  recorde: number;
  cor: string;
  unidade: string;
}

export function EscalaRitmo({ media, meta, recorde, cor, unidade }: Props) {
  const max = Math.max(media, meta, recorde, 1) * 1.12;
  const x = (v: number) => `${Math.min(97, Math.max(3, (v / max) * 100))}%`;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  return (
    <div className="mt-4" aria-label={`Média ${fmt(media)}, meta ${fmt(meta)}, recorde ${fmt(recorde)} ${unidade} por dia`}>
      <div className="relative h-14">
        <div className="absolute left-0 right-0 top-7 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,.1)" }} />
        <div className="absolute top-7 h-1.5 rounded-full" style={{ left: x(Math.min(media, meta)), width: `calc(${x(Math.max(media, meta))} - ${x(Math.min(media, meta))})`, background: `linear-gradient(90deg,${COR.sub},${cor})` }} />
        <Marca pos={x(media)} valor={fmt(media)} rotulo="sua média" cor={COR.sub} emCima />
        <Marca pos={x(recorde)} valor={fmt(recorde)} rotulo="recorde" cor={COR.texto} emCima />
        <Marca pos={x(meta)} valor={fmt(meta)} rotulo="meta" cor={cor} grande />
      </div>
    </div>
  );
}

function Marca({ pos, valor, rotulo, cor, emCima = false, grande = false }: { pos: string; valor: string; rotulo: string; cor: string; emCima?: boolean; grande?: boolean }) {
  return (
    <div className="absolute flex flex-col items-center" style={{ left: pos, top: emCima ? 0 : 22, transform: "translateX(-50%)" }}>
      {emCima && <span className="orbis-num text-[11px] font-extrabold leading-none mb-1 whitespace-nowrap" style={{ color: cor }}>{valor} <span className="font-semibold" style={{ color: COR.mute }}>{rotulo}</span></span>}
      <span className={grande ? "w-4 h-4 rounded-full" : "w-2.5 h-2.5 rounded-full mt-[9px]"}
        style={{ background: cor, boxShadow: grande ? `0 0 0 4px rgba(0,0,0,.6), 0 0 18px ${cor}` : "0 0 0 3px rgba(0,0,0,.6)" }} />
      {!emCima && <span className="orbis-num text-[12px] font-black leading-none mt-1.5 whitespace-nowrap" style={{ color: cor }}>{valor} <span className="font-semibold text-[11px]" style={{ color: COR.mute }}>{rotulo}</span></span>}
    </div>
  );
}
