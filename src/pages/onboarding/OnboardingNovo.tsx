/* ============================================================
   ONBOARDING NOVO — os 3 atos + "Leva o Orbis no bolso".
   Fluxo aprovado: link → captura → criar conta → AQUI → DEFCON.
   (Rick, 05/09: 7 em 10 contas novas nunca chegavam ao primeiro DEFCON
    passando pelo dashboard. Agora o onboarding termina no início do DEFCON.)

   Ato 1  DOR      "trabalhei tanto… cadê o dinheiro?" (toque avança)
   Ato 2  PLANO    logo P&B + meta do mês, dias/semana, horas/dia
   Ato 3  REVELAÇÃO odômetro sobe até o valor do ANO + diária/hora
   Fixar  PWA      Android: botão nativo · iOS: 3 passos manuais

   Regras embutidas:
   - O plano é GRAVADO no Ato 2→3 (salvarPlano) mas só é REVELADO
     no 1º Modo Foco — aqui a gente não fala de DEFCON.
   - "Pular" existe em todas as etapas (nunca prender o usuário).
   - prefers-reduced-motion desliga o odômetro (número aparece pronto).
   - Se o app já está instalado (standalone), a etapa Fixar nem aparece.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Share, PlusSquare, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useCountUp, useReducedMotion } from "@/shared/motion";
import { calcularPlano, salvarPlano, marcarPlanoRevelado, type PlanoDoCorre } from "@/shared/onboarding/plano";
import { EditPlanningModal } from "@/components/EditPlanningModal";
import { marcarNovidadesVistas } from "@/components/NovidadesOrbis2";

type Etapa = "ato1" | "ato2" | "ato3" | "fixar" | "meta";

/* Sem centavos: "R$ 120.000" cabe na tela, "R$ 120.000,00" estoura (visto no ar). */
const fmt0 = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));

/* ---------- fundo de "rochas" (mesmo dos mocks aprovados) ---------- */
function Rochas() {
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute -top-16 -left-10 w-[260px] h-[180px] rounded-full blur-[2px]"
        style={{ background: "radial-gradient(ellipse at 30% 20%, #1a1a1a, #000 70%)" }} />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-14 w-[300px] h-[200px] rounded-full blur-[2px]"
        style={{ background: "radial-gradient(ellipse at 70% 80%, #151515, #000 70%)" }} />
    </>
  );
}

/* ---------- logo do Orbis em PRETO E BRANCO (decisão do Rick) ---------- */
function LogoPB({ size = 64 }: { size?: number }) {
  return (
    <div
      className="relative rounded-full"
      style={{ width: size, height: size, border: "5px solid #fff", boxShadow: "0 0 32px -6px rgba(255,255,255,.45)" }}
    >
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
        style={{ width: size * 0.25, height: size * 0.25 }} />
    </div>
  );
}

