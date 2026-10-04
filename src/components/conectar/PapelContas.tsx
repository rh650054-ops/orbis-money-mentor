/* ============================================================
   PRA QUE SERVE CADA CONTA — TRABALHO × PESSOAL (04/10/2026, Mohamed)
   Fica no Vender, logo onde o banco é ligado (saiu das Finanças).
   • Só o Pix que cai em conta de TRABALHO vira venda (DEFCON, relatório e
     ranking). Conta PESSOAL fica fora das vendas e entra só nos gastos.
   • A Vant sugere o papel pelo histórico do banco (muitas entradas pequenas
     no mesmo dia = cara de conta de vendas). Quem decide é o vendedor.
   • Trava: depois da 1ª escolha, 1 troca a cada 7 dias; virar trabalho depois
     não puxa Pix antigo pro ranking. (A regra mora no banco de dados.)
   • A reserva deixou de ser uma conta: é uma caixinha (ver ReservaCaixinha).
   • BancoExtra: o Pro inclui 1 banco; cada um a mais é +R$ 10/mês.
   ============================================================ */
import { useState } from "react";
import { Briefcase, Home, Loader2, Sparkles, Lock } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { BANCO_EXTRA_CHECKOUT } from "@/shared/lib/checkout";
import { definirPapel, type ContaVenda } from "@/components/conectar/pluggy";

export type Papel = "trabalho" | "pessoal";
const GOLD = "#F5B800";
const SUB = "#b9b3a6";
const MUTE = "#8a857c";
const LINHA = "rgba(255,255,255,.07)";

const ROTULO: Record<Papel, string> = { trabalho: "Trabalho", pessoal: "Pessoal" };
const ddmm = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) : "";
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/,00$/, "");

export function PapelToggle({ valor, onEscolher, ocupado, travado }: { valor: Papel | null; onEscolher: (p: Papel) => void; ocupado?: boolean; travado?: boolean }) {
  const botao = (p: Papel, cor: string, Icone: typeof Briefcase) => {
    const on = valor === p;
    return (
      <button type="button" disabled={ocupado || (travado && !on)} onClick={() => onEscolher(p)} aria-pressed={on}
        className="h-8 px-2.5 rounded-[10px] inline-flex items-center gap-1.5 text-[11.5px] font-black disabled:opacity-50"
        style={on ? { background: `${cor}22`, border: `1.5px solid ${cor}`, color: cor } : { background: "#16161a", border: "1px solid #2a2a2e", color: MUTE }}>
        <Icone className="w-3.5 h-3.5" /> {ROTULO[p]}
      </button>
    );
  };
  return (
    <div className="flex gap-1.5 shrink-0">
      {botao("trabalho", GOLD, Briefcase)}
      {botao("pessoal", "#d8d2c6", Home)}
    </div>
  );
}

/** Conta como o Financeiro recebe (financas_home). */
export interface ContaPapel { id: string; banco: string | null; papel: Papel | null; saldo: number | null }

/** Mensagem do resultado de definirPapel (trava de 7 dias / falha). */
export function avisoPapel(r: Awaited<ReturnType<typeof definirPapel>>, banco: string, p: Papel): boolean {
  if (r.ok) {
    toast({ title: `${banco}: conta ${p === "trabalho" ? "de trabalho" : "pessoal"}`, description: p === "trabalho" ? "Pix que cair nela conta como venda." : "Fica fora das vendas e do ranking." });
    return true;
  }
  if (r.erro === "trava") {
    toast({ title: "Essa conta já trocou de papel essa semana", description: `Dá pra trocar de novo a partir de ${ddmm(r.liberadaEm)}.`, variant: "destructive" });
    return false;
  }
  toast({ title: "Não deu pra salvar", description: "Tenta de novo.", variant: "destructive" });
  return false;
}

