/* ============================================================
   NOVA CAIXINHA — 3 perguntas e o Orbis faz a conta (Rick, 10/09):
   1) Pra quê?      → chips com ícone + nome
   2) Quanto custa? → valor grande
   3) Pra quando?   → 3 meses / 6 meses / 1 ano / escolher data
   O painel verde recalcula a cada toque: quanto por dia de rua, se cabe no
   que sobra depois das contas (e das outras caixinhas) e quando termina.
   Mesmo INSERT em financial_goals do formulário antigo.
   ============================================================ */
import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { MoneyInput } from "@/shared/ui/money-input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/shared/hooks/use-toast";
import { formatCurrency } from "@/shared/lib/utils";
import { getBrazilDate } from "@/shared/lib/date-utils";
import {
  Bike, Smartphone, Home, Plane, Package, Shield, GraduationCap, Target, Calendar, ChevronLeft, Loader2, Plus, ImagePlus, type LucideIcon,
} from "lucide-react";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const CUSTO = "#e5737f";

type Tipo = { key: string; label: string; emoji: string; icon: LucideIcon };
const TIPOS: Tipo[] = [
  { key: "moto", label: "Moto", emoji: "🏍️", icon: Bike },
  { key: "celular", label: "Celular", emoji: "📱", icon: Smartphone },
  { key: "casa", label: "Casa", emoji: "🏠", icon: Home },
  { key: "viagem", label: "Viagem", emoji: "✈️", icon: Plane },
  { key: "estoque", label: "Estoque", emoji: "📦", icon: Package },
  { key: "reserva", label: "Reserva", emoji: "🛡️", icon: Shield },
  { key: "estudo", label: "Estudo", emoji: "🎓", icon: GraduationCap },
  { key: "outro", label: "Outro", emoji: "🎯", icon: Target },
];
const PRAZOS = [
  { key: "3m", label: "3 meses", meses: 3 },
  { key: "6m", label: "6 meses", meses: 6 },
  { key: "12m", label: "1 ano", meses: 12 },
] as const;
const NOMES_DIA = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function somarMeses(n: number): string {
  const d = new Date(getBrazilDate() + "T12:00:00");
  d.setMonth(d.getMonth() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Dias de trabalho de amanhã até a data (inclusive), pela escala do perfil. */
function diasUteisAte(ymd: string, workingDays: string[]): number {
  if (!ymd) return 0;
  const ini = new Date(getBrazilDate() + "T12:00:00");
  ini.setDate(ini.getDate() + 1);
  const fim = new Date(ymd + "T12:00:00");
  let n = 0;
  for (let d = new Date(ini); d.getTime() <= fim.getTime(); d.setDate(d.getDate() + 1)) {
    if (workingDays.length === 0 || workingDays.includes(NOMES_DIA[d.getDay()]!)) n++;
    if (n > 800) break;
  }
  return n;
}

export function NovaCaixinhaSheet({ open, onOpenChange, userId, workingDays, sobraDia, ritmoOutras, onCreated }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  workingDays: string[];
  /** Lucro médio por dia de rua MENOS o que as contas pedem por dia. */
  sobraDia: number;
  /** Quanto por dia já vai pras outras caixinhas ativas. */
  ritmoOutras: number;
  onCreated: () => void;
}) {
  const [tipo, setTipo] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState(0);
  const [prazo, setPrazo] = useState<string | null>("6m");
  const [dataLivre, setDataLivre] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const [salvando, setSalvando] = useState(false);

  const deadline = prazo === "data" ? dataLivre : prazo ? somarMeses(PRAZOS.find((p) => p.key === prazo)!.meses) : "";
  const dias = useMemo(() => diasUteisAte(deadline, workingDays), [deadline, workingDays]);
  const porDia = dias > 0 && valor > 0 ? valor / dias : 0;
  const livre = Math.max(0, sobraDia - ritmoOutras);
  const cabe = porDia > 0 && porDia <= livre + 0.005;
  const semBase = sobraDia <= 0;
  const fimLabel = deadline ? (() => { const d = new Date(deadline + "T12:00:00"); return `${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}/${String(d.getFullYear()).slice(2)}`; })() : "";
  // Prazo que caberia no que sobra (pra sugerir quando não cabe)
  const diasQueCabem = livre > 0 && valor > 0 ? Math.ceil(valor / livre) : 0;
  const prazoQueCabe = PRAZOS.find((p) => diasUteisAte(somarMeses(p.meses), workingDays) >= diasQueCabem);

  const reset = () => { setTipo(null); setNome(""); setValor(0); setPrazo("6m"); setDataLivre(""); setFoto(null); setFotoPreview(""); };
  const fechar = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const escolherTipo = (t: Tipo) => {
    setTipo(t.key);
    if (t.key === "outro") { setNome(""); return; }
    if (!nome.trim() || TIPOS.some((x) => x.label === nome.trim())) setNome(t.label);
  };

  const pode = nome.trim().length > 0 && valor > 0 && !!deadline && !salvando;

  const criar = async () => {
    if (!pode) return;
    setSalvando(true);
    try {
      let icone: string = TIPOS.find((t) => t.key === tipo)?.emoji ?? "🎯";
      if (foto) {
        const ext = foto.name.split(".").pop() || "jpg";
        const path = `${userId}/goals/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("community-media").upload(path, foto, { upsert: false });
        if (!upErr) icone = supabase.storage.from("community-media").getPublicUrl(path).data.publicUrl;
      }
      const prazoTag = dias <= 90 ? "curto" : dias <= 200 ? "medio" : "longo";
      const { error } = await supabase.from("financial_goals").insert({
        user_id: userId,
        name: nome.trim().slice(0, 80),
        target_amount: Math.round(valor * 100) / 100,
        current_amount: 0,
        deadline: deadline || null,
        icon: icone,
        status: "active",
        prazo: prazoTag,
      } as never);
      if (error) throw error;
      toast({ title: `Caixinha "${nome.trim()}" criada`, description: porDia > 0 ? `Entra no GUARDEI com ${formatCurrency(porDia)} por dia de rua.` : undefined });
      fechar(false);
      onCreated();
    } catch (e) {
      console.error("nova caixinha:", e);
      toast({ title: "Erro ao criar a caixinha", description: "Tenta de novo.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const caixa = (extra?: React.CSSProperties): React.CSSProperties => ({ background: "#0a0a0d", border: "1px solid #2a2823", ...extra });

  return (
    <Sheet open={open} onOpenChange={fechar}>
      <SheetContent
        side="bottom"
        className="rounded-t-[24px] border-t p-0 max-h-[94vh] overflow-y-auto [&>button]:hidden"
        style={{ background: "#0e0e10", borderColor: "#2a2416" }}
      >
        <SheetTitle className="sr-only">Nova caixinha</SheetTitle>
        <div className="px-[18px] pt-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
          <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: "#2c2a24" }} />

          <div className="flex items-center gap-3">
            <button type="button" onClick={() => fechar(false)} aria-label="Fechar" className="w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0" style={{ background: "#131211", border: "1px solid rgba(255,255,255,.1)" }}>
              <ChevronLeft className="w-[18px] h-[18px]" style={{ color: "#b9b3a6" }} strokeWidth={2.4} />
            </button>
            <div className="min-w-0">
              <h3 className="text-[22px] font-black tracking-tight leading-none text-foreground">Nova caixinha</h3>
              <p className="text-[12.5px] mt-1" style={{ color: "#7e7869" }}>3 perguntas e o Orbis faz a conta</p>
            </div>
          </div>

          {/* 1 · pra quê */}
          <p className="orbis-section mt-5 mb-2.5 px-0.5">1 · Pra quê?</p>
          <div className="grid grid-cols-4 gap-2">
            {TIPOS.map((t) => {
              const on = tipo === t.key;
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => escolherTipo(t)}
                  className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-[14px] text-[11.5px] font-bold active:scale-95 transition-transform"
                  style={on ? { background: "rgba(245,184,0,.1)", border: `1.5px solid ${GOLD}`, color: GOLD } : { background: "#131211", border: "1px solid rgba(255,255,255,.1)", color: "#b9b3a6" }}
                >
                  <Icon className="w-[22px] h-[22px]" strokeWidth={2} />
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="mt-2.5 flex items-center gap-2.5 h-14 px-4 rounded-[14px]" style={caixa()}>
            <span className="text-[12px] font-bold shrink-0" style={{ color: "#7e7869" }}>Nome</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={tipo === "outro" ? "Ex.: Carrinho novo, Dentista…" : "Toque num tipo ou escreva"}
              autoFocus={tipo === "outro"}
              className="flex-1 min-w-0 bg-transparent outline-none text-[16px] font-bold text-foreground placeholder:text-[#5a5449] placeholder:font-semibold placeholder:text-[13px]"
            />
          </div>

          {/* 2 · quanto */}
          <p className="orbis-section mt-5 mb-2.5 px-0.5">2 · Quanto custa?</p>
          <div className="flex items-center gap-2 h-16 px-4 rounded-[14px]" style={caixa({ borderColor: "rgba(245,184,0,.4)" })}>
            <MoneyInput
              value={valor}
              onChange={setValor}
              placeholder="R$ 0,00"
              className="border-0 bg-transparent px-0 h-12 text-[28px] font-black tracking-tight focus-visible:ring-0"
            />
          </div>

          {/* 3 · pra quando */}
          <p className="orbis-section mt-5 mb-2.5 px-0.5">3 · Pra quando?</p>
          <div className="flex flex-wrap gap-2">
            {PRAZOS.map((p) => {
              const on = prazo === p.key;
              return (
                <button key={p.key} type="button" onClick={() => setPrazo(p.key)} className="h-10 px-3.5 rounded-full text-[13px] font-extrabold active:scale-95 transition-transform"
                  style={on ? { background: "rgba(245,184,0,.1)", border: `1.5px solid ${GOLD}`, color: GOLD } : { background: "#131211", border: "1px solid rgba(255,255,255,.12)", color: "#b9b3a6" }}>
                  {p.label}
                </button>
              );
            })}
            <label className="h-10 px-3.5 rounded-full text-[13px] font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              style={prazo === "data" ? { background: "rgba(245,184,0,.1)", border: `1.5px solid ${GOLD}`, color: GOLD } : { background: "#131211", border: "1px solid rgba(255,255,255,.12)", color: "#b9b3a6" }}>
              <Calendar className="w-3.5 h-3.5" strokeWidth={2.2} />
              {prazo === "data" && dataLivre ? new Date(dataLivre + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "escolher data"}
              <input type="date" min={getBrazilDate()} value={dataLivre} onChange={(e) => { setDataLivre(e.target.value); setPrazo("data"); }} className="sr-only" />
            </label>
          </div>

          {/* a conta, ao vivo */}
          {valor > 0 && deadline && (
            <section className="mt-4 rounded-[18px] p-4 flex flex-col gap-3" style={{
              border: `1px solid ${semBase ? "rgba(255,255,255,.1)" : cabe ? "rgba(61,214,140,.35)" : "rgba(245,184,0,.4)"}`,
              background: semBase ? "#131211" : cabe ? "linear-gradient(180deg,#0f1a13,#131211)" : "linear-gradient(180deg,#1a1305,#131211)",
            }}>
              <div className="flex items-end justify-between gap-3">
                <span className="flex flex-col gap-1.5">
                  <span className="orbis-section" style={{ color: semBase ? "#7e7869" : cabe ? OK : GOLD }}>{semBase ? "Seu ritmo" : cabe ? "Dá pra fazer" : "Aperta um pouco"}</span>
                  <span className="orbis-num text-[34px] font-extrabold leading-none tracking-tight whitespace-nowrap" style={{ color: semBase ? "#ffffff" : cabe ? OK : GOLD }}>
                    {formatCurrency(porDia)}<span className="text-[15px] font-bold tracking-normal" style={{ color: "#b9b3a6" }}> /dia</span>
                  </span>
                </span>
                <span className="orbis-num text-[12.5px] text-right leading-[1.5] whitespace-nowrap" style={{ color: "#7e7869" }}>
                  {dias} dias de rua<br />termina em <b className="text-foreground">{fimLabel}</b>
                </span>
              </div>
              {!semBase && (
                <div className="flex flex-col gap-1.5 pt-2.5 text-[12.5px]" style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
                  <div className="flex justify-between"><span style={{ color: "#b9b3a6" }}>Sobra depois das contas</span><span className="orbis-num font-extrabold text-foreground">{formatCurrency(sobraDia)}/dia</span></div>
                  {ritmoOutras > 0 && <div className="flex justify-between"><span style={{ color: "#b9b3a6" }}>Já vai pras outras caixinhas</span><span className="orbis-num font-extrabold text-foreground">− {formatCurrency(ritmoOutras)}/dia</span></div>}
                  <div className="flex justify-between"><span style={{ color: "#b9b3a6" }}>Cabe {nome.trim() ? `a ${nome.trim()}` : "essa"}?</span>
                    <span className="orbis-num font-extrabold" style={{ color: cabe ? OK : CUSTO }}>{cabe ? `sim · sobram ${formatCurrency(livre - porDia)}` : `faltam ${formatCurrency(porDia - livre)}/dia`}</span>
                  </div>
                </div>
              )}
              <p className="text-[12px] leading-[1.45]" style={{ color: "#7e7869" }}>
                {semBase
                  ? "Ainda não tenho seu lucro médio por dia — registra uns dias no DEFCON que eu digo se cabe."
                  : cabe
                  ? "Cabe no que sobra hoje. Entra no GUARDEI de amanhã e dá pra mudar o ritmo depois."
                  : prazoQueCabe && prazoQueCabe.key !== prazo
                  ? `Em ${prazoQueCabe.label} cabe sem apertar (${formatCurrency(valor / Math.max(1, diasUteisAte(somarMeses(prazoQueCabe.meses), workingDays)))}/dia).`
                  : "Mais do que sobra hoje. Ou o prazo estica, ou o faturamento sobe — contas primeiro, caixinha depois."}
              </p>
            </section>
          )}

          {/* foto opcional */}
          <label className="mt-3 flex items-center gap-3 cursor-pointer h-11 px-1">
            {fotoPreview ? (
              <img src={fotoPreview} alt="" className="w-9 h-9 rounded-[10px] object-cover shrink-0" style={{ border: "1px solid rgba(255,255,255,.12)" }} />
            ) : (
              <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ border: "1px dashed rgba(255,255,255,.2)" }}><ImagePlus className="w-4 h-4" style={{ color: "#7e7869" }} /></span>
            )}
            <span className="text-[12.5px] font-bold" style={{ color: "#b9b3a6" }}>{fotoPreview ? "trocar a foto" : "colocar uma foto do que você quer (opcional)"}</span>
            <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFoto(f); setFotoPreview(URL.createObjectURL(f)); } }} />
          </label>

          <button type="button" disabled={!pode} onClick={criar} className="orbis-cta w-full mt-3 disabled:opacity-40 flex items-center justify-center gap-2" style={{ height: 56 }}>
            {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" strokeWidth={3} />}
            CRIAR CAIXINHA
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