/* ---------- "botão fantasma" dourado que pulsa (TOQUE PARA CONTINUAR) ---------- */
function ContinuarFantasma({ texto }: { texto: string }) {
  return (
    <p
      className="absolute bottom-11 left-0 right-0 text-center text-[13px] font-extrabold tracking-[.14em] select-none"
      style={{
        background: "linear-gradient(90deg,#B9B3A6,#F5B800,#B9B3A6)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}
    >
      {texto}
    </p>
  );
}

export default function OnboardingNovo() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const [etapa, setEtapa] = useState<Etapa>("ato1");
  const [saindo, setSaindo] = useState(false); // fade entre etapas (200ms)

  // ---- estado do plano (Ato 2) — valores do mock como ponto de partida
  const [metaMensal, setMetaMensal] = useState(6000);
  const [diasSemana, setDiasSemana] = useState(6);
  const [horasDia, setHorasDia] = useState(8);
  const [editandoMeta, setEditandoMeta] = useState(false);

  // A hora de começar a vender NÃO é perguntada aqui: ela entra no fim da
  // definição de metas ("Que horas você vai começar a vender amanhã?") —
  // decisão do Rick: pergunta natural, no lugar onde ele mexe nas metas.
  const plano = useMemo(
    () => calcularPlano({ metaMensal, diasSemana, horasDia, horaInicio: null }),
    [metaMensal, diasSemana, horasDia],
  );

  // ---- app já instalado? então a etapa "fixar" não existe
  const jaInstalado = useMemo(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true),
    [],
  );

  // ---- Android: captura o evento nativo de instalação do PWA
  const promptRef = useRef<any>(null);
  const [temPromptNativo, setTemPromptNativo] = useState(false);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); promptRef.current = e; setTemPromptNativo(true); };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);
  const ehIOS = useMemo(() => /iPhone|iPad|iPod/i.test(navigator.userAgent), []);

  /* INSTRUMENTAÇÃO (relatório "Precipício do Terceiro Dia"): grava em
     profiles.onboarding_step até onde cada conta chegou. Hoje as 621 contas
     estão todas em 0 — sem isso, não dá pra saber onde as pessoas desistem
     nem se o onboarding novo é melhor que o velho. 1 update por etapa. */
  const ETAPA_NUM: Record<Etapa, number> = { ato1: 1, ato2: 2, ato3: 3, fixar: 4, meta: 5 };
  const gravarPasso = (n: number) => {
    if (!user?.id) return;
    supabase.from("profiles").update({ onboarding_step: n }).eq("user_id", user.id)
      .then(() => { /* fire and forget */ }, () => { /* offline — segue o jogo */ });
  };
  useEffect(() => { gravarPasso(1); /* chegou no Ato 1 */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /* Troca de etapa com o MESMO respiro sempre: fade-out 200ms → próxima
     entra com orbis-card-in. Uma transição só, igual ao resto do app. */
  const irPara = (prox: Etapa | "fim") => {
    const go = () => {
      if (prox === "fim") { concluir(); return; }
      // app já instalado → pula direto pra tela de meta de amanhã
      if (prox === "fixar" && jaInstalado) { setEtapa("meta"); gravarPasso(ETAPA_NUM.meta); setSaindo(false); window.scrollTo(0, 0); return; }
      setEtapa(prox);
      gravarPasso(ETAPA_NUM[prox]);
      setSaindo(false);
      window.scrollTo(0, 0);
    };
    if (reduced) { go(); return; }
    setSaindo(true);
    window.setTimeout(go, 200);
  };

  /* Ato 2 → Ato 3: é AQUI que o plano é gravado (em silêncio). */
  const calcular = () => {
    const p: PlanoDoCorre = { metaMensal, diasSemana, horasDia, horaInicio: null };
    if (user?.id) void salvarPlano(user.id, p);
    irPara("ato3");
  };

  const concluir = async () => {
    if (user?.id) {
      marcarNovidadesVistas(user.id); // conta nova não vê "o que mudou no 2.0"
      try {
        await supabase.from("profiles")
          .update({ onboarding_completed: true, onboarding_step: 6 })
          .eq("user_id", user.id);
      } catch { /* offline — o Layout revalida depois */ }
    }
    // Direto pro início do DEFCON: a ativação é o primeiro dia rodando, não o dashboard.
    navigate("/defcon?primeiro=1", { replace: true });
  };

  /* Pular = concluir sem cerimônia: nunca prendemos ninguém.
     (Se pulou antes do Ato 3, o plano não existe e o Foco pede a meta normal.) */
  const pular = () => { void concluir(); };

  const conteudo: Record<Etapa, JSX.Element> = {
    ato1: <Ato1 onAvancar={() => irPara("ato2")} />,
    ato2: (
      <Ato2
        metaMensal={metaMensal} setMetaMensal={setMetaMensal}
        editandoMeta={editandoMeta} setEditandoMeta={setEditandoMeta}
        diasSemana={diasSemana} setDiasSemana={setDiasSemana}
        horasDia={horasDia} setHorasDia={setHorasDia}
        onCalcular={calcular}
      />
    ),
    ato3: <Ato3 plano={plano} onAvancar={() => irPara("fixar")} />,
    fixar: (
      <Fixar
        ehIOS={ehIOS}
        temPromptNativo={temPromptNativo}
        onInstalarNativo={async () => {
          const ev = promptRef.current;
          if (!ev) return;
          try { await ev.prompt(); await ev.userChoice; } catch { /* usuário fechou */ }
          promptRef.current = null; setTemPromptNativo(false);
        }}
        onConcluir={() => irPara("meta")}
      />
    ),
    meta: (
      <UltimoPasso
        userId={user?.id}
        onConcluir={() => { if (user?.id) marcarPlanoRevelado(user.id); void concluir(); }}
      />
    ),
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black text-[#F4F1EA] font-body"
      style={{ opacity: saindo ? 0 : 1, transition: reduced ? undefined : "opacity 200ms cubic-bezier(0.2,0,0,1)" }}
    >
      <Rochas />
      <button type="button" onClick={pular}
        className="absolute top-14 right-6 z-10 text-[12.5px] font-semibold" style={{ color: "#5C574D" }}>
        Pular
      </button>
      <div key={etapa} className="orbis-card-in relative min-h-full flex flex-col items-center px-8 text-center">
        {conteudo[etapa]}
      </div>
    </div>
  );
}

/* ================= ATO 1 — a dor ================= */
function Ato1({ onAvancar }: { onAvancar: () => void }) {
  return (
    <button type="button" onClick={onAvancar} className="flex-1 w-full flex flex-col items-center justify-center pb-24 cursor-pointer">
      {/* o "sol de pedra" do mock — círculo escuro que lembra o peso do dia */}
      <div className="relative rounded-full mb-10" style={{
        width: 160, height: 160,
        background: "radial-gradient(circle at 35% 30%, #282826, #131311 60%, #0A0A09)",
        boxShadow: "inset 0 2px 14px rgba(255,255,255,.05)",
      }}>
        <div className="absolute rounded-full" style={{ inset: 25, border: "3px solid #2C2A24" }} />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: 32, height: 32, background: "#242219" }} />
      </div>
      <h1 className="font-display text-[23px] font-extrabold leading-[1.35] tracking-[-.02em]">
        Você acorda cedo, pega sol,<br />enfrenta rua o dia inteiro.
      </h1>
      <p className="text-[14.5px] leading-[1.55] mt-3" style={{ color: "#B9B3A6" }}>
        E no fim do mês, olha pro bolso e pensa:<br />
        <b style={{ color: "#F4F1EA" }}>“trabalhei tanto… cadê o dinheiro?”</b>
      </p>
      <ContinuarFantasma texto="TOQUE PARA CONTINUAR" />
    </button>
  );
}

