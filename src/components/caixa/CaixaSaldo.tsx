/* Caixa da Vant — mexer no saldo. Três jeitos, todos registrados no extrato:
   1) Adicionar saldo (entrou dinheiro: aporte, saque, outro)
   2) Corrigir saldo (digita o saldo certo; vira um AJUSTE com a diferença e o motivo)
   3) Bater com a Hotmart (digita o disponível + a receber; ajusta o caixa pra ficar igual) */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { CaixaLancamento } from "@/hooks/useCaixa";
import { Modal } from "./caixa-ui";
import { lerValor, moeda, hojeBR } from "./caixa-fmt";

type Modo = "somar" | "corrigir" | "hotmart";

interface Props {
  saldo: number;
  hotmart: { disponivel: number | null; receber: number | null };
  inicial?: Modo;
  onClose: () => void;
  onLancar: (l: Partial<CaixaLancamento> & { valor: number; descricao: string; tipo: CaixaLancamento["tipo"] }) => Promise<boolean>;
  onCorrigir: (novo: number, motivo: string) => Promise<boolean>;
  onHotmart: (disp: number, receber: number, ajustar: boolean) => Promise<boolean>;
}

export default function CaixaSaldo({ saldo, hotmart, inicial = "hotmart", onClose, onLancar, onCorrigir, onHotmart }: Props) {
  const [modo, setModo] = useState<Modo>(inicial);
  const [valorTxt, setValorTxt] = useState("");
  const [origem, setOrigem] = useState("aporte");
  const [motivo, setMotivo] = useState("");
  // Campos vazios de propósito: tem que digitar o que a Hotmart mostra AGORA (o último fica de dica).
  const [disp, setDisp] = useState("");
  const [receber, setReceber] = useState("");
  const [ajustar, setAjustar] = useState(false);
  const ult = (v: number | null) => (v != null ? `última: ${String(v).replace(".", ",")}` : "0,00");
  const [indo, setIndo] = useState(false);
  const [erro, setErro] = useState("");

  const v = lerValor(valorTxt);
  const totalHotmart = lerValor(disp) + lerValor(receber);
  const dif = modo === "corrigir" ? v - saldo : totalHotmart - saldo;

  const confirmar = async () => {
    setErro("");
    let ok = false;
    setIndo(true);
    if (modo === "somar") {
      if (v <= 0) { setErro("Coloca o valor que entrou."); setIndo(false); return; }
      ok = await onLancar({ tipo: "entrada", valor: v, categoria: origem, origem: "manual", status: "pago", data: hojeBR(),
        descricao: (motivo.trim() || (origem === "aporte" ? "Aporte dos sócios" : origem === "saque_hotmart" ? "Saque da Hotmart" : "Entrada")).slice(0, 200) });
    } else if (modo === "corrigir") {
      if (motivo.trim().length < 3) { setErro("Diz o motivo — fica no extrato."); setIndo(false); return; }
      ok = await onCorrigir(v, motivo.trim());
    } else {
      if (!disp || !receber) { setErro("Preenche os dois valores que aparecem na Hotmart."); setIndo(false); return; }
      ok = await onHotmart(lerValor(disp), lerValor(receber), ajustar);
    }
    setIndo(false);
    if (ok) onClose();
  };

  return (
    <Modal titulo="Saldo do caixa" onClose={onClose}>
      <div className="cx-form">
        <div className="cx-seg" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <button type="button" aria-pressed={modo === "hotmart"} onClick={() => setModo("hotmart")}>Bater c/ Hotmart</button>
          <button type="button" aria-pressed={modo === "somar"} onClick={() => setModo("somar")}>Adicionar</button>
          <button type="button" aria-pressed={modo === "corrigir"} onClick={() => setModo("corrigir")}>Corrigir</button>
        </div>
        <p className="cx-nota" style={{ marginTop: 0 }}>Saldo agora: <b className="num" style={{ color: "var(--gold)" }}>{moeda(saldo)}</b></p>

        {modo === "hotmart" && (
          <>
            <div className="row">
              <label><span className="lb">Saldo disponível</span><input id="cx-hd" inputMode="decimal" value={disp} onChange={(e) => setDisp(e.target.value)} placeholder={ult(hotmart.disponivel)} /></label>
              <label><span className="lb">Saldo a receber</span><input id="cx-hr" inputMode="decimal" value={receber} onChange={(e) => setReceber(e.target.value)} placeholder={ult(hotmart.receber)} /></label>
            </div>
            <p className="cx-nota" style={{ marginTop: 0 }}>Copia os dois números da tela "Saldos" da Hotmart. Total: <b className="num">{moeda(totalHotmart)}</b></p>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input id="cx-aj" type="checkbox" checked={ajustar} onChange={(e) => setAjustar(e.target.checked)} />
              Ajustar o caixa pra ficar igual à Hotmart {disp && receber && Math.abs(dif) >= 0.01 && <b className="num" style={{ color: dif > 0 ? "var(--ok)" : "var(--bad)" }}>({dif > 0 ? "+" : ""}{moeda(dif)})</b>}
            </label>
            {disp && receber && Math.abs(dif) >= 0.01 && (
              <p className="cx-nota" style={{ marginTop: 0 }}>
                Diferença é normal quando tem gasto lançado que ainda não foi sacado da Hotmart (ex: a recarga paga no cartão).
                Só marca "ajustar" se o caixa estiver errado — senão o gasto some do saldo.
              </p>
            )}
          </>
        )}

        {modo === "somar" && (
          <>
            <div className="row">
              <label><span className="lb">Quanto entrou</span><input id="cx-sv" inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} placeholder="0,00" /></label>
              <label><span className="lb">De onde</span>
                <select id="cx-so" value={origem} onChange={(e) => setOrigem(e.target.value)}>
                  <option value="aporte">Aporte dos sócios</option><option value="saque_hotmart">Saque da Hotmart</option><option value="outros">Outro</option>
                </select>
              </label>
            </div>
            <label><span className="lb">Descrição (opcional)</span><input id="cx-sd" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} /></label>
          </>
        )}

        {modo === "corrigir" && (
          <>
            <label><span className="lb">Saldo certo</span><input id="cx-cv" inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} placeholder="0,00" /></label>
            <label><span className="lb">Motivo (obrigatório)</span><input id="cx-cm" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={160} placeholder="ex: gasto da viagem que não foi lançado" /></label>
            {valorTxt && <p className="cx-nota" style={{ marginTop: 0 }}>Vai entrar um ajuste de <b className="num" style={{ color: dif >= 0 ? "var(--ok)" : "var(--bad)" }}>{dif >= 0 ? "+" : ""}{moeda(dif)}</b> no extrato.</p>}
          </>
        )}

        {erro && <p className="cx-erro" role="alert">{erro}</p>}
        <button type="button" className="cx-btn gold" disabled={indo} onClick={confirmar}>
          {indo ? <Loader2 className="w-4 h-4 animate-spin inline" /> : modo === "hotmart" ? "Atualizar com a Hotmart" : modo === "somar" ? "Adicionar ao saldo" : "Corrigir saldo"}
        </button>
        <p className="cx-nota" style={{ marginTop: 0 }}>Nada some: cada mudança vira uma linha no extrato, com quem fez e quando.</p>
      </div>
    </Modal>
  );
}
