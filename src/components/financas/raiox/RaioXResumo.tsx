/* Raio-X do extrato — resumo do mês: saiu × entrou (sem contar dinheiro que só mudou
   de conta), perguntas pendentes, o que tá levando o dinheiro, categorias com barra e
   comparação, e as contas (RaioXContas). Tudo vem do RPC extrato_resumo — nenhum
   número é inventado aqui. */
import type { RaioXResumo as Resumo, RaioXMes, RaioXConta } from "@/hooks/useRaioXExtrato";
import RaioXContas from "./RaioXContas";
import { moeda, mesNome, mesAnteriorIso, variacao, fraseVilao, corCat } from "./raiox-utils";

interface Props {
  mes: string;
  meses: RaioXMes[];
  resumo: Resumo | null;
  loading: boolean;
  onMes: (mes: string) => void;
  onCategoria: (slug: string) => void;
  onNaoIdentificados: () => void;
  onEnviar: () => void;
  onPerguntas: () => void;
  onEntreContas: () => void;
  onManual: () => void;
  onContaUso: (banco: string, uso: RaioXConta["uso"]) => void;
}

export default function RaioXResumo({ mes, meses, resumo, loading, onMes, onCategoria, onNaoIdentificados, onEnviar, onPerguntas, onEntreContas, onManual, onContaUso }: Props) {
  const mesesBarra = [...meses.map((m) => m.mes), mes].filter((v, i, a) => a.indexOf(v) === i).sort();
  const antNome = mesNome(mesAnteriorIso(mes));
  const cats = resumo?.categorias ?? [];
  const maior = cats[0]?.total ?? 0;
  const vazio = !loading && (!resumo || resumo.lancamentos === 0);

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-[22px] font-black tracking-tight text-foreground">Raio-X financeiro</h1>

      {mesesBarra.length > 1 && (
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
          {mesesBarra.map((m) => (
            <button key={m} type="button" onClick={() => onMes(m)} className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-extrabold border"
              style={m === mes ? { background: "#FFC800", color: "#1A1200", borderColor: "transparent" } : { background: "#131211", color: "#7e7869", borderColor: "rgba(255,255,255,.08)" }}>
              {mesNome(m, true)}{m.slice(0, 4) !== mes.slice(0, 4) ? `/${m.slice(2, 4)}` : ""}
            </button>
          ))}
        </div>
      )}

      {loading && !resumo ? (
        <div className="grid grid-cols-2 gap-2.5">
          {[0, 1].map((i) => <div key={i} className="h-[92px] rounded-2xl animate-pulse" style={{ background: "#131211" }} />)}
        </div>
      ) : vazio ? (
        <section className="rounded-2xl border p-4" style={{ background: "#131211", borderColor: "rgba(255,255,255,.07)" }}>
          <p className="text-[14px] font-bold text-foreground">Nada lido em {mesNome(mes)} ainda.</p>
          <p className="text-[12.5px] mt-1" style={{ color: "#a9a49c" }}>O Raio-X lê os gastos direto dos seus bancos ligados. Liga um banco e os gastos aparecem aqui sozinhos, já separados.</p>
          <button type="button" onClick={onEnviar} className="mt-3 w-full h-11 rounded-xl text-[14px] font-extrabold" style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
            Ligar meu banco
          </button>
        </section>
      ) : resumo && (
        <>
          {resumo.perguntas > 0 && (
            <button type="button" onClick={onPerguntas} className="w-full text-left rounded-2xl p-3 flex gap-2.5 items-center" style={{ background: "rgba(255,200,0,.08)", border: "1px solid rgba(255,200,0,.45)" }}>
              <span className="text-[22px] leading-none">🤔</span>
              <span className="flex-1 min-w-0">
                <b className="block text-[13.5px]" style={{ color: "#FFC800" }}>A Vant tem {resumo.perguntas} {resumo.perguntas === 1 ? "pergunta" : "perguntas"} pra você</b>
                <span className="block text-[11.5px] leading-snug" style={{ color: "#a9a49c" }}>Pix pra mesma pessoa, lugar que não reconheci… responde e eu acerto tudo.</span>
              </span>
            </button>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border p-3" style={{ background: "#131211", borderColor: "rgba(255,255,255,.07)" }}>
              <span className="orbis-section">Saiu</span>
              <div className="text-[22px] font-black tracking-tight tabular-nums mt-1.5" style={{ color: "#FF5A45" }}>{moeda(resumo.saiu)}</div>
              <small className="block text-[11px] font-semibold mt-1" style={{ color: "#7e7869" }}>
                {resumo.lancamentos} lançamento{resumo.lancamentos === 1 ? "" : "s"} · {resumo.bancos.length} banco{resumo.bancos.length === 1 ? "" : "s"}
              </small>
            </div>
            <div className="rounded-2xl border p-3" style={{ background: "#131211", borderColor: "rgba(255,255,255,.07)" }}>
              <span className="orbis-section">Entrou</span>
              <div className="text-[22px] font-black tracking-tight tabular-nums mt-1.5" style={{ color: "#3DD68C" }}>{moeda(resumo.entrou)}</div>
              <small className="block text-[11px] font-semibold mt-1" style={{ color: "#7e7869" }}>{resumo.vendas > 0 ? `${moeda(resumo.vendas)} de vendas` : "Pix, cartão e transferências"}</small>
            </div>
          </div>

          {resumo.viloes.length > 0 && (
            <section className="rounded-2xl p-3.5" style={{ background: "linear-gradient(160deg,#1c0a08,#0d0d0c)", border: "1px solid rgba(255,90,69,.4)" }}>
              <div className="text-[11px] font-extrabold uppercase" style={{ letterSpacing: ".12em", color: "#ff8a7a" }}>🚨 O que tá levando seu dinheiro</div>
              {resumo.viloes.map((v, i) => (
                <button key={v.categoria} type="button" onClick={() => onCategoria(v.categoria)} className="w-full text-left flex gap-2.5 items-start py-2.5" style={{ borderTop: i ? "1px solid rgba(255,255,255,.06)" : undefined, marginTop: i ? 0 : 6 }}>
                  <span className="text-[22px] font-black w-8 shrink-0 leading-tight" style={{ color: "#FF5A45" }}>{i + 1}</span>
                  <div className="min-w-0">
                    <b className="block text-[13.5px] text-foreground">{v.icone} {v.rotulo}</b>
                    <span className="block text-[12px] mt-0.5 leading-snug" style={{ color: "#b9b3a6" }}>{fraseVilao(v, antNome)}</span>
                  </div>
                </button>
              ))}
            </section>
          )}

          <div className="flex justify-between items-baseline px-0.5 mt-1">
            <h2 className="text-[15px] font-extrabold tracking-tight text-foreground">Pra onde foi</h2>
            <span className="text-[11px] font-bold" style={{ color: "#7e7869" }}>toque pra ver os lançamentos</span>
          </div>
          <section className="rounded-2xl border px-3.5" style={{ background: "#131211", borderColor: "rgba(255,255,255,.07)" }}>
            {cats.length === 0 && <p className="py-4 text-[12.5px]" style={{ color: "#a9a49c" }}>Só entradas nesse mês — nenhuma saída lida.</p>}
            {cats.map((c, i) => {
              const cor = corCat(c.categoria);
              const w = maior > 0 ? Math.max(4, Math.round((c.total / maior) * 100)) : 0;
              const va = variacao(c.total, c.anterior);
              const nid = c.categoria === "nao_identificado";
              return (
                <button key={c.categoria} type="button" onClick={() => (nid ? onNaoIdentificados() : onCategoria(c.categoria))}
                  className="w-full text-left grid items-center gap-2.5 py-2.5" style={{ gridTemplateColumns: "38px 1fr auto", borderTop: i ? "1px solid rgba(255,255,255,.07)" : undefined }}>
                  <span className="w-[38px] h-[38px] rounded-xl flex items-center justify-center text-[18px]" style={{ background: `${cor}22` }}>{c.icone}</span>
                  <div className="min-w-0">
                    <b className="block text-[13.5px] text-foreground truncate">
                      {c.rotulo}
                      {c.esfera === "corre" && <span className="ml-1.5 align-middle inline-block text-[9.5px] font-extrabold uppercase rounded-md px-1.5 py-0.5" style={{ letterSpacing: ".06em", color: "#4FA3FF", background: "rgba(79,163,255,.12)" }}>corre</span>}
                    </b>
                    <div className="h-[5px] rounded-full mt-1.5 overflow-hidden" style={{ background: "#1c1c1b" }}>
                      <i className="block h-full rounded-full" style={{ width: `${w}%`, background: cor }} />
                    </div>
                  </div>
                  <div className="text-right">
                    <b className="block text-[14px] font-black tabular-nums text-foreground">{moeda(c.total)}</b>
                    <span className="block text-[10.5px] font-bold mt-0.5" style={{ color: va?.sobe ? "#FF5A45" : va && !va.sobe && va.texto.startsWith("▼") ? "#3DD68C" : "#7e7869" }}>
                      {nid ? `${c.qtd} · me ajuda?` : va ? va.texto : `${c.pct}% · ${c.qtd} ${c.qtd === 1 ? "vez" : "vezes"}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </section>

          <RaioXContas resumo={resumo} onEntreContas={onEntreContas} onContaUso={onContaUso} />

          {/* 04/10: sem "mandar extrato" — o Raio-X lê os bancos ligados sozinho. Lançar na
              mão continua pra gasto que não passa pelo banco (dinheiro vivo). */}
          <button type="button" onClick={onManual} className="h-11 rounded-xl text-[13.5px] font-extrabold border" style={{ background: "#141413", color: "#F4F1EA", borderColor: "rgba(255,255,255,.08)" }}>
            + lançar gasto em dinheiro
          </button>
        </>
      )}
    </div>
  );
}
