import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/shared/hooks/use-toast";
import { Botao, COR, Secao } from "@/shared/components/vant-ui";
import { formatCurrency } from "@/shared/lib/utils";
import { quick, temQuick } from "../api/ponte";
import { lerConfig, salvarConfig } from "../lib/memoria";
import type { ConfigQuick } from "../types";

const METODOS: { id: ConfigQuick["metodo"]; rotulo: string }[] = [{ id: "dinheiro", rotulo: "Dinheiro" }, { id: "pix", rotulo: "Pix" }, { id: "cartao", rotulo: "Cartão" }];

/** Minha Conta (iPhone): the amount and the payment method of the widget's quick sale. */
export function ConfigVendaRapida() {
  const { user } = useAuth();
  const conta = user?.id ?? null;
  const atual = conta ? lerConfig(conta) : null;
  const [texto, setTexto] = useState(atual ? String(atual.valor).replace(".", ",") : "");
  const [metodo, setMetodo] = useState<ConfigQuick["metodo"]>(atual?.metodo ?? "dinheiro");
  if (!temQuick() || !conta) return null;

  const valor = Number(texto.replace(/\./g, "").replace(",", "."));
  const valido = Number.isFinite(valor) && valor > 0 && valor <= 5000;
  const salvar = () => {
    if (!valido) return;
    const c = salvarConfig(conta, { valor, metodo });
    void quick.salvarConfig(c.valor, formatCurrency(c.valor));
    toast({ title: "Venda rápida salva", description: `O widget registra ${formatCurrency(c.valor)} em ${METODOS.find((m) => m.id === c.metodo)?.rotulo.toLowerCase()}.` });
  };

  return (
    <Secao titulo="VANT QUICK" id="sec-vant-quick">
      <div className="rounded-[16px] p-3.5 flex flex-col gap-3" style={{ background: COR.card, border: `1px solid ${COR.borda}` }}>
        <p className="text-[12.5px] leading-snug" style={{ color: COR.suave }}>
          Valor da venda rápida do widget. Cada toque registra uma venda deste valor no bloco do DEFCON em andamento.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-black tracking-[.12em]" style={{ color: COR.apagado }}>VALOR (R$)</span>
          <input inputMode="decimal" value={texto} onChange={(e) => setTexto(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="10,00"
            aria-label="Valor da venda rápida" className="h-12 rounded-[12px] px-3 text-[16px] font-bold bg-black outline-none" style={{ border: `1px solid ${COR.borda}`, color: COR.texto }} />
        </label>
        <div role="radiogroup" aria-label="Forma de pagamento" className="grid grid-cols-3 gap-2">
          {METODOS.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={metodo === m.id} onClick={() => setMetodo(m.id)}
              className="h-11 rounded-[12px] text-[13px] font-bold" style={metodo === m.id ? { background: COR.ouro, color: "#1A1200" } : { background: "#000", border: `1px solid ${COR.borda}`, color: COR.suave }}>
              {m.rotulo}
            </button>
          ))}
        </div>
        <Botao tipo="ouro" disabled={!valido} onClick={salvar}>Salvar venda rápida</Botao>
      </div>
    </Secao>
  );
}
