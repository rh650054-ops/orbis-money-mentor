/* Caixa da Vant — influenciadores (o que foi combinado com cada um e o que falta pagar)
   e contas fixas (Supabase, Vercel, Pluggy...). "Pagar" vira saída no extrato. */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { CaixaInfluenciador, CaixaRecorrente } from "@/hooks/useCaixa";
import { CATEGORIAS } from "@/hooks/useCaixa";
import { Modal, Tile } from "./caixa-ui";
import { lerValor, moeda, dataBR, hojeBR } from "./caixa-fmt";

type Inf = Partial<CaixaInfluenciador> & { nome: string };
type Rec = Partial<CaixaRecorrente> & { descricao: string; valor: number; dia: number };

interface Props {
  influenciadores: CaixaInfluenciador[];
  recorrentes: CaixaRecorrente[];
  onSalvarInf: (i: Inf) => Promise<boolean>;
  onPagar: (i: CaixaInfluenciador, valor: number, data: string) => Promise<boolean>;
  onSalvarRec: (r: Rec) => Promise<boolean>;
}

const fimDoMes = () => { const h = hojeBR(); const d = new Date(Number(h.slice(0, 4)), Number(h.slice(5, 7)), 0); return d.toLocaleDateString("en-CA"); };
const PER: Record<string, string> = { mensal: "todo mês", unico: "uma vez", por_video: "por vídeo" };

