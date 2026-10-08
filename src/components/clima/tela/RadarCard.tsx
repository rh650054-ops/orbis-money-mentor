/* 9 · RADAR / DETALHES — como a chuva avança nas próximas 6 horas (nosso consenso,
   não um mapa licenciado) + "Abrir radar" num radar de verdade, fora do app.
   O radar grátis mais usado (RainViewer) não permite uso comercial; radar dentro
   do app pede provedor pago. "Detalhes" mostra de onde vem a previsão. */
import { useState } from "react";
import { ExternalLink, Info, Radar } from "lucide-react";
import type { HoraClima, ModeloNota } from "@/hooks/useClima";
import { chanceDe } from "../decisao";
import { BotaoAcao, COR, Cartao, Folha, LinhaValor, Titulo } from "./comum";

export function RadarCard({ horas, cell, modelos }: { horas: HoraClima[]; cell: string | null; modelos: ModeloNota[] }) {
  const [detalhes, setDetalhes] = useState(false);
  const seis = horas.slice(0, 6);
  const [lat, lon] = (cell ?? "").split(",");
  const link = lat && lon ? `https://www.windy.com/-Weather-radar-radar?radar,${lat},${lon},9` : "https://www.windy.com/-Weather-radar-radar?radar";
  return (
    <section aria-label="Radar de chuva">
      <Titulo>Radar de chuva</Titulo>
      <Cartao>
        <p className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: COR.sub }}>
          <Radar className="w-[18px] h-[18px]" strokeWidth={2} style={{ color: "#6FA8FF" }} /> Como a chuva avança nas próximas horas
        </p>
        <div className="mt-3 grid grid-cols-6 gap-1.5 items-end h-[84px]" aria-label="Chance de chuva nas próximas 6 horas">
          {seis.map((h, i) => {
            const c = chanceDe(h);
            return (
              <div key={h.iso} className="flex flex-col items-center gap-1 h-full justify-end">
                <span className="text-[12px] font-bold tabular-nums" style={{ color: c >= 30 ? "#6FA8FF" : COR.mute }}>{c}%</span>
                <span className="w-full rounded-[6px] transition-[height] duration-[420ms]" style={{ height: `${Math.max(6, c * 0.5)}px`, background: c >= 60 ? "#6FA8FF" : c >= 30 ? "#6FA8FF99" : "#2a2a2e" }} />
                <span className="text-[12px] font-semibold" style={{ color: i === 0 ? COR.ouro : COR.mute }}>{i === 0 ? "agora" : `${h.hora}h`}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <BotaoAcao tom="ouro" onClick={() => window.open(link, "_blank", "noopener")}><ExternalLink className="w-4 h-4" />Abrir radar</BotaoAcao>
          <BotaoAcao onClick={() => setDetalhes(true)}><Info className="w-4 h-4" />Detalhes</BotaoAcao>
        </div>
      </Cartao>

      <Folha open={detalhes} onOpenChange={setDetalhes} titulo="De onde vem a previsão" subtitulo="6 modelos globais + alerta oficial do INMET + o que os vendedores confirmam.">
        <div>
          {modelos.map((m) => (
            <LinhaValor key={m.nome} rotulo={m.nome} valor={m.total > 0 ? `acertou ${m.acertos} de ${m.total}` : "sem nota ainda"} />
          ))}
        </div>
        <p className="text-[13px] leading-snug" style={{ color: COR.mute }}>
          Cada "Tá chovendo aí?" dá nota pros modelos da sua região: quem acerta mais pesa mais na chance de chuva. Sua posição vai arredondada pra uns 5 km.
        </p>
      </Folha>
    </section>
  );
}
