/* ============================================================
   DASHBOARD v8 — blocos aprovados no mock (set/2026).
   Componentes de APRESENTAÇÃO: recebem os números por props.
   A ligação com os hooks reais (Index.tsx) acontece no deploy,
   trocando os blocos antigos por estes — ver ORBIS-DEPLOY-NOTES.md.
   ============================================================ */
import { ReactNode } from "react";
import { Zap, Flame, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { AnimatedCurrency, AnimatedNumber, Ring, FillBar, useCountUp } from "@/shared/motion";

/* Sem centavos nas linhas de apoio: "Meta R$ 30.000 · R$ 1.153/dia" cabe em
   uma linha; com centavos quebrava feio no meio ("ritmo / R$ 20.348,99/dia"). */
const fmtCurto = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));

/* ---------- Cabeçalho: saudação + chip "N dias de Foco" ---------- */
export function DashboardHeader({ nome, diasFoco }: { nome: string; diasFoco: number }) {
  const agora = new Date();
  const h = agora.getHours();
  const saud = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  // Data CURTA ("seg, 31 ago") — a longa ("segunda-feira, 31 de agosto") não cabe
  // em tela de 375px ao lado do chip e virava "31 de ag…".
  const data = agora.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
  return (
    <div className="flex items-center justify-between gap-2 pt-1">
      <div className="min-w-0 flex-1">
        <p className="orbis-section">{data}</p>
        <p className="font-display text-[17px] font-extrabold leading-tight mt-0.5 truncate">
          {saud}, <span style={{ color: "var(--orbis-gold)" }}>{nome}</span>
        </p>
      </div>
      {diasFoco > 0 && (
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-extrabold whitespace-nowrap shrink-0"
          style={{ color: "var(--orbis-gold)", background: "var(--orbis-gold-soft)", borderColor: "rgba(245,184,0,.35)" }}
        >
          <Flame className="w-3 h-3" /> {diasFoco} {diasFoco === 1 ? "dia" : "dias"} de Foco
        </span>
      )}
    </div>
  );
}

/* Valor grande do herói: inteiro grande + centavos pequenos (mock v8). O tamanho
   da fonte ENCOLHE conforme o número cresce — "R$ 13.343,01" não pode atropelar o anel. */
function ValorGrande({ value }: { value: number }) {
  const n = useCountUp(value);
  const inteiro = Math.floor(Math.abs(n));
  const cents = Math.round((Math.abs(n) - inteiro) * 100);
  const digitos = String(inteiro).length;
  const size = digitos >= 6 ? "clamp(22px,6.2vw,30px)" : digitos >= 5 ? "clamp(24px,7vw,33px)" : "clamp(28px,9vw,38px)";
  return (
    <span className="orbis-num whitespace-nowrap" style={{ fontSize: size }}>
      {n < 0 ? "-" : ""}R$ {inteiro.toLocaleString("pt-BR")}
      <span style={{ fontSize: "0.45em", color: "var(--orbis-fg-3)", fontWeight: 700 }}>,{String(cents).padStart(2, "0")}</span>
    </span>
  );
}

