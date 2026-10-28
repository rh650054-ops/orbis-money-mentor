/* 9 · RADAR DE CHUVA (v2, 08/10) — parece radar: mini mapa, anéis, varredura,
   você no centro e as manchas de chuva se movendo na direção do vento.
   É uma SIMULAÇÃO honesta montada com a chance dos modelos + o vento (o radar
   grátis não permite uso comercial); o radar real abre no botão. */
import { useId, useState } from "react";
import { ExternalLink, Info } from "lucide-react";
import type { HoraClima, ModeloNota } from "@/hooks/useClima";
import { chanceDe } from "../decisao";
import { lerMovimento, type Movimento } from "./visual";
import { BotaoAcao, COR, Folha, LinhaValor, Titulo } from "./comum";
import { CLIMA } from "./paleta";

function Mapa({ m }: { m: Movimento }) {
  const id = useId().replace(/:/g, "");
  const rad = ((m.para - 90) * Math.PI) / 180; // 0° = norte (pra cima)
  const vx = Math.cos(rad), vy = Math.sin(rad);
  const dist = m.tipo === "saindo" ? 46 : m.tipo === "chegando" ? -58 : m.tipo === "sobre" ? 0 : 22;
  const cx = 160 + vx * dist, cy = 100 + vy * dist;
  const cor = m.forca >= 70 ? CLIMA.temporal : m.forca >= 45 ? CLIMA.chuva : CLIMA.chuvaLeve;
  const op = m.tipo === "longe" ? 0.12 : 0.55;
  const blobs = [[0, 0, 42, 26], [-26, 14, 26, 18], [24, -12, 30, 18], [10, 22, 18, 12]] as const;
  return (
    <svg viewBox="0 0 320 200" className="w-full h-auto block rounded-[16px]" role="img" aria-label={m.frase}>
      <defs>
        <radialGradient id={`fundo-${id}`} cx="50%" cy="50%" r="70%"><stop offset="0" stopColor="#13202b" /><stop offset="1" stopColor="#090c10" /></radialGradient>
        <filter id={`blur-${id}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" /></filter>
        <linearGradient id={`varre-${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#5B9BFF" stopOpacity="0" /><stop offset="1" stopColor="#5B9BFF" stopOpacity=".28" /></linearGradient>
      </defs>
      <style>{`
        @keyframes deriva-${id} { 0% { transform: translate(${-vx * 10}px, ${-vy * 10}px) } 100% { transform: translate(${vx * 14}px, ${vy * 14}px) } }
        @keyframes gira-${id} { to { transform: rotate(360deg) } }
        @keyframes pulso-${id} { 0% { r: 5; opacity: .7 } 100% { r: 18; opacity: 0 } }
        .deriva-${id} { animation: deriva-${id} 5s ease-in-out infinite alternate; }
        .gira-${id} { animation: gira-${id} 4.5s linear infinite; transform-origin: 160px 100px; }
        .pulso-${id} { animation: pulso-${id} 1.8s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) { .deriva-${id}, .gira-${id}, .pulso-${id} { animation: none } }
      `}</style>
      <rect width="320" height="200" fill={`url(#fundo-${id})`} />
      {/* mini mapa: ruas e um rio (ambientação, não é a sua rua) */}
      <g stroke="#ffffff" strokeOpacity=".07" strokeWidth="1.2" fill="none">
        <path d="M0 62 L120 70 L210 52 L320 60" /><path d="M0 140 L90 128 L170 150 L320 136" /><path d="M70 0 L84 80 L60 200" />
        <path d="M200 0 L214 92 L236 200" /><path d="M140 0 L150 200" /><path d="M0 100 L320 104" strokeOpacity=".05" />
      </g>
      <path d="M0 176 Q80 150 150 170 T320 158" stroke="#5B9BFF" strokeOpacity=".16" strokeWidth="6" fill="none" />
      {/* anéis e varredura */}
      {[34, 64, 94].map((r) => <circle key={r} cx="160" cy="100" r={r} fill="none" stroke="#9CC4FF" strokeOpacity=".12" />)}
      <g className={`gira-${id}`}><path d="M160 100 L254 100 A94 94 0 0 0 226 34 Z" fill={`url(#varre-${id})`} /></g>
      {/* manchas de chuva */}
      <g className={`deriva-${id}`} filter={`url(#blur-${id})`} opacity={op}>
        {blobs.map(([dx, dy, rx, ry], i) => <ellipse key={i} cx={cx + dx} cy={cy + dy} rx={rx * (0.6 + m.forca / 200)} ry={ry * (0.6 + m.forca / 200)} fill={i === 0 ? cor : CLIMA.chuvaLeve} />)}
      </g>
      {/* seta do movimento */}
      {m.tipo !== "longe" && m.tipo !== "espalhada" && (
        <g stroke="#F4F1EA" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round" fill="none">
          <line x1={cx - vx * 20} y1={cy - vy * 20} x2={cx + vx * 22} y2={cy + vy * 22} />
          <path d={`M${cx + vx * 22 - vy * 6 - vx * 8} ${cy + vy * 22 + vx * 6 - vy * 8} L${cx + vx * 22} ${cy + vy * 22} L${cx + vx * 22 + vy * 6 - vx * 8} ${cy + vy * 22 - vx * 6 - vy * 8}`} />
        </g>
      )}
      {/* você */}
      <circle className={`pulso-${id}`} cx="160" cy="100" r="5" fill="none" stroke="#F5B800" strokeWidth="2" />
      <circle cx="160" cy="100" r="5" fill="#F5B800" stroke="#0b0b0d" strokeWidth="2" />
      <text x="160" y="16" textAnchor="middle" fontSize="10" fontWeight="800" fill="#ffffff" fillOpacity=".45">N</text>
    </svg>
  );
}

export function RadarCard({ horas, cell, modelos }: { horas: HoraClima[]; cell: string | null; modelos: ModeloNota[] }) {
  const [detalhes, setDetalhes] = useState(false);
  const m = lerMovimento(horas);
  const seis = horas.slice(0, 6);
  const [lat, lon] = (cell ?? "").split(",");
  const link = lat && lon ? `https://www.windy.com/-Weather-radar-radar?radar,${lat},${lon},9` : "https://www.windy.com/-Weather-radar-radar?radar";
  return (
    <section aria-label="Radar de chuva">
      <Titulo>Radar de chuva</Titulo>
      <div className="rounded-[20px] border p-3.5" style={{ background: "#0b0d10", borderColor: "rgba(91,155,255,.18)" }}>
        <p className="text-[17px] font-extrabold px-1" style={{ color: COR.texto }}>{m.frase}</p>
        <div className="mt-3"><Mapa m={m} /></div>
        {/* linha do tempo: pontos, não barras */}
        <div className="mt-3 px-1 flex items-start justify-between">
          {seis.map((h, i) => {
            const c = chanceDe(h);
            const tam = 8 + Math.round(c / 10);
            return (
              <div key={h.iso} className="flex flex-col items-center gap-1 w-10">
                <span className="rounded-full" style={{ width: tam, height: tam, background: c >= 30 ? CLIMA.chuva : "#2a2d33", opacity: c >= 30 ? 0.4 + c / 170 : 1 }} />
                <span className="text-[12px] font-bold tabular-nums" style={{ color: c >= 30 ? CLIMA.chuvaLeve : COR.mute }}>{c}%</span>
                <span className="text-[11px] font-semibold" style={{ color: i === 0 ? COR.ouro : COR.mute }}>{i === 0 ? "agora" : `${h.hora}h`}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[11.5px] mt-2 px-1" style={{ color: COR.mute }}>Simulação pelos modelos e pelo vento · o radar real abre no botão.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <BotaoAcao tom="ouro" onClick={() => window.open(link, "_blank", "noopener")}><ExternalLink className="w-4 h-4" />Abrir radar</BotaoAcao>
          <BotaoAcao onClick={() => setDetalhes(true)}><Info className="w-4 h-4" />Detalhes</BotaoAcao>
        </div>
      </div>

      <Folha open={detalhes} onOpenChange={setDetalhes} titulo="De onde vem a previsão" subtitulo="6 modelos globais + alerta oficial do INMET + o que os vendedores confirmam.">
        <div>
          {modelos.map((x) => <LinhaValor key={x.nome} rotulo={x.nome} valor={x.total > 0 ? `acertou ${x.acertos} de ${x.total}` : "sem nota ainda"} />)}
        </div>
        <p className="text-[13px] leading-snug" style={{ color: COR.mute }}>
          Cada "Tá chovendo aí?" dá nota pros modelos da sua região: quem acerta mais pesa mais na chance de chuva. Sua posição vai arredondada pra uns 5 km.
        </p>
      </Folha>
    </section>
  );
}
