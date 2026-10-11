/* ============================================================
   REPLANEJAR O MÊS (Rick, 11/10/2026)
   Abre quando o sonho do mês saiu do ritmo. Três saídas, todas honestas:
     1) ajustar o mês pro ritmo (turbo × dias que faltam)
     2) trabalhar mais um dia por semana
     3) manter o sonho — a meta do dia fica em 1,3× o ritmo e o resto aparece como falta
   Puro: devolve a escolha por callback; quem grava é o hook.
   ============================================================ */
import { useState } from "react";
import { CalendarPlus, Flag, Target, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/shared/ui/drawer";
import { DIAS_PT, type MetaDoDia } from "@/shared/lib/meta-viavel";

const brl0 = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));

export type EscolhaReplanejar =
  | { tipo: "ajustar_mes"; metaMensal: number }
  | { tipo: "mais_um_dia"; dia: number }
  | { tipo: "manter" };

function Opcao({ icone, titulo, texto, selo, cor, onClick, destaque }: { icone: React.ReactNode; titulo: string; texto: React.ReactNode; selo?: string; cor: string; onClick: () => void; destaque?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="w-full text-left rounded-[18px] p-3.5 flex gap-3 items-start active:scale-[.99] transition"
      style={destaque
        ? { border: "1px solid transparent", background: `linear-gradient(#15120a,#0f0e0b) padding-box, linear-gradient(135deg,${cor},${cor}55) border-box` }
        : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.035)" }}>
      <span className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center" style={{ background: `${cor}1f`, color: cor }}>{icone}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-[14.5px] font-extrabold">{titulo}</span>
          {selo && <span className="rounded-full px-2 py-[2px] text-[9.5px] font-black tracking-[.06em]" style={{ color: cor, background: `${cor}22` }}>{selo}</span>}
        </span>
        <span className="block text-[12px] leading-snug mt-1" style={{ color: "var(--orbis-fg-2)" }}>{texto}</span>
      </span>
    </button>
  );
}

export function ReplanejarMes({ aberto, onFechar, m, onEscolher, salvando = false }: { aberto: boolean; onFechar: () => void; m: MetaDoDia; onEscolher: (e: EscolhaReplanejar) => void; salvando?: boolean }) {
  const [erro, setErro] = useState<string | null>(null);
  const diaMais = m.maisUmDia !== null ? DIAS_PT[m.maisUmDia] : null;
  const aindaForaComMaisUmDia = m.precisaComMaisUmDia !== null && m.precisaComMaisUmDia > m.ritmo * 1.3;
  const metaTurbo = Math.round((m.ritmo * 1.2) / 10) * 10;
  return (
    <Drawer open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DrawerContent className="rounded-t-[26px] border-0 px-4 pb-6" style={{ background: "#0b0b0b" }}>
        <DrawerTitle className="sr-only">Replanejar o mês</DrawerTitle>
        <div className="flex items-start justify-between gap-3 mt-2">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.18em]" style={{ color: "#F2465A" }}>o mês saiu do ritmo</p>
            <h2 className="text-[21px] font-extrabold leading-[1.1] tracking-[-.02em] mt-1.5 text-balance">
              Pra fechar {brl0(m.metaMensal)} você precisa de {brl0(m.precisaDia)} por dia.
            </h2>
            <p className="text-[12.5px] mt-2 leading-relaxed" style={{ color: "var(--orbis-fg-2)" }}>
              Seu ritmo de verdade é <b className="text-foreground">{brl0(m.ritmo)}</b> num {DIAS_PT[m.diaSemana]}. Meta impossível só cansa. Escolhe um caminho:
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,.06)", color: "var(--orbis-fg-2)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-2.5 mt-4">
          <Opcao destaque cor="#F5B800" icone={<Target className="w-[18px] h-[18px]" strokeWidth={2.4} />}
            titulo={`Ajustar o mês pra ${brl0(m.mesViavel)}`} selo="RECOMENDADO"
            texto={<>No seu ritmo turbo ({brl0(metaTurbo)}/dia) nos {m.diasRestantes} dias que faltam. Bater meta todo dia vale mais que perseguir um número.</>}
            onClick={() => { setErro(null); onEscolher({ tipo: "ajustar_mes", metaMensal: m.mesViavel }); }} />
          {diaMais && m.precisaComMaisUmDia !== null && (
            <Opcao cor={aindaForaComMaisUmDia ? "#F5B800" : "#3DD68C"} icone={<CalendarPlus className="w-[18px] h-[18px]" strokeWidth={2.4} />}
              titulo={`Trabalhar também na ${diaMais}`} selo={aindaForaComMaisUmDia ? "AINDA APERTADO" : "DÁ"}
              texto={<>Com mais um dia por semana a conta cai pra <b className="text-foreground">{brl0(m.precisaComMaisUmDia)}/dia</b>{aindaForaComMaisUmDia ? <> — ainda acima do seu ritmo, mas mais perto.</> : <>, dentro do que você já faz.</>}</>}
              onClick={() => { setErro(null); onEscolher({ tipo: "mais_um_dia", dia: m.maisUmDia as number }); }} />
          )}
          <Opcao cor="#b9b3a6" icone={<Flag className="w-[18px] h-[18px]" strokeWidth={2.4} />}
            titulo={`Manter ${brl0(m.metaMensal)}`}
            texto={<>A meta de hoje fica em <b className="text-foreground">{brl0(m.meta)}</b> (1,3× o seu ritmo) e o que faltar pro sonho a Vant mostra sem esconder.</>}
            onClick={() => { setErro(null); onEscolher({ tipo: "manter" }); }} />
        </div>
        {erro && <p className="text-[12px] mt-3" style={{ color: "#F2465A" }}>{erro}</p>}
        <p className="text-[11px] mt-4 text-center leading-relaxed" style={{ color: "var(--orbis-fg-3)" }}>
          {salvando ? "salvando…" : "Isso muda só a sua meta. Ranking e patente continuam contando o dinheiro que você faz."}
        </p>
      </DrawerContent>
    </Drawer>
  );
}
