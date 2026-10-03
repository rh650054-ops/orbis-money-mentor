/* ============================================================
   CONTA DE TRABALHO × CONTA DE RESERVA (Rick, 03/10/2026)
   • PapelEscolha: com 2+ bancos ligados e algum sem papel, Finanças pergunta
     UMA vez "pra que serve cada conta?". Trabalho = fluxo de caixa do corre;
     Reserva = onde guarda. Dá pra mudar depois em Vant Pro → Gerenciar conexões.
   • PapelToggle: o par de botões, reaproveitado no Gerenciar conexões.
   • BancoExtra: o Pro inclui 1 banco; cada um a mais é +R$ 10/mês.
   ============================================================ */
import { useState } from "react";
import { Briefcase, LifeBuoy, Loader2 } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { BANCO_EXTRA_CHECKOUT } from "@/shared/lib/checkout";
import { definirPapel } from "@/components/conectar/pluggy";

export type Papel = "trabalho" | "reserva";
const GOLD = "#F5B800";
const AZUL = "#5ab0ff";
const MUTE = "#8a857c";

export function PapelToggle({ valor, onEscolher, ocupado }: { valor: Papel | null; onEscolher: (p: Papel) => void; ocupado?: boolean }) {
  const botao = (p: Papel, rotulo: string, cor: string, Icone: typeof Briefcase) => {
    const on = valor === p;
    return (
      <button type="button" disabled={ocupado} onClick={() => onEscolher(p)}
        className="h-8 px-2.5 rounded-[10px] inline-flex items-center gap-1.5 text-[11.5px] font-black disabled:opacity-60"
        style={on ? { background: `${cor}22`, border: `1.5px solid ${cor}`, color: cor } : { background: "#16161a", border: "1px solid #2a2a2e", color: MUTE }}>
        <Icone className="w-3.5 h-3.5" /> {rotulo}
      </button>
    );
  };
  return (
    <div className="flex gap-1.5 shrink-0">
      {botao("trabalho", "Trabalho", GOLD, Briefcase)}
      {botao("reserva", "Reserva", AZUL, LifeBuoy)}
    </div>
  );
}

export interface ContaPapel { id: string; banco: string | null; papel: Papel | null; saldo: number | null }

export function PapelEscolha({ contas, onPronto }: { contas: ContaPapel[]; onPronto: () => void }) {
  const [papeis, setPapeis] = useState<Record<string, Papel | null>>(
    Object.fromEntries(contas.map((c) => [c.id, c.papel])),
  );
  const [salvando, setSalvando] = useState<string | null>(null);
  const nomes = contas.map((c) => c.banco ?? "Banco").join(" e ");

  const escolher = async (id: string, p: Papel) => {
    setSalvando(id);
    const ok = await definirPapel(id, p);
    setSalvando(null);
    if (!ok) { toast({ title: "Não deu pra salvar", description: "Tenta de novo.", variant: "destructive" }); return; }
    const novo = { ...papeis, [id]: p };
    setPapeis(novo);
    if (Object.values(novo).every(Boolean)) onPronto();
  };

  return (
    <div className="rounded-[18px] p-4" style={{ background: "linear-gradient(170deg,#101a26,#0b0b0d 70%)", border: "1px solid rgba(90,176,255,.35)" }}>
      <p className="text-[10px] font-black tracking-[.16em]" style={{ color: AZUL }}>PRA QUE SERVE CADA CONTA?</p>
      <p className="text-[14px] font-extrabold mt-1 leading-snug">Você tem {contas.length} contas conectadas: {nomes}.</p>
      <p className="text-[11.5px] mt-1 leading-relaxed" style={{ color: "#b9b3a6" }}>
        <b style={{ color: GOLD }}>Trabalho</b> é o fluxo de caixa do corre. <b style={{ color: AZUL }}>Reserva</b> é onde você guarda. A Vant mostra cada uma separada.
      </p>
      <div className="mt-2.5 rounded-xl px-3" style={{ background: "rgba(0,0,0,.3)" }}>
        {contas.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2 py-2.5" style={{ borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,.07)" }}>
            <span className="flex-1 min-w-0 text-[13px] font-extrabold truncate">{c.banco ?? "Banco"}</span>
            {salvando === c.id && <Loader2 className="w-4 h-4 animate-spin" style={{ color: MUTE }} />}
            <PapelToggle valor={papeis[c.id] ?? null} ocupado={!!salvando} onEscolher={(p) => void escolher(c.id, p)} />
          </div>
        ))}
      </div>
      <p className="text-[10.5px] mt-2" style={{ color: MUTE }}>Dá pra mudar depois em Vant Pro → Gerenciar conexões.</p>
    </div>
  );
}

export function BancoExtra({ usados, onFechar }: { usados: number; onFechar: () => void }) {
  return (
    <div className="rounded-[20px] p-4 text-center" style={{ background: "linear-gradient(170deg,#1a1305,#0e0e10 70%)", border: "1px solid rgba(245,184,0,.42)" }}>
      <p className="text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>MAIS UM BANCO</p>
      <p className="text-[19px] font-black mt-1">+R$ 10 por mês</p>
      <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: "#b9b3a6" }}>
        Seu Vant Pro inclui 1 banco e você já tem {usados} ligado{usados === 1 ? "" : "s"}. Cada banco a mais custa R$ 10 por mês, porque cada leitura do banco tem custo pra Vant.
      </p>
      {BANCO_EXTRA_CHECKOUT ? (
        <a href={BANCO_EXTRA_CHECKOUT} target="_blank" rel="noopener noreferrer"
          className="mt-3 w-full h-12 rounded-[14px] inline-flex items-center justify-center text-[14px] font-black"
          style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
          QUERO LIGAR MAIS UM BANCO
        </a>
      ) : (
        <p className="mt-3 text-[12px] font-extrabold" style={{ color: GOLD }}>Em breve dá pra contratar aqui. Fala com o suporte da Vant pra liberar.</p>
      )}
      <button type="button" onClick={onFechar} className="mt-2 w-full h-10 text-[12.5px] font-extrabold" style={{ color: MUTE }}>agora não</button>
    </div>
  );
}
