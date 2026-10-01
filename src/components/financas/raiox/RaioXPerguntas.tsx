/* Raio-X do extrato — "A Vant quer saber". Quando a análise tem dúvida (Pix frequente
   pra mesma pessoa, lugar com categorias diferentes, "isso é conta sua?"), ela pergunta
   em vez de chutar. Uma resposta vale pra todos os lançamentos daquele nome — e pros
   próximos extratos também (vira regra). */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { RaioXPergunta, RaioXOpcao } from "@/hooks/useRaioXInteligencia";
import { toast } from "@/shared/hooks/use-toast";
import { moeda, bonito, mesNome, lerValor } from "./raiox-utils";

interface Props {
  perguntas: RaioXPergunta[];
  loading: boolean;
  onResponder: (id: string, resposta: string, valorMin?: number) => Promise<number | null>;
}

const ICONE: Record<RaioXPergunta["motivo"], string> = {
  conta_sua: "🔁", pessoa: "👤", inconsistente: "🔀", recorrente: "📅", nao_sei: "❓", lancamento: "💸",
};

/** A pergunta em português, só com números que vieram do banco. */
function frase(p: RaioXPergunta): { titulo: string; detalhe: string } {
  const nome = bonito(p.nome) || "esse nome";
  const vezes = `${p.qtd} ${p.qtd === 1 ? "vez" : "vezes"}`;
  const periodo = p.meses > 1 ? ` em ${p.meses} meses` : "";
  switch (p.motivo) {
    case "conta_sua":
      return { titulo: `${nome} é uma conta sua?`, detalhe: `Saiu ${moeda(p.total)} pra esse nome (${vezes}). Se for conta sua em outro banco, não conta como gasto.` };
    case "pessoa": {
      const faixa = p.dados.min != null && p.dados.max != null ? ` — de ${moeda(p.dados.min)} a ${moeda(p.dados.max)}` : "";
      return { titulo: `Pra que são os Pix pra ${nome}?`, detalhe: `${vezes}, ${moeda(p.total)}${periodo}${faixa}.` };
    }
    case "inconsistente":
      return { titulo: `O que é ${nome}?`, detalhe: `Apareceu como ${(p.dados.categorias ?? []).join(", ").toLowerCase()} — ${vezes}, ${moeda(p.total)}. Me diz o certo e eu junto tudo.` };
    case "recorrente":
      return { titulo: `Todo mês pra ${nome}: o que é?`, detalhe: `${vezes}${periodo}, uns ${moeda(p.dados.media ?? p.total / Math.max(p.qtd, 1))} cada.` };
    case "nao_sei":
      return { titulo: `Não reconheci ${nome}`, detalhe: `${vezes}, ${moeda(p.total)}${periodo}. O que é esse lugar?` };
    default: {
      const d = p.dados.data ? `${p.dados.data.slice(8, 10)} de ${mesNome(`${p.dados.data.slice(0, 7)}-01`)}` : "";
      return { titulo: `${moeda(p.total)} sem nome${d ? ` em ${d}` : ""}`, detalhe: `"${p.nome ?? "Pix enviado"}"${p.dados.banco ? ` no ${p.dados.banco}` : ""}. Pra onde foi?` };
    }
  }
}

const rotulo = (o: RaioXOpcao) => (o.min != null ? o.r.replace("{min}", moeda(o.min)) : o.r);

