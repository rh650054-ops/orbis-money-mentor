/* Caixa da Vant — Visão geral: saldo ao vivo, mês, gasto a mais, dicas da IA, pra onde foi. */
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { CaixaResumo } from "@/hooks/useCaixa";
import { catInfo } from "@/hooks/useCaixa";
import { Tile, Src, SaldoChart } from "./caixa-ui";
import { moeda, dataBR, mesNome, hojeBR } from "./caixa-fmt";

interface Alerta { icone: string; cor: string; titulo: string; texto: string }

/** Ritmo de gasto honesto: nos primeiros dias do caixa divide pelos dias que existem (não por 30),
 *  e só mostra "aguenta X dias" depois de 7 dias de uso — antes disso uma recarga única distorce tudo. */
function ritmo(r: CaixaResumo) {
  const ab = (r.config as Record<string, unknown>).aberto_em;
  const abertura = typeof ab === "string" ? new Date(ab).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : null;
  const diasUso = abertura ? Math.max(1, Math.round((new Date(`${r.hoje}T12:00:00`).getTime() - new Date(`${abertura}T12:00:00`).getTime()) / 86400000) + 1) : 30;
  const base = Math.min(30, diasUso);
  const porDia = (r.media_dia_30 * 30) / base;
  const confiavel = diasUso >= 7;
  const aguenta = confiavel && porDia > 0 ? Math.floor(r.saldo / porDia) : null;
  return { abertura, diasUso, porDia, confiavel, aguenta };
}

function alertas(r: CaixaResumo): Alerta[] {
  const out: Alerta[] = [];
  const tetos = r.config.tetos ?? {};
  for (const c of r.categorias) {
    const teto = tetos[c.categoria];
    if (teto && c.total >= teto) out.push({ icone: catInfo(c.categoria).icone, cor: "rgba(255,90,69,.14)", titulo: `${catInfo(c.categoria).rotulo} passou do teto`, texto: `${moeda(c.total)} de ${moeda(teto, true)} combinados pro mês.` });
    else if (teto && c.total >= teto * 0.8) out.push({ icone: catInfo(c.categoria).icone, cor: "rgba(255,138,61,.14)", titulo: `${catInfo(c.categoria).rotulo} chegando no teto`, texto: `${moeda(c.total)} de ${moeda(teto, true)} (${Math.round((c.total / teto) * 100)}%).` });
    if (c.anterior > 0 && c.total >= c.anterior * 1.5) out.push({ icone: catInfo(c.categoria).icone, cor: "rgba(255,138,61,.14)", titulo: `${catInfo(c.categoria).rotulo} subiu ${Math.round((c.total / c.anterior - 1) * 100)}%`, texto: `${moeda(c.total)} este mês contra ${moeda(c.anterior)} no anterior.` });
  }
  if (r.a_pagar > r.saldo) out.push({ icone: "⚠️", cor: "rgba(255,90,69,.14)", titulo: "Tem mais a pagar do que saldo", texto: `${moeda(r.a_pagar)} a pagar e ${moeda(r.saldo)} em conta.` });
  const rt = ritmo(r);
  if (rt.aguenta !== null && rt.aguenta < 45) out.push({ icone: "⏳", cor: "rgba(255,90,69,.14)", titulo: `Saldo aguenta ${rt.aguenta} dias`, texto: `No ritmo dos últimos ${Math.min(30, rt.diasUso)} dias (${moeda(rt.porDia)} por dia).` });
  const hoje = hojeBR();
  for (const i of r.influenciadores) {
    if (i.status !== "ativo") continue;
    if (i.proximo_vencimento && i.proximo_vencimento <= hoje) out.push({ icone: "🤝", cor: "rgba(255,90,69,.14)", titulo: `${i.nome} venceu ${dataBR(i.proximo_vencimento)}`, texto: `${moeda(i.valor)} combinados${i.pix_chave ? "" : " — e sem Pix cadastrado"}.` });
    else if (i.proximo_vencimento && i.proximo_vencimento <= new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })) out.push({ icone: "🤝", cor: "rgba(255,138,61,.14)", titulo: `${i.nome} vence ${dataBR(i.proximo_vencimento)}`, texto: `Separa ${moeda(i.valor)}${i.pix_chave ? "" : " e pede a chave Pix"}.` });
  }
  for (const [nome, p] of [["Anthropic", r.ia.anthropic], ["OpenAI", r.ia.openai]] as const) {
    const restante = p.recargas_total - p.consumo_total;
    const porDia = p.consumo_7d / 7;
    if (p.recargas_total > 0 && porDia > 0 && restante / porDia < 10) out.push({ icone: "🤖", cor: "rgba(255,138,61,.14)", titulo: `Crédito da ${nome} acaba em ~${Math.max(0, Math.floor(restante / porDia))} dias`, texto: `Sobram ${moeda(restante)} e o consumo é ${moeda(porDia)} por dia.` });
  }
  const hm = (r.config as Record<string, unknown>).hotmart_atualizado_em;
  if (typeof hm === "string" && Date.now() - new Date(hm).getTime() > 7 * 86400000)
    out.push({ icone: "💚", cor: "rgba(255,138,61,.14)", titulo: "Confere o saldo com a Hotmart", texto: `Última conferência em ${dataBR(new Date(hm).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }))}. Toque em "saldo" › Bater com a Hotmart.` });
  return out.slice(0, 5);
}

