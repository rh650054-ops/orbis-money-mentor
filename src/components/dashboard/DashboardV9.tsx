/* ============================================================
   DASHBOARD v9.1 — "padrão Opal" (pedido do Rick, 01/09).

   O que mudou em relação ao v9:
   - TOPO ENXUTO: data em 10px, "Boa tarde, Rick" em 15px. Quem manda na
     tela é o número da meta, não o cabeçalho. À direita: a CHAMA (dias
     trabalhados) + o avatar — igual o Opal põe.
   - A CHAMA saiu do meio da tela. Acende quando ele fecha o DEFCON 4 e a
     Home abre: cor entra, brilho pulsa, o número desliza pra cima.
   - SEMANA colada no card da meta, por fora. Folga = lua (não quebra a
     sequência, mantém o lugar dela). Sem texto explicando embaixo.
   - CONTEXTO = BORDA: todo assunto mora num card com a mesma borda e o
     mesmo fundo. O único diferente é o da meta, dourado de propósito.
   - RÉGUA DE ESPAÇO com 4 valores: 28 entre blocos, 20 dentro do herói,
     16 do título pro conteúdo, 7 do rótulo pro número dele.
   - ESCALA DE FONTE com 6 tamanhos, nada além (ver as classes abaixo).
   Componentes de APRESENTAÇÃO; o Index passa os números.
   ============================================================ */
import { useEffect, useState, type ReactNode } from "react";
import { Zap, ChevronRight, Medal, User, Moon } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { AnimatedCurrency, Ring, FillBar, useCountUp } from "@/shared/motion";

const fmtCurto = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));

/* ============================================================
   A CHAMA (padrão Opal)
   Vetor, não emoji: o emoji muda de desenho em cada aparelho e não dá
   pra acender, apagar nem pulsar. Três pontas (meio alta, direita média,
   esquerda baixinha), corpo redondo, degradê creme → âmbar.
   ============================================================ */
let seqChama = 0;
export function Chama({ size = 21, aceso = true }: { size?: number; aceso?: boolean }) {
  const [id] = useState(() => `orbis-chama-${++seqChama}`);
  return (
    <svg width={size} height={Math.round(size * 1.28)} viewBox="0 0 100 128" aria-hidden
      style={aceso ? { filter: "drop-shadow(0 0 8px rgba(255,168,60,.55)) drop-shadow(0 0 18px rgba(255,140,20,.25))" } : undefined}>
      <defs>
        <linearGradient id={id} x1="0.14" y1="0.06" x2="0.86" y2="0.96">
          <stop offset="0" stopColor="#FFF8EE" /><stop offset="0.30" stopColor="#FDE6C2" />
          <stop offset="0.62" stopColor="#F7C88C" /><stop offset="1" stopColor="#EDA45C" />
        </linearGradient>
      </defs>
      <path
        fill={aceso ? `url(#${id})` : "#3A3730"}
        stroke={aceso ? "#FFF3DF" : "#4A463D"}
        strokeWidth="2.4" strokeLinejoin="round"
        d="M50 3 C56 23 62 35 66 48 L74 32 C86 50 92 62 92 80 C92 105 74 123 50 123 C26 123 8 105 8 80 C8 63 14 54 20 44 L25 57 C31 40 42 22 50 3 Z"
      />
    </svg>
  );
}

/* A chave que o DEFCON grava ao encerrar o dia. A Home lê UMA vez, roda a
   animação e apaga — não dá pra assistir de novo dando refresh, então a
   chama nunca mente. */
export const CHAVE_ACENDER = (uid: string) => `orbis_chama_acender_${uid}`;
const VALIDADE_MS = 12 * 60 * 60 * 1000; // a marca vale por 12h: fechou à noite, abriu de manhã, ainda acende
export function pedirAcenderChama(uid: string | undefined) {
  if (!uid) return;
  try { localStorage.setItem(CHAVE_ACENDER(uid), String(Date.now())); } catch { /* sem storage: sem animação */ }
}
/* Lê a marca SEM apagar. Aceita "1" (versão antiga) ou um timestamp recente. */
function marcaPendente(uid: string | undefined): boolean {
  if (!uid) return false;
  try {
    const v = localStorage.getItem(CHAVE_ACENDER(uid));
    if (!v) return false;
    if (v === "1") return true;
    return Date.now() - Number(v) < VALIDADE_MS;
  } catch { return false; }
}

