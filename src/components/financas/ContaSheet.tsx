/* ============================================================
   FOLHA DA CONTA — abre quando toca em "Paguei" (ou na conta) na lista.

   Rick (10/09): "na onde está as contas precisa ter uma opção de pagar as
   contas... algo bonito e funcional". Um lugar só pra tudo que era o card
   expandido antigo: de onde sai o dinheiro (guardado), código de pagamento,
   boleto, PAGUEI, desfazer, guardei um valor, editar e excluir.
   Só apresentação — quem grava é a tela Finanças.
   ============================================================ */
import { useRef } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { formatCurrency } from "@/shared/lib/utils";
import {
  Check, Copy, Paperclip, FileText, Trash2, Pencil, Loader2, RotateCcw, ShieldCheck, AlertTriangle, CreditCard, Receipt, Plus,
} from "lucide-react";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const CALOTE = "#FF5C5C";

export interface ContaInfo {
  nome: string;
  valor: number;
  guardado: number;
  quitada: boolean;        // guardado >= valor (ou marcada paga)
  paga: boolean;           // paga de vez (não recorrente) ou paga neste ciclo
  recorrente: boolean;
  cartao: boolean;
  vencida: boolean;
  venceLabel: string;      // "vence em 2 dias · sexta 12/09" / "venceu há 3 dias"
  proximoLabel: string | null; // próximo vencimento (recorrente), ex.: "12/10"
  porDiaDepois: number;    // quanto por dia de rua depois de pagar (recorrente)
  temCodigo: boolean;
  codigoResumo: string;    // trecho do código pra mostrar
  temBoleto: boolean;
  enviandoBoleto: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  info: ContaInfo | null;
  onPagar: () => void;
  onDesfazer: () => void;
  onCopiarCodigo: () => void;
  onVerBoleto: () => void;
  onAnexarBoleto: (f: File) => void;
  onRemoverBoleto: () => void;
  onGuardei: () => void;
  onEditar: () => void;
  onExcluir: () => void;
}