export default function CaixaGeral({ resumo, onSync, onIr }: { resumo: CaixaResumo; onSync: (a: "dicas") => Promise<unknown>; onIr: (tab: string) => void }) {
  const [gerando, setGerando] = useState(false);
  const r = resumo;
  const lucro = r.entrou - r.saiu;
  const rt = ritmo(r);
  const serie = rt.abertura ? r.serie.filter((p) => p.d >= rt.abertura!) : r.serie;
  const als = alertas(r);
  const maior = r.categorias[0]?.total ?? 0;
  const aReceber = Number(r.config.hotmart_a_receber) || 0;
  const cfgX = r.config as Record<string, unknown>;
  const disp = Number(cfgX.hotmart_disponivel) || 0;
  const hmData = typeof cfgX.hotmart_atualizado_em === "string" ? new Date(cfgX.hotmart_atualizado_em).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : null;

  return (
    <>
      <div className="cx-grid cx-g5">
        <Tile className="saldo" k={<><span className="cx-dot" />Saldo da Vant</>} big={moeda(r.saldo)}
          sub={<>{r.a_pagar > 0 ? `${moeda(r.a_pagar)} a pagar · ` : ""}Hotmart {hmData ? `em ${dataBR(hmData)}` : ""}: {moeda(disp)} disponível + {moeda(aReceber)} a receber</>} />
        <Tile k="Entrou no mês" big={moeda(r.entrou)} cor="var(--ok)" sub={<>vendas da Hotmart (líquido) e aportes <Src tipo="live">auto</Src></>} />
        <Tile k="Saiu no mês" big={moeda(r.saiu)} cor="var(--bad)" sub={r.saiu_anterior > 0 ? `mês anterior: ${moeda(r.saiu_anterior)}` : "pagos + a pagar, sem os ajustes"} />
        <Tile k="Resultado do mês" big={moeda(lucro)} cor={lucro >= 0 ? "var(--ok)" : "var(--bad)"} sub="entrou − saiu" />
        <Tile k="Ritmo de gasto" big={rt.confiavel ? moeda(rt.porDia) : "medindo…"}
          sub={rt.confiavel ? `por dia · saldo aguenta ${rt.aguenta ?? "—"} dias` : `caixa com ${rt.diasUso} dia${rt.diasUso === 1 ? "" : "s"} · o ritmo aparece com 7 dias de uso`} />
      </div>

      <div className="cx-grid cx-g21 cx-sec">
        <div className="cx-card">
          <div className="cx-hd"><h2>Saldo dia a dia</h2><span>{mesNome(r.mes)} · verde entrou, vermelho saiu</span></div>
          <SaldoChart serie={serie} />
        </div>
        <div className="cx-card">
          <div className="cx-hd"><h2>🚨 Gasto a mais</h2><span>fora do combinado</span></div>
          {als.length === 0 ? <p className="cx-empty">Nada fora do padrão. Os tetos do mês: marketing, IA e prêmios.</p>
            : als.map((a, i) => (
              <div className="cx-alerta" key={i}><span className="ic" style={{ background: a.cor }}>{a.icone}</span><div><b>{a.titulo}</b><p>{a.texto}</p></div></div>
            ))}
        </div>
      </div>

      <div className="cx-sec">
        <div className="cx-hd">
          <h2>Dicas da IA</h2>
          <button type="button" className="cx-btn sm" disabled={gerando} onClick={async () => { setGerando(true); await onSync("dicas"); setGerando(false); }}>
            {gerando ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : <RefreshCw className="w-3.5 h-3.5 inline" />} {r.dicas ? " nova leitura" : " gerar leitura"}
          </button>
        </div>
        {r.dicas && r.dicas.dicas.length > 0 ? (
          <>
            {r.dicas.alertas.length > 0 && (
              <div className="cx-card" style={{ marginBottom: 10, borderColor: "rgba(255,90,69,.35)" }}>
                {r.dicas.alertas.map((a, i) => <div className="cx-alerta" key={i}><span className="ic" style={{ background: a.nivel === "alto" ? "rgba(255,90,69,.14)" : "rgba(255,138,61,.14)" }}>{a.nivel === "alto" ? "🔴" : "🟠"}</span><div><p style={{ marginTop: 6 }}>{a.texto}</p></div></div>)}
              </div>
            )}
            <div className="cx-grid cx-g3">
              {r.dicas.dicas.map((d, i) => (
                <div className="cx-dica" key={i}><span className="k">{d.titulo}</span><p>{d.texto}</p>{d.acao && <div className="acao">→ {d.acao}</div>}</div>
              ))}
            </div>
            <p className="cx-nota">Gerada {new Date(r.dicas.geradas_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              {r.dicas.app ? ` · app: ${r.dicas.app.assinantes_ativos} assinantes ativos, ${r.dicas.app.vendas_mes} vendas no mês (${moeda(Number(r.dicas.app.bruto_mes))} bruto), ${r.dicas.app.cancelamentos_mes} cancelamentos` : ""}
              {r.dicas.fonte === "regra" ? " · IA indisponível, leitura feita por regra" : ""}
            </p>
          </>
        ) : <p className="cx-empty">Toque em "gerar leitura": a IA olha o saldo, os gastos, o crédito das APIs, os influenciadores e os números do app (assinantes, vendas, cancelamentos) e devolve 3 dicas.</p>}
      </div>

      <div className="cx-grid cx-g2 cx-sec">
        <div className="cx-card">
          <div className="cx-hd"><h2>Pra onde foi</h2><span>{mesNome(r.mes)}</span></div>
          {r.categorias.length === 0 ? <p className="cx-empty">Nenhum gasto lançado neste mês.</p> : r.categorias.map((c) => {
            const info = catInfo(c.categoria);
            const w = maior > 0 ? Math.max(4, Math.round((c.total / maior) * 100)) : 0;
            const var_ = c.anterior > 0 ? Math.round((c.total / c.anterior - 1) * 100) : null;
            return (
              <button type="button" key={c.categoria} className="cx-cat" style={{ width: "100%", background: "none", border: 0, borderTop: undefined, color: "inherit", textAlign: "left", cursor: "pointer" }} onClick={() => onIr(`extrato:${c.categoria}`)}>
                <span className="ic">{info.icone}</span>
                <div><b>{info.rotulo}</b><div className="bar"><i style={{ width: `${w}%`, background: info.cor }} /></div></div>
                <div className="v"><b className="num">{moeda(c.total)}</b><span className={var_ !== null && var_ > 0 ? "up" : var_ !== null && var_ < 0 ? "dn" : ""}>{var_ === null ? `${r.saiu > 0 ? Math.round((c.total / r.saiu) * 100) : 0}% · ${c.qtd}×` : `${var_ > 0 ? "▲" : var_ < 0 ? "▼" : "="} ${Math.abs(var_)}% vs mês anterior`}</span></div>
              </button>
            );
          })}
        </div>
        <div className="cx-card">
          <div className="cx-hd"><h2>Crédito das APIs</h2><span>recarga (dinheiro) × consumo (uso)</span></div>
          {([["Anthropic", r.ia.anthropic], ["OpenAI", r.ia.openai]] as const).map(([nome, p]) => {
            const restante = p.recargas_total - p.consumo_total;
            return (
              <div className="cx-cat" key={nome}>
                <span className="ic">🤖</span>
                <div><b>{nome}</b><div className="bar"><i style={{ width: p.recargas_total > 0 ? `${Math.min(100, Math.max(0, (restante / p.recargas_total) * 100))}%` : "0%", background: "#FFC800" }} /></div></div>
                <div className="v"><b className="num">{p.recargas_total > 0 ? moeda(restante) : "—"}</b><span>{p.recargas_total > 0 ? `sobra de ${moeda(p.recargas_total)} · gastou ${moeda(p.consumo_mes)} no mês` : p.ultimo ? `consumo ${moeda(p.consumo_mes)} no mês` : "sem dado ainda"}</span></div>
              </div>
            );
          })}
          <p className="cx-nota">O consumo vem direto da API (aba IA). Recarga é o Pix/cartão que você lança como gasto na categoria IA.</p>
        </div>
      </div>
    </>
  );
}
