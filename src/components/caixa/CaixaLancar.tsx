/* Caixa da Vant — lançar (ou editar) um gasto ou uma entrada. Gasto em dólar (recarga
   da Anthropic/OpenAI) guarda o valor em US$ e a cotação usada; o saldo desce em R$. */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { CaixaLancamento } from "@/hooks/useCaixa";
import { CATEGORIAS } from "@/hooks/useCaixa";
import { Modal } from "./caixa-ui";
import { lerValor, moeda, hojeBR } from "./caixa-fmt";

const SAIDAS = ["ia", "influenciador", "marketing", "infra", "open_finance", "premios", "ferramentas", "impostos", "retirada", "outros"];
const ENTRADAS = ["aporte", "saque_hotmart", "outros"];
const PROVEDORES = ["Anthropic", "OpenAI", "Outro"];

type Novo = Partial<CaixaLancamento> & { valor: number; descricao: string; tipo: CaixaLancamento["tipo"] };

interface Props {
  cambio: number;
  editando?: CaixaLancamento | null;
  inicial?: "saida" | "entrada";
  onClose: () => void;
  onSalvar: (l: Novo) => Promise<boolean>;
  onEditar: (id: string, patch: Partial<CaixaLancamento>) => Promise<boolean>;
  subirComprovante: (f: File) => Promise<string | null>;
}

