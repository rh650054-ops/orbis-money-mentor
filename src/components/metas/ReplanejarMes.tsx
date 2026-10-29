/* ============================================================
   REPLANEJAR O MÊS (Rick, 11/10/2026 · objetivo em 18/10 · lucro em 29/10)
   Abre quando o mês saiu do ritmo. Dois grupos de saída: PRA BATER A META
   (dias a mais, blocos a mais, os dois juntos, ou subir o ritmo) e PRA SOBRAR
   MAIS (calote e custo do corre — mesmo vendendo igual), e o REALISTA.
   Puro: devolve a escolha por callback; quem grava é o hook (meta_replanejar).
   ============================================================ */
import { CalendarPlus, Clock, Flag, Gauge, Landmark, Rocket, Scissors, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/shared/ui/drawer";
import { listarDias, type MetaDoDia } from "@/shared/lib/meta-viavel";
import type { SobrarMes } from "@/features/objetivo-lucro";

const brl0 = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));
export type TipoReplanejar = "maximo" | "dias" | "blocos" | "realista" | "manter";

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

const Grupo = ({ t, cor }: { t: string; cor: string }) => <p className="text-[10px] font-extrabold uppercase tracking-[.14em] mt-4 mb-2" style={{ color: cor }}>{t}</p>;