export default function CaixaInfluenciadores({ influenciadores, recorrentes, onSalvarInf, onPagar, onSalvarRec }: Props) {
  const [editInf, setEditInf] = useState<Inf | null>(null);
  const [pagando, setPagando] = useState<CaixaInfluenciador | null>(null);
  const [editRec, setEditRec] = useState<Rec | null>(null);
  const ativos = influenciadores.filter((i) => i.status === "ativo");
  const fim = fimDoMes();
  const vencendo = ativos.filter((i) => i.proximo_vencimento && i.proximo_vencimento <= fim);
  const devidoMes = vencendo.reduce((a, i) => a + i.valor, 0);
  const pagoMes = influenciadores.reduce((a, i) => a + i.pago_mes, 0);
  const semPix = ativos.filter((i) => !i.pix_chave).length;
  const fixos = recorrentes.filter((r) => r.ativo).reduce((a, r) => a + r.valor, 0);

  return (
    <>
      <div className="cx-grid cx-g4">
        <Tile k="A pagar até o fim do mês" big={moeda(devidoMes)} cor={devidoMes > 0 ? "var(--warn)" : undefined} sub={`${vencendo.length} influenciador${vencendo.length === 1 ? "" : "es"} com vencimento`} />
        <Tile k="Pago no mês" big={moeda(pagoMes)} sub="influenciadores" />
        <Tile k="Sem Pix cadastrado" big={String(semPix)} cor={semPix > 0 ? "var(--bad)" : undefined} sub={semPix > 0 ? "não dá pra pagar em dia" : "todo mundo com Pix"} />
        <Tile k="Contas fixas por mês" big={moeda(fixos)} sub={`${recorrentes.filter((r) => r.ativo).length} ativas`} />
      </div>

      <div className="cx-card cx-sec">
        <div className="cx-hd"><h2>Influenciadores</h2>
          <button type="button" className="cx-btn sm gold" onClick={() => setEditInf({ nome: "", tipo: "cache", periodicidade: "mensal", valor: 0, status: "ativo" })}>＋ novo combinado</button>
        </div>
        {influenciadores.length === 0 ? <p className="cx-empty">Nenhum combinado ainda. Cadastra quem vocês pagam (cachê, por vídeo, permuta) e a Vant avisa quando vencer.</p> : (
          <div className="cx-tblwrap"><table className="cx-tbl">
            <thead><tr><th>Quem</th><th>Combinado</th><th className="r">Valor</th><th>Vence</th><th>Pix</th><th className="r">Pago no mês</th><th /></tr></thead>
            <tbody>{influenciadores.map((i) => {
              const venc = i.status === "ativo" && i.proximo_vencimento;
              const atrasado = venc && i.proximo_vencimento! < hojeBR();
              return (
                <tr key={i.id} style={i.status !== "ativo" ? { opacity: 0.5 } : undefined}>
                  <td><span className="cx-av">{i.nome.slice(0, 1).toUpperCase()}</span>{i.nome}{i.handle && <span className="mut"> {i.handle}</span>}</td>
                  <td>{i.combinado || "—"}<div className="mut" style={{ fontSize: 11.5 }}>{i.tipo === "cache" ? "cachê" : i.tipo} · {PER[i.periodicidade]}{i.cupom ? ` · cupom ${i.cupom}` : ""}</div></td>
                  <td className="r num"><b>{moeda(i.valor)}</b></td>
                  <td>{i.status !== "ativo" ? <span className="cx-st mut">{i.status}</span> : venc ? <span className={`cx-st ${atrasado ? "venc" : "pend"}`}>{atrasado ? "venceu " : ""}{dataBR(i.proximo_vencimento)}</span> : "—"}</td>
                  <td>{i.pix_chave ? <span className="cx-st pago">ok</span> : <span className="cx-st venc">sem Pix</span>}</td>
                  <td className="r num">{moeda(i.pago_mes)}</td>
                  <td className="r" style={{ whiteSpace: "nowrap" }}>
                    {i.status === "ativo" && <button type="button" className="cx-btn sm gold" onClick={() => setPagando(i)}>pagar</button>}{" "}
                    <button type="button" className="cx-btn sm" onClick={() => setEditInf(i)}>editar</button>
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </div>

      <div className="cx-card cx-sec">
        <div className="cx-hd"><h2>Contas fixas</h2>
          <button type="button" className="cx-btn sm" onClick={() => setEditRec({ descricao: "", valor: 0, dia: 5, categoria: "infra", ativo: true })}>＋ conta fixa</button>
        </div>
        {recorrentes.length === 0 ? <p className="cx-empty">Supabase, Vercel, Pluggy, contador… cadastra uma vez e ela entra no extrato como "a pagar" todo mês, no dia certo.</p>
          : recorrentes.map((r) => (
            <div className="cx-cat" key={r.id} style={r.ativo ? undefined : { opacity: 0.5 }}>
              <span className="ic">{CATEGORIAS[r.categoria]?.icone ?? "📎"}</span>
              <div><b>{r.descricao}</b><span className="mut" style={{ fontSize: 11.5 }}>dia {r.dia} · {CATEGORIAS[r.categoria]?.rotulo ?? r.categoria}{r.ativo ? "" : " · pausada"}</span></div>
              <div className="v"><b className="num">{moeda(r.valor)}</b><button type="button" className="cx-btn sm" style={{ marginTop: 4 }} onClick={() => setEditRec(r)}>editar</button></div>
            </div>
          ))}
      </div>

      {editInf && <FormInf inicial={editInf} onClose={() => setEditInf(null)} onSalvar={onSalvarInf} />}
      {pagando && <FormPagar inf={pagando} onClose={() => setPagando(null)} onPagar={onPagar} />}
      {editRec && <FormRec inicial={editRec} onClose={() => setEditRec(null)} onSalvar={onSalvarRec} />}
    </>
  );
}

function FormInf({ inicial, onClose, onSalvar }: { inicial: Inf; onClose: () => void; onSalvar: (i: Inf) => Promise<boolean> }) {
  const [f, setF] = useState<Inf>(inicial);
  const [valorTxt, setValorTxt] = useState(inicial.valor ? String(inicial.valor).replace(".", ",") : "");
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState("");
  const set = (k: keyof CaixaInfluenciador, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const salvar = async () => {
    if (!f.nome.trim()) { setErro("Coloca o nome."); return; }
    setIndo(true);
    const ok = await onSalvar({ ...f, nome: f.nome.trim(), valor: lerValor(valorTxt), proximo_vencimento: f.proximo_vencimento || null, pix_chave: f.pix_chave?.trim() || null });
    setIndo(false); if (ok) onClose();
  };
  return (
    <Modal titulo={inicial.id ? "Editar combinado" : "Novo combinado"} onClose={onClose}>
      <div className="cx-form">
        <div className="row">
          <label><span className="lb">Nome</span><input id="cx-in" value={f.nome} onChange={(e) => set("nome", e.target.value)} maxLength={80} /></label>
          <label><span className="lb">@ (opcional)</span><input id="cx-ih" value={f.handle ?? ""} onChange={(e) => set("handle", e.target.value)} maxLength={60} /></label>
        </div>
        <label><span className="lb">O que foi combinado</span><input id="cx-ic" value={f.combinado ?? ""} onChange={(e) => set("combinado", e.target.value)} placeholder="ex: 2 vídeos por mês + stories" maxLength={160} /></label>
        <div className="row">
          <label><span className="lb">Valor (R$)</span><input id="cx-iv" inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} placeholder="0,00" /></label>
          <label><span className="lb">Paga</span>
            <select id="cx-ip" value={f.periodicidade} onChange={(e) => set("periodicidade", e.target.value)}>
              <option value="mensal">todo mês</option><option value="por_video">por vídeo</option><option value="unico">uma vez</option>
            </select>
          </label>
        </div>
        <div className="row">
          <label><span className="lb">Tipo</span>
            <select id="cx-it" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
              <option value="cache">cachê</option><option value="comissao">comissão</option><option value="permuta">permuta</option>
            </select>
          </label>
          <label><span className="lb">Próximo vencimento</span><input id="cx-iven" type="date" value={f.proximo_vencimento ?? ""} onChange={(e) => set("proximo_vencimento", e.target.value)} /></label>
        </div>
        <div className="row">
          <label><span className="lb">Chave Pix</span><input id="cx-ipix" value={f.pix_chave ?? ""} onChange={(e) => set("pix_chave", e.target.value)} maxLength={120} /></label>
          <label><span className="lb">Cupom (opcional)</span><input id="cx-icup" value={f.cupom ?? ""} onChange={(e) => set("cupom", e.target.value)} maxLength={40} /></label>
        </div>
        {inicial.id && (
          <label><span className="lb">Situação</span>
            <select id="cx-is" value={f.status} onChange={(e) => set("status", e.target.value)}>
              <option value="ativo">ativo</option><option value="pausado">pausado</option><option value="encerrado">encerrado</option>
            </select>
          </label>
        )}
        {erro && <p className="cx-erro">{erro}</p>}
        <button type="button" className="cx-btn gold" disabled={indo} onClick={salvar}>{indo ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Salvar combinado"}</button>
      </div>
    </Modal>
  );
}

function FormPagar({ inf, onClose, onPagar }: { inf: CaixaInfluenciador; onClose: () => void; onPagar: Props["onPagar"] }) {
  const [qtd, setQtd] = useState("1");
  const [valorTxt, setValorTxt] = useState(String(inf.valor).replace(".", ","));
  const [data, setData] = useState(hojeBR());
  const [indo, setIndo] = useState(false);
  const total = inf.periodicidade === "por_video" ? lerValor(valorTxt) * Math.max(1, Number(qtd) || 1) : lerValor(valorTxt);
  return (
    <Modal titulo={`Pagar ${inf.nome}`} onClose={onClose}>
      <div className="cx-form">
        <p className="cx-nota" style={{ marginTop: 0 }}>Combinado: {inf.combinado || "—"} · {moeda(inf.valor)} {PER[inf.periodicidade]}{inf.pix_chave ? ` · Pix: ${inf.pix_chave}` : " · sem Pix cadastrado"}</p>
        <div className="row">
          <label><span className="lb">{inf.periodicidade === "por_video" ? "Valor por vídeo" : "Valor"}</span><input id="cx-pv" inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} /></label>
          {inf.periodicidade === "por_video"
            ? <label><span className="lb">Vídeos entregues</span><input id="cx-pq" inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value)} /></label>
            : <label><span className="lb">Data</span><input id="cx-pd" type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>}
        </div>
        <button type="button" className="cx-btn gold" disabled={indo || total <= 0} onClick={async () => { setIndo(true); const ok = await onPagar(inf, total, data); setIndo(false); if (ok) onClose(); }}>
          {indo ? <Loader2 className="w-4 h-4 animate-spin inline" /> : `Registrar pagamento de ${moeda(total)}`}
        </button>
        <p className="cx-nota" style={{ marginTop: 0 }}>Sai do caixa na hora{inf.periodicidade === "mensal" ? " e o próximo vencimento pula um mês" : ""}.</p>
      </div>
    </Modal>
  );
}

function FormRec({ inicial, onClose, onSalvar }: { inicial: Rec; onClose: () => void; onSalvar: Props["onSalvarRec"] }) {
  const [f, setF] = useState<Rec>(inicial);
  const [valorTxt, setValorTxt] = useState(inicial.valor ? String(inicial.valor).replace(".", ",") : "");
  const [indo, setIndo] = useState(false);
  return (
    <Modal titulo={inicial.id ? "Editar conta fixa" : "Nova conta fixa"} onClose={onClose}>
      <div className="cx-form">
        <label><span className="lb">Conta</span><input id="cx-rd" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder="ex: Supabase Pro" maxLength={120} /></label>
        <div className="row">
          <label><span className="lb">Valor por mês (R$)</span><input id="cx-rv" inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} /></label>
          <label><span className="lb">Dia que vence</span><input id="cx-rdia" inputMode="numeric" value={String(f.dia)} onChange={(e) => setF({ ...f, dia: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })} /></label>
        </div>
        <div className="row">
          <label><span className="lb">Categoria</span>
            <select id="cx-rc" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
              {["infra", "open_finance", "ia", "ferramentas", "impostos", "marketing", "outros"].map((c) => <option key={c} value={c}>{CATEGORIAS[c]?.rotulo}</option>)}
            </select>
          </label>
          <label><span className="lb">Situação</span>
            <select id="cx-ra" value={f.ativo ? "1" : "0"} onChange={(e) => setF({ ...f, ativo: e.target.value === "1" })}><option value="1">ativa</option><option value="0">pausada</option></select>
          </label>
        </div>
        <button type="button" className="cx-btn gold" disabled={indo || !f.descricao.trim() || lerValor(valorTxt) <= 0}
          onClick={async () => { setIndo(true); const ok = await onSalvar({ ...f, descricao: f.descricao.trim(), valor: lerValor(valorTxt) }); setIndo(false); if (ok) onClose(); }}>
          {indo ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Salvar conta fixa"}
        </button>
      </div>
    </Modal>
  );
}