export function ChamaStreak({ dias, userId }: { dias: number; userId?: string }) {
  // "vai acender": abre apagado no número anterior e sobe pro atual.
  const [acender, setAcender] = useState(false);
  const [mostra, setMostra] = useState(dias);
  const [aceso, setAceso] = useState(dias > 0);

  useEffect(() => {
    /* BUG (Rick, 01/09 à noite): "terminei o DEFCON e não animou". A Home monta
       com dias = 0 (os dados ainda estão carregando), o efeito rodava, CONSUMIA
       a marca e desistia porque dias <= 0. Quando os dados chegavam (dias = 1),
       a marca já tinha ido embora. Agora: com dias = 0 a marca fica intacta —
       só é consumida no render em que existe um número pra subir. */
    if (dias <= 0) { setMostra(0); setAceso(false); return; }
    const pedido = marcaPendente(userId);
    if (!pedido) { setMostra(dias); setAceso(true); return; }
    try { if (userId) localStorage.removeItem(CHAVE_ACENDER(userId)); } catch { /* nada */ }
    setMostra(Math.max(0, dias - 1));
    setAceso(false);
    const t1 = window.setTimeout(() => { setAceso(true); setAcender(true); }, 300);
    const t2 = window.setTimeout(() => setMostra(dias), 650);
    const t3 = window.setTimeout(() => setAcender(false), 1200);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3); };
  }, [dias, userId]);

  return (
    <span className="inline-flex items-center gap-[7px] shrink-0" aria-label={`${dias} dias trabalhados`}>
      <span className={acender ? "orbis-chama-pulso" : undefined} style={{ display: "inline-flex" }}>
        <Chama size={21} aceso={aceso} />
      </span>
      <b
        key={mostra}
        className="orbis-num orbis-chama-num"
        style={{
          fontSize: 17, fontWeight: 800, lineHeight: 1,
          ...(aceso
            ? { background: "linear-gradient(180deg,#FFE59A,#F9CE63 48%,#EFB23A)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }
            : { color: "#57534A" }),
        }}
      >
        {mostra}
      </b>
    </span>
  );
}

/* ---------- Cabeçalho enxuto: data + saudação · chama · avatar ---------- */
export function HeaderV9({ nome, diasTrabalhados, userId, onPerfil }: {
  nome: string; diasTrabalhados: number; userId?: string; onPerfil?: () => void;
}) {
  const agora = new Date();
  const h = Number(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }));
  const saud = h >= 5 && h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const data = agora.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
  return (
    <div className="flex items-center gap-3 pt-1">
      <div className="flex-1 min-w-0">
        <p className="orbis-mini">{data}</p>
        <p className="font-display font-semibold truncate mt-[3px]" style={{ fontSize: "clamp(14px,4vw,15.5px)", letterSpacing: "-.01em" }}>
          {saud}, <span style={{ color: "var(--orbis-gold)" }}>{nome}</span>
        </p>
      </div>
      <ChamaStreak dias={diasTrabalhados} userId={userId} />
      <button type="button" onClick={onPerfil} aria-label="Seu perfil"
        className="orbis-press w-[31px] h-[31px] rounded-[11px] flex items-center justify-center shrink-0"
        style={{ border: "1.4px solid rgba(245,184,0,.45)", color: "var(--orbis-gold)" }}>
        <User className="w-[15px] h-[15px]" strokeWidth={2} />
      </button>
    </div>
  );
}

/* ============================================================
   SEMANA — colada no card da meta, por fora.
   Regra do Rick: dia trabalhado = iniciou o DEFCON 4 e vendeu (1 por dia).
   Folga é lua e MANTÉM a sequência: não conta contra nem a favor.
   ============================================================ */
const DIAS_EN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const LETRAS = ["S", "T", "Q", "Q", "S", "S", "D"]; // segunda → domingo
function isoLocal(d: Date) { return d.toLocaleDateString("en-CA"); }

export function SemanaRow({ workingDays, diasTrabalhados }: {
  workingDays: string[] | null; diasTrabalhados: string[];
}) {
  const hojeStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const hoje = new Date(`${hojeStr}T12:00:00`);
  const dow = (hoje.getDay() + 6) % 7; // 0 = segunda
  const temHistorico = diasTrabalhados.length > 0;
  const semana = LETRAS.map((letra, i) => {
    const d = new Date(hoje); d.setDate(hoje.getDate() - dow + i);
    const iso = isoLocal(d);
    const folga = Array.isArray(workingDays) && workingDays.length > 0 && !workingDays.includes(DIAS_EN[d.getDay()]!);
    const passou = iso < hojeStr;
    const fez = diasTrabalhados.includes(iso);
    return { letra, iso, folga, fez, ehHoje: iso === hojeStr, perdeu: temHistorico && passou && !folga && !fez };
  });
  const base = "w-[25px] h-[25px] rounded-full flex items-center justify-center text-[10px] font-bold not-italic";
  return (
    <div className="flex items-center justify-between px-1 pb-[10px]">
      <p className="orbis-section">Sua semana</p>
      <div className="flex gap-[7px]" aria-label="Sua semana">
        {semana.map((d) => {
          if (d.fez) return <i key={d.iso} className={base} style={{ background: "linear-gradient(180deg,var(--orbis-gold-light),var(--orbis-gold))", color: "#1A1200", boxShadow: "0 0 10px rgba(245,184,0,.28)" }}>{d.letra}</i>;
          if (d.ehHoje) return <i key={d.iso} className={base} style={{ border: "1.6px solid var(--orbis-gold)", color: "var(--orbis-gold)" }}>{d.letra}</i>;
          if (d.folga) return (
            <i key={d.iso} className={base} style={{ border: "1.6px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.03)" }} title="Folga — não quebra a sequência">
              <Moon className="w-[11px] h-[11px]" strokeWidth={2.3} style={{ color: "#5F5A50" }} />
            </i>
          );
          if (d.perdeu) return <i key={d.iso} className={base} style={{ border: "1.6px solid rgba(229,115,127,.6)", color: "var(--orbis-custo)" }}>×</i>;
          return <i key={d.iso} className={base} style={{ border: "1.6px solid rgba(255,255,255,.13)", color: "var(--orbis-fg-3)" }}>{d.letra}</i>;
        })}
      </div>
    </div>
  );
}