/** O card do Vender: cada conta ligada, a sugestão da Vant e o papel. */
export function ContasDeVenda({ contas, onMudou }: { contas: ContaVenda[]; onMudou: () => void }) {
  const [salvando, setSalvando] = useState<string | null>(null);
  const faltam = contas.filter((c) => !c.papel).length;

  const escolher = async (c: ContaVenda, p: Papel) => {
    if (c.papel === p) return;
    setSalvando(c.id);
    const r = await definirPapel(c.id, p);
    setSalvando(null);
    if (avisoPapel(r, c.banco ?? "Banco", p)) onMudou();
  };

  return (
    <section className="rounded-[18px] p-4"
      style={faltam > 0
        ? { background: "linear-gradient(170deg,#1a1305,#0e0e10 70%)", border: "1px solid rgba(245,184,0,.45)" }
        : { background: "#111114", border: "1px solid #1f1e22" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black tracking-[.16em]" style={{ color: faltam > 0 ? GOLD : MUTE }}>PRA QUE SERVE CADA CONTA?</p>
        {faltam > 0 && <span className="text-[10.5px] font-black rounded-full px-2 py-0.5" style={{ color: "#1a1200", background: GOLD }}>falta {faltam}</span>}
      </div>
      <p className="text-[12.5px] mt-1.5 leading-relaxed" style={{ color: SUB }}>
        Só o Pix que cai em conta de <b style={{ color: GOLD }}>trabalho</b> conta como venda e vai pro ranking. Conta <b className="text-foreground">pessoal</b> fica fora das vendas.
      </p>
      <div className="mt-2.5 rounded-xl px-3" style={{ background: "rgba(0,0,0,.3)" }}>
        {contas.map((c, i) => {
          const sugere = !c.papel && c.sugestao;
          return (
            <div key={c.id} className="py-3" style={{ borderTop: i === 0 ? "none" : `1px solid ${LINHA}` }}>
              <div className="flex items-baseline gap-2">
                <span className="flex-1 min-w-0 text-[14px] font-extrabold truncate">{c.banco ?? "Banco"}</span>
                {c.saldo != null && <span className="text-[12px] font-bold tabular-nums shrink-0" style={{ color: MUTE }}>{reais(c.saldo)}</span>}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <PapelToggle valor={c.papel} ocupado={!!salvando} travado={!c.pode_trocar} onEscolher={(p) => void escolher(c, p)} />
                {salvando === c.id && <Loader2 className="w-4 h-4 animate-spin" style={{ color: MUTE }} />}
              </div>
              {sugere && (
                <button type="button" onClick={() => void escolher(c, c.sugestao!)} disabled={!!salvando}
                  className="mt-2 w-full text-left rounded-lg px-2.5 py-2 flex items-start gap-2 active:opacity-70"
                  style={{ background: "rgba(245,184,0,.07)", border: "1px dashed rgba(245,184,0,.35)" }}>
                  <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: GOLD }} />
                  <span className="text-[11.5px] leading-snug" style={{ color: SUB }}>
                    A Vant acha que é <b style={{ color: GOLD }}>{ROTULO[c.sugestao!].toLowerCase()}</b>. {c.motivo} <b className="text-foreground">Usar</b>
                  </span>
                </button>
              )}
              {!c.pode_trocar && (
                <p className="mt-1.5 text-[10.5px] font-bold flex items-center gap-1" style={{ color: MUTE }}>
                  <Lock className="w-3 h-3" /> troca liberada em {ddmm(c.troca_liberada_em)}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10.5px] mt-2 leading-relaxed" style={{ color: MUTE }}>
        Depois da primeira escolha, cada conta troca de papel 1 vez por semana. Virou trabalho depois? Vale daqui pra frente: Pix antigo não entra no ranking.
      </p>
    </section>
  );
}

export function BancoExtra({ usados, onFechar, email }: { usados: number; onFechar: () => void; email?: string | null }) {
  // e-mail da conta já preenchido no checkout: é por ele que o webhook acha o dono da compra
  const link = BANCO_EXTRA_CHECKOUT
    ? `${BANCO_EXTRA_CHECKOUT}&sck=banco_extra${email ? `&email=${encodeURIComponent(email)}` : ""}`
    : null;
  return (
    <div className="rounded-[20px] p-4 text-center" style={{ background: "linear-gradient(170deg,#1a1305,#0e0e10 70%)", border: "1px solid rgba(245,184,0,.42)" }}>
      <p className="text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>MAIS UM BANCO</p>
      <p className="text-[19px] font-black mt-1">+R$ 10 por mês</p>
      <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: "#b9b3a6" }}>
        Seu Vant Pro inclui 1 banco e você já tem {usados} ligado{usados === 1 ? "" : "s"}. Cada banco a mais custa R$ 10 por mês, porque cada leitura do banco tem custo pra Vant.
      </p>
      {link ? (
        <>
        <a href={link} target="_blank" rel="noopener noreferrer"
          className="mt-3 w-full h-12 rounded-[14px] inline-flex items-center justify-center text-[14px] font-black"
          style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
          QUERO LIGAR MAIS UM BANCO
        </a>
        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: MUTE }}>Paga com o mesmo e-mail da sua conta Vant. A vaga libera sozinha em até 1 minuto: depois é só voltar aqui e ligar o banco.</p>
        </>
      ) : (
        <p className="mt-3 text-[12px] font-extrabold" style={{ color: GOLD }}>Em breve dá pra contratar aqui. Fala com o suporte da Vant pra liberar.</p>
      )}
      <button type="button" onClick={onFechar} className="mt-2 w-full h-10 text-[12.5px] font-extrabold" style={{ color: MUTE }}>agora não</button>
    </div>
  );
}
