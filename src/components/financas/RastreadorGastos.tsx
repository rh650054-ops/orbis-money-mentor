/* ============================================================
   RASTREADOR DE GASTOS (Finanças) — 03/10/2026, pedido do Rick.
   Acompanha o mês enquanto ele acontece, com base nos gastos DO vendedor:
   • quanto já saiu, comparado com o mesmo dia do mês passado;
   • o ritmo: o "seu normal" até hoje (média dos últimos 3 meses × dia ÷ dias do mês);
   • cada categoria contra o próprio normal (passou → vermelho);
   • UM alerta: a categoria que mais passou do normal pra essa altura do mês.
   Fonte: o que saiu do banco (Open Finance/PDF) + o que ele lançou nos custos
   do dia e não aparece no banco. Tudo de financas_rastreador().
   ============================================================ */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";
import { formatCurrency } from "@/shared/lib/utils";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const RED = "#ff7a6b";
const MUTE = "#8a857c";

interface Cat { categoria: string; rotulo: string; icone: string; total: number; qtd: number; normal: number; esperado: number }
export interface Rastreador {
  tem_dados: boolean; fonte?: "banco" | "lancado" | "misto"; mes: string; dia: number; dias_mes: number;
  gasto?: number; mes_passado_mesmo_dia?: number; normal_mes?: number; normal_ate_hoje?: number; projecao?: number | null;
  semana?: { atual: number; anterior: number }; categorias?: Cat[];
  alerta?: { rotulo: string; icone: string; total: number; esperado: number; acima: number; fixa?: boolean } | null;
  ultimos?: { data: string; valor: number; descricao: string; icone: string }[];
}

const reais = (v: number) => formatCurrency(v).replace(/,00$/, "");
const nomeMes = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { month: "long" });
// conta fixa cai de uma vez no mês: compara com o mês inteiro, não com o ritmo
const FIXAS = new Set(["assinaturas", "contas_casa", "parcelas", "celular_internet", "impostos"]);
const FONTE = { banco: "lido do seu banco", lancado: "pelo que você lança", misto: "banco + o que você lança" } as const;

function Barra({ v, max, marca, cor }: { v: number; max: number; marca?: number; cor: string }) {
  const pct = max > 0 ? Math.min(100, (v / max) * 100) : v > 0 ? 100 : 0;
  const m = marca != null && max > 0 ? Math.min(100, (marca / max) * 100) : null;
  return (
    <div className="relative h-[7px] rounded-full" style={{ background: "#1c1c1f" }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor }} />
      {m != null && <span className="absolute top-[-3px] w-[2px] h-[13px] rounded" style={{ left: `calc(${m}% - 1px)`, background: "#e9e6df" }} />}
    </div>
  );
}