/* Valor herói: inteiro grande + centavos pequenos, nunca quebra linha. */
function ValorGrande({ value }: { value: number }) {
  const n = useCountUp(value);
  const inteiro = Math.floor(Math.abs(n));
  const cents = Math.round((Math.abs(n) - inteiro) * 100);
  const digitos = String(inteiro).length;
  const size = digitos >= 6 ? "clamp(24px,6.8vw,30px)" : digitos >= 5 ? "clamp(26px,7.6vw,33px)" : "clamp(29px,8.8vw,37px)";
  return (
    <span className="orbis-num whitespace-nowrap" style={{ fontSize: size, fontWeight: 700, letterSpacing: "-.025em" }}>
      {n < 0 ? "-" : ""}R$ {inteiro.toLocaleString("pt-BR")}
      <span style={{ fontSize: "0.4em", color: "var(--orbis-fg-3)", fontWeight: 700 }}>,{String(cents).padStart(2, "0")}</span>
    </span>
  );
}

/* ---------- O card da meta: o único dourado da tela ---------- */
export function HeroCard({ faturamento, meta, diaria, vendidoHoje, metaHoje, descanso, onEditMeta, onFoco }: {
  faturamento: number; meta: number; diaria: number; vendidoHoje: number; metaHoje: number;
  descanso?: boolean; onEditMeta: () => void; onFoco: () => void;
}) {
  const pct = meta > 0 ? Math.min(100, (faturamento / meta) * 100) : 0;
  const mes = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const bateu = metaHoje > 0 && vendidoHoje >= metaHoje;
  const falta = Math.max(0, metaHoje - vendidoHoje);
  const forte = vendidoHoje <= 0 && !descanso;
  const texto = descanso && vendidoHoje <= 0
    ? "Dia de descanso · abrir mesmo assim"
    : bateu ? "Meta do dia batida · ver placar"
    : vendidoHoje > 0 ? `Voltar pro Foco · faltam ${fmtCurto(falta)}`
    : "Começar a vender";

  return (
    <section
      className="orbis-card-in rounded-[24px] border p-5"
      style={{
        borderColor: "rgba(245,184,0,.22)",
        background: "linear-gradient(165deg,#191308 0%,#101010 58%)",
        boxShadow: "0 24px 54px -32px rgba(245,184,0,.4)",
      }}
    >
      <button type="button" onClick={onEditMeta} className="w-full text-left orbis-press">
        {/* rótulo na linha dele: em 320px "FATURAMENTO DE SETEMBRO" quebrava e batia no anel */}
        <p className="orbis-label">Faturamento de {mes}</p>
        <div className="flex items-center gap-4 mt-3.5">
          <div className="flex-1 min-w-0">
            <p className="font-display leading-none"><ValorGrande value={faturamento} /></p>
            <p className="text-[12px] mt-[11px] leading-snug truncate" style={{ color: "var(--orbis-fg-2)" }}>
              Meta <b style={{ color: "var(--orbis-fg)" }}>{fmtCurto(meta)}</b>
              {diaria > 0 && <> · <b style={{ color: "var(--orbis-fg)" }}>{fmtCurto(diaria)}</b>/dia</>}
            </p>
          </div>
          <div className="shrink-0">
            <Ring pct={pct} size={78} stroke={7} label={<span className="orbis-num text-[15px] font-bold">{Math.round(pct)}%</span>} />
          </div>
        </div>
      </button>

      <div className="h-px my-[18px]" style={{ background: "var(--orbis-line)" }} />

      <div className="flex">
        <div className="flex-1 min-w-0">
          <p className="orbis-mini">Hoje</p>
          <p className="orbis-num mt-[7px]" style={{ fontSize: "clamp(17px,5vw,20px)", fontWeight: 700, color: vendidoHoje > 0 ? "var(--orbis-ok)" : "var(--orbis-fg)" }}>
            <AnimatedCurrency value={vendidoHoje} />
          </p>
        </div>
        <div className="flex-1 min-w-0 pl-[18px]" style={{ borderLeft: "1px solid var(--orbis-line)" }}>
          <p className="orbis-mini">Meta do dia</p>
          <p className="orbis-num mt-[7px]" style={{ fontSize: "clamp(17px,5vw,20px)", fontWeight: 700 }}>{fmtCurto(metaHoje)}</p>
        </div>
      </div>

      <button
        type="button" onClick={onFoco}
        className={forte ? "orbis-cta w-full mt-[18px] whitespace-nowrap" : "orbis-press w-full mt-[18px] h-[50px] rounded-[16px] border flex items-center justify-center gap-2 font-semibold whitespace-nowrap"}
        style={forte
          ? { height: 50, fontSize: "clamp(14px,3.9vw,15px)" }
          : { color: "var(--orbis-gold)", background: "rgba(245,184,0,.09)", borderColor: "rgba(245,184,0,.30)", fontSize: "clamp(13px,3.6vw,14.5px)" }}
      >
        <Zap className="w-[17px] h-[17px]" strokeWidth={2.6} /> {texto}
      </button>
    </section>
  );
}

