/* Caixa da Vant — extrato: tudo que entrou e saiu, quem lançou, e o histórico de
   alterações (antes/depois) de cada mudança. Apagar pede confirmação na própria linha. */
import { useMemo, useState } from "react";
import type { CaixaLancamento, CaixaAuditoria } from "@/hooks/useCaixa";
import { catInfo } from "@/hooks/useCaixa";
import { Src } from "./caixa-ui";
import { moeda, dataBR } from "./caixa-fmt";

type Filtro = "todos" | "entradas" | "saidas" | "a_pagar" | "ajustes" | "consumo_ia";

interface Props {
  lancamentos: CaixaLancamento[];
  auditoria: CaixaAuditoria[];
  socios: Record<string, string>;
  categoria: string | null;
  onLimparCategoria: () => void;
  onEditar: (l: CaixaLancamento) => void;
  onMarcarPago: (l: CaixaLancamento) => void;
  onApagar: (l: CaixaLancamento) => Promise<boolean>;
  onVerComprovante: (path: string) => void;
}

const quemFoi = (l: { criado_por: string | null; origem?: string }, socios: Record<string, string>) =>
  l.criado_por ? socios[l.criado_por] ?? "sócio" : l.origem === "hotmart" ? "Hotmart" : l.origem === "anthropic" || l.origem === "openai" ? "API" : "sistema";

function resumoAudit(a: CaixaAuditoria): string {
  const d = (a.depois ?? a.antes ?? {}) as Record<string, unknown>;
  const nome = String(d.descricao ?? d.nome ?? d.chave ?? "");
  if (a.acao === "update" && a.antes && a.depois) {
    const mud = Object.keys(a.depois).filter((k) => !["atualizado_em"].includes(k) && JSON.stringify(a.antes?.[k]) !== JSON.stringify(a.depois?.[k]));
    return `${nome}: ${mud.map((k) => `${k} ${fmtV(a.antes?.[k])} → ${fmtV(a.depois?.[k])}`).join(", ") || "sem mudança"}`;
  }
  const v = d.valor != null && typeof d.valor === "number" ? ` (${moeda(d.valor)})` : "";
  return `${nome}${v}`;
}
const fmtV = (v: unknown) => (typeof v === "number" ? moeda(v) : v == null ? "—" : String(v).slice(0, 40));

