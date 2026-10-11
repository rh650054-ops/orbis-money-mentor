/* ============================================================
   REPLANEJAR O MÊS (Rick, 11/10/2026)
   Abre quando o sonho do mês saiu do ritmo. Em vez de pedir pra baixar a meta,
   primeiro vem o PLANO MÁXIMO que o cérebro montou (dias que ele pode esticar
   + blocos a mais, em vendas por dia pelo ticket dele) pra chegar ou ficar
   muito perto do sonho. Depois o REALISTA. E "manter" sempre existe.
   Puro: devolve a escolha por callback; quem grava é o hook (meta_replanejar).
   ============================================================ */
import { CalendarPlus, Flag, Rocket, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/shared/ui/drawer";
import { DIAS_PT, listarDias, type MetaDoDia } from "@/shared/lib/meta-viavel";

const brl0 = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));
export type TipoReplanejar = "maximo" | "realista" | "manter";

function Opcao({ icone, titulo, texto, selo, cor, onClick, destaque, disabled }: { icone: React.ReactNode; titulo: string; texto: React.ReactNode; selo?: string; cor: string; onClick: () => void; destaque?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="w-full text-left rounded-[18px] p-3.5 flex gap-3 items-start active:scale-[.99] transition disabled:opacity-60"
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

export function ReplanejarMes({ aberto, onFechar, m, onEscolher, salvando = false }: { aberto: boolean; onFechar: () => void; m: MetaDoDia; onEscolher: (t: TipoReplanejar) => void; salvando?: boolean }) {
  const mx = m.maximo;
  const temExtra = !!mx && (mx.diasExtra.length > 0 || mx.blocos > 0);
  const metaTurbo = Math.round((m.ritmo * 1.2) / 10) * 10;
  const vendas = (n: number | null) => (n ? <> ≈ <b className="text-foreground">{n} vendas/dia</b>{m.ticket ? <> (ticket {brl0(m.ticket)})</> : null}</> : null);
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
              Seu ritmo de verdade é <b className="text-foreground">{brl0(m.ritmo)}</b> num {DIAS_PT[m.diaSemana]}. A Vant montou o máximo que dá com o seu ticket e os dias que você pode esticar:
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,.06)", color: "var(--orbis-fg-2)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-2.5 mt-4">
          {mx && temExtra && (
            <Opcao destaque cor="#F5B800" icone={<Rocket className="w-[18px] h-[18px]" strokeWidth={2.4} />}
              titulo={mx.chega ? `Plano máximo: fecha ${brl0(m.metaMensal)}` : `Plano máximo: chega em ${brl0(mx.projecao)}`}
              selo={mx.chega ? "BATE O SONHO" : `${mx.pct}% DO SONHO`}
              texto={<>
                {mx.diasExtra.length > 0 ? <>Entra <b className="text-foreground">{listarDias(mx.diasExtra)}</b> na semana e </> : <>Mantém os dias e </>}
                <b className="text-foreground">{mx.blocos} blocos</b> por dia. Meta de <b className="text-foreground">{brl0(mx.metaDia)}/dia</b>{vendas(mx.vendasDia)}{mx.vendasHora ? <>, {mx.vendasHora.toLocaleString("pt-BR")} por hora</> : null}, nos {mx.diasRestantes} dias que faltam.
              </>}
              onClick={() => onEscolher("maximo")} disabled={salvando} />
          )}
          <Opcao cor="#3DD68C" icone={<CalendarPlus className="w-[18px] h-[18px]" strokeWidth={2.4} />}
            titulo={`Plano realista: ${brl0(m.mesViavel)}`} selo="NO SEU RITMO"
            texto={<>Seus dias de sempre, no ritmo turbo: <b className="text-foreground">{brl0(metaTurbo)}/dia</b>{vendas(mx?.vendasDiaRealista ?? null)}. Bater meta todo dia vale mais que perseguir um número.</>}
            onClick={() => onEscolher("realista")} disabled={salvando} />
          <Opcao cor="#b9b3a6" icone={<Flag className="w-[18px] h-[18px]" strokeWidth={2.4} />}
            titulo={`Manter ${brl0(m.metaMensal)}`}
            texto={<>A meta de hoje fica em <b className="text-foreground">{brl0(m.meta)}</b> (1,3× o seu ritmo) e o que faltar pro sonho a Vant mostra sem esconder.</>}
            onClick={() => onEscolher("manter")} disabled={salvando} />
        </div>
        <p className="text-[11px] mt-4 text-center leading-relaxed" style={{ color: "var(--orbis-fg-3)" }}>
          {salvando ? "salvando…" : "Isso muda só a sua meta. Ranking e patente continuam contando o dinheiro que você faz."}
        </p>
      </DrawerContent>
    </Drawer>
  );
}
