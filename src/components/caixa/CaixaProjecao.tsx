/* Caixa da Vant — projeção dos próximos 3 meses. Parte do saldo de hoje, dos
   assinantes ativos no app (cada renovação = líquido médio da Hotmart) e dos gastos
   (contas fixas + influenciadores mensais + o resto no ritmo dos últimos 30 dias). */
import { useMemo, useState } from "react";
import type { CaixaInfluenciador, CaixaRecorrente, CaixaVendas } from "@/hooks/useCaixa";
import { moeda, projetar } from "./caixa-fmt";

interface Props {
  saldo: number;
  vendas: CaixaVendas | null;
  recorrentes: CaixaRecorrente[];
  influenciadores: CaixaInfluenciador[];
  mediaDia30: number;
  consumoIaMesUsd: number;
  cambio: number;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default function CaixaProjecao({ saldo, vendas, recorrentes, influenciadores, mediaDia30, consumoIaMesUsd, cambio }: Props) {
  const fixos = recorrentes.filter((r) => r.ativo).reduce((a, r) => a + r.valor, 0);
  const infMes = influenciadores.filter((i) => i.status === "ativo" && i.periodicidade === "mensal").reduce((a, i) => a + i.valor, 0);
  const ia = Math.round(consumoIaMesUsd * cambio);
  const variavel = Math.max(0, Math.round(mediaDia30 * 30 - fixos - infMes));
  const [novos, setNovos] = useState(20);
  const [churn, setChurn] = useState(12);
  const [gasto, setGasto] = useState(Math.max(300, Math.round((fixos + infMes + variavel) / 50) * 50));
  const ativos = vendas?.assinantes ?? 0;
  const liquido = vendas?.liquido_medio ?? 24.45;

  const cen = useMemo(() => ({
    pes: projetar({ saldo, ativos, liquido, novos: Math.round(novos * 0.4), churn: Math.min(30, churn + 4), gastoMes: gasto }),
    base: projetar({ saldo, ativos, liquido, novos, churn, gastoMes: gasto }),
    oti: projetar({ saldo, ativos, liquido, novos: Math.round(novos * 1.6), churn: Math.max(2, churn - 4), gastoMes: gasto }),
  }), [saldo, ativos, liquido, novos, churn, gasto]);

  const hoje = new Date();
  const rotulos = [0, 1, 2, 3].map((i) => MESES[(hoje.getMonth() + i) % 12]!);
  const all = [...cen.pes.serie, ...cen.base.serie, ...cen.oti.serie];
  const mx = Math.max(...all, 0) * 1.1 || 1, mn = Math.min(0, ...all) * 1.1;
  const W = 640, H = 230, L = 56, R = 16, T = 14, B = 28;
  const x = (i: number) => L + (i / 3) * (W - L - R);
  const y = (v: number) => T + (1 - (v - mn) / (mx - mn)) * (H - T - B);
  const linha = (s: number[]) => s.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`).join(" ");
  const fim = cen.base.serie[3]!;
  const entraMes = cen.base.ativos * liquido;

  return (
    <div className="cx-grid cx-g21">
      <div className="cx-card">
        <div className="cx-hd"><h2>Próximos 3 meses</h2><span>a partir de {moeda(saldo)} hoje e {ativos} assinantes ativos</span></div>
        <svg className="cx-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projeção do saldo nos próximos 3 meses">
          {[mn, 0, mx].filter((v, i, a) => a.indexOf(v) === i).map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? "rgba(255,255,255,.2)" : "rgba(255,255,255,.07)"} /><text x={L - 6} y={y(v) + 4} textAnchor="end">{Math.round(v).toLocaleString("pt-BR")}</text></g>)}
          {rotulos.map((r, i) => <text key={r + i} x={x(i)} y={H - 8} textAnchor="middle">{r}</text>)}
          {([[cen.pes.serie, "#FF5A45", "5 4"], [cen.oti.serie, "#3DD68C", "5 4"], [cen.base.serie, "#FFC800", ""]] as const).map(([s, c, d]) => (
            <g key={c}><path d={linha([...s])} fill="none" stroke={c} strokeWidth={d ? 2 : 3} strokeDasharray={d} /><circle cx={x(3)} cy={y(s[3]!)} r={4.5} fill={c} /></g>
          ))}
        </svg>
        <div className="cx-legend"><span><i style={{ background: "#3DD68C" }} />otimista</span><span><i style={{ background: "#FFC800" }} />base</span><span><i style={{ background: "#FF5A45" }} />pessimista</span></div>
        <div className="cx-grid cx-g3 cx-sec" style={{ gap: 10 }}>
          {([["Pessimista", cen.pes, "#FF5A45"], ["Base", cen.base, "#FFC800"], ["Otimista", cen.oti, "#3DD68C"]] as const).map(([n, c, cor]) => (
            <div key={n} className="cx-card" style={{ borderTop: `3px solid ${cor}` }}>
              <span className="k">{n} · {rotulos[3]}</span>
              <div className="num" style={{ fontSize: 22, fontWeight: 900, marginTop: 6, color: c.serie[3]! < 0 ? "var(--bad)" : "var(--ink)" }}>{moeda(c.serie[3]!, true)}</div>
              <small className="mut">{c.ativos} assinantes</small>
            </div>
          ))}
        </div>
      </div>
      <div className="cx-card">
        <div className="cx-hd"><h2>E se…</h2><span>mexe e o gráfico responde</span></div>
        {([["Assinantes novos por mês", novos, setNovos, 0, 100, 5, String(novos)], ["Cancelam por mês (churn)", churn, setChurn, 0, 30, 1, `${churn}%`], ["Gasto por mês", gasto, setGasto, 0, 6000, 50, moeda(gasto, true)]] as const).map(([rot, v, set, min, max, step, txt]) => (
          <div key={rot} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--line)" }}>
            <label htmlFor={`cx-sl-${rot}`} style={{ fontSize: 12.5, fontWeight: 700 }}>{rot}
              <input id={`cx-sl-${rot}`} type="range" min={min} max={max} step={step} value={v} onChange={(e) => set(Number(e.target.value))} style={{ padding: 0, accentColor: "#FFC800", background: "none", border: 0 }} />
            </label>
            <b className="num" style={{ minWidth: 70, textAlign: "right" }}>{txt}</b>
          </div>
        ))}
        <div className="cx-dica" style={{ marginTop: 12 }}>
          <span className="k">Leitura</span>
          <p>{fim >= saldo
            ? <><b>No cenário base, {rotulos[3]} fecha com {moeda(fim, true)} no caixa</b> e {cen.base.ativos} assinantes ({moeda(entraMes, true)} líquido por mês).</>
            : <><b>No cenário base o caixa cai pra {moeda(fim, true)} em {rotulos[3]}.</b> Entram {moeda(entraMes, true)} por mês e saem {moeda(gasto, true)}.</>}
            {" "}Cada ponto de churn a menos vale ~{moeda(ativos * 0.01 * liquido * 3, true)} no trimestre.</p>
        </div>
        <p className="cx-nota">Gasto sugerido = contas fixas {moeda(fixos, true)} + influenciadores {moeda(infMes, true)} + o resto no ritmo dos últimos 30 dias {moeda(variavel, true)} (a IA entra pelas recargas; o consumo do mês está em {moeda(ia, true)}). Cada assinante rende {moeda(liquido)} líquido por mês na Hotmart.</p>
      </div>
    </div>
  );
}
