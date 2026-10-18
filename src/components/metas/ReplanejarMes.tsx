/* ============================================================
   REPLANEJAR O MÊS (Rick, 11/10/2026 · objetivo em 18/10)
   Abre quando o mês saiu do ritmo. Três caminhos, cada um com o número que
   importa e uma linha curta: MÁXIMO (dias a mais + blocos a mais), REALISTA
   (seus dias, ritmo turbo) e MANTER. Puro: devolve a escolha por callback;
   quem grava é o hook (meta_replanejar).
   ============================================================ */
import { CalendarPlus, Flag, Rocket, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/shared/ui/drawer";
import { listarDias, type MetaDoDia } from "@/shared/lib/meta-viavel";

const brl0 = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));
export type TipoReplanejar = "maximo" | "realista" | "manter";

function Opcao({ icone, titulo, valor, linha, selo, cor, onClick, destaque, disabled }: { icone: React.ReactNode; titulo: string; valor: string; linha: string; selo?: string; cor: string; onClick: () => void; destaque?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="w-full text-left rounded-[18px] px-3.5 py-3 flex gap-3 items-center active:scale-[.99] transition disabled:opacity-60"
      style={destaque
        ? { border: "1px solid transparent", background: `linear-gradient(#15120a,#0f0e0b) padding-box, linear-gradient(135deg,${cor},${cor}55) border-box` }
        : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.035)" }}>
      <span className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center" style={{ background: `${cor}1f`, color: cor }}>{icone}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-extrabold">{titulo}</span>
          {selo && <span className="rounded-full px-2 py-[2px] text-[9.5px] font-black tracking-[.06em]" style={{ color: cor, background: `${cor}22` }}>{selo}</span>}
        </span>
        <span className="block text-[12px] mt-0.5 leading-snug" style={{ color: "var(--orbis-fg-2)" }}>{linha}</span>
      </span>
      <span className="orbis-num text-[16px] font-extrabold shrink-0" style={{ color: cor }}>{valor}</span>
    </button>
  );
}

export function ReplanejarMes({ aberto, onFechar, m, onEscolher, salvando = false }: { aberto: boolean; onFechar: () => void; m: MetaDoDia; onEscolher: (t: TipoReplanejar) => void; salvando?: boolean }) {
  const mx = m.maximo;
  const temExtra = !!mx && (mx.diasExtra.length > 0 || mx.blocos > 0);
  const metaTurbo = Math.round((m.ritmo * 1.2) / 10) * 10;
  return (
    <Drawer open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DrawerContent className="rounded-t-[26px] border-0 px-4 pb-6" style={{ background: "#0b0b0b" }}>
        <div className="flex items-start justify-between gap-3 mt-2">
          <div className="min-w-0">
            <DrawerTitle className="text-[20px] font-extrabold leading-[1.1] tracking-[-.02em]">Replanejar o mês</DrawerTitle>
            <p className="text-[12.5px] mt-1.5" style={{ color: "var(--orbis-fg-2)" }}>
              Meta <b className="text-foreground">{brl0(m.metaMensal)}</b> · precisa <b className="text-foreground">{brl0(m.precisaDia)}/dia</b> · você faz <b className="text-foreground">{brl0(m.ritmo)}/dia</b>
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,.06)", color: "var(--orbis-fg-2)" }}><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-2 mt-4">
          {mx && temExtra && (
            <Opcao destaque cor="#F5B800" icone={<Rocket className="w-[18px] h-[18px]" strokeWidth={2.4} />}
              titulo="Plano máximo" valor={brl0(mx.chega ? m.metaMensal : mx.projecao)} selo={mx.chega ? "BATE" : `${mx.pct}%`}
              linha={`${mx.diasExtra.length > 0 ? `+ ${listarDias(mx.diasExtra)} · ` : ""}${mx.blocos} blocos · ${brl0(mx.metaDia)}/dia`}
              onClick={() => onEscolher("maximo")} disabled={salvando} />
          )}
          <Opcao cor="#3DD68C" icone={<CalendarPlus className="w-[18px] h-[18px]" strokeWidth={2.4} />}
            titulo="Plano realista" valor={brl0(m.mesViavel)} selo="NO SEU RITMO"
            linha={`Seus dias de sempre · ${brl0(metaTurbo)}/dia`}
            onClick={() => onEscolher("realista")} disabled={salvando} />
          <Opcao cor="#b9b3a6" icone={<Flag className="w-[18px] h-[18px]" strokeWidth={2.4} />}
            titulo="Manter a meta" valor={brl0(m.metaMensal)}
            linha={`Meta de hoje ${brl0(m.meta)}`}
            onClick={() => onEscolher("manter")} disabled={salvando} />
        </div>
        <p className="text-[11px] mt-3 text-center" style={{ color: "var(--orbis-fg-3)" }}>
          {salvando ? "salvando…" : "Muda só a sua meta. O ranking não muda."}
        </p>
      </DrawerContent>
    </Drawer>
  );
}
