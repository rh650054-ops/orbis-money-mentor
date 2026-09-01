/* ============================================================
   DASHBOARD v9 — "menos design ao mesmo tempo" (crítica do Mohamed +
   lista do Rick, 01/09). Regras desta versão:
   - UM card só, o do faturamento (como a conta do banco): mês + anel +
     Hoje + Meta do dia + o botão do Foco DENTRO dele, discreto.
   - Constância no TOPO (prioridade do Rick): streak + faixa da semana,
     folga em tracejado — folga não quebra a sequência.
   - O resto é LISTA sem caixa: seção em caixa-alta, linhas com fio fino.
   - Ícones (lucide), nunca emoji — regra do Rick (01/09).
   - Cores: dourado + cinzas. Verde/vermelho só nos dois números do
     financeiro. Patente/ranking/competição em versão neutra na Home.
   Componentes de APRESENTAÇÃO; o Index passa os números.
   ============================================================ */
import { type ReactNode } from "react";
import { Zap, ChevronRight, Flame, Medal, Pencil } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { AnimatedCurrency, AnimatedNumber, Ring, FillBar, useCountUp } from "@/shared/motion";

const fmtCurto = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));

/* ---------- Cabeçalho: data + saudação (sem chip — a constância tem a linha dela) ---------- */
export function HeaderV9({ nome }: { nome: string }) {
  const agora = new Date();
  const h = Number(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }));
  const saud = h >= 5 && h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const data = agora.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
  return (
    <div className="pt-1 min-w-0">
      <p className="orbis-section">{data}</p>
      <p className="font-display font-extrabold leading-tight mt-0.5 truncate" style={{ fontSize: "clamp(19px,5.2vw,22px)" }}>
        {saud}, <span style={{ color: "var(--orbis-gold)" }}>{nome}</span>
      </p>
    </div>
  );
}

/* ---------- Constância (regra do Rick, 01/09 — segunda versão) ----------
   O que conta é DIA TRABALHADO: ele iniciou o DEFCON 4 e vendeu.
   - 1 por dia, no máximo (vender 40 vezes num dia é 1 dia trabalhado);
   - o número grande é ACUMULATIVO no mês (não zera por causa de um dia);
   - a sequência (dias seguidos) vira apoio, porque folga não quebra;
   - dia de trabalho sem venda quebra a sequência — e a Home mostra qual foi.
   Fonte: os dias em que existe venda no DEFCON (defcon_sales), não o
   daily_sales — ali entram lançamentos manuais e Pix atrasado, que não
   são "dia trabalhado". */
const DIAS_EN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const LETRAS = ["S", "T", "Q", "Q", "S", "S", "D"]; // segunda → domingo
const NOME_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function isoLocal(d: Date) { return d.toLocaleDateString("en-CA"); }

export function calcularConstancia(diasTrabalhados: string[], workingDays: string[] | null, hojeStr: string) {
  const fez = new Set(diasTrabalhados);
  const trabalha = (d: Date) => !(Array.isArray(workingDays) && workingDays.length > 0 && !workingDays.includes(DIAS_EN[d.getDay()]!));
  const hoje = new Date(`${hojeStr}T12:00:00`);
  let streak = 0;
  let quebra: string | null = null;
  if (fez.has(hojeStr)) streak++;      // hoje só conta a favor; nunca contra
  const d = new Date(hoje);
  for (let i = 0; i < 90; i++) {
    d.setDate(d.getDate() - 1);
    const iso = isoLocal(d);
    if (!trabalha(d)) continue;        // folga: pula, não quebra
    if (fez.has(iso)) { streak++; continue; }
    quebra = iso;
    break;
  }
  return { streak, quebra };
}

