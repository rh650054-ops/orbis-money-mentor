/* 2 · OPINIÃO DA VANT — a leitura da IA, curta e escaneável (uma frase por linha).
   Toque troca a leitura. O rodapé "não sou Deus" fica fixo, menor e separado. */
import { useState } from "react";
import { COR, Cartao, Rotulo, haptic } from "./comum";

export function OpiniaoVant({ falas, fontes, pensando }: { falas: string[]; fontes: number; pensando: boolean }) {
  const [i, setI] = useState(0);
  const n = falas.length;
  const fala = n > 0 ? falas[i % n]! : null;
  const linhas = fala ? fala.split(/(?<=[.!?])\s+/).filter(Boolean) : [];
  return (
    <Cartao className="p-0">
      <button type="button" disabled={n < 2} onClick={() => { haptic(); setI((x) => x + 1); }}
        className="w-full text-left p-4 rounded-[18px] transition-[transform,background-color] duration-[120ms] enabled:active:scale-[0.99] enabled:active:bg-white/[.04]">
        <Rotulo cor={COR.ouro}>Opinião da Vant</Rotulo>
        {n > 1 && <p className="text-[12px] font-semibold mt-0.5" style={{ color: COR.mute }}>{(i % n) + 1}/{n} · toque para ver outras leituras</p>}
        <div key={i} className="mt-2 flex flex-col gap-1 animate-in fade-in duration-200">
          {fala ? linhas.map((l, k) => (
            <p key={k} className="text-[17px] leading-snug font-semibold" style={{ color: k === 0 ? COR.texto : "#d8d3c9" }}>{l}</p>
          )) : <p className="text-[15px]" style={{ color: COR.sub }}>{pensando ? "Lendo os modelos e as suas contas…" : "Toca em atualizar pra eu dar minha opinião."}</p>}
        </div>
        <p className="mt-3 pt-3 border-t text-[12.5px] leading-snug" style={{ borderColor: "rgba(255,255,255,.06)", color: COR.mute }}>
          Antes de tudo: não sou Deus, né kkk — clima muda. Mas juntei {fontes || 6} modelos e é nisso que eu aposto.
        </p>
      </button>
    </Cartao>
  );
}