export default function RaioXPerguntas({ perguntas, loading, onResponder }: Props) {
  const [enviando, setEnviando] = useState<string | null>(null);
  // Opção "só os acima de R$ X": o X vem calculado, mas o vendedor ajusta antes de confirmar.
  const [corte, setCorte] = useState<{ id: string; o: RaioXOpcao; txt: string } | null>(null);

  const responder = async (p: RaioXPergunta, o: RaioXOpcao | null) => {
    setEnviando(p.id);
    const n = await onResponder(p.id, o ? o.v : "__ignorar", o?.min);
    setEnviando(null);
    if (n === null) { toast({ title: "Não consegui salvar", description: "Tenta de novo em instantes." }); return; }
    if (o) toast({ title: "Anotado 👊", description: n > 1 ? `${n} lançamentos foram pro lugar certo. Nos próximos extratos já vai direto.` : "Nos próximos extratos já vai direto." });
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1 className="text-[22px] font-black tracking-tight text-foreground">A Vant quer saber</h1>
        <p className="text-[12.5px] mt-1.5 leading-snug" style={{ color: "#a9a49c" }}>
          Coisas que eu não quis chutar. Responde uma vez e eu aplico em tudo — nos meses que já mandou e nos próximos.
        </p>
      </div>

      {loading && perguntas.length === 0 ? (
        [0, 1].map((i) => <div key={i} className="h-[150px] rounded-2xl animate-pulse" style={{ background: "#131211" }} />)
      ) : perguntas.length === 0 ? (
        <section className="rounded-2xl border p-4" style={{ background: "#131211", borderColor: "rgba(255,255,255,.07)" }}>
          <p className="text-[14px] font-bold text-foreground">Nenhuma dúvida agora. 👊</p>
          <p className="text-[12.5px] mt-1" style={{ color: "#a9a49c" }}>Quando mandar outro extrato, se eu ficar em dúvida, pergunto aqui.</p>
        </section>
      ) : perguntas.map((p) => {
        const f = frase(p);
        const ocupado = enviando === p.id;
        return (
          <section key={p.id} className="rounded-2xl border p-3.5" style={{ background: "#131211", borderColor: "rgba(255,200,0,.22)" }}>
            <div className="flex gap-2.5 items-start">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[17px] shrink-0" style={{ background: "rgba(255,200,0,.1)" }}>{ICONE[p.motivo]}</span>
              <div className="min-w-0">
                <b className="block text-[14px] text-foreground leading-snug">{f.titulo}</b>
                <span className="block text-[12px] mt-0.5 leading-snug" style={{ color: "#b9b3a6" }}>{f.detalhe}</span>
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap mt-3">
              {p.opcoes.map((o, i) => (
                <button key={`${o.v}-${i}`} type="button" disabled={enviando !== null}
                  onClick={() => (o.min != null ? setCorte({ id: p.id, o, txt: String(o.min) }) : responder(p, o))}
                  className="rounded-full px-2.5 py-1.5 text-[12px] font-bold border disabled:opacity-50"
                  style={{ background: "#1a1918", color: "#F4F1EA", borderColor: "rgba(255,255,255,.12)" }}>
                  {rotulo(o)}
                </button>
              ))}
              <button type="button" disabled={enviando !== null} onClick={() => responder(p, null)}
                className="rounded-full px-2.5 py-1.5 text-[12px] font-bold disabled:opacity-50" style={{ color: "#7e7869" }}>
                {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : "pular"}
              </button>
            </div>
            {corte?.id === p.id && (
              <div className="flex items-center gap-2 mt-2.5 rounded-xl p-2" style={{ background: "#1a1918" }}>
                <span className="text-[12px] font-bold" style={{ color: "#b9b3a6" }}>Rancho = Pix acima de R$</span>
                <input inputMode="decimal" value={corte.txt} onChange={(e) => setCorte({ ...corte, txt: e.target.value })}
                  className="w-20 h-8 rounded-lg border px-2 text-[14px] font-black tabular-nums" style={{ background: "#131211", borderColor: "rgba(255,255,255,.12)", color: "#F4F1EA" }} />
                <button type="button" disabled={enviando !== null || lerValor(corte.txt) <= 0}
                  onClick={() => { const min = lerValor(corte.txt); setCorte(null); responder(p, { ...corte.o, min }); }}
                  className="ml-auto h-8 px-3 rounded-lg text-[12px] font-extrabold disabled:opacity-50" style={{ background: "#FFC800", color: "#1A1200" }}>
                  ok
                </button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