/* ---------- Bloco: a borda que dá CONTEXTO a cada assunto ---------- */
export function Bloco({ titulo, acao, onAcao, children, plano }: {
  titulo?: string; acao?: string; onAcao?: () => void; children: ReactNode; plano?: boolean;
}) {
  return (
    <section className="orbis-card-in rounded-[22px] border"
      style={{ background: "var(--orbis-surf)", borderColor: "var(--orbis-line)", padding: plano ? "16px 18px" : 18 }}>
      {titulo && (
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold" style={{ fontSize: 15, letterSpacing: "-.005em" }}>{titulo}</p>
          {acao && (
            <button type="button" onClick={onAcao} className="text-[12px] font-semibold inline-flex items-center gap-0.5" style={{ color: "var(--orbis-fg-3)" }}>
              {acao} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------- Financeiro: dois números lado a lado ---------- */
export function FinanceiroFlat({ lucro, custos }: { lucro: number; custos: number }) {
  return (
    <div className="flex">
      <div className="flex-1 min-w-0">
        <p className="orbis-mini">Lucro líquido</p>
        <p className="orbis-num mt-[7px]" style={{ fontSize: "clamp(17px,5vw,20px)", fontWeight: 700, color: "var(--orbis-ok)" }}><AnimatedCurrency value={lucro} /></p>
      </div>
      <div className="flex-1 min-w-0 pl-[18px]" style={{ borderLeft: "1px solid var(--orbis-line)" }}>
        <p className="orbis-mini">Custos</p>
        <p className="orbis-num mt-[7px]" style={{ fontSize: "clamp(17px,5vw,20px)", fontWeight: 700, color: "var(--orbis-custo)" }}><AnimatedCurrency value={custos} /></p>
      </div>
    </div>
  );
}

/* ---------- Linha de item dentro de um Bloco ---------- */
export function Linha({ icone, titulo, sub, direita, pct, onClick }: {
  icone: ReactNode; titulo: string; sub: ReactNode; direita?: ReactNode; pct?: number; onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="orbis-press w-full flex items-center gap-3.5 text-left">
      <span className="w-[38px] h-[38px] rounded-[12px] flex items-center justify-center shrink-0"
        style={{ background: "rgba(245,184,0,.09)", color: "var(--orbis-gold)" }}>
        {icone}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold truncate">{titulo}</span>
        <span className="block text-[12px] mt-[3px] truncate" style={{ color: "var(--orbis-fg-3)" }}>{sub}</span>
        {typeof pct === "number" && <span className="block mt-[9px] pr-1"><FillBar pct={pct} color="var(--orbis-gold)" height={3} /></span>}
      </span>
      {direita}
      <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--orbis-fg-3)" }} />
    </button>
  );
}

export function PatenteLinha({ nome, pct, faltam, onClick }: {
  nome: string; pct: number; faltam: number; onClick?: () => void;
}) {
  return (
    <Linha
      icone={<Medal className="w-[17px] h-[17px]" strokeWidth={2.2} />}
      titulo={`Patente ${nome}`}
      sub={<>Faltam <b style={{ color: "var(--orbis-fg-2)" }}>{formatCurrency(faltam)}</b> pra subir</>}
      pct={pct}
      direita={pct > 0 ? <span className="orbis-num text-[13px] font-bold mr-1" style={{ color: "var(--orbis-fg-2)" }}>{Math.round(pct)}%</span> : undefined}
      onClick={onClick}
    />
  );
}