/* ================= ATO 2 — montar o plano ================= */
function Ato2(props: {
  metaMensal: number; setMetaMensal: (n: number) => void;
  editandoMeta: boolean; setEditandoMeta: (b: boolean) => void;
  diasSemana: number; setDiasSemana: (n: number) => void;
  horasDia: number; setHorasDia: (n: number) => void;
  onCalcular: () => void;
}) {
  const { metaMensal, setMetaMensal, editandoMeta, setEditandoMeta, diasSemana, setDiasSemana, horasDia, setHorasDia, onCalcular } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editandoMeta) inputRef.current?.focus(); }, [editandoMeta]);

  const Chip = ({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className="orbis-press orbis-num flex-1 h-12 rounded-[14px] flex items-center justify-center text-[17px] font-extrabold"
      style={ativo
        ? { background: "linear-gradient(180deg,#FFC63A,#F5B800)", color: "#1A1200", boxShadow: "0 4px 0 #B88700" }
        : { background: "#101010", border: "1px solid rgba(255,255,255,.09)", color: "#B9B3A6" }}
    >
      {children}
    </button>
  );

  const Rotulo = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[10.5px] font-extrabold uppercase tracking-[.16em]" style={{ color: "#7E7869" }}>{children}</p>
  );

  return (
    <div className="w-full pt-24 pb-28">
      <div className="flex justify-center"><LogoPB /></div>
      <h1 className="font-display text-[22px] font-extrabold leading-[1.35] mt-[22px]">
        Então vamos montar<br /><b style={{ color: "#F5B800" }}>o seu plano.</b>
      </h1>

      <div className="mt-[26px] flex flex-col gap-[14px] text-left">
        <div>
          <Rotulo>Quanto você quer fazer por mês?</Rotulo>
          {editandoMeta ? (
            <div className="mt-[7px] rounded-2xl px-4 py-[13px] flex items-baseline gap-1.5"
              style={{ background: "#101010", border: "1px solid rgba(245,184,0,.55)" }}>
              <span className="orbis-num font-display text-[28px] font-extrabold">R$</span>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                className="orbis-num font-display bg-transparent outline-none text-[28px] font-extrabold w-full"
                defaultValue={metaMensal ? String(metaMensal) : ""}
                onBlur={(e) => {
                  const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                  if (Number.isFinite(n) && n > 0) setMetaMensal(Math.min(n, 1_000_000));
                  setEditandoMeta(false);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              />
            </div>
          ) : (
            <button type="button" onClick={() => setEditandoMeta(true)}
              className="orbis-press mt-[7px] w-full rounded-2xl px-4 py-[13px] flex items-baseline gap-1.5 text-left"
              style={{ background: "#101010", border: "1px solid rgba(245,184,0,.35)" }}>
              <span className="orbis-num font-display text-[28px] font-extrabold">{fmt0(metaMensal)}</span>
              <span className="ml-auto text-[12px]" style={{ color: "#5C574D" }}>toque pra mudar</span>
            </button>
          )}
        </div>

        <div>
          <Rotulo>Quantos dias na rua por semana?</Rotulo>
          <div className="mt-[7px] flex gap-2">
            {[4, 5, 6, 7].map((d) => (
              <Chip key={d} ativo={diasSemana === d} onClick={() => setDiasSemana(d)}>{d}</Chip>
            ))}
          </div>
        </div>

        <div>
          <Rotulo>Quantas horas por dia?</Rotulo>
          <div className="mt-[7px] flex gap-2">
            {[6, 8, 10, 12].map((h) => (
              <Chip key={h} ativo={horasDia === h} onClick={() => setHorasDia(h)}>{h}h</Chip>
            ))}
          </div>
        </div>

      </div>

      <button
        type="button"
        onClick={onCalcular}
        className="orbis-press absolute bottom-11 left-0 right-0 text-center text-[13px] font-extrabold tracking-[.14em]"
        style={{
          background: "linear-gradient(90deg,#B9B3A6,#F5B800,#B9B3A6)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        CALCULAR MEU CORRE
      </button>
    </div>
  );
}

/* ================= ATO 3 — o odômetro da revelação ================= */
function Ato3({ plano, onAvancar }: { plano: ReturnType<typeof calcularPlano>; onAvancar: () => void }) {
  /* O número grande CONTA de 0 até o valor do ano (1,4s — mais lento que
     os 600ms padrão de propósito: este é O momento do onboarding).
     Os dois valores borrados atrás são "rastro" do odômetro (⅓ e ⅔). */
  const anoAnimado = useCountUp(plano.ano, 1400);
  const fmt = (n: number) => fmt0(n);

  return (
    <button type="button" onClick={onAvancar} className="flex-1 w-full flex flex-col items-center justify-center pb-24 cursor-pointer">
      <p className="text-[10.5px] font-extrabold uppercase tracking-[.18em]" style={{ color: "#7E7869" }}>
        {plano.diasSemana} dias por semana · {plano.horasDia} horas por dia
      </p>
      <h1 className="font-display text-[21px] font-extrabold mt-2.5">Essa meta constrói</h1>

      <div className="my-[22px] leading-[1.08] relative">
        <div className="orbis-num font-display text-[26px] font-extrabold blur-[1.5px]" style={{ color: "#2E2B23" }}>
          {fmt(plano.ano / 3)}
        </div>
        <div className="orbis-num font-display text-[30px] font-extrabold blur-[1px]" style={{ color: "#3A362C" }}>
          {fmt((plano.ano * 2) / 3)}
        </div>
        <div className="orbis-num font-display text-[54px] font-extrabold" style={{
          background: "linear-gradient(90deg,#FFE49A,#F5B800)",
          WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
        }}>
          {fmt(anoAnimado)}
        </div>
      </div>
      <h1 className="font-display text-[21px] font-extrabold">em um ano.</h1>

      <div className="flex gap-2 w-full mt-[26px]">
        <CardValor rotulo="Na semana" valor={plano.semana} />
        <CardValor rotulo="Sua diária" valor={plano.diaria} destaque />
        <CardValor rotulo="Sua hora" valor={plano.hora} />
      </div>

      <p className="text-[14.5px] leading-[1.55] mt-[18px]" style={{ color: "#B9B3A6" }}>
        Sua hora na rua vale <b style={{ color: "#F4F1EA" }}>{fmt0(plano.hora)}</b>.<br />
        Isso não é um corre. <b style={{ color: "#F4F1EA" }}>Isso é uma empresa.</b>
      </p>
      <ContinuarFantasma texto="COMEÇAR MEU NEGÓCIO" />
    </button>
  );
}

function CardValor({ rotulo, valor, destaque = false }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className="flex-1 rounded-[14px] px-1.5 py-[11px]" style={destaque
      ? { background: "rgba(245,184,0,.10)", border: "1px solid rgba(245,184,0,.4)" }
      : { background: "#101010", border: "1px solid rgba(255,255,255,.09)" }}>
      <p className="text-[9.5px] font-extrabold uppercase tracking-[.12em]" style={{ color: destaque ? "#F5B800" : "#7E7869" }}>
        {rotulo}
      </p>
      <p className="orbis-num font-display text-[18px] font-extrabold mt-[5px]" style={destaque ? { color: "#F5B800" } : undefined}>
        {fmt0(valor)}
      </p>
    </div>
  );
}

/* ================= FIXAR — "Leva o Orbis no bolso" ================= */
function Fixar({ ehIOS, temPromptNativo, onInstalarNativo, onConcluir }: {
  ehIOS: boolean;
  temPromptNativo: boolean;
  onInstalarNativo: () => void;
  onConcluir: () => void;
}) {
  return (
    <div className="w-full pt-[92px] pb-40 flex flex-col items-center">
      {/* mini-celular com o ícone P&B do Orbis na tela inicial */}
      <div className="relative overflow-hidden" style={{
        width: 120, height: 150, borderRadius: "22px 22px 0 0",
        border: "3px solid #262626", borderBottom: "none",
        background: "linear-gradient(180deg,#0E0E0E,#141414)",
      }}>
        <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 8, width: 34, height: 5, borderRadius: 99, background: "#262626" }} />
        <div className="absolute left-0 right-0 flex justify-center gap-2.5" style={{ top: 28 }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ width: 20, height: 20, borderRadius: 6, background: "#1E1E1E" }} />)}
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-[5px]" style={{ top: 62 }}>
          <div className="relative" style={{ width: 44, height: 44, borderRadius: 12, background: "#000", border: "1px solid #2A2A2A", boxShadow: "0 0 18px -4px rgba(255,255,255,.35)" }}>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: 26, height: 26, border: "3px solid #fff" }} />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ width: 9, height: 9 }} />
          </div>
          <span className="text-[8.5px] font-semibold" style={{ color: "#B9B3A6" }}>Orbis</span>
        </div>
      </div>

      <h1 className="font-display text-[23px] font-extrabold leading-[1.35] mt-[22px]">
        Leva o Orbis <b style={{ color: "#F5B800" }}>no bolso</b>,<br />igual seus outros apps.
      </h1>
      <p className="text-[13.5px] leading-[1.5] mt-2" style={{ color: "#B9B3A6" }}>
        Fixa na tela inicial: abre com um toque,<br />direto da rua, sem procurar no navegador.
      </p>

      {ehIOS ? (
        /* iOS não tem prompt nativo — ensinamos os 3 toques (dúvida nº 1 da galera) */
        <div className="w-full mt-5 flex flex-col gap-[9px] text-left">
          <Passo n={1} icone={<Share size={20} color="#5AC8FA" strokeWidth={2} />}>
            Toca no botão <b>Compartilhar</b> <span style={{ color: "#B9B3A6", fontWeight: 500 }}>aí embaixo do navegador</span>
          </Passo>
          <Passo n={2} icone={<PlusSquare size={20} color="#F5B800" strokeWidth={2} />}>
            Escolhe <b>“Adicionar à Tela de Início”</b>
          </Passo>
          <Passo n={3} icone={<Check size={20} color="#3DD68C" strokeWidth={2.4} />}>
            Toca em <b>Adicionar</b> — pronto, virou app
          </Passo>
        </div>
      ) : (
        <p className="text-[13px] mt-5" style={{ color: "#B9B3A6" }}>
          {temPromptNativo
            ? "Toca no botão dourado que o resto é com a gente."
            : "Abre o menu do navegador (⋮) e toca em “Adicionar à tela inicial”."}
        </p>
      )}

      <div className="fixed left-8 right-8 bottom-[100px]">
        {!ehIOS && temPromptNativo ? (
          <button type="button" onClick={onInstalarNativo} className="orbis-cta w-full">FIXAR NA TELA INICIAL</button>
        ) : (
          <button type="button" onClick={onConcluir} className="orbis-cta w-full">JÁ FIXEI ✓</button>
        )}
      </div>
      <button type="button" onClick={onConcluir} className="fixed left-0 right-0 bottom-14 text-[13px] font-semibold" style={{ color: "#7E7869" }}>
        fazer isso depois
      </button>
    </div>
  );
}

