/* Caixa da Vant — IA: consumo direto das APIs (Anthropic e OpenAI), crédito que sobra
   e em quantos dias acaba. Consumo NÃO mexe no saldo (o dinheiro saiu na recarga). */
import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { CaixaLancamento } from "@/hooks/useCaixa";
import { Modal } from "./caixa-ui";
import { lerValor, moeda, dataBR, hojeBR } from "./caixa-fmt";

type Prov = "anthropic" | "openai";
const NOME: Record<Prov, string> = { anthropic: "Anthropic", openai: "OpenAI" };
const COR: Record<Prov, string> = { anthropic: "#FFC800", openai: "#4FA3FF" };
interface Credito { usd: number; em: string }

interface Props {
  lancamentos: CaixaLancamento[];
  config: Record<string, unknown>;
  cambio: number;
  onSync: () => Promise<unknown>;
  onSalvarConfig: (chave: string, valor: unknown) => Promise<boolean>;
}

function contas(p: Prov, l: CaixaLancamento[], cred: Credito | null) {
  const consumo = l.filter((x) => x.origem === p && !x.afeta_saldo);
  const recargas = l.filter((x) => x.origem === "manual" && x.categoria === "ia" && x.afeta_saldo && x.status === "pago" && new RegExp(NOME[p], "i").test(x.descricao));
  const usd = (x: CaixaLancamento) => Math.abs(Number(x.valor_original) || 0);
  const hoje = hojeBR();
  const d7 = new Date(Date.now() - 7 * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const mes = hoje.slice(0, 7);
  const soma = (xs: CaixaLancamento[]) => xs.reduce((a, x) => a + usd(x), 0);
  const consumoMes = soma(consumo.filter((x) => x.data.startsWith(mes)));
  const consumoHoje = soma(consumo.filter((x) => x.data === hoje));
  const dias7 = consumo.filter((x) => x.data > d7);
  const porDia = dias7.length > 0 ? soma(dias7) / Math.min(7, Math.max(1, new Set(dias7.map((x) => x.data)).size)) : 0;
  let restante: number | null = null;
  let base = "";
  if (cred) {
    const dCred = cred.em.slice(0, 10);
    restante = cred.usd - soma(consumo.filter((x) => x.data >= dCred)) + soma(recargas.filter((x) => x.criado_em > cred.em));
    base = `saldo do console em ${dataBR(dCred)}`;
  } else if (recargas.length > 0) {
    restante = soma(recargas) - soma(consumo);
    base = "recargas lançadas − consumo (sem o saldo do console)";
  }
  const diasRestantes = restante !== null && porDia > 0 ? Math.max(0, Math.floor(restante / porDia)) : null;
  return { consumo, consumoMes, consumoHoje, porDia, restante, base, diasRestantes, recargas: soma(recargas) };
}

function Barras({ l }: { l: CaixaLancamento[] }) {
  const dias: string[] = [];
  for (let i = 29; i >= 0; i--) dias.push(new Date(Date.now() - i * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }));
  const val = (p: Prov, d: string) => l.filter((x) => x.origem === p && x.data === d).reduce((a, x) => a + Math.abs(Number(x.valor_original) || 0), 0);
  const tot = dias.map((d) => val("anthropic", d) + val("openai", d));
  const mx = Math.max(...tot, 0.01);
  const W = 1000, H = 230, L = 44, B = 24, T = 10, bw = (W - L - 8) / 30;
  const y = (v: number) => T + (1 - v / mx) * (H - T - B);
  return (
    <svg className="cx-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Consumo de IA por dia, em dólar">
      {[0, mx / 2, mx].map((v, i) => <g key={i}><line x1={L} x2={W - 8} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.07)" /><text x={L - 6} y={y(v) + 4} textAnchor="end">{v.toFixed(v < 1 ? 2 : 0)}</text></g>)}
      {dias.map((d, i) => {
        const a = val("anthropic", d), o = val("openai", d);
        return (
          <g key={d}>
            {a > 0 && <rect x={L + i * bw + 1} y={y(a)} width={bw - 2} height={y(0) - y(a)} rx={2} fill={COR.anthropic} />}
            {o > 0 && <rect x={L + i * bw + 1} y={y(a + o)} width={bw - 2} height={y(a) - y(a + o)} rx={2} fill={COR.openai} />}
            {i % 5 === 4 && <text x={L + i * bw + bw / 2} y={H - 6} textAnchor="middle">{d.slice(8, 10)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export default function CaixaIA({ lancamentos, config, cambio, onSync, onSalvarConfig }: Props) {
  const [sync, setSync] = useState(false);
  const [editCred, setEditCred] = useState<Prov | null>(null);
  const estado = (config.ia_sync ?? {}) as Record<string, { ok?: boolean; erro?: string; total_usd?: number } | string>;
  const quando = typeof estado.quando === "string" ? estado.quando : null;
  const semChave = (["anthropic", "openai"] as Prov[]).filter((p) => (estado[p] as { erro?: string } | undefined)?.erro === "chave_nao_configurada");

  return (
    <>
      <div className="cx-hd">
        <h2>Consumo das APIs</h2>
        <span>
          {quando ? `atualizado ${new Date(quando).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "ainda não sincronizado"}{" "}
          <button type="button" className="cx-btn sm" disabled={sync} onClick={async () => { setSync(true); await onSync(); setSync(false); }}>
            {sync ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : <RefreshCw className="w-3.5 h-3.5 inline" />} atualizar agora
          </button>
        </span>
      </div>

      <div className="cx-grid cx-g2">
        {(["anthropic", "openai"] as Prov[]).map((p) => {
          const cred = (config[`credito_${p}`] ?? null) as Credito | null;
          const c = contas(p, lancamentos, cred);
          const st = estado[p] as { ok?: boolean; erro?: string } | undefined;
          const alerta = c.diasRestantes !== null && c.diasRestantes < 10;
          return (
            <div className="cx-card" key={p} style={alerta ? { borderColor: "rgba(255,90,69,.4)" } : undefined}>
              <div className="cx-hd"><h2 style={{ color: COR[p] }}>{NOME[p]}</h2>
                <span>{st?.ok ? <span className="cx-st pago">conectado</span> : st?.erro === "chave_nao_configurada" ? <span className="cx-st pend">falta a chave</span> : st?.erro ? <span className="cx-st venc" title={st.erro}>erro na API</span> : <span className="cx-st mut">—</span>}</span>
              </div>
              <div className="cx-grid cx-g3" style={{ gap: 8 }}>
                <div><span className="k">Hoje</span><div className="num" style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>US$ {c.consumoHoje.toFixed(2)}</div></div>
                <div><span className="k">No mês</span><div className="num" style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>US$ {c.consumoMes.toFixed(2)}</div><small className="mut">{moeda(c.consumoMes * cambio)}</small></div>
                <div><span className="k">Ritmo</span><div className="num" style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>US$ {c.porDia.toFixed(2)}</div><small className="mut">por dia (7 dias)</small></div>
              </div>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                <span className="k">Crédito que sobra</span>
                <div className="num" style={{ fontSize: 24, fontWeight: 900, marginTop: 4, color: c.restante !== null && c.restante < 3 ? "var(--bad)" : "var(--ink)" }}>
                  {c.restante === null ? "—" : `US$ ${c.restante.toFixed(2)}`}
                  {c.diasRestantes !== null && <span style={{ fontSize: 13, color: alerta ? "var(--bad)" : "var(--ink3)", fontWeight: 800 }}> · acaba em ~{c.diasRestantes} dia{c.diasRestantes === 1 ? "" : "s"}</span>}
                </div>
                <small className="mut">{c.base || "lança a recarga como gasto na categoria IA pra eu calcular"}</small>
                <div><button type="button" className="cx-btn sm" style={{ marginTop: 8 }} onClick={() => setEditCred(p)}>informar saldo do console</button></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="cx-card cx-sec">
        <div className="cx-hd"><h2>Por dia</h2><span>últimos 30 dias, em US$</span></div>
        <Barras l={lancamentos} />
        <div className="cx-legend"><span><i style={{ background: COR.anthropic }} />Anthropic</span><span><i style={{ background: COR.openai }} />OpenAI</span></div>
      </div>

      {semChave.length > 0 && (
        <div className="cx-card cx-sec" style={{ borderColor: "rgba(255,200,0,.35)" }}>
          <div className="cx-hd"><h2>Ligar {semChave.map((p) => NOME[p]).join(" e ")}</h2><span>uma vez só</span></div>
          <p className="cx-nota" style={{ marginTop: 0 }}>
            O consumo vem da <b>chave Admin</b> (não é a chave normal da API). Anthropic: console → Settings → Admin keys. OpenAI: platform → Settings → Admin keys.
            Depois, no Supabase: Edge Functions → Secrets → crie <b>ANTHROPIC_ADMIN_KEY</b> e <b>OPENAI_ADMIN_KEY</b>. Não mande a chave por mensagem pra ninguém.
          </p>
        </div>
      )}

      {editCred && <FormCredito prov={editCred} atual={(config[`credito_${editCred}`] ?? null) as Credito | null} onClose={() => setEditCred(null)} onSalvar={(v) => onSalvarConfig(`credito_${editCred}`, v)} />}
    </>
  );
}

function FormCredito({ prov, atual, onClose, onSalvar }: { prov: Prov; atual: Credito | null; onClose: () => void; onSalvar: (v: Credito) => Promise<boolean> }) {
  const [txt, setTxt] = useState(atual ? String(atual.usd).replace(".", ",") : "");
  const [indo, setIndo] = useState(false);
  return (
    <Modal titulo={`Saldo de crédito — ${NOME[prov]}`} onClose={onClose}>
      <div className="cx-form">
        <p className="cx-nota" style={{ marginTop: 0 }}>Abre o console da {NOME[prov]} e copia o "credit balance" de agora. A partir daqui eu desconto o consumo do dia a dia e somo as recargas novas.</p>
        <label><span className="lb">Saldo agora (US$)</span><input id="cx-cred" inputMode="decimal" value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="0,00" /></label>
        <button type="button" className="cx-btn gold" disabled={indo || !txt} onClick={async () => { setIndo(true); const ok = await onSalvar({ usd: lerValor(txt), em: new Date().toISOString() }); setIndo(false); if (ok) onClose(); }}>
          {indo ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Salvar saldo do console"}
        </button>
      </div>
    </Modal>
  );
}
