/* One bank inside "Gerenciar conexões": role switch, Vant's hint, disconnect. */
import { useEffect, useState } from "react";
import { Check, Lock, Sparkles, Loader2 } from "lucide-react";
import type { BancoLigado, ContaVenda } from "@/components/conectar/pluggy";
import { COR } from "@/shared/components/vant-ui";
import { Pilula, Segmentado } from "@/shared/components/vant-status";
import { statusDoBanco } from "../lib/bancos";

type Papel = "trabalho" | "pessoal";
const ddmm = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) : "");

interface Props {
  banco: BancoLigado; conta?: ContaVenda; salvando: boolean; saindo: boolean;
  onPapel: (p: Papel) => Promise<boolean>; onDesligar: () => void;
}

export function ContaGestaoLinha({ banco, conta, salvando, saindo, onPapel, onDesligar }: Props) {
  const [confirmar, setConfirmar] = useState(false);
  const [salvo, setSalvo] = useState(false);
  useEffect(() => { if (!salvo) return; const t = setTimeout(() => setSalvo(false), 1800); return () => clearTimeout(t); }, [salvo]);
  const st = statusDoBanco(banco.status, banco.last_synced_at);
  const papel = (conta?.papel ?? banco.papel ?? null) as Papel | null;
  const escolher = async (p: Papel) => { if (await onPapel(p)) setSalvo(true); };

  return (
    <div className="py-3.5 flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <p className="flex-1 min-w-0 text-[14.5px] font-black truncate">{banco.institution_name || "Banco"}</p>
        {salvo && <span className="text-[11px] font-black inline-flex items-center gap-1" style={{ color: COR.ok }}><Check className="w-3.5 h-3.5" /> Salvo</span>}
        {salvando && <Loader2 className="w-4 h-4 animate-spin" style={{ color: COR.apagado }} />}
        <Pilula tom={st.tom}>{st.rotulo}</Pilula>
      </div>
      <p className="text-[11.5px] -mt-1.5" style={{ color: COR.apagado }}>
        {st.detalhe}{conta && conta.entradas_30d > 0 ? ` · ${conta.entradas_30d} entradas em 30 dias` : ""}
      </p>
      <Segmentado<Papel> rotulo={`Papel da conta ${banco.institution_name ?? ""}`} valor={papel} disabled={salvando || (conta ? !conta.pode_trocar : false)}
        onEscolher={(p) => void escolher(p)}
        opcoes={[{ valor: "trabalho", texto: "Trabalho", cor: COR.ouro }, { valor: "pessoal", texto: "Pessoal", cor: "#b9b3a6" }]} />
      {conta?.sugestao && (!papel || (conta.papel_auto && conta.sugestao !== papel)) && (
        <button type="button" onClick={() => void escolher(conta.sugestao!)} disabled={salvando}
          className="text-left rounded-lg px-2.5 py-2 flex items-start gap-2 active:opacity-70"
          style={{ background: "rgba(245,184,0,.07)", border: "1px dashed rgba(245,184,0,.35)" }}>
          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: COR.ouro }} />
          <span className="text-[11.5px] leading-snug" style={{ color: COR.suave }}>
            A Vant acha que é <b style={{ color: COR.ouro }}>{conta.sugestao}</b>. {conta.motivo} <b style={{ color: COR.texto }}>Usar</b>
          </span>
        </button>
      )}
      {conta && !conta.pode_trocar && (
        <p className="text-[11px] font-bold flex items-center gap-1" style={{ color: COR.apagado }}><Lock className="w-3 h-3" /> virar pessoal liberado em {ddmm(conta.troca_liberada_em)}</p>
      )}
      {confirmar ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setConfirmar(false)} disabled={saindo} className="h-9 rounded-[10px] text-[12.5px] font-black" style={{ background: "#1a1a1d" }}>Cancelar</button>
          <button type="button" onClick={onDesligar} disabled={saindo} className="h-9 rounded-[10px] text-[12.5px] font-black inline-flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
            style={{ background: COR.coral, color: "#1A0806" }}>{saindo && <Loader2 className="w-4 h-4 animate-spin" />} Desconectar</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmar(true)} className="self-start text-[12px] font-extrabold underline underline-offset-4" style={{ color: COR.coral }}>Desconectar este banco</button>
      )}
    </div>
  );
}