export function ConstanciaRow({ workingDays, diasTrabalhados, diasNoMes, onEditMeta }: {
  workingDays: string[] | null;   // profiles.working_days (en)
  diasTrabalhados: string[];      // YYYY-MM-DD com venda no DEFCON (~60 dias)
  diasNoMes: number;              // acumulativo do mês corrente
  onEditMeta?: () => void;
}) {
  const hojeStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const { streak, quebra } = calcularConstancia(diasTrabalhados, workingDays, hojeStr);
  const hoje = new Date(`${hojeStr}T12:00:00`);
  const dow = (hoje.getDay() + 6) % 7; // 0 = segunda
  const trabalhouHoje = diasTrabalhados.includes(hojeStr);
  const temHistorico = diasTrabalhados.length > 0;
  const semana = LETRAS.map((letra, i) => {
    const d = new Date(hoje); d.setDate(hoje.getDate() - dow + i);
    const iso = isoLocal(d);
    const folga = Array.isArray(workingDays) && workingDays.length > 0 && !workingDays.includes(DIAS_EN[d.getDay()]!);
    const passou = iso < hojeStr;
    const fez = diasTrabalhados.includes(iso);
    return { letra, iso, folga, fez, ehHoje: iso === hojeStr, perdeu: temHistorico && passou && !folga && !fez };
  });
  const quebraRecente = temHistorico && quebra && streak === 0 && semana.some((d) => d.iso === quebra);
  const nomeQuebra = quebra ? NOME_DIA[new Date(`${quebra}T12:00:00`).getDay()] : "";
  const ativo = diasNoMes > 0;

  // Linha de apoio, na ordem de importância: quebra > hoje ainda aberto > sequência > regra
  const apoio = quebraRecente
    ? `Sem venda na ${nomeQuebra}, dia de trabalho — a sequência recomeçou.`
    : !trabalhouHoje && !semana.find((d) => d.ehHoje)?.folga
      ? "Hoje ainda não contou — venda no DEFCON pra marcar o dia."
      : streak > 1
        ? `${streak} dias seguidos · folga não quebra`
        : "Folga não quebra a sequência.";

  return (
    <div className="orbis-card-in">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold whitespace-nowrap inline-flex items-center gap-1.5" style={{ fontSize: "clamp(13.5px,3.7vw,15px)" }}>
          <Flame className="w-4 h-4 shrink-0" strokeWidth={2.4} style={{ color: ativo ? "var(--orbis-gold)" : "var(--orbis-fg-3)" }} />
          <span>
            <b className="orbis-num" style={{ color: ativo ? "var(--orbis-gold)" : "var(--orbis-fg-2)" }}>{diasNoMes}</b>
            {" "}{diasNoMes === 1 ? "dia trabalhado" : "dias trabalhados"}
          </span>
        </p>
        <div className="flex gap-[5px] shrink-0" aria-label="Sua semana">
          {semana.map((d) => {
            const base = "w-[19px] h-[19px] rounded-full flex items-center justify-center text-[9px] font-bold not-italic";
            if (d.fez) return <i key={d.iso} className={base} style={{ background: "var(--orbis-gold)", color: "#1A1200" }}>{d.letra}</i>;
            if (d.ehHoje) return <i key={d.iso} className={base} style={{ border: "1.5px solid var(--orbis-gold)", color: "var(--orbis-gold)" }}>{d.letra}</i>;
            if (d.folga) return <i key={d.iso} className={base} style={{ border: "1.5px dashed rgba(255,255,255,.18)", color: "#4a4740" }}>{d.letra}</i>;
            if (d.perdeu) return <i key={d.iso} className={base} style={{ border: "1.5px solid rgba(229,115,127,.7)", color: "var(--orbis-custo)" }}>×</i>;
            return <i key={d.iso} className={base} style={{ border: "1.5px solid rgba(255,255,255,.14)", color: "var(--orbis-fg-3)" }}>{d.letra}</i>;
          })}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 mt-1.5">
        <p className="text-[11.5px] leading-tight min-w-0 truncate" style={{ color: quebraRecente ? "var(--orbis-custo)" : "var(--orbis-fg-3)" }}>{apoio}</p>
        {onEditMeta && (
          <button type="button" onClick={onEditMeta} className="inline-flex items-center gap-1 text-[11.5px] font-medium shrink-0" style={{ color: "var(--orbis-fg-3)" }}>
            <Pencil className="w-3 h-3" /> definir meta do mês
          </button>
        )}
      </div>
    </div>
  );
}