/* ================= ÚLTIMO PASSO — o modal "Editar Planejamento" DE VERDADE ================= */
/* Decisão do Rick (31/08): depois do Ato 3 abre o MESMO modal que ele usa no
   dashboard (meta mensal, dias, horas, faixa semanal/diária/hora e o bloco NOVO
   da hora de começar). Salvar → dashboard. Cancelar/X → dashboard também
   (o plano do Ato 2 já está gravado, ninguém fica preso). */
function UltimoPasso({ userId, onConcluir }: { userId?: string; onConcluir: () => void }) {
  return (
    <div className="w-full pt-24 text-center relative z-[1]">
      <p className="text-[10.5px] font-extrabold uppercase tracking-[.18em]" style={{ color: "#B9B3A6" }}>
        Último passo
      </p>
      <h1 className="font-display text-[22px] font-extrabold leading-[1.35] mt-2">
        Confere <b style={{ color: "#F5B800" }}>seu planejamento</b>
      </h1>
      <p className="text-[13px] mt-2" style={{ color: "#7E7869" }}>
        Ajusta se quiser e marca que horas você começa amanhã.
      </p>
      {userId && (
        <EditPlanningModal
          userId={userId}
          isOpen
          onClose={onConcluir}
        />
      )}
      {!userId && (
        <button type="button" onClick={onConcluir} className="orbis-cta w-full mt-8">CONTINUAR</button>
      )}
    </div>
  );
}

function Passo({ n, icone, children }: { n: number; icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] px-3.5 py-3 w-full"
      style={{ background: "#101010", border: "1px solid rgba(255,255,255,.09)" }}>
      <span className="orbis-num font-display flex-none w-[26px] h-[26px] rounded-full flex items-center justify-center text-[13px] font-extrabold"
        style={{ background: "rgba(245,184,0,.14)", border: "1px solid rgba(245,184,0,.4)", color: "#F5B800" }}>
        {n}
      </span>
      <span className="flex-none">{icone}</span>
      <p className="text-[13.5px] font-semibold leading-[1.4]">{children}</p>
    </div>
  );
}