export function ContaSheet({ open, onOpenChange, info, onPagar, onDesfazer, onCopiarCodigo, onVerBoleto, onAnexarBoleto, onRemoverBoleto, onGuardei, onEditar, onExcluir }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  if (!info) return null;
  const falta = Math.max(0, info.valor - info.guardado);
  const pct = info.valor > 0 ? Math.min(100, (info.guardado / info.valor) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[24px] border-t p-0 max-h-[92vh] overflow-y-auto [&>button]:hidden"
        style={{ background: "#131211", borderColor: "rgba(255,255,255,.08)" }}
      >
        <SheetTitle className="sr-only">{info.nome}</SheetTitle>
        <div className="px-5 pt-2.5 flex flex-col gap-4" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
          <div className="w-10 h-1 rounded-full mx-auto" style={{ background: "rgba(255,255,255,.18)" }} />

          {/* cabeçalho */}
          <div className="flex items-center gap-3.5 pt-1">
            <span className="inline-flex items-center justify-center w-[52px] h-[52px] rounded-[15px] shrink-0"
              style={info.paga ? { background: "rgba(61,214,140,.12)", border: "1px solid rgba(61,214,140,.35)" } : info.vencida ? { background: "rgba(255,92,92,.1)", border: "1px solid rgba(255,92,92,.35)" } : { background: "rgba(245,184,0,.12)", border: "1px solid rgba(245,184,0,.3)" }}>
              {info.paga ? <Check className="w-6 h-6" style={{ color: OK }} strokeWidth={3} />
                : info.vencida ? <AlertTriangle className="w-6 h-6" style={{ color: CALOTE }} strokeWidth={2.2} />
                : info.cartao ? <CreditCard className="w-6 h-6" style={{ color: GOLD }} strokeWidth={2.1} />
                : <Receipt className="w-6 h-6" style={{ color: GOLD }} strokeWidth={2.1} />}
            </span>
            <span className="flex-1 min-w-0 flex flex-col gap-1">
              <span className="orbis-label" style={{ letterSpacing: ".14em", color: info.paga ? OK : info.vencida ? CALOTE : GOLD }}>{info.paga ? "Conta paga" : "Pagar conta"}</span>
              <span className="text-[20px] font-black leading-[1.1] text-foreground truncate">{info.nome}</span>
              <span className="text-[12.5px] font-bold whitespace-nowrap truncate" style={{ color: info.vencida && !info.paga ? CALOTE : GOLD }}>{info.venceLabel}</span>
            </span>
            <span className="orbis-num text-[24px] font-black text-foreground whitespace-nowrap shrink-0">{formatCurrency(info.valor)}</span>
          </div>

          {/* de onde sai o dinheiro */}
          {!info.paga && (
            <div className="rounded-[14px] px-3.5 py-3 flex flex-col gap-2"
              style={info.quitada ? { border: "1px solid rgba(61,214,140,.3)", background: "rgba(61,214,140,.06)" } : { border: "1px solid rgba(245,184,0,.3)", background: "rgba(245,184,0,.06)" }}>
              <div className="flex items-center justify-between gap-2.5">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-extrabold" style={{ color: info.quitada ? OK : GOLD }}>
                  <ShieldCheck className="w-4 h-4" strokeWidth={2.4} />
                  {info.quitada ? "Você já tem o dinheiro" : `Faltam ${formatCurrency(falta)}`}
                </span>
                <span className="orbis-num text-[12.5px] whitespace-nowrap" style={{ color: "#b9b3a6" }}><b className="text-foreground">{formatCurrency(info.guardado)}</b> guardado</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.1)" }}>
                <div className="orbis-fill h-full rounded-full" style={{ width: `${pct}%`, background: info.quitada ? OK : GOLD }} />
              </div>
              <p className="text-[12.5px] leading-[1.45]" style={{ color: "#b9b3a6" }}>
                {info.quitada
                  ? info.recorrente
                    ? <>Vou tirar os {formatCurrency(info.valor)} do guardado e já começo a juntar pro próximo vencimento{info.proximoLabel ? ` (${info.proximoLabel})` : ""}{info.porDiaDepois > 0 ? <>: <b className="orbis-num text-foreground">{formatCurrency(info.porDiaDepois)} por dia</b></> : null}.</>
                    : <>Vou tirar os {formatCurrency(info.valor)} do guardado. Conta única: paga, fica paga.</>
                  : <>Pagou com dinheiro de fora? Tudo bem — marco como paga mesmo assim{info.recorrente ? " e recomeço a juntar pro próximo mês" : ""}. Se preferir, guarda um valor primeiro.</>}
              </p>
            </div>
          )}

          {info.paga && (
            <div className="rounded-[14px] px-3.5 py-3 flex items-start gap-2.5" style={{ border: "1px solid rgba(61,214,140,.3)", background: "rgba(61,214,140,.06)" }}>
              <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: OK }} strokeWidth={3} />
              <p className="text-[12.5px] leading-[1.45]" style={{ color: "#b9b3a6" }}>
                {info.recorrente
                  ? <>Paga este mês. Já estou juntando pro próximo vencimento{info.proximoLabel ? ` (${info.proximoLabel})` : ""}{info.porDiaDepois > 0 ? <>: <b className="orbis-num text-foreground">{formatCurrency(info.porDiaDepois)} por dia</b></> : null}.</>
                  : <>Quitada. Não pede mais nada.</>}
              </p>
            </div>
          )}

          {/* código de pagamento / boleto */}
          {(info.temCodigo || info.temBoleto || !info.paga) && (
            <div className="flex flex-col gap-2">
              {info.temCodigo && (
                <div className="flex items-center gap-3 h-14 px-3.5 rounded-[14px]" style={{ border: "1px solid rgba(255,255,255,.1)", background: "#0d0c0b" }}>
                  <Copy className="w-[18px] h-[18px] shrink-0" style={{ color: "#b9b3a6" }} strokeWidth={2} />
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-[13px] font-bold text-foreground">Código de pagamento</span>
                    <span className="orbis-num text-[11.5px] truncate" style={{ color: "#7e7869" }}>{info.codigoResumo}</span>
                  </span>
                  <button type="button" onClick={onCopiarCodigo} className="h-[34px] px-3 rounded-[10px] text-[12.5px] font-extrabold shrink-0 active:scale-95 transition-transform" style={{ border: "1.5px solid rgba(245,184,0,.5)", color: GOLD }}>copiar</button>
                </div>
              )}
              <div className="flex items-center gap-3 h-14 px-3.5 rounded-[14px]" style={{ border: "1px solid rgba(255,255,255,.1)", background: "#0d0c0b" }}>
                {info.enviandoBoleto ? <Loader2 className="w-[18px] h-[18px] shrink-0 animate-spin" style={{ color: GOLD }} /> : <FileText className="w-[18px] h-[18px] shrink-0" style={{ color: "#b9b3a6" }} strokeWidth={2} />}
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[13px] font-bold text-foreground">Boleto</span>
                  <span className="text-[11.5px] truncate" style={{ color: "#7e7869" }}>{info.enviandoBoleto ? "enviando…" : info.temBoleto ? "anexado" : "PDF ou foto, opcional"}</span>
                </span>
                <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onAnexarBoleto(f); e.target.value = ""; }} />
                {info.temBoleto ? (
                  <span className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={onVerBoleto} className="h-[34px] px-3 rounded-[10px] text-[12.5px] font-extrabold active:scale-95 transition-transform" style={{ border: "1.5px solid rgba(245,184,0,.5)", color: GOLD }}>ver</button>
                    <button type="button" onClick={onRemoverBoleto} aria-label="Remover boleto" className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center active:scale-95 transition-transform" style={{ border: "1px solid rgba(255,255,255,.12)" }}><Trash2 className="w-4 h-4" style={{ color: "#7e7869" }} /></button>
                  </span>
                ) : (
                  <button type="button" disabled={info.enviandoBoleto} onClick={() => fileRef.current?.click()} className="h-[34px] px-3 rounded-[10px] text-[12.5px] font-extrabold shrink-0 inline-flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50" style={{ border: "1px solid rgba(255,255,255,.16)", color: "#b9b3a6" }}><Paperclip className="w-3.5 h-3.5" />anexar</button>
                )}
              </div>
            </div>
          )}

          {/* ação principal */}
          {info.paga ? (
            <button type="button" onClick={onDesfazer} className="w-full h-[52px] rounded-[16px] text-[14px] font-extrabold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform" style={{ border: "1.5px solid rgba(255,255,255,.14)", color: "#b9b3a6" }}>
              <RotateCcw className="w-4 h-4" strokeWidth={2.4} /> Desfazer · não paguei ainda
            </button>
          ) : (
            <>
              <button type="button" onClick={onPagar} className="orbis-cta w-full flex items-center justify-center gap-2.5" style={{ height: 58, fontSize: 16 }}>
                <Check className="w-[22px] h-[22px]" strokeWidth={3} /> PAGUEI {formatCurrency(info.valor)}
              </button>
              <div className="flex items-center justify-center gap-4 -mt-1 text-[13px] font-bold">
                {!info.quitada && (
                  <button type="button" onClick={onGuardei} className="h-11 inline-flex items-center gap-1.5" style={{ color: GOLD }}><Plus className="w-3.5 h-3.5" strokeWidth={3} /> guardei um valor</button>
                )}
                <button type="button" onClick={() => onOpenChange(false)} className="h-11" style={{ color: "#7e7869" }}>ainda não paguei</button>
              </div>
            </>
          )}

          {/* editar / excluir */}
          <div className="flex items-center justify-center gap-5 pt-1 text-[12.5px] font-bold" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
            <button type="button" onClick={onEditar} className="h-11 inline-flex items-center gap-1.5" style={{ color: "#b9b3a6" }}><Pencil className="w-3.5 h-3.5" /> editar conta</button>
            <button type="button" onClick={onExcluir} className="h-11 inline-flex items-center gap-1.5" style={{ color: "#7e7869" }}><Trash2 className="w-3.5 h-3.5" /> excluir</button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