export default function CaixaExtrato({ lancamentos, auditoria, socios, categoria, onLimparCategoria, onEditar, onMarcarPago, onApagar, onVerComprovante }: Props) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [confirmar, setConfirmar] = useState<string | null>(null);

  const lista = useMemo(() => lancamentos.filter((l) => {
    if (filtro === "consumo_ia") { if (l.afeta_saldo) return false; }
    else if (!l.afeta_saldo) return false;
    if (filtro === "entradas" && !(l.valor > 0 && l.tipo !== "ajuste")) return false;
    if (filtro === "saidas" && !(l.valor < 0 && l.tipo !== "ajuste")) return false;
    if (filtro === "a_pagar" && l.status !== "a_pagar") return false;
    if (filtro === "ajustes" && l.tipo !== "ajuste") return false;
    if (categoria && l.categoria !== categoria) return false;
    if (busca && !`${l.descricao} ${l.obs ?? ""}`.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  }), [lancamentos, filtro, busca, categoria]);

  const chips: [Filtro, string][] = [["todos", "Todos"], ["entradas", "Entradas"], ["saidas", "Saídas"], ["a_pagar", "A pagar"], ["ajustes", "Ajustes"], ["consumo_ia", "Consumo das APIs"]];

  return (
    <>
      <div className="cx-card">
        <div className="cx-hd"><h2>Extrato</h2><span>{lista.length} lançamento{lista.length === 1 ? "" : "s"} · o mais novo em cima</span></div>
        <div className="cx-chips" style={{ marginBottom: 10 }}>
          {chips.map(([k, r]) => <button type="button" key={k} className={`cx-chip ${filtro === k ? "on" : ""}`} onClick={() => setFiltro(k)}>{r}</button>)}
          {categoria && <button type="button" className="cx-chip on" onClick={onLimparCategoria}>{catInfo(categoria).rotulo} ✕</button>}
        </div>
        <input id="cx-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no extrato…" style={{ marginBottom: 10 }} />
        {filtro === "consumo_ia" && <p className="cx-nota" style={{ marginTop: 0 }}>Consumo vem direto das APIs e <b>não mexe no saldo</b> — o dinheiro saiu na recarga.</p>}
        <div className="cx-tblwrap">
          {lista.length === 0 ? <p className="cx-empty">Nada aqui ainda.</p> : (
            <table className="cx-tbl">
              <thead><tr><th>Dia</th><th>Descrição</th><th>Categoria</th><th>Quem</th><th>Status</th><th className="r">Valor</th><th /></tr></thead>
              <tbody>
                {lista.map((l) => (
                  <tr key={l.id}>
                    <td className="num mut">{dataBR(l.data)}</td>
                    <td style={{ minWidth: 200 }}>
                      {l.descricao}
                      {l.moeda_original === "USD" && l.valor_original != null && <span className="mut"> · US$ {Number(l.valor_original).toFixed(2)} × {Number(l.cambio).toFixed(2)}</span>}
                      {l.obs && <div className="mut" style={{ fontSize: 11.5 }}>{l.obs}</div>}
                      {l.comprovante_url && <button type="button" className="cx-btn sm" style={{ marginTop: 4 }} onClick={() => onVerComprovante(l.comprovante_url!)}>📎 comprovante</button>}
                    </td>
                    <td>{catInfo(l.categoria).icone} {catInfo(l.categoria).rotulo}</td>
                    <td>{quemFoi(l, socios)}{!l.criado_por && l.origem === "hotmart" && <Src tipo="live">auto</Src>}</td>
                    <td>{l.tipo === "ajuste" ? <span className="cx-st mut">ajuste</span> : l.status === "a_pagar" ? <span className="cx-st pend">{l.valor < 0 ? "a pagar" : "a receber"}</span> : <span className="cx-st pago">ok</span>}</td>
                    <td className={`r num ${l.valor > 0 ? "pos" : "neg"}`}>{l.valor > 0 ? "+" : ""}{moeda(l.valor)}</td>
                    <td className="r" style={{ whiteSpace: "nowrap" }}>
                      {confirmar === l.id ? (
                        <>
                          <button type="button" className="cx-btn sm bad" onClick={async () => { if (await onApagar(l)) setConfirmar(null); }}>apagar mesmo</button>{" "}
                          <button type="button" className="cx-btn sm" onClick={() => setConfirmar(null)}>não</button>
                        </>
                      ) : l.afeta_saldo && l.origem !== "hotmart" && l.tipo !== "ajuste" && (
                        <>
                          {l.status === "a_pagar" && <button type="button" className="cx-btn sm" onClick={() => onMarcarPago(l)}>{l.valor < 0 ? "paguei" : "recebi"}</button>}{" "}
                          <button type="button" className="cx-btn sm" onClick={() => onEditar(l)}>editar</button>{" "}
                          <button type="button" className="cx-btn sm" onClick={() => setConfirmar(l.id)} aria-label="Apagar">🗑</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="cx-card cx-sec">
        <div className="cx-hd"><h2>Histórico de alterações</h2><span>quem mexeu, quando, e o que mudou</span></div>
        {auditoria.length === 0 ? <p className="cx-empty">Nada alterado ainda.</p> : (
          <div className="cx-tblwrap">
            <table className="cx-tbl">
              <thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Detalhe</th></tr></thead>
              <tbody>
                {auditoria.slice(0, 60).map((a) => (
                  <tr key={a.id}>
                    <td className="num mut" style={{ whiteSpace: "nowrap" }}>{new Date(a.quando).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td>{a.quem ? socios[a.quem] ?? "sócio" : "sistema"}</td>
                    <td>{{ insert: "lançou", update: "alterou", delete: "apagou" }[a.acao] ?? a.acao} <span className="mut">· {a.tabela.replace("caixa_", "")}</span></td>
                    <td style={{ minWidth: 220 }}>{resumoAudit(a)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
