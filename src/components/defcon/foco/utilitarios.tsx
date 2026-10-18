/* Ajustes e utilitários: o administrativo no fim da tela, em cinza-azulado, sem competir
   com DEFCON, custo, compra e mercadoria. Linhas simples; as que têm conteúdo expandem.
   "Ajustar ontem" vive só nas ações rápidas (não repete aqui). */
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Clock, FileDown, History, Loader2, MapPin } from "lucide-react";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { PixDepois } from "./pix-depois";
import { PRESS } from "./foco-tipos";

export interface GpsResumo { kmSemana: number; kmTotal: number; diasSemana: number; velocidade: number; pace: string | null }

interface Props {
  temBancoTrabalho: boolean;
  gps: GpsResumo;
  pdfDate: string;
  exporting: boolean;
  onPdfDate: (d: string) => void;
  onPDF: () => void;
  onHistorico: () => void;
}

const km = (v: number) => (v < 1 ? `${Math.round(v * 1000)} m` : `${v.toFixed(1)} km`);

export function Utilitarios({ temBancoTrabalho, gps, pdfDate, exporting, onPdfDate, onPDF, onHistorico }: Props) {
  const [aberto, setAberto] = useState<string | null>(null);
  const toggle = (k: string) => setAberto((v) => (v === k ? null : k));
  return (
    <section className="mt-6 px-0.5" aria-label="Ajustes e utilitários">
      <p className="orbis-mini">Ajustes e utilitários</p>
      <div className="rounded-[18px] border mt-2.5 px-3" style={{ borderColor: "var(--orbis-line)", background: "rgba(143,163,184,.04)" }}>
        <Linha icone={<FileDown className="w-3.5 h-3.5" />} titulo="Baixar relatório em PDF" sub="de hoje ou de qualquer dia" aberto={aberto === "pdf"} onClick={() => toggle("pdf")}>
          <div className="flex gap-2">
            <input type="date" value={pdfDate} max={getBrazilDate()} onChange={(e) => onPdfDate(e.target.value)} aria-label="Dia do relatório" className="h-11 w-36 shrink-0 bg-background border border-border rounded-xl px-3 text-sm text-foreground" />
            <button type="button" onClick={onPDF} disabled={exporting} className={`flex-1 h-11 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 disabled:opacity-50 ${PRESS}`} style={{ border: "1px solid rgba(245,184,0,.4)", color: "var(--orbis-gold)" }}>
              <FileDown className="w-4 h-4" /> {exporting ? "Gerando..." : pdfDate === getBrazilDate() ? "Baixar PDF do dia" : "Baixar PDF do dia escolhido"}
            </button>
          </div>
        </Linha>
        {!temBancoTrabalho && (
          <Linha icone={<Clock className="w-3.5 h-3.5" />} titulo="Pix que caiu depois" sub="lançar num dia anterior" aberto={aberto === "pix"} onClick={() => toggle("pix")}>
            <PixDepois />
          </Linha>
        )}
        {gps.kmTotal > 0 && (
          <Linha icone={<MapPin className="w-3.5 h-3.5" />} titulo="Deslocamento" sub={`${km(gps.kmSemana)} na semana${gps.velocidade > 0 ? ` · ${gps.velocidade.toFixed(1)} km/h` : ""}`} aberto={aberto === "gps"} onClick={() => toggle("gps")}>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="orbis-num text-xl font-black" style={{ color: "var(--orbis-gold)" }}>{km(gps.kmSemana)}</p><p className="text-[11px]" style={{ color: "var(--orbis-fg-3)" }}>na semana</p></div>
              <div><p className="orbis-num text-xl font-black">{gps.pace ?? "—"}</p><p className="text-[11px]" style={{ color: "var(--orbis-fg-3)" }}>pace /km</p></div>
              <div><p className="orbis-num text-xl font-black">{gps.velocidade.toFixed(1)}</p><p className="text-[11px]" style={{ color: "var(--orbis-fg-3)" }}>km/h real</p></div>
            </div>
            <p className="text-[11px] text-center mt-2" style={{ color: "var(--orbis-fg-3)" }}>Total geral: <b className="text-foreground">{gps.kmTotal.toFixed(1)} km</b>{gps.diasSemana > 0 && <> · {gps.diasSemana} {gps.diasSemana === 1 ? "dia" : "dias"} com GPS na semana</>}</p>
          </Linha>
        )}
        <Linha icone={<History className="w-3.5 h-3.5" />} titulo="Relatórios e histórico" sub="todos os dias, com filtros" onClick={onHistorico} />
      </div>
      {exporting && <p className="text-center text-[11.5px] mt-3 inline-flex items-center gap-1.5 w-full justify-center" style={{ color: "var(--orbis-fg-3)" }}><Loader2 className="w-3 h-3 animate-spin" /> gerando o PDF…</p>}
    </section>
  );
}

function Linha({ icone, titulo, sub, aberto, onClick, children }: { icone: ReactNode; titulo: string; sub?: string; aberto?: boolean; onClick: () => void; children?: ReactNode }) {
  return (
    <div className="border-t first:border-t-0" style={{ borderColor: "var(--orbis-line)" }}>
      <button type="button" onClick={onClick} aria-expanded={children ? !!aberto : undefined} className="w-full h-[54px] flex items-center gap-3 text-left">
        <span className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0" style={{ background: "rgba(143,163,184,.12)", color: "#8fa3b8" }}>{icone}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13.5px] font-semibold truncate" style={{ color: "var(--orbis-fg-2)" }}>{titulo}</span>
          {sub && <span className="block text-[11.5px] truncate" style={{ color: "var(--orbis-fg-3)" }}>{sub}</span>}
        </span>
        {children ? <ChevronDown className="w-4 h-4 shrink-0 transition-transform duration-150" style={{ color: "#5f5a50", transform: aberto ? "rotate(180deg)" : undefined }} /> : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "#5f5a50" }} />}
      </button>
      {children && aberto && <div className="pb-4">{children}</div>}
    </div>
  );
}