/* Valor grande: inteiro grande + centavos pequenos; encolhe conforme cresce. */
function ValorGrande({ value }: { value: number }) {
  const n = useCountUp(value);
  const inteiro = Math.floor(Math.abs(n));
  const cents = Math.round((Math.abs(n) - inteiro) * 100);
  const digitos = String(inteiro).length;
  // fixo E adaptável: cresce com a tela, mas sempre dentro de um teto/piso —
  // nunca minúsculo num iPhone grande, nunca estourando num 320px.
  const size = digitos >= 6 ? "clamp(26px,7.4vw,34px)" : digitos >= 5 ? "clamp(28px,8.2vw,37px)" : "clamp(32px,9.6vw,42px)";
  return (
    <span className="orbis-num whitespace-nowrap" style={{ fontSize: size }}>
      {n < 0 ? "-" : ""}R$ {inteiro.toLocaleString("pt-BR")}
      <span style={{ fontSize: "0.45em", color: "var(--orbis-fg-3)", fontWeight: 700 }}>,{String(cents).padStart(2, "0")}</span>
    </span>
  );
}

/* ---------- O card: faturamento do mês + anel + Hoje/Meta do dia + botão do Foco ---------- */
export function HeroCard({ faturamento, meta, diaria, vendidoHoje, metaHoje, descanso, onEditMeta, onFoco }: {
  faturamento: number;
  meta: number;
  diaria: number;
  vendidoHoje: number;
  metaHoje: number;
  descanso?: boolean;
  onEditMeta: () => void;
  onFoco: () => void;
}) {
  const pct = meta > 0 ? Math.min(100, (faturamento / meta) * 100) : 0;
  const mes = new Date().toLocaleDateString("pt-BR", { month: "long" });
  const bateu = metaHoje > 0 && vendidoHoje >= metaHoje;
  const falta = Math.max(0, metaHoje - vendidoHoje);
  // Um botão só, e ele muda de tom com o dia: forte antes da 1ª venda,
  // discreto (ghost) quando o dia já está em movimento — o faturamento é o herói.
  const forte = vendidoHoje <= 0 && !descanso;
  const texto = descanso && vendidoHoje <= 0
    ? "Dia de descanso · abrir mesmo assim"
    : bateu ? "Meta do dia batida · ver placar"
    : vendidoHoje > 0 ? `Voltar pro Foco · faltam ${fmtCurto(falta)}`
    : "Começar a vender";

  return (
    <section
      className="orbis-card-in rounded-[24px] border p-[18px] pb-[14px]"
      style={{
        borderColor: "rgba(245,184,0,.22)",
        background: "linear-gradient(165deg,#181307 0%,var(--orbis-surface) 55%)",
        boxShadow: "0 20px 50px -30px rgba(245,184,0,.35)",
      }}
    >
      <button type="button" onClick={onEditMeta} className="w-full text-left flex items-center gap-3.5 orbis-press">
        <div className="min-w-0 flex-1">
          <p className="orbis-label">Faturamento de {mes}</p>
          <p className="font-display font-extrabold leading-none mt-2"><ValorGrande value={faturamento} /></p>
          <p className="text-[12.5px] mt-2 leading-snug" style={{ color: "var(--orbis-fg-2)" }}>
            Meta <b style={{ color: "var(--orbis-fg)" }}>{fmtCurto(meta)}</b>
            {diaria > 0 && <> · <b style={{ color: "var(--orbis-fg)" }}>{fmtCurto(diaria)}</b>/dia</>}
          </p>
        </div>
        <div className="ml-auto shrink-0">
          <Ring pct={pct} size={82} stroke={8} label={<AnimatedNumber value={pct} format={(n) => `${Math.round(n)}%`} className="text-[16px]" />} />
        </div>
      </button>

      <div className="h-px my-3.5" style={{ background: "rgba(255,255,255,.08)" }} />

      <div className="flex">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[.06em]" style={{ color: "var(--orbis-fg-3)" }}>Hoje</p>
          <p className="orbis-num font-extrabold mt-0.5" style={{ fontSize: "clamp(16px,4.6vw,19px)", color: vendidoHoje > 0 ? "var(--orbis-ok)" : "var(--orbis-fg)" }}>
            <AnimatedCurrency value={vendidoHoje} />
          </p>
        </div>
        <div className="flex-1 min-w-0 pl-3.5" style={{ borderLeft: "1px solid rgba(255,255,255,.08)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-[.06em]" style={{ color: "var(--orbis-fg-3)" }}>Meta do dia</p>
          <p className="orbis-num font-extrabold mt-0.5" style={{ fontSize: "clamp(16px,4.6vw,19px)" }}>{fmtCurto(metaHoje)}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onFoco}
        className={forte ? "orbis-cta w-full mt-3.5 whitespace-nowrap" : "orbis-press w-full mt-3.5 h-[48px] rounded-[14px] border flex items-center justify-center gap-2 font-semibold whitespace-nowrap"}
        style={forte
          ? { height: 48, fontSize: "clamp(14px,3.9vw,15.5px)" }
          : { color: "var(--orbis-gold)", background: "rgba(245,184,0,.10)", borderColor: "rgba(245,184,0,.30)", fontSize: "clamp(13px,3.6vw,15px)" }}
      >
        <Zap className="w-[17px] h-[17px]" strokeWidth={2.6} /> {texto}
      </button>
    </section>
  );
}

/* ---------- Título de seção plano, com link opcional à direita ---------- */
export function Secao({ titulo, acao, onAcao, children }: { titulo: string; acao?: string; onAcao?: () => void; children: ReactNode }) {
  return (
    <div className="orbis-card-in">
      <div className="flex items-baseline justify-between">
        <p className="orbis-section">{titulo}</p>
        {acao && (
          <button type="button" onClick={onAcao} className="text-[12px] font-semibold inline-flex items-center gap-0.5" style={{ color: "var(--orbis-fg-3)" }}>
            {acao} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/* ---------- Financeiro: dois números lado a lado, sem caixa ---------- */
export function FinanceiroFlat({ lucro, custos }: { lucro: number; custos: number }) {
  return (
    <div className="flex pt-3 pb-1">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[.06em]" style={{ color: "var(--orbis-fg-3)" }}>Lucro líquido</p>
        <p className="orbis-num font-extrabold mt-1" style={{ fontSize: "clamp(18px,5.2vw,22px)", color: "var(--orbis-ok)" }}><AnimatedCurrency value={lucro} /></p>
      </div>
      <div className="flex-1 min-w-0 pl-4" style={{ borderLeft: "1px solid rgba(255,255,255,.08)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-[.06em]" style={{ color: "var(--orbis-fg-3)" }}>Custos</p>
        <p className="orbis-num font-extrabold mt-1" style={{ fontSize: "clamp(18px,5.2vw,22px)", color: "var(--orbis-custo)" }}><AnimatedCurrency value={custos} /></p>
      </div>
    </div>
  );
}

/* ---------- Linha de lista (sem caixa): ícone neutro + título + sub + › ---------- */
export function Linha({ icone, titulo, sub, direita, pct, ultima, onClick }: {
  icone: ReactNode; titulo: string; sub: ReactNode; direita?: ReactNode; pct?: number; ultima?: boolean; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="orbis-press w-full flex items-center gap-3.5 py-3.5 text-left"
      style={ultima ? undefined : { borderBottom: "1px solid rgba(255,255,255,.07)" }}
    >
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[16px] leading-none overflow-hidden"
        style={{ background: "rgba(255,255,255,.05)" }}>
        {icone}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-semibold truncate">{titulo}</span>
        <span className="block text-[12px] mt-0.5 truncate" style={{ color: "var(--orbis-fg-3)" }}>{sub}</span>
        {typeof pct === "number" && <span className="block mt-1.5 pr-1"><FillBar pct={pct} color="var(--orbis-gold)" height={3} /></span>}
      </span>
      {direita}
      <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--orbis-fg-3)" }} />
    </button>
  );
}

export function PatenteLinha({ nome, pct, faltam, ultima, onClick }: {
  nome: string; pct: number; faltam: number; ultima?: boolean; onClick?: () => void;
}) {
  return (
    <Linha
      icone={<Medal className="w-4 h-4" strokeWidth={2.2} style={{ color: "var(--orbis-gold)" }} />}
      titulo={`Patente ${nome}`}
      sub={<>Faltam <b style={{ color: "var(--orbis-fg-2)" }}>{formatCurrency(faltam)}</b> pra subir</>}
      pct={pct}
      ultima={ultima}
      direita={pct > 0 ? <span className="orbis-num text-[14px] font-extrabold mr-1" style={{ color: "var(--orbis-fg-2)" }}>{Math.round(pct)}%</span> : undefined}
      onClick={onClick}
    />
  );
}