export default function CaixaLancar({ cambio, editando, inicial = "saida", onClose, onSalvar, onEditar, subirComprovante }: Props) {
  const e = editando;
  const [tipo, setTipo] = useState<"saida" | "entrada">(e ? (e.valor > 0 ? "entrada" : "saida") : inicial);
  const [descricao, setDescricao] = useState(e?.descricao ?? "");
  // Gasto novo abre em IA/Anthropic → já em dólar (recarga é cobrada em US$).
  const [emDolar, setEmDolar] = useState(e ? e.moeda_original === "USD" : inicial === "saida");
  const [valorTxt, setValorTxt] = useState(e ? String(Math.abs(e.moeda_original === "USD" ? Number(e.valor_original) : e.valor)).replace(".", ",") : "");
  const [cot, setCot] = useState(String(e?.cambio ?? cambio).replace(".", ","));
  const [data, setData] = useState(e?.data ?? hojeBR());
  const [categoria, setCategoria] = useState(e?.categoria ?? (inicial === "entrada" ? "aporte" : "ia"));
  const [provedor, setProvedor] = useState(/openai/i.test(e?.descricao ?? "") ? "OpenAI" : "Anthropic");
  const [status, setStatus] = useState<"pago" | "a_pagar">(e?.status ?? "pago");
  const [obs, setObs] = useState(e?.obs ?? "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const valorDigitado = lerValor(valorTxt);
  const cotacao = lerValor(cot) || cambio;
  const reais = emDolar ? Math.round(valorDigitado * cotacao * 100) / 100 : valorDigitado;
  const cats = tipo === "saida" ? SAIDAS : ENTRADAS;
  const recargaIa = tipo === "saida" && categoria === "ia" && provedor !== "Outro";

  const salvar = async () => {
    setErro("");
    if (reais <= 0) { setErro("Coloca o valor."); return; }
    let desc = descricao.trim();
    if (!desc && recargaIa) desc = `Recarga ${provedor}${emDolar ? ` (US$ ${valorDigitado.toLocaleString("pt-BR")})` : ""}`;
    // A conta de crédito das APIs acha a recarga pelo nome do provedor na descrição.
    if (recargaIa && !new RegExp(provedor, "i").test(desc)) desc = `${provedor} — ${desc}`;
    if (!desc) { setErro("Diz o que foi (ex: Meta Ads, cachê do fulano)."); return; }
    setSalvando(true);
    let comprovante = e?.comprovante_url ?? null;
    if (arquivo) comprovante = (await subirComprovante(arquivo)) ?? comprovante;
    const campos = {
      data, descricao: desc.slice(0, 200), categoria, status, obs: obs.trim() || null, comprovante_url: comprovante,
      valor: tipo === "saida" ? -reais : reais,
      moeda_original: emDolar ? "USD" : null, valor_original: emDolar ? valorDigitado : null, cambio: emDolar ? cotacao : null,
    };
    const ok = e ? await onEditar(e.id, campos) : await onSalvar({ ...campos, tipo, origem: "manual" });
    setSalvando(false);
    if (ok) onClose();
  };

  return (
    <Modal titulo={e ? "Editar lançamento" : tipo === "saida" ? "Lançar gasto" : "Lançar entrada"} onClose={onClose}>
      <div className="cx-form">
        {!e && (
          <div className="cx-seg">
            <button type="button" aria-pressed={tipo === "saida"} onClick={() => { setTipo("saida"); setCategoria("ia"); setEmDolar(true); }}>Gasto</button>
            <button type="button" aria-pressed={tipo === "entrada"} onClick={() => { setTipo("entrada"); setCategoria("aporte"); setEmDolar(false); }}>Entrada</button>
          </div>
        )}
        <label><span className="lb">Categoria</span>
          <select id="cx-cat" value={categoria} onChange={(ev) => { setCategoria(ev.target.value); if (ev.target.value !== "ia") setEmDolar(false); }}>
            {cats.map((c) => <option key={c} value={c}>{CATEGORIAS[c]?.icone} {CATEGORIAS[c]?.rotulo ?? c}</option>)}
          </select>
        </label>
        {tipo === "saida" && categoria === "ia" && (
          <label><span className="lb">Provedor</span>
            <select id="cx-prov" value={provedor} onChange={(ev) => { setProvedor(ev.target.value); if (ev.target.value !== "Outro") setEmDolar(true); }}>
              {PROVEDORES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
        )}
        <label><span className="lb">Descrição</span>
          <input id="cx-desc" value={descricao} onChange={(ev) => setDescricao(ev.target.value)} maxLength={200}
            placeholder={recargaIa ? `Recarga ${provedor}` : tipo === "saida" ? "ex: Meta Ads — campanha Rio" : "ex: saque da Hotmart"} />
        </label>
        {tipo === "saida" && (
          <div className="cx-seg">
            <button type="button" aria-pressed={!emDolar} onClick={() => setEmDolar(false)}>Em reais</button>
            <button type="button" aria-pressed={emDolar} onClick={() => setEmDolar(true)}>Em dólar</button>
          </div>
        )}
        <div className="row">
          <label><span className="lb">{emDolar ? "Valor em US$" : "Valor em R$"}</span>
            <input id="cx-valor" inputMode="decimal" value={valorTxt} onChange={(ev) => setValorTxt(ev.target.value)} placeholder="0,00" />
          </label>
          {emDolar ? (
            <label><span className="lb">Cotação R$/US$</span>
              <input id="cx-cot" inputMode="decimal" value={cot} onChange={(ev) => setCot(ev.target.value)} />
            </label>
          ) : (
            <label><span className="lb">Data</span><input id="cx-data" type="date" value={data} onChange={(ev) => setData(ev.target.value)} /></label>
          )}
        </div>
        {emDolar && (
          <div className="row">
            <label><span className="lb">Data</span><input id="cx-data2" type="date" value={data} onChange={(ev) => setData(ev.target.value)} /></label>
            <div style={{ alignSelf: "end", paddingBottom: 10 }}><span className="lb">Sai do caixa</span><b className="num" style={{ fontSize: 16 }}>{moeda(reais)}</b></div>
          </div>
        )}
        <label><span className="lb">Status</span>
          <select id="cx-st" value={status} onChange={(ev) => setStatus(ev.target.value as "pago" | "a_pagar")}>
            <option value="pago">{tipo === "saida" ? "Pago — já saiu do caixa" : "Recebido — já entrou"}</option>
            <option value="a_pagar">{tipo === "saida" ? "A pagar — ainda não saiu" : "A receber"}</option>
          </select>
        </label>
        <label><span className="lb">Observação (opcional)</span>
          <textarea id="cx-obs" rows={2} value={obs} onChange={(ev) => setObs(ev.target.value)} maxLength={400} />
        </label>
        <label className="cx-drop">
          <input type="file" accept="image/*,application/pdf" hidden onChange={(ev) => setArquivo(ev.target.files?.[0] ?? null)} />
          📎 {arquivo ? arquivo.name : e?.comprovante_url ? "comprovante anexado — toque pra trocar" : "anexar comprovante (print do Pix, nota)"}
        </label>
        {erro && <p className="cx-erro" role="alert">{erro}</p>}
        <button type="button" className="cx-btn gold" disabled={salvando} onClick={salvar}>
          {salvando ? <Loader2 className="w-4 h-4 animate-spin inline" /> : e ? "Salvar alteração" : tipo === "saida" ? `Lançar gasto${reais > 0 ? ` de ${moeda(reais)}` : ""}` : `Lançar entrada${reais > 0 ? ` de ${moeda(reais)}` : ""}`}
        </button>
        {e && <p className="cx-nota" style={{ marginTop: 0 }}>A alteração fica registrada no histórico com o antes e o depois.</p>}
      </div>
    </Modal>
  );
}
