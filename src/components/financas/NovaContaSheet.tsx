/* ============================================================
   NOVA CONTA A PAGAR — em 3 passos (pedido do Rick, 07/09):
   1) Que conta é essa?  → chips prontos + nome
   2) Quanto e quando?   → valor grande + dia do vencimento + cálculo por dia útil
   3) Repete?            → todo mês / por alguns meses / só uma vez
   Risco vira automático (cartão = alto, resto = médio). Boleto/Pix/código
   a pessoa anexa depois, dentro da conta. Mesmo INSERT do formulário antigo.
   ============================================================ */
import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { MoneyInput } from "@/shared/ui/money-input";
import { Input } from "@/shared/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";
import { getBrazilDate } from "@/shared/lib/date-utils";
import {
  Home, Zap, Droplets, Wifi, Smartphone, ShoppingCart, CreditCard, Bike, Plus, ChevronLeft, Loader2, Check,
} from "lucide-react";

const GOLD = "#F5B800";
const OK = "#3DD68C";

type Tipo = { key: string; label: string; icon: React.ComponentType<{ className?: string }>; cartao?: boolean };
const TIPOS: Tipo[] = [
  { key: "aluguel", label: "Aluguel", icon: Home },
  { key: "luz", label: "Luz", icon: Zap },
  { key: "agua", label: "Água", icon: Droplets },
  { key: "internet", label: "Internet", icon: Wifi },
  { key: "celular", label: "Celular", icon: Smartphone },
  { key: "mercado", label: "Mercado", icon: ShoppingCart },
  { key: "cartao", label: "Cartão", icon: CreditCard, cartao: true },
  { key: "moto", label: "Moto", icon: Bike },
];
const DIAS = [1, 5, 10, 15, 20, 25, 30];
const NOMES_DIA = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Próxima ocorrência do dia N: este mês se ainda não passou, senão mês que vem. */
function proximaData(dia: number): string {
  const hoje = new Date(getBrazilDate() + "T12:00:00");
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  const mk = (yy: number, mm: number) => {
    const ultimo = new Date(yy, mm + 1, 0).getDate();
    const d = new Date(yy, mm, Math.min(dia, ultimo), 12);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const esteMes = mk(y, m);
  return esteMes >= getBrazilDate() ? esteMes : mk(y, m + 1);
}

/** Dias de trabalho de hoje até a data (inclusive), pela escala do perfil. */
function diasUteisAte(ymd: string, workingDays: string[]): number {
  if (!ymd) return 0;
  const ini = new Date(getBrazilDate() + "T12:00:00");
  const fim = new Date(ymd + "T12:00:00");
  let n = 0;
  for (let d = new Date(ini); d.getTime() <= fim.getTime(); d.setDate(d.getDate() + 1)) {
    const nome = NOMES_DIA[d.getDay()];
    if (workingDays.length === 0 || workingDays.includes(nome)) n++;
    if (n > 400) break;
  }
  return n;
}

export function NovaContaSheet({ open, onOpenChange, userId, workingDays, onCreated }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  workingDays: string[];
  onCreated: () => void;
}) {
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [tipo, setTipo] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState(0);
  const [dia, setDia] = useState<number | null>(null);
  const [outroDia, setOutroDia] = useState(false);
  const [dataLivre, setDataLivre] = useState("");
  const [cardModo, setCardModo] = useState<"parcela" | "total">("parcela");
  const [parcelas, setParcelas] = useState("");
  const [repete, setRepete] = useState<"fixa" | "duracao" | "unica">("fixa");
  const [meses, setMeses] = useState("");
  const [salvando, setSalvando] = useState(false);

  const ehCartao = tipo === "cartao";
  const dueDate = outroDia ? dataLivre : dia ? proximaData(dia) : "";
  const nParcelas = parseInt(parcelas) || 0;
  // Valor MENSAL: cartão por total divide pelas parcelas.
  const mensal = ehCartao && cardModo === "total" && nParcelas > 0 ? valor / nParcelas : valor;
  const dias = useMemo(() => diasUteisAte(dueDate, workingDays), [dueDate, workingDays]);
  const porDia = dias > 0 ? mensal / dias : 0;
  const diaLabel = dueDate ? new Date(dueDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";

  const reset = () => {
    setPasso(1); setTipo(null); setNome(""); setValor(0); setDia(null); setOutroDia(false); setDataLivre("");
    setCardModo("parcela"); setParcelas(""); setRepete("fixa"); setMeses("");
  };
  const fechar = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const escolherTipo = (t: Tipo) => {
    setTipo(t.key);
    if (!nome.trim() || TIPOS.some((x) => x.label === nome.trim())) setNome(t.label);
  };

  const podeIr2 = nome.trim().length > 0;
  const podeIr3 = valor > 0 && !!dueDate && (!ehCartao || cardModo === "parcela" || nParcelas > 0);

  const criar = async () => {
    if (!podeIr3 || salvando) return;
    if (repete === "duracao" && !(parseInt(meses) > 0)) {
      toast({ title: "Diz por quantos meses", variant: "destructive" });
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from("planned_bills").insert({
      user_id: userId,
      name: nome.trim().slice(0, 80),
      amount: Math.round(mensal * 100) / 100,
      due_date: dueDate || null,
      saved_amount: 0,
      paid: false,
      recurring: repete !== "unica",
      payment_code: null,
      file_path: null,
      is_credit_card: ehCartao,
      installments: ehCartao && cardModo === "total" && nParcelas > 0 ? nParcelas : null,
      risco: ehCartao ? "alto" : "medio",
      duration_months: repete === "duracao" ? parseInt(meses) : null,
      cycles_paid: 0,
    } as never);
    setSalvando(false);
    if (error) {
      toast({ title: "Erro ao criar a conta", description: "Tente de novo.", variant: "destructive" });
      return;
    }
    toast({ title: `${nome.trim()} entrou no seu planejamento`, description: porDia > 0 ? `Guardar ${formatCurrency(porDia)} por dia útil.` : undefined });
    fechar(false);
    onCreated();
  };

  return (
    <Sheet open={open} onOpenChange={fechar}>
      <SheetContent
        side="bottom"
        className="rounded-t-[24px] border-t p-0 max-h-[92vh] overflow-y-auto [&>button]:hidden"
        style={{ background: "#0e0e10", borderColor: "#2a2416" }}
      >
        <SheetTitle className="sr-only">Nova conta a pagar</SheetTitle>
        <div className="px-[18px] pt-3 pb-6" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
          <div className="w-10 h-1 rounded-full mx-auto mb-3.5" style={{ background: "#2c2a24" }} />
          {/* passos */}
          <div className="flex gap-1.5 mb-3.5">
            {[1, 2, 3].map((n) => (
              <i key={n} className="flex-1 h-1 rounded-full" style={{ background: n <= passo ? GOLD : "#1c1b20" }} />
            ))}
          </div>

          {/* ===== PASSO 1 ===== */}
          {passo === 1 && (
            <>
              <p className="text-[10px] font-black tracking-[.16em]" style={{ color: "#8a8378" }}>NOVA CONTA</p>
              <h3 className="text-[22px] font-black tracking-tight leading-tight mt-1 text-foreground">Que conta é essa?</h3>
              <div className="flex flex-wrap gap-2 mt-3.5">
                {TIPOS.map((t) => {
                  const on = tipo === t.key;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => escolherTipo(t)}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold active:scale-95 transition-transform"
                      style={on ? { background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD } : { background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}
                    >
                      <Icon className="w-[15px] h-[15px]" />
                      {t.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => { setTipo("outra"); setNome(""); }}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-bold"
                  style={tipo === "outra" ? { background: "#1a1305", border: `1px solid ${GOLD}`, color: GOLD } : { background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}
                >
                  <Plus className="w-3.5 h-3.5" /> outra
                </button>
              </div>
              <div className="mt-3.5 rounded-[14px] px-3.5 py-3" style={{ background: "#0a0a0d", border: "1px solid #2a2823" }}>
                <p className="text-[11px] font-bold" style={{ color: "#8a8378" }}>Nome</p>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder={tipo === "outra" ? "Ex.: Faculdade, Seguro…" : "Toque num tipo acima ou escreva"}
                  autoFocus={tipo === "outra"}
                  className="w-full bg-transparent outline-none text-[18px] font-extrabold text-foreground mt-0.5 placeholder:text-[#5a5449] placeholder:font-semibold placeholder:text-[14px]"
                />
              </div>
              <button type="button" disabled={!podeIr2} onClick={() => setPasso(2)} className="orbis-cta w-full mt-4 disabled:opacity-40" style={{ height: 52 }}>
                CONTINUAR
              </button>
            </>
          )}

          {/* ===== PASSO 2 ===== */}
          {passo === 2 && (
            <>
              <p className="text-[10px] font-black tracking-[.16em] uppercase truncate" style={{ color: "#8a8378" }}>{nome}</p>
              <h3 className="text-[22px] font-black tracking-tight leading-tight mt-1 text-foreground">Quanto e quando vence?</h3>

              <div className="mt-3.5 rounded-[14px] px-3.5 py-3" style={{ background: "#0a0a0d", border: "1px solid #2a2823" }}>
                <p className="text-[11px] font-bold" style={{ color: "#8a8378" }}>{ehCartao ? (cardModo === "total" ? "Total da compra" : "Valor da fatura / parcela") : "Valor"}</p>
                <MoneyInput
                  value={valor}
                  onChange={setValor}
                  autoFocus
                  placeholder="R$ 0,00"
                  className="border-0 bg-transparent px-0 h-12 text-[34px] font-black tracking-tight focus-visible:ring-0"
                />
              </div>

              {ehCartao && (
                <div className="mt-2.5 rounded-[14px] px-3.5 py-3" style={{ background: "#0a0a0d", border: "1px solid #2a2823" }}>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: "#16151a" }}>
                    {(["parcela", "total"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setCardModo(m)} className="py-2 rounded-lg text-xs font-bold transition-colors" style={cardModo === m ? { background: "#0e0e10", color: GOLD } : { color: "#8a8378" }}>
                        {m === "parcela" ? "Digitei a parcela" : "Digitei o total"}
                      </button>
                    ))}
                  </div>
                  {cardModo === "total" && (
                    <div className="flex items-center gap-2 mt-2.5">
                      <span className="text-xs" style={{ color: "#8a8378" }}>Em quantas vezes?</span>
                      <Input type="number" inputMode="numeric" min={1} value={parcelas} onChange={(e) => setParcelas(e.target.value)} placeholder="6" className="w-20 h-9" />
                      {nParcelas > 0 && valor > 0 && <span className="text-xs font-bold text-foreground tabular-nums">{formatCurrency(valor / nParcelas)}/mês</span>}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-2.5 rounded-[14px] px-3.5 py-3" style={{ background: "#0a0a0d", border: "1px solid #2a2823" }}>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold" style={{ color: "#8a8378" }}>Dia do vencimento</p>
                  {dueDate && <p className="text-[11px] font-black" style={{ color: GOLD }}>{outroDia ? diaLabel : `dia ${dia}`}</p>}
                </div>
                {!outroDia ? (
                  <>
                    <div className="grid grid-cols-7 gap-1.5 mt-2.5">
                      {DIAS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDia(d)}
                          className="h-[38px] rounded-[10px] text-[13px] font-extrabold active:scale-95 transition-transform"
                          style={dia === d ? { background: GOLD, color: "#1a1305" } : { background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => setOutroDia(true)} className="w-full text-center text-[11px] mt-2.5 py-1" style={{ color: "#8a8378" }}>
                      ou toque pra escolher outro dia
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 mt-2.5">
                    <input
                      type="date"
                      value={dataLivre}
                      min={getBrazilDate()}
                      onChange={(e) => setDataLivre(e.target.value)}
                      className="h-10 flex-1 min-w-0 rounded-lg px-2 text-sm text-foreground bg-background border border-border"
                    />
                    <button type="button" onClick={() => { setOutroDia(false); setDataLivre(""); }} className="text-[11px] font-bold px-2" style={{ color: "#8a8378" }}>voltar</button>
                  </div>
                )}
              </div>

              {podeIr3 && (
                <div className="mt-3.5 rounded-[14px] px-3.5 py-3" style={{ background: "linear-gradient(160deg,#0d1f16,#0e0e10)", border: "1px solid rgba(61,214,140,.35)" }}>
                  <p className="text-[15px] font-black tabular-nums" style={{ color: OK }}>
                    {porDia > 0 ? `Guardar ${formatCurrency(porDia)} por dia útil` : `Vence ${diaLabel}`}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#b3ab9c" }}>
                    {dias > 0 ? `${dias} dia${dias === 1 ? "" : "s"} de trabalho até ${diaLabel}. Chega paga sem susto.` : "Sem dia de trabalho até lá — guarde o quanto antes."}
                  </p>
                </div>
              )}

              <button type="button" disabled={!podeIr3} onClick={() => setPasso(3)} className="orbis-cta w-full mt-4 disabled:opacity-40" style={{ height: 52 }}>
                CONTINUAR
              </button>
              <button type="button" onClick={() => setPasso(1)} className="w-full h-10 mt-1.5 text-[13px] font-bold flex items-center justify-center gap-1" style={{ color: "#b3ab9c" }}>
                <ChevronLeft className="w-4 h-4" /> voltar
              </button>
            </>
          )}

          {/* ===== PASSO 3 ===== */}
          {passo === 3 && (
            <>
              <p className="text-[10px] font-black tracking-[.16em] uppercase truncate" style={{ color: "#8a8378" }}>
                {nome} · {formatCurrency(mensal)} · {outroDia ? diaLabel : `dia ${dia}`}
              </p>
              <h3 className="text-[22px] font-black tracking-tight leading-tight mt-1 text-foreground">Essa conta repete?</h3>

              {([
                { k: "fixa", t: "Todo mês", s: ehCartao ? "Fatura recorrente. O Orbis renova sozinho." : "Aluguel, luz, internet. O Orbis renova sozinho." },
                { k: "duracao", t: "Por alguns meses", s: "Parcelas: escolhe quantas e ela some quando acabar." },
                { k: "unica", t: "Só uma vez", s: "Paga e pronto." },
              ] as const).map((o) => {
                const on = repete === o.k;
                return (
                  <button
                    key={o.k}
                    type="button"
                    onClick={() => setRepete(o.k)}
                    className="w-full flex items-center gap-3 rounded-[14px] px-3.5 py-3 mt-2.5 text-left active:scale-[0.99] transition-transform"
                    style={on ? { background: "#1a1305", border: `1px solid ${GOLD}` } : { background: "#0a0a0d", border: "1px solid #2a2823" }}
                  >
                    <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center" style={{ border: `2px solid ${on ? GOLD : "#3a3629"}` }}>
                      {on && <span className="w-2.5 h-2.5 rounded-full" style={{ background: GOLD }} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-extrabold text-foreground">{o.t}</span>
                      <span className="block text-[11px] mt-0.5" style={{ color: "#8a8378" }}>{o.s}</span>
                    </span>
                  </button>
                );
              })}
              {repete === "duracao" && (
                <div className="flex items-center gap-2 mt-2.5 px-1">
                  <span className="text-xs" style={{ color: "#8a8378" }}>Quantos meses?</span>
                  <Input type="number" inputMode="numeric" min={1} value={meses} onChange={(e) => setMeses(e.target.value)} placeholder={nParcelas > 0 ? String(nParcelas) : "6"} className="w-20 h-9" autoFocus />
                </div>
              )}

              <p className="text-[11px] text-center mt-3.5" style={{ color: "#8a8378" }}>
                Boleto, Pix e código de barras você anexa depois, na própria conta.
              </p>
              <button type="button" onClick={criar} disabled={salvando} className="orbis-cta w-full mt-3.5 flex items-center justify-center gap-2" style={{ height: 52 }}>
                {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" strokeWidth={3} />}
                CRIAR CONTA
              </button>
              <button type="button" onClick={() => setPasso(2)} className="w-full h-10 mt-1.5 text-[13px] font-bold flex items-center justify-center gap-1" style={{ color: "#b3ab9c" }}>
                <ChevronLeft className="w-4 h-4" /> voltar
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
