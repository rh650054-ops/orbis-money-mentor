/* "Quanto você guardou?" — valor grande, atalhos 50/100/200, registra. */
import { useEffect, useState } from "react";
import { MoneyInput } from "@/shared/ui/money-input";
import { formatCurrency } from "@/shared/lib/utils";
import { BotaoPrimario, COR, Chip, Folha } from "./ui";

/** Em qual dia o valor entra: hoje, um dia da lista, ou uma data anterior (YYYY-MM-DD). */
export interface DiaAlvo { label: string; isToday: boolean; data?: string }

export function RegistrarValorFolha({ alvo, onClose, sugerido, onRegistrar }: {
  alvo: DiaAlvo | null; onClose: () => void; sugerido: number; onRegistrar: (valor: number, dia: DiaAlvo) => Promise<boolean>;
}) {
  const [valor, setValor] = useState(0);
  const [estado, setEstado] = useState<"normal" | "carregando">("normal");
  useEffect(() => { if (alvo) { setValor(0); setEstado("normal"); } }, [alvo]);

  const registrar = async () => {
    if (!alvo || valor <= 0) return;
    setEstado("carregando");
    const ok = await onRegistrar(valor, alvo);
    setEstado("normal");
    if (ok) onClose();
  };

  const falta = sugerido - valor;
  return (
    <Folha open={alvo !== null} onOpenChange={(o) => !o && onClose()}
      titulo={alvo?.isToday ? "Quanto você guardou?" : `Quanto você guardou em ${alvo?.label ?? ""}?`}
      subtitulo="Vai abater do que falta nas suas contas, o vencimento mais perto primeiro.">
      <MoneyInput value={valor} onChange={setValor} autoFocus className="h-16 text-[32px] font-extrabold text-center tabular-nums" placeholder="R$ 0,00" />
      <div className="flex gap-2">
        {[50, 100, 200].map((v) => <Chip key={v} ativo={valor === v} onClick={() => setValor(v)}>R$ {v}</Chip>)}
      </div>
      {alvo?.isToday && sugerido > 0 && valor > 0 && (
        <p className="text-[14px] font-medium" style={{ color: falta > 0.005 ? COR.sub : COR.verde }}>
          {falta > 0.005 ? `Ainda ficam ${formatCurrency(falta)} pra hoje.` : falta < -0.005 ? `Fecha o dia e passa ${formatCurrency(-falta)}.` : "Fecha o dia certinho."}
        </p>
      )}
      <BotaoPrimario onClick={() => void registrar()} disabled={valor <= 0} estado={estado}>Registrar valor</BotaoPrimario>
    </Folha>
  );
}