/* ---------- Herói: faturamento do MÊS com anel animado ---------- */
export function HeroMes({ faturamento, meta, ritmoDia, onEditMeta }: {
  faturamento: number;
  meta: number;
  ritmoDia: number; // a DIÁRIA do plano dele (não "o que falta ÷ dias restantes":
                    // no dia 31 isso virava "R$ 20.348/dia" — número inútil)
  onEditMeta?: () => void;
}) {
  const pct = meta > 0 ? Math.min(100, (faturamento / meta) * 100) : 0;
  const mes = new Date().toLocaleDateString("pt-BR", { month: "long" });
  return (
    <button
      type="button"
      onClick={onEditMeta}
      className="orbis-press orbis-card-in w-full text-left rounded-[22px] border p-[17px] flex items-center gap-4"
      style={{
        borderColor: "rgba(245,184,0,.28)",
        background: "linear-gradient(160deg,#1C1608 0%,var(--orbis-surface) 60%)",
        boxShadow: "0 20px 50px -30px rgba(245,184,0,.45)",
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="orbis-label">Faturamento de {mes}</p>
        <p className="font-display font-extrabold leading-none mt-2">
          <ValorGrande value={faturamento} />
        </p>
        <p className="text-[12.5px] mt-2 leading-snug" style={{ color: "var(--orbis-fg-2)" }}>
          Meta <b style={{ color: "var(--orbis-fg)" }}>{fmtCurto(meta)}</b>
          {ritmoDia > 0 && (
            <> · <b style={{ color: "var(--orbis-fg)" }}>{fmtCurto(ritmoDia)}/dia</b></>
          )}
        </p>
      </div>
      <div className="ml-auto shrink-0">
        <Ring pct={pct} size={80} stroke={8} label={<AnimatedNumber value={pct} format={(n) => `${Math.round(n)}%`} className="text-[16px]" />} />
      </div>
    </button>
  );
}

/* ---------- Hoje: ponte pro Modo Foco, com humor pela hora ---------- */
export function HojeFoco({ vendidoHoje, metaHoje, onEntrar }: {
  vendidoHoje: number;
  metaHoje: number;
  onEntrar: () => void;
}) {
  const h = new Date().getHours();
  const bateu = metaHoje > 0 && vendidoHoje >= metaHoje;
  const falta = Math.max(0, metaHoje - vendidoHoje);
  // O card muda de humor com a hora do dia (decisão do Rick):
  let frase: string;
  if (bateu) frase = "Meta do dia BATIDA — agora é lucro em cima de lucro 🏆";
  else if (vendidoHoje > 0) frase = h >= 20 ? `Faltam ${formatCurrency(falta)} — última chamada do dia` : `Faltam ${formatCurrency(falta)} · você já está em movimento`;
  else if (h < 12) frase = "Sua meta do dia te espera no Modo Foco — bora abrir o placar";
  else if (h < 18) frase = "O dia ainda dá jogo — sua meta te espera no Modo Foco";
  else if (h < 21) frase = "Reta final do dia — ainda dá pra abrir o placar";
  else frase = "Dia encerrado — feche o caixa no Modo Foco";

  return (
    <>
      <div
        className="orbis-card-in rounded-2xl border px-3.5 py-3"
        style={{ borderColor: "rgba(245,184,0,.20)", background: "var(--orbis-surface)" }}
      >
        <p className="font-display text-[15px] font-extrabold orbis-num">
          Hoje · <AnimatedCurrency value={vendidoHoje} />{" "}
          <span style={{ color: "var(--orbis-fg-3)" }}>de {formatCurrency(metaHoje)}</span>
        </p>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-3)" }}>{frase}</p>
      </div>
      <button type="button" onClick={onEntrar} className="orbis-cta w-full">
        <Zap className="w-[17px] h-[17px]" strokeWidth={2.6} />
        Entrar no Modo Foco
      </button>
    </>
  );
}

/* ---------- Lucro (verde) e Custos (vermelho calmo) ---------- */
export function LucroCustos({ lucro, custos, onCustos }: { lucro: number; custos: number; onCustos?: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Tile label="Lucro líquido" sub="no mês">
        <AnimatedCurrency value={lucro} className="text-[22px] font-extrabold" />
      </Tile>
      <button type="button" onClick={onCustos} className="text-left orbis-press">
        <Tile label="Custos" sub="ver por categoria" valueColor="var(--orbis-custo)">
          <AnimatedCurrency value={custos} className="text-[22px] font-extrabold" />
        </Tile>
      </button>
    </div>
  );
}

function Tile({ label, sub, children, valueColor = "var(--orbis-ok)" }: {
  label: string; sub: string; children: ReactNode; valueColor?: string;
}) {
  return (
    <div className="rounded-2xl border px-3.5 py-3 h-full" style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surface)" }}>
      <p className="orbis-section">{label}</p>
      <p className="font-display mt-1.5 leading-none" style={{ color: valueColor }}>{children}</p>
      <p className="text-[11px] mt-1" style={{ color: "var(--orbis-fg-3)" }}>{sub}</p>
    </div>
  );
}

/* ---------- Competição: espadas no quadrado dourado ---------- */
export function CompeticaoRow({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="orbis-press w-full rounded-2xl border px-3.5 py-2.5 flex items-center gap-3 text-left"
      style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surface)" }}
    >
      <span
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "linear-gradient(180deg,var(--orbis-gold-light),var(--orbis-gold))", boxShadow: "0 3px 0 var(--orbis-gold-deep)" }}
      >
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 3.5 15 15M3.5 3.5H6L8 5.5M20.5 3.5 9 15M20.5 3.5H18L16 5.5" stroke="#1A1200" strokeWidth="2.2" />
          <path d="M13.6 13.6 18 18M10.4 13.6 6 18" stroke="#1A1200" strokeWidth="2.2" />
          <path d="M16.2 19.8 19.8 16.2M7.8 19.8 4.2 16.2" stroke="#7A1F1F" strokeWidth="2.4" />
          <circle cx="19" cy="19" r="1.4" fill="#7A1F1F" />
          <circle cx="5" cy="19" r="1.4" fill="#7A1F1F" />
        </svg>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-bold">Competição</span>
        <span className="block text-[12px]" style={{ color: "var(--orbis-fg-2)" }}>Em breve — as guerras de vendas estão chegando</span>
      </span>
      <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--orbis-fg-3)" }} />
    </button>
  );
}

/* ---------- Patente (Seu jogo): ícone da patente + barra até a próxima ---------- */
export function PatenteRow({ emoji, nome, pct, faltam, accentHsl, onClick }: {
  emoji: string;
  nome: string;
  pct: number;          // 0–100 até a próxima patente
  faltam: number;       // R$ que faltam
  accentHsl?: string;   // "140 70% 45%" (cor da patente, vinda do REWARD_TIERS)
  onClick?: () => void;
}) {
  const cor = accentHsl ? `hsl(${accentHsl})` : "var(--orbis-ok)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="orbis-press w-full rounded-2xl border px-3.5 py-2.5 flex items-center gap-3 text-left"
      style={{ borderColor: "var(--orbis-line)", background: "var(--orbis-surface)" }}
    >
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-[19px] leading-none"
        style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${cor} 32%, transparent)` }}>
        {emoji}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-bold truncate">Patente {nome} · {Math.round(pct)}%</span>
        <span className="block text-[12px] mt-0.5" style={{ color: "var(--orbis-fg-2)" }}>
          Faltam <b style={{ color: "var(--orbis-fg)" }}>{formatCurrency(faltam)}</b> pra subir
        </span>
        <span className="block mt-1.5"><FillBar pct={pct} color={cor} height={5} /></span>
      </span>
      <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--orbis-fg-3)" }} />
    </button>
  );
}
