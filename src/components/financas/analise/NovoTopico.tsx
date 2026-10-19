/* Escolheu "Outros": dá um nome e vira um tópico próprio em "Onde você gastou".
   Com limite por mês, o tópico já nasce com barra de progresso. */
import { useState } from "react";
import { MoneyInput } from "@/shared/ui/money-input";
import { BotaoPrimario, COR } from "../planejar/ui";

export function NovoTopico({ ocupado, onCriar, onSemNome }: {
  ocupado: boolean;
  onCriar: (nome: string, teto: number | null) => void;
  /** deixa em "Outros" mesmo, sem criar tópico */
  onSemNome?: () => void;
}) {
  const [nome, setNome] = useState("");
  const [teto, setTeto] = useState(0);
  const ok = nome.trim().length >= 2;
  return (
    <div className="flex flex-col gap-3 rounded-[16px] border p-4" style={{ background: "#0e0e10", borderColor: "rgba(245,184,0,.35)" }}>
      <p className="text-[15px] font-bold" style={{ color: COR.texto }}>Que gasto é esse?</p>
      <input value={nome} onChange={(e) => setNome(e.target.value.slice(0, 30))} placeholder="Ex.: ração do cachorro, academia" aria-label="Nome do tópico" autoFocus
        className="h-12 rounded-[12px] border px-3 text-[16px] font-semibold outline-none focus:border-[#F5B800]"
        style={{ background: "#1A1A1A", borderColor: "#2A2A2A", color: COR.texto }} />
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold" style={{ color: COR.sub }}>Quanto quer gastar nisso por mês? <span style={{ color: COR.mute }}>(opcional)</span></span>
        <MoneyInput value={teto} onChange={setTeto} className="h-12 text-[16px] font-bold" placeholder="R$ 0,00" />
      </label>
      <BotaoPrimario disabled={!ok} estado={ocupado ? "carregando" : "normal"} onClick={() => onCriar(nome.trim(), teto > 0 ? teto : null)}>
        Criar tópico
      </BotaoPrimario>
      {onSemNome && (
        <button type="button" onClick={onSemNome} disabled={ocupado} className="text-[14px] font-bold min-h-10" style={{ color: COR.sub }}>
          Deixar em Outros
        </button>
      )}
    </div>
  );
}
