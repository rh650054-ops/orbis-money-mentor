/* The live card: what the vendor typed in the last 3 days (real) against what the
   bank would show. Without Pro we do not know what landed, so with real sales the
   "caiu" and "calote" cells stay as a question; with no sales yet, the whole card
   plays an example and says so. */
import { useEffect, useState } from "react";
import { COR } from "@/shared/components/vant-ui";
import { reaisInteiros, semMovimento, useContador } from "./use-vitrine-motion";

const EXEMPLO = { lancou: 912, caiu: 784, calote: 74 };
const FEED: { t: "p" | "m" | "d" | "z"; titulo: string; quem: string; valor: number }[] = [
  { t: "p", titulo: "Pix recebido", quem: "Ana · 14:32", valor: 12 },
  { t: "m", titulo: "Maquininha", quem: "Cartão · cai amanhã", valor: 18 },
  { t: "p", titulo: "Pix recebido", quem: "Lucas · 14:51", valor: 8 },
  { t: "d", titulo: "Não caiu", quem: "João · na lista de cobrança", valor: 15 },
  { t: "p", titulo: "Pix recebido", quem: "Bia · 15:10", valor: 10 },
  { t: "z", titulo: "Cobrador da VANT", quem: "Pix gerado pro Carlos", valor: 9 },
];
const ICONE = { p: ["✓", COR.ok], m: ["▭", "#4FB3FF"], d: ["!", COR.coral], z: ["↗", "#FFC800"] } as const;

function Celula({ valor, texto, cor, scan }: { valor: string; texto: string; cor: string; scan?: boolean }) {
  return (
    <div className={`rounded-[14px] px-2.5 py-2.5 min-w-0 ${scan ? "vv-scan" : ""}`} style={{ background: "#070707", border: `1px solid ${COR.borda}` }}>
      <span className="block text-[22px] font-black tabular-nums leading-none truncate" style={{ color: cor }}>{valor}</span>
      <span className="block text-[10px] font-bold mt-1" style={{ color: COR.apagado }}>{texto}</span>
    </div>
  );
}

export function VitrineAoVivo({ lancado }: { lancado: number }) {
  const real = lancado > 0;
  const [fase, setFase] = useState(0); // 0 lançado · 1 conectando · 2 resultado
  const [feed, setFeed] = useState(0);
  const [ciclo, setCiclo] = useState(0);

  useEffect(() => {
    if (semMovimento()) { setFase(2); setFeed(FEED.length); return; }
    setFase(0); setFeed(0);
    const ts = [setTimeout(() => setFase(1), 2000), setTimeout(() => setFase(2), 3600)];
    FEED.forEach((_, i) => ts.push(setTimeout(() => setFeed(i + 1), 3600 + i * 900)));
    ts.push(setTimeout(() => setCiclo((c) => c + 1), 13000));
    return () => ts.forEach(clearTimeout);
  }, [ciclo]);

  const vLancou = useContador(real ? lancado : EXEMPLO.lancou, true, 1400);
  const mostra = fase === 2 && !real;
  const vCaiu = useContador(EXEMPLO.caiu, mostra);
  const vCalote = useContador(EXEMPLO.calote, mostra);
  const itens = FEED.slice(0, feed).reverse().slice(0, 4);

  return (
    <div className="vv-borda relative rounded-[20px] p-3.5 overflow-hidden" style={{ background: "linear-gradient(170deg,#1a1305,#0b0b0c 70%)", border: "1px solid rgba(245,184,0,.45)" }}>
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-black tracking-[.16em]" style={{ color: COR.ouro }}>
          {fase === 1 ? "CONECTANDO AO BANCO…" : fase === 2 && !real ? "COM O PRO" : "SEUS ÚLTIMOS 3 DIAS"}
        </span>
        {fase === 2 && !real && <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold" style={{ color: COR.ok }}><i className="vv-pisca w-[7px] h-[7px] rounded-full" style={{ background: COR.ok }} />banco conectado</span>}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <Celula valor={reaisInteiros(vLancou)} texto="você lançou" cor={COR.texto} />
        <Celula valor={mostra ? reaisInteiros(vCaiu) : "?"} texto="caiu no banco" cor={COR.ok} scan={fase === 1 || (real && fase === 2)} />
        <Celula valor={mostra ? reaisInteiros(vCalote) : "?"} texto="calote" cor={COR.coral} scan={fase === 1 || (real && fase === 2)} />
      </div>
      <div className="h-1.5 rounded-full mt-3 overflow-hidden flex" style={{ background: "#1a1916" }}>
        {[["86%", "linear-gradient(90deg,#1fae6b,#3DD68C)"], ["6%", "#5b4a1d"], ["8%", COR.coral]].map(([w, bg]) => (
          <i key={bg} className="block h-full transition-[width] duration-[1200ms]" style={{ width: mostra ? w : "0%", background: bg }} />
        ))}
      </div>
      <div className="mt-3 h-[132px] overflow-hidden" style={{ WebkitMaskImage: "linear-gradient(180deg,#000 70%,transparent)", maskImage: "linear-gradient(180deg,#000 70%,transparent)" }}>
        {itens.map((e) => (
          <div key={e.quem} className="vv-cai flex items-center gap-2.5 rounded-[12px] px-2.5 py-2 mb-1.5 text-[12px]" style={{ background: "#0b0b0c", border: `1px solid ${COR.borda}` }}>
            <span className="w-6 h-6 rounded-[8px] grid place-items-center text-[12px] font-black shrink-0" style={{ color: ICONE[e.t][1], background: `${ICONE[e.t][1]}26` }}>{ICONE[e.t][0]}</span>
            <span className="flex-1 min-w-0 leading-tight" style={{ color: COR.suave }}>{e.titulo}<br /><b style={{ color: COR.texto }}>{e.quem}</b></span>
            <span className="font-black" style={{ color: e.t === "d" ? COR.coral : COR.ok }}>{e.t === "d" ? "− " : "+ "}R$ {e.valor}</span>
          </div>
        ))}
      </div>
      <p className="text-[13.5px] font-extrabold mt-2.5">
        {fase === 2 && !real ? <><b style={{ color: "#FFC800" }}>R$ 74 de calote</b> que você não ia ver. Cobre com um toque.</> : "Quanto disso caiu de verdade?"}
      </p>
      <p className="text-[10.5px] mt-1.5" style={{ color: COR.apagado }}>
        {real ? "O valor lançado é o seu. As notificações são um exemplo de como fica com o Pro." : "Exemplo de como fica com o Pro."}
      </p>
    </div>
  );
}
