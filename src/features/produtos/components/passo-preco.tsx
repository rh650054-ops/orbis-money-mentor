/* Passo 4 — "Quanto você cobra?" com o lucro aparecendo na hora, e o combo. */
import { useState } from "react";
import { lucroDe, precosVizinhos } from "../lib/conta";
import { CampoDinheiro, Contador, reais } from "./campos";
import { BotaoOuro, LinkCinza, QuizCasca } from "./quiz-casca";

function CardLucro({ preco, custo }: { preco: number; custo: number }) {
  const l = lucroDe(preco, custo);
  const pctCusto = preco > 0 ? Math.min(100, Math.max(0, Math.round((custo / preco) * 100))) : 0;
  const ruim = l.sobra <= 0;
  return (
    <div className="rounded-[18px] px-4 py-3.5 flex flex-col gap-2"
      style={{ background: ruim ? "rgba(255,122,107,.08)" : "rgba(61,214,140,.08)", border: `1px solid ${ruim ? "rgba(255,122,107,.4)" : "rgba(61,214,140,.35)"}` }}>
      <div className="flex justify-between items-baseline">
        <span className="text-[13px] font-extrabold" style={{ color: "#b9b3a6" }}>{ruim ? "Assim você perde em cada venda" : "Sobra pra você em cada uma"}</span>
        <span className="text-[26px] font-black" style={{ color: ruim ? "#ff7a6b" : "#3DD68C" }}>{reais(l.sobra)}</span>
      </div>
      {custo > 0 && (
        <>
          <div className="h-2 rounded-full flex overflow-hidden" style={{ background: "#1d1c19" }}>
            <div style={{ width: `${pctCusto}%`, background: "#ff7a6b" }} />
            <div style={{ width: `${100 - pctCusto}%`, background: "#3DD68C" }} />
          </div>
          <div className="flex justify-between text-[11px] font-extrabold">
            <span style={{ color: "#ff7a6b" }}>custo {reais(custo)}</span>
            <span style={{ color: "#3DD68C" }}>{Math.max(0, l.pct)}% é lucro</span>
          </div>
        </>
      )}
    </div>
  );
}

export function PassoPreco({ nome, custo, preco, combo, total, onPreco, onCombo, onPrecoLivre, onContinuar, onVoltar }: {
  nome: string; custo: number; preco: number; combo: { qty: number; price: number } | null; total: number;
  onPreco: (n: number) => void; onCombo: (c: { qty: number; price: number } | null) => void;
  onPrecoLivre: () => void; onContinuar: () => void; onVoltar: () => void;
}) {
  const [chave, setChave] = useState(0); // remonta o campo quando toca num preço sugerido
  return (
    <QuizCasca passo={4} total={total} onVoltar={onVoltar}
      titulo={`Quanto você cobra no ${nome}?`}
      sub={custo > 0 ? <>Você paga <b style={{ color: "#F4F1EA" }}>{reais(custo)}</b> em cada um.</> : "Quanto o cliente paga em 1."}
      rodape={<>
        <BotaoOuro onClick={onContinuar} disabled={!(preco > 0)}>CONTINUAR</BotaoOuro>
        <LinkCinza onClick={onPrecoLivre}>o preço muda todo dia (combino na hora)</LinkCinza>
      </>}>
      <CampoDinheiro key={chave} valor={preco} onChange={onPreco} grande autoFocus />
      {preco > 0 && <CardLucro preco={preco} custo={custo} />}
      {preco > 0 && custo > 0 && (
        <>
          <span className="text-[11px] font-black tracking-[.14em] mt-1" style={{ color: "#7b766e" }}>E SE VOCÊ COBRAR…</span>
          <div className="flex gap-2">
            {precosVizinhos(preco).map((p) => {
              const l = lucroDe(p, custo);
              const atual = Math.abs(p - preco) < 0.005;
              return (
                <button key={p} type="button" onClick={() => { onPreco(p); setChave((k) => k + 1); }}
                  className="flex-1 rounded-[14px] py-2.5 px-2 flex flex-col gap-0.5 items-center"
                  style={atual ? { background: "#1a1305", border: "1.5px solid #F5B800" } : { background: "#121211", border: "1px solid #26241f" }}>
                  <span className="text-base font-black">{reais(p)}</span>
                  <span className="text-[10.5px] font-extrabold" style={{ color: l.sobra > 0 ? "#3DD68C" : "#ff7a6b" }}>sobra {reais(l.sobra)}</span>
                  <span className="text-[10px] font-bold" style={{ color: "#7b766e" }}>{l.pct}%</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      {preco > 0 && (combo ? (
        <div className="rounded-2xl p-3.5 flex flex-col gap-2.5" style={{ background: "#0f0f10", border: "1px solid #26241f" }}>
          <div className="flex justify-between items-center">
            <span className="text-[13px] font-extrabold">🔥 Combo</span>
            <button type="button" onClick={() => onCombo(null)} className="text-xs font-extrabold" style={{ color: "#7b766e" }}>tirar</button>
          </div>
          <Contador rotulo="Quantas no combo" valor={combo.qty} min={2} onChange={(q) => onCombo({ ...combo, qty: q })} />
          <CampoDinheiro rotulo={`Preço das ${combo.qty}`} valor={combo.price} onChange={(p) => onCombo({ ...combo, price: p })} />
          {combo.price > 0 && (
            <span className="text-xs font-extrabold" style={{ color: "#3DD68C" }}>
              {combo.qty} por {reais(combo.price)} · sobra {reais(combo.price - custo * combo.qty)}
            </span>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => onCombo({ qty: 2, price: 0 })} className="rounded-2xl px-3.5 py-3 flex items-center gap-2.5 text-left"
          style={{ background: "#0f0f10", border: "1px dashed #3a3833" }}>
          <span className="text-lg">🔥</span>
          <span className="flex-1 flex flex-col gap-0.5">
            <span className="text-[13px] font-extrabold">Vende 2 por um preço fechado?</span>
            <span className="text-[11.5px] font-bold" style={{ color: "#7b766e" }}>ex.: 2 por {reais(Math.max(1, Math.floor(preco * 2 * 0.85)))}</span>
          </span>
          <span className="text-[12.5px] font-black" style={{ color: "#F5B800" }}>+ combo</span>
        </button>
      ))}
    </QuizCasca>
  );
}