export function ReplanejarMes({ aberto, onFechar, m, onEscolher, salvando = false, inicial, sobrar, onVerFinancas }: {
  aberto: boolean; onFechar: () => void; m: MetaDoDia; onEscolher: (t: TipoReplanejar) => void; salvando?: boolean;
  /** 29/10: the tip he tapped on the Foco comes highlighted */
  inicial?: TipoReplanejar | null;
  /** 29/10: "pra sobrar mais" — calote and the cost of going out, same money without selling more */
  sobrar?: SobrarMes | null; onVerFinancas?: () => void;
}) {
  const mx = m.maximo;
  const temDias = !!mx && mx.diasExtra.length > 0;
  const temBlocos = !!mx && mx.blocos > 0;
  const metaTurbo = Math.round((m.ritmo * 1.2) / 10) * 10;
  const ticket = m.ticket ?? 0;
  const unidFaltam = ticket > 0 ? Math.ceil(Math.max(0, m.precisaDia - m.ritmo) / ticket) : 0;
  const VERDE = "#3DD68C", OURO = "#F5B800";
  const d = (t: TipoReplanejar) => inicial === t;
  const comLucro = !!sobrar && sobrar.fonte_custo !== "sem_custo" && sobrar.unidades_mes > 0;
  const calotePerdido = comLucro ? sobrar!.calote_unid * sobrar!.unidades_mes : 0;
  const correMes = comLucro ? sobrar!.custo_corre_dia * sobrar!.dias_mes : 0;
  return (
    <Drawer open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DrawerContent className="rounded-t-[26px] border-0 px-4 pb-6 max-h-[92dvh] overflow-y-auto" style={{ background: "#0b0b0b" }}>
        <div className="flex items-start justify-between gap-3 mt-2">
          <div className="min-w-0">
            <DrawerTitle className="text-[20px] font-extrabold leading-[1.1] tracking-[-.02em]">Replanejar o mês</DrawerTitle>
            <p className="text-[12.5px] mt-1.5" style={{ color: "var(--orbis-fg-2)" }}>
              Meta <b className="text-foreground">{brl0(m.metaMensal)}</b> · precisa <b className="text-foreground">{brl0(m.precisaDia)}/dia</b> · você faz <b className="text-foreground">{brl0(m.ritmo)}/dia</b>
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,.06)", color: "var(--orbis-fg-2)" }}><X className="w-4 h-4" /></button>
        </div>

        <Grupo t="Pra bater a meta · vender mais" cor={VERDE} />
        <div className="space-y-2">
          {temDias && (
            <Opcao cor={VERDE} destaque={d("dias")} icone={<CalendarPlus className="w-[18px] h-[18px]" strokeWidth={2.4} />}
              titulo={`Trabalhar ${mx!.diasExtra.length > 1 ? `${mx!.diasExtra.length} dias a mais` : "1 dia a mais"}`} valor={`+${mx!.diasExtra.length}`}
              linha={`+ ${listarDias(mx!.diasExtra)} · seus blocos de sempre`} onClick={() => onEscolher("dias")} disabled={salvando} />
          )}
          {temBlocos && (
            <Opcao cor={VERDE} destaque={d("blocos")} icone={<Clock className="w-[18px] h-[18px]" strokeWidth={2.4} />}
              titulo="Mais tempo na rua" valor={`${mx!.blocos} blocos`}
              linha={`${mx!.blocos} blocos de 1h por dia · seus dias de sempre`} onClick={() => onEscolher("blocos")} disabled={salvando} />
          )}
          {mx && (temDias || temBlocos) && (
            <Opcao cor={OURO} destaque={inicial ? d("maximo") : true} icone={<Rocket className="w-[18px] h-[18px]" strokeWidth={2.4} />}
              titulo="Plano máximo" valor={brl0(mx.chega ? m.metaMensal : mx.projecao)} selo={mx.chega ? "BATE" : `${mx.pct}%`}
              linha={`${temDias ? `+ ${listarDias(mx.diasExtra)} · ` : ""}${mx.blocos} blocos · ${brl0(mx.metaDia)}/dia`}
              onClick={() => onEscolher("maximo")} disabled={salvando} />
          )}
          <Opcao cor={VERDE} destaque={d("manter")} icone={<Gauge className="w-[18px] h-[18px]" strokeWidth={2.4} />}
            titulo="Subir o ritmo" valor={unidFaltam > 0 ? `+${unidFaltam}/dia` : brl0(m.precisaDia)}
            linha={`Mantém a meta · ${brl0(m.precisaDia)}/dia nos seus dias · meta de hoje ${brl0(m.meta)}`}
            onClick={() => onEscolher("manter")} disabled={salvando} />
        </div>

        {comLucro && onVerFinancas && (calotePerdido > 0 || correMes > 0) && (<>
          <Grupo t="Pra sobrar mais · mesmo vendendo igual" cor={OURO} />
          <div className="space-y-2">
            {calotePerdido > 0 && (
              <Opcao cor={OURO} icone={<Landmark className="w-[18px] h-[18px]" strokeWidth={2.4} />}
                titulo="Cortar o calote" valor={`+${brl0(calotePerdido / 2)}`}
                linha={`${sobrar!.calote_pct}% das vendas · cobra o Pix na hora: metade disso volta pro bolso`} onClick={onVerFinancas} />
            )}
            {correMes > 0 && (
              <Opcao cor={OURO} icone={<Scissors className="w-[18px] h-[18px]" strokeWidth={2.4} />}
                titulo="Custo do corre" valor={brl0(sobrar!.custo_corre_dia) + "/dia"}
                linha={`${brl0(correMes)} no mês em transporte e comida · ver onde dá pra cortar`} onClick={onVerFinancas} />
            )}
          </div>
        </>)}

        <Grupo t="Ou ser realista" cor="#b9b3a6" />
        <Opcao cor="#b9b3a6" destaque={d("realista")} icone={<Flag className="w-[18px] h-[18px]" strokeWidth={2.4} />}
          titulo="Meta pelo seu ritmo" valor={brl0(m.mesViavel)} selo="NO SEU RITMO"
          linha={`Seus dias de sempre · ${brl0(metaTurbo)}/dia`}
          onClick={() => onEscolher("realista")} disabled={salvando} />
        <p className="text-[11px] mt-3 text-center" style={{ color: "var(--orbis-fg-3)" }}>
          {salvando ? "salvando…" : "Muda só a sua meta. O ranking não muda."}
        </p>
      </DrawerContent>
    </Drawer>
  );
}
