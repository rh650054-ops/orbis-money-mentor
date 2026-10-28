/* Where the calote number comes from (Rick, 28/10/2026). Two estimates: measured by the bank
   (only days with the bank connected, only sale-sized entries) or what he registered in the app.
   The day-by-day table shows where the Pix did not land, so he can judge and pick. */
import { Check, Landmark, Smartphone } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import type { BaseLucro, FonteCalote } from "../types";
import { nomeUnidade } from "../lib/plano";
import { brl0 } from "../lib/formato";
import { COR } from "./ui";

const dm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

export function CaloteEscolha({ b, fonte, onFonte }: { b: BaseLucro; fonte: FonteCalote; onFonte: (f: FonteCalote) => void }) {
  const c = b.calote;
  const un1 = nomeUnidade(b.produto_nome, 1);
  const temBanco = c.estimado_banco !== null && c.banco_unid !== null;
  const opcoes: Array<{ id: FonteCalote; icon: typeof Landmark; titulo: string; valor: string; sub: string; ok: boolean; motivo?: string }> = [
    {
      id: "banco", icon: Landmark, titulo: "Medido pelo banco", ok: temBanco,
      valor: temBanco ? brl0(c.estimado_banco ?? 0) : "—",
      sub: temBanco ? `${brl0(c.banco_por_dia ?? 0)}/dia · ${formatCurrency(c.banco_unid ?? 0)} por ${un1}` : "",
      motivo: !b.banco ? "conecte o banco pra medir" : c.dias_banco < 5 ? `só ${c.dias_banco} dias de venda com o banco ligado` : undefined,
    },
    {
      id: "app", icon: Smartphone, titulo: "Registrado no app", ok: true,
      valor: brl0(c.perdido), sub: `${brl0(c.app_por_dia)}/dia · ${formatCurrency(c.app_unid)} por ${un1}`,
    },
  ];
  return (
    <section className="rounded-[18px] p-4 mt-1 flex flex-col gap-3" style={{ background: "#0b0b0d", border: `1px solid ${COR.linha}` }} aria-label="Fonte do calote">
      <div>
        <p className="orbis-section" style={{ color: COR.ouro }}>Calote: de onde vem o número</p>
        <p className="text-[11.5px] mt-1 leading-snug" style={{ color: COR.sub }}>
          {temBanco && c.desde
            ? <>Pelo banco: desde <b style={{ color: COR.texto }}>{dm(c.desde)}</b> (dia em que você ligou o Open Finance), {c.dias_banco} dias de venda. Pix/cartão lançados no app {brl0(c.app_pix_banco)} contra {brl0(c.banco_recebido)} que caíram na conta.</>
            : "Pelo app: o fiado que você marcou no DEFCON, menos o que recuperou."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {opcoes.map((o) => {
          const Icon = o.icon; const on = fonte === o.id;
          return (
            <button type="button" key={o.id} disabled={!o.ok} onClick={() => onFonte(o.id)} aria-pressed={on}
              className="rounded-[14px] px-3 py-3 text-left min-w-0 disabled:opacity-50 active:scale-[0.98] transition-transform"
              style={{ background: on ? "rgba(245,184,0,.10)" : "rgba(255,255,255,.03)", border: `1px solid ${on ? COR.ouro : COR.linha}` }}>
              <p className="text-[10.5px] font-bold uppercase tracking-[.06em] inline-flex items-center gap-1.5" style={{ color: on ? COR.ouro : COR.mute }}>
                <Icon className="w-3.5 h-3.5" /> {o.titulo} {on && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
              </p>
              <p className="vant-missao-num text-[22px] leading-none mt-1.5" style={{ color: on ? COR.texto : COR.sub }}>{o.valor}</p>
              <p className="text-[11px] mt-1 leading-snug" style={{ color: COR.sub }}>{o.motivo ?? o.sub}</p>
            </button>
          );
        })}
      </div>
      {c.tabela.length > 0 && (
        <div>
          <p className="orbis-section mb-1.5" style={{ color: COR.mute }}>Dia a dia · app × banco</p>
          <div className="rounded-[12px] overflow-hidden" style={{ border: `1px solid ${COR.linha}` }}>
            {c.tabela.slice().reverse().map((l, i) => {
              const ruim = l.dif > Math.max(40, l.app * 0.25);
              return (
                <div key={l.dia} className="grid grid-cols-4 items-center px-3 py-1.5 text-[12px]" style={{ borderTop: i ? `1px solid ${COR.linha}` : undefined, background: i % 2 ? "rgba(255,255,255,.02)" : undefined }}>
                  <span style={{ color: COR.sub }}>{dm(l.dia)}</span>
                  <span className="orbis-num text-right" style={{ color: COR.texto }}>{brl0(l.app)}</span>
                  <span className="orbis-num text-right" style={{ color: COR.texto }}>{brl0(l.banco)}</span>
                  <span className="orbis-num text-right font-bold" style={{ color: ruim ? COR.vermelho : l.dif < 0 ? COR.verde : COR.sub }}>{l.dif > 0 ? "−" : "+"}{brl0(Math.abs(l.dif))}</span>
                </div>
              );
            })}
          </div>
          <p className="text-[10.5px] mt-1.5 leading-snug" style={{ color: COR.mute }}>
            app = Pix e cartão lançados no DEFCON · banco = entradas do corre até {brl0(c.teto)} (acima disso não é venda de rua). Dia com diferença grande: Pix que caiu em outra conta, cliente que pagou depois ou extrato incompleto naquele dia.
          </p>
        </div>
      )}
    </section>
  );
}