export function RastreadorView({ r, onVerTudo }: { r: Rastreador; onVerTudo: () => void }) {
  const mes = nomeMes(r.mes);
  if (!r.tem_dados) {
    return (
      <section className="rounded-2xl p-4" style={{ background: "#0f0f10", border: "1px solid #1f1e22" }}>
        <p className="text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>RASTREADOR DE GASTOS</p>
        <p className="text-[15px] font-extrabold mt-1.5">Ainda não tem gasto pra rastrear</p>
        <p className="text-[12px] mt-1 leading-relaxed" style={{ color: MUTE }}>Lança seus custos do dia (almoço, passagem, mercadoria) ou liga seu banco no Vant Pro. A Vant separa por tipo e avisa quando algum passar do seu normal.</p>
      </section>
    );
  }
  const gasto = r.gasto ?? 0;
  const normalHoje = r.normal_ate_hoje ?? 0;
  const dif = gasto - normalHoje;
  const cats = (r.categorias ?? []).slice(0, 5);
  // categoria sem histórico ainda: a barra é relativa ao maior gasto do mês
  const maiorTotal = Math.max(1, ...cats.map((c) => c.total));
  const passado = r.mes_passado_mesmo_dia ?? 0;
  return (
    <section className="rounded-2xl p-4" style={{ background: "linear-gradient(170deg,#121214,#0b0b0d)", border: "1px solid #1f1e22" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>RASTREADOR DE GASTOS · {mes.toUpperCase()}</p>
        <span className="text-[10px] font-bold rounded-full px-2 py-[3px] shrink-0" style={{ color: "#b9b3a6", border: "1px solid #2a2a2e" }}>{FONTE[r.fonte ?? "lancado"]}</span>
      </div>
      <div className="flex items-end justify-between gap-3 mt-2">
        <div>
          <p className="text-[30px] font-black tabular-nums leading-none">{reais(gasto)}</p>
          <p className="text-[11.5px] mt-1.5" style={{ color: MUTE }}>gastou até hoje (dia {r.dia})</p>
        </div>
        {normalHoje > 0 && (
          <div className="text-right">
            <p className="text-[15px] font-black tabular-nums" style={{ color: dif > 0 ? RED : OK }}>{dif > 0 ? "+" : "−"} {reais(Math.abs(dif))}</p>
            <p className="text-[10.5px]" style={{ color: MUTE }}>{dif > 0 ? "acima" : "abaixo"} do seu normal</p>
          </div>
        )}
      </div>
      {(r.normal_mes ?? 0) > 0 && (
        <div className="mt-3">
          <Barra v={gasto} max={r.normal_mes ?? 0} marca={normalHoje} cor={dif > 0 ? `linear-gradient(90deg,#c9463a,${RED})` : `linear-gradient(90deg,#1fa868,${OK})`} />
          <p className="text-[10.5px] mt-1.5" style={{ color: MUTE }}>
            Seu normal no mês: {reais(r.normal_mes ?? 0)} · o traço é onde você deveria estar hoje
            {r.projecao ? ` · nesse ritmo fecha em ${reais(r.projecao)}` : ""}
          </p>
        </div>
      )}
      {r.alerta && (
        <div className="mt-3 rounded-xl px-3 py-2.5 flex gap-2.5 items-start" style={{ background: "rgba(255,90,69,.08)", border: "1px solid rgba(255,90,69,.35)" }}>
          <span className="text-[18px] leading-none" aria-hidden>{r.alerta.icone}</span>
          <p className="text-[12px] leading-snug">
            <b style={{ color: RED }}>{r.alerta.rotulo} passou do seu normal.</b>{" "}
            <span style={{ color: "#b9b3a6" }}>
              {reais(r.alerta.total)} até hoje; {r.alerta.fixa ? `o normal no mês todo é ${reais(r.alerta.esperado)}` : `o normal pra essa altura é ${reais(r.alerta.esperado)}`}.
            </span>
          </p>
        </div>
      )}
      {cats.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {cats.map((c) => {
            const fixa = FIXAS.has(c.categoria);
            // vermelho: passou do mês inteiro; laranja: acelerado (30% e R$ 30 acima do ritmo)
            const passou = c.normal > 0 && c.total > c.normal;
            const acelerado = !fixa && !passou && c.esperado > 0 && c.total - c.esperado >= 30 && c.total >= c.esperado * 1.3;
            const cor = passou ? RED : acelerado ? "#ff9f43" : GOLD;
            return (
              <div key={c.categoria}>
                <div className="flex items-center gap-2 text-[12.5px]">
                  <span aria-hidden>{c.icone}</span>
                  <span className="flex-1 min-w-0 truncate font-extrabold">{c.rotulo}</span>
                  <span className="tabular-nums font-black" style={{ color: passou || acelerado ? cor : "#F4F1EA" }}>{reais(c.total)}</span>
                  <span className="text-[10.5px] tabular-nums w-[78px] text-right" style={{ color: MUTE }}>{c.normal > 0 ? `de ${reais(c.normal)}` : "novo no mês"}</span>
                </div>
                <div className="mt-1"><Barra v={c.total} max={c.normal || maiorTotal} marca={c.normal > 0 && !fixa ? c.esperado : undefined} cor={cor} /></div>
              </div>
            );
          })}
        </div>
      )}
      {gasto === 0 && (
        <p className="text-[12px] mt-3" style={{ color: MUTE }}>
          Nada saiu em {mes} ainda{r.semana && r.semana.atual > 0 ? ` · últimos 7 dias: ${reais(r.semana.atual)}` : ""}.
        </p>
      )}
      {passado > 0 && gasto > 0 && (
        <p className="text-[11px] mt-3" style={{ color: MUTE }}>
          No mesmo dia do mês passado: {reais(passado)} ({gasto <= passado ? "você está gastando menos" : "você está gastando mais"}).
        </p>
      )}
      {r.fonte !== "lancado" && (
        <button type="button" onClick={onVerTudo} className="mt-3 w-full h-10 rounded-xl text-[12.5px] font-extrabold" style={{ background: "#18181b", border: "1px solid #26262a" }}>
          Ver cada gasto no Raio-X
        </button>
      )}
    </section>
  );
}

export function RastreadorGastos({ userId }: { userId?: string }) {
  const navigate = useNavigate();
  const [r, setR] = useState<Rastreador | null>(null);
  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    (async () => {
      const { data, error } = await (supabase as unknown as { rpc: (f: string) => Promise<{ data: unknown; error: unknown }> }).rpc("financas_rastreador");
      if (error) { avisar.silencioso("financas_rastreador", error); return; }
      if (vivo) setR(data as Rastreador);
    })();
    return () => { vivo = false; };
  }, [userId]);
  if (!r) return null;
  return <RastreadorView r={r} onVerTudo={() => navigate(`/financas/extrato?mes=${r.mes}`)} />;
}
