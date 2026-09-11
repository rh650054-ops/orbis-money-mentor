/* ============================================================
   CLIMA DO VENDEDOR — tela cheia (Rick, 11/09/2026).
   A cena com o Orbis + a opinião do dia (IA com meta, contas e melhor hora)
   + janelas de sair/descansar/voltar + chance de chuva por hora (6 modelos).
   O clima vem sozinho do GPS; o vendedor não escolhe nada.
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Pause, Home, AlertTriangle, Loader2, MapPin, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { formatCurrency } from "@/shared/lib/utils";
import { useClima, type ContextoClima } from "@/hooks/useClima";
import { ClimaCena } from "@/components/clima/ClimaCena";
import { TourClima, tourClimaVisto } from "@/components/clima/TourClima";
import { melhoresPicos, horasFortes, rotuloPico, cidadeCurta, type PerfilHora, type Pico } from "@/components/clima/picos";

// Tabelas que os tipos gerados (velhos) não conhecem: consulta genérica, sem `any`.
interface Q { select: (s: string) => Q; eq: (k: string, v: unknown) => Q; not: (k: string, op: string, v: unknown) => Q; lte: (k: string, v: unknown) => Q; gte: (k: string, v: unknown) => Q; order: (k: string) => Q; limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null }>; maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> }
const db = supabase as unknown as { from: (t: string) => Q };
const rpc = supabase as unknown as { rpc: (nome: string, args?: Record<string, unknown>) => Promise<{ data: unknown }> };

/* O que o Orbis já aprendeu do clima DESTE vendedor (vem da função clima_meu_aprendizado). */
interface Aprendizado {
  dias: number;
  melhor: { estado: string; media: number; dias: number } | null;
  queda_chuva_pct: number | null;
  por_estado: { estado: string; dias: number; media: number }[];
}
const NOME_ESTADO: Record<string, string> = { sol: "dia limpo", calor: "calor", nublado: "nublado", chuva: "chuva", tempestade: "tempestade", frio: "frio", noite: "noite" };


export default function Clima() {
  const { user } = useAuth();
  const [contexto, setContexto] = useState<ContextoClima | null>(null);
  const [toques, setToques] = useState(0);
  // primeiro acesso à tela: mostra os 7 climas antes (uma vez por pessoa).
  // null = ainda não sei quem é a pessoa (o login pode chegar depois do 1º render)
  const [tour, setTour] = useState<boolean | null>(null);
  const [perfilHoras, setPerfilHoras] = useState<PerfilHora[]>([]);
  const [aprendizado, setAprendizado] = useState<Aprendizado | null>(null);

  // contexto do vendedor: meta de hoje, vendido, contas vencendo, melhor hora
  useEffect(() => {
    if (!user) return;
    let vivo = true;
    (async () => {
      const hoje = getBrazilDate();
      const em7 = new Date(`${hoje}T12:00:00`); em7.setDate(em7.getDate() + 7);
      const ate = `${em7.getFullYear()}-${String(em7.getMonth() + 1).padStart(2, "0")}-${String(em7.getDate()).padStart(2, "0")}`;
      const [plano, perfil, vendas, contas, ficha] = await Promise.all([
        supabase.from("daily_goal_plans").select("daily_goal").eq("user_id", user.id).eq("date", hoje).maybeSingle(),
        supabase.from("profiles").select("monthly_goal").eq("user_id", user.id).maybeSingle(),
        supabase.from("daily_sales").select("total_profit").eq("user_id", user.id).eq("date", hoje),
        db.from("planned_bills").select("name, amount, due_date").eq("user_id", user.id).eq("paid", false).not("due_date", "is", null).lte("due_date", ate).order("due_date").limit(4),
        db.from("orbis_ficha").select("melhor_hora").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!vivo) return;
      const metaPlano = Number(plano.data?.daily_goal ?? 0);
      const mensal = Number(perfil.data?.monthly_goal ?? 0);
      const meta = metaPlano > 0 ? metaPlano : mensal > 0 ? Math.round(mensal / 26) : 0;
      const vendidoHoje = (vendas.data ?? []).reduce((s, r) => s + (Number((r as { total_profit?: number }).total_profit) || 0), 0);
      const fichaMelhor = (ficha.data as { melhor_hora?: number | null } | null)?.melhor_hora;
      const contasRows = (contas.data ?? []) as { name: string; amount: number; due_date: string }[];
      // horas em que ELE mais vende: vem dos blocos do DEFCON dos últimos 90 dias
      const desde = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data: blocos } = await db
        .from("challenge_blocks").select("started_at, sales_count")
        .eq("user_id", user.id).gte("started_at", desde).limit(1000);
      let horasDele: PerfilHora[] = [];
      if (vivo && blocos) {
        const mapa = new Map<number, { vendas: number; blocos: number }>();
        for (const b of blocos as unknown as { started_at: string | null; sales_count: number | null }[]) {
          if (!b.started_at) continue;
          const h = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date(b.started_at)));
          const at = mapa.get(h) ?? { vendas: 0, blocos: 0 };
          at.vendas += Number(b.sales_count) || 0; at.blocos += 1;
          mapa.set(h, at);
        }
        horasDele = [...mapa.entries()].map(([hora, v]) => ({ hora, ...v }));
        setPerfilHoras(horasDele);
      }
      // o que o cérebro já aprendeu do clima dele (vira contexto da IA)
      const { data: aprRaw } = await rpc.rpc("clima_meu_aprendizado");
      const apr = (aprRaw ?? null) as Aprendizado | null;
      if (vivo) setAprendizado(apr);
      const dias = (iso: string) => Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(`${hoje}T12:00:00`).getTime()) / 86400000);
      setContexto({
        meta, vendidoHoje,
        melhorHora: fichaMelhor != null ? Number(fichaMelhor) : null,
        melhoresHoras: horasFortes(horasDele).topo,
        quedaChuvaPct: apr?.queda_chuva_pct ?? null,
        contas: contasRows.map((b) => ({ nome: String(b.name), dias: dias(String(b.due_date)), valor: Number(b.amount) || 0 })),
      });
    })().catch(() => { if (vivo) setContexto({}); });
    return () => { vivo = false; };
  }, [user]);

  useEffect(() => { if (user && tour === null) setTour(!tourClimaVisto(user.id)); }, [user, tour]);

  const { tempo, opiniao, fonteOpiniao, carregando, erro, permissao, recarregar, pedirPermissao } = useClima({ contexto: contexto ?? undefined, auto: contexto !== null });

  const fala = opiniao ? opiniao.falas[toques % opiniao.falas.length] ?? opiniao.falas[0] : null;
  const cor = useMemo(() => {
    const n = opiniao?.veredito.nota ?? 7;
    return n >= 8 ? "#3DD68C" : n >= 5 ? "#F5B800" : "#FF5C5C";
  }, [opiniao]);
  const linha = tempo ? `máx ${tempo.max != null ? Math.round(tempo.max) : "–"}° · mín ${tempo.min != null ? Math.round(tempo.min) : "–"}° · sensação ${Math.round(tempo.sensacao)}°${tempo.vento >= 20 ? ` · vento ${Math.round(tempo.vento)} km/h` : ""}` : "";
  const proximas = (tempo?.horas ?? []).slice(0, 10);
  // PICOS: as horas que ele não pode perder hoje (clima + histórico dele)
  const picos = useMemo<Pico[]>(() => (tempo ? melhoresPicos(tempo.horas.slice(0, 16), perfilHoras) : []), [tempo, perfilHoras]);
  const contexTxt = contexto ? [
    contexto.meta ? `meta de hoje ${formatCurrency(contexto.meta)}` : null,
    contexto.contas && contexto.contas[0] ? `${contexto.contas[0].nome} vence ${contexto.contas[0].dias <= 0 ? "hoje" : `em ${contexto.contas[0].dias} dias`}` : null,
    contexto.melhorHora != null ? `sua melhor hora é ${contexto.melhorHora}h` : null,
  ].filter(Boolean).join(" · ") : "";

  if (!user) return null;
  if (tour) return <TourClima userId={user.id} onFim={() => setTour(false)} />;

  return (
    <div className="orbis-stagger bg-background pb-10 max-w-2xl mx-auto">
      {/* O cabeçalho saiu (Rick, 11/09): a cena já diz que tela é essa. O
          "Voltar" volta a ser o da barra do app e o atualizar foi pra dentro
          da cena, do lado do "6 fontes". Menos moldura, mais foto. */}
      {/* PERMISSÃO — o nosso convite, no lugar do pop-up cinza do celular.
          O sistema só pergunta quando ele toca no botão dourado. (Rick, 11/09) */}
      {!tempo && (permissao === "perguntar" || permissao === "negada" || erro === "sem_posicao") && (
        <div className="px-4">
          <section className="relative overflow-hidden rounded-[22px] border p-5 flex flex-col gap-2.5"
            style={{ borderColor: "rgba(245,184,0,.4)", background: "linear-gradient(160deg,#1c1608 0%,#131211 60%)" }}>
            <img src="/orbis/clima/calor-boneco-p.webp" alt="" draggable={false} className="absolute pointer-events-none"
              style={{ right: -26, top: -10, width: 132, maxWidth: "none", opacity: .9, filter: "drop-shadow(0 10px 20px rgba(0,0,0,.6))" }} />
            <span className="relative inline-flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[.16em] uppercase" style={{ color: "#F5B800" }}>
              <MapPin className="w-3.5 h-3.5" strokeWidth={2.6} /> Onde você vende
            </span>
            <p className="relative text-[19px] font-black leading-[1.15] pr-[110px]">Me diz onde você tá que eu leio o céu por você.</p>
            <p className="relative text-[13px] leading-[1.5] pr-[100px]" style={{ color: "#b9b3a6" }}>
              {permissao === "negada"
                ? "A localização tá bloqueada pro Orbis. Abre o cadeado na barra de endereço (ou os ajustes do app) e libera — aí eu te mostro as melhores horas de hoje."
                : "Com a sua localização eu vejo a chuva hora a hora e te digo os picos do dia — as horas em que vale sair e as que não valem. Não guardo sua rua: arredondo pra uns 5 km."}
            </p>
            {permissao !== "negada" && (
              <button type="button" onClick={() => void pedirPermissao()} disabled={carregando}
                className="orbis-cta relative w-full mt-1 flex items-center justify-center gap-2 disabled:opacity-60" style={{ height: 50, fontSize: 14 }}>
                {carregando ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <MapPin className="w-[18px] h-[18px]" strokeWidth={2.6} />}
                {carregando ? "PROCURANDO VOCÊ…" : "LIBERAR LOCALIZAÇÃO"}
              </button>
            )}
          </section>
        </div>
      )}

      {!tempo && erro === "falhou" && (
        <div className="mx-4 rounded-2xl border p-5 text-center" style={{ background: "#131211", borderColor: "rgba(255,255,255,.08)" }}>
          <p className="text-[15px] font-bold">Não consegui ler o céu agora</p>
          <p className="text-[13px] mt-1" style={{ color: "#b9b3a6" }}>Tenta de novo em 1 minuto.</p>
        </div>
      )}
      {!tempo && !erro && (
        <div className="cl-cena-vazia mx-3 rounded-[26px] animate-pulse" style={{ background: "#131211" }} />
      )}

      {tempo && (
        <>
          <div className="px-3">
            <ClimaCena
              estado={tempo.estado} temp={tempo.temp} condicao={tempo.condicao} linha={linha}
              cidade={tempo.cidade ? cidadeCurta(tempo.cidade, tempo.uf) : ""}
              fontes={tempo.fontesTotal} concordancia={tempo.concordancia}
              toques={toques} onToque={() => setToques((t) => t + 1)}
              carregando={carregando} onAtualizar={() => recarregar()}
            />
          </div>

          {/* ALERTA PRIMEIRO (Rick + Mohamed, 11/09): risco de vida vem antes de
              qualquer conselho de venda. Vermelho forte, ícone grande, no topo. */}
          {tempo.alerta && (
            <div className="px-4 mt-3.5">
              <section className="cl-alerta rounded-[20px] px-4 py-4 flex items-start gap-3" style={{ border: "2px solid #FF5C5C", background: "linear-gradient(160deg,#3a0c10,#1a0708)" }}>
                <span className="w-11 h-11 rounded-[14px] inline-flex items-center justify-center shrink-0" style={{ background: "rgba(255,92,92,.2)" }}>
                  <AlertTriangle className="w-6 h-6" style={{ color: "#FF5C5C" }} strokeWidth={2.6} />
                </span>
                <span className="flex flex-col gap-1 min-w-0">
                  <span className="text-[10.5px] font-black tracking-[.18em] uppercase" style={{ color: "#FF8A8A" }}>Alerta agora</span>
                  <span className="text-[17px] font-black leading-tight">{tempo.alerta.titulo}</span>
                  <span className="text-[13px] leading-[1.45]" style={{ color: "#e8b9b9" }}>{tempo.alerta.texto}</span>
                </span>
              </section>
            </div>
          )}

          {/* balão: o Orbis fala */}
          <div className="px-4 -mt-[30px] relative">
            <div key={toques} className="cl-balao rounded-[20px] px-4 py-3.5 flex flex-col gap-2" style={{ background: "#ffffff", color: "#0d0c0b", boxShadow: "0 20px 40px -20px rgba(0,0,0,.8)" }}>
              <span className="flex items-center gap-2">
                <span className="w-[22px] h-[22px] rounded-full inline-flex items-center justify-center shrink-0" style={{ background: "#0d0c0b" }}><span className="w-3 h-3 rounded-full box-border" style={{ border: "2px solid #fff" }} /></span>
                <span className="text-[10.5px] font-extrabold tracking-[.14em] uppercase" style={{ color: "#7e7869" }}>Opinião do Orbis</span>
                <span className="ml-auto text-[10.5px] font-bold" style={{ color: "#9a9489" }}>{opiniao ? `${(toques % opiniao.falas.length) + 1}/${opiniao.falas.length} · toca na cena` : "pensando…"}</span>
              </span>
              <span className="text-[15px] font-extrabold leading-[1.35]">{fala ?? (carregando ? "Lendo os 6 modelos e as suas contas…" : "Toca em atualizar pra eu dar minha opinião.")}</span>
              <span className="text-[12px] font-semibold" style={{ color: "#6f6a60" }}>Antes de tudo: não sou Deus, né kkk — clima muda. Mas juntei {tempo.fontesTotal} modelos e é nisso que aposto.</span>
            </div>
          </div>

          {/* veredito */}
          {opiniao && (
            <div className="px-4 mt-3.5">
              <section className="rounded-[20px] p-4 flex items-center gap-3.5 border" style={{ borderColor: `${cor}66`, background: `linear-gradient(160deg, ${cor}14, #131211)` }}>
                <span className="flex flex-col gap-1 min-w-0 flex-1">
                  <span className="text-[10.5px] font-extrabold tracking-[.16em] uppercase" style={{ color: cor }}>Veredito do dia</span>
                  <span className="text-[22px] font-extrabold leading-[1.1] tracking-tight">{opiniao.veredito.titulo}</span>
                  <span className="text-[12.5px] leading-[1.4]" style={{ color: "#b9b3a6" }}>{opiniao.veredito.sub}</span>
                </span>
                <span className="orbis-num text-[34px] font-extrabold leading-none shrink-0" style={{ color: cor }}>{opiniao.veredito.nota}</span>
              </section>
            </div>
          )}

          {/* PICOS DO DIA — as horas que ele não pode perder (Rick, 11/09).
              Clima dos 6 modelos + sol/temperatura + movimento de rua + as horas
              em que ELE mais vende. Conta pura, sem IA: aparece mesmo offline. */}
          {picos.length > 0 && (
            <div className="px-4 mt-4 flex flex-col gap-2">
              <div className="flex items-baseline justify-between px-1">
                <p className="orbis-section">Picos de hoje</p>
                <p className="text-[11.5px]" style={{ color: "#7e7869" }}>não perde essas horas</p>
              </div>
              <div className="flex flex-col gap-2">
                {picos.map((p, i) => {
                  const c = i === 0 ? "#3DD68C" : "#F5B800";
                  return (
                    <section key={`${p.de}-${p.ate}`} className="rounded-[16px] px-3.5 py-3 flex items-center gap-3"
                      style={{ border: `1px solid ${c}55`, background: `linear-gradient(100deg, ${c}18, #131211 70%)` }}>
                      <span className="orbis-num text-[17px] font-black shrink-0" style={{ color: c, minWidth: 74 }}>{rotuloPico(p)}</span>
                      <span className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                        {p.etiquetas.map((e) => (
                          <span key={e} className="h-[22px] px-2 rounded-full text-[10.5px] font-extrabold inline-flex items-center"
                            style={e === "seu pico"
                              ? { background: `${c}26`, color: c }
                              : { border: "1px solid rgba(255,255,255,.14)", color: "#b9b3a6" }}>
                            {e === "seu pico" ? "⚡ seu pico" : e}
                          </span>
                        ))}
                      </span>
                      {i === 0 && <Zap className="w-[18px] h-[18px] shrink-0" style={{ color: c }} strokeWidth={2.6} />}
                    </section>
                  );
                })}
              </div>
              {perfilHoras.length === 0 && (
                <p className="px-1 text-[11.5px] leading-[1.4]" style={{ color: "#7e7869" }}>
                  Ainda tô aprendendo suas horas. Quanto mais você usa o Foco, mais afiado fica esse pico.
                </p>
              )}
            </div>
          )}
          {picos.length === 0 && tempo.horas.length > 0 && (
            <div className="px-4 mt-4">
              <section className="rounded-[16px] px-4 py-3.5" style={{ border: "1px solid rgba(255,255,255,.08)", background: "#131211" }}>
                <p className="text-[13.5px] font-bold">Hoje não tem janela boa.</p>
                <p className="text-[12.5px] mt-1 leading-[1.45]" style={{ color: "#b9b3a6" }}>
                  {tempo.estado === "tempestade" ? "Tempestade fecha o dia. Amanhã a gente recupera." : tempo.estado === "chuva" ? "Chuva na maior parte das horas — o que der, dá de manhã." : "Nem toda hora do dia serve. Confere a chance de chuva aqui embaixo."}
                </p>
              </section>
            </div>
          )}

          {/* janelas — mais enxutas (Mohamed: "as notificações estão muito grossas") */}
          {opiniao && (
            <div className="px-4 mt-4 flex flex-col gap-2">
              <p className="orbis-section px-1">Seu dia, hora a hora</p>
              <section className="rounded-[16px] border px-3.5 py-0.5" style={{ background: "#131211", borderColor: "rgba(255,255,255,.07)" }}>
                <Janela icone={<ArrowRight className="w-4 h-4" style={{ color: "#3DD68C" }} strokeWidth={2.6} />} fundo="rgba(61,214,140,.14)" titulo="Sair pra vender" txt={opiniao.sair.txt} hora={opiniao.sair.hora} cor="#3DD68C" />
                <Janela icone={<Pause className="w-4 h-4" style={{ color: "#F5B800" }} strokeWidth={2.6} />} fundo="rgba(245,184,0,.14)" titulo="Descansar" txt={opiniao.pausa.txt} hora={opiniao.pausa.hora} cor="#F5B800" borda />
                <Janela icone={<Home className="w-4 h-4" style={{ color: "#b9b3a6" }} strokeWidth={2.6} />} fundo="rgba(255,255,255,.08)" titulo="Voltar pra casa" txt={opiniao.volta.txt} hora={opiniao.volta.hora} cor="#ffffff" borda />
              </section>
              {contexTxt && <p className="px-1 text-[11.5px] leading-[1.45]" style={{ color: "#7e7869" }}>Levei em conta: {contexTxt}.{fonteOpiniao === "local" ? " (IA descansando — opinião pela regra da casa.)" : ""}</p>}
            </div>
          )}

          {/* O QUE O ORBIS APRENDEU DE VOCÊ (Rick, 11/09) — sai do cruzamento
              entre o tempo de cada dia e o que ele vendeu naquele dia. */}
          {aprendizado && aprendizado.dias > 0 && (
            <div className="px-4 mt-4">
              <section className="rounded-[18px] border px-4 py-3.5 flex flex-col gap-2" style={{ background: "#131211", borderColor: "rgba(255,255,255,.08)" }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="orbis-section">O que eu aprendi de você</span>
                  <span className="text-[11px]" style={{ color: "#7e7869" }}>{aprendizado.dias} {aprendizado.dias === 1 ? "dia" : "dias"} cruzados</span>
                </div>
                {aprendizado.melhor || aprendizado.queda_chuva_pct != null ? (
                  <div className="flex flex-col gap-2">
                    {aprendizado.melhor && (
                      <p className="text-[13.5px] leading-[1.45]">
                        Seu melhor tempo é <b style={{ color: "#3DD68C" }}>{NOME_ESTADO[aprendizado.melhor.estado] ?? aprendizado.melhor.estado}</b>
                        <span style={{ color: "#b9b3a6" }}> — média de {formatCurrency(aprendizado.melhor.media)} em {aprendizado.melhor.dias} dias.</span>
                      </p>
                    )}
                    {aprendizado.queda_chuva_pct != null && (
                      <p className="text-[13.5px] leading-[1.45]">
                        {aprendizado.queda_chuva_pct > 0
                          ? <>Com chuva você vende <b style={{ color: "#FF5C5C" }}>{Math.abs(aprendizado.queda_chuva_pct)}% menos</b><span style={{ color: "#b9b3a6" }}> — por isso eu te empurro pra fora antes de ela chegar.</span></>
                          : <>Com chuva você vende <b style={{ color: "#3DD68C" }}>{Math.abs(aprendizado.queda_chuva_pct)}% mais</b><span style={{ color: "#b9b3a6" }}> — você é dos raros. Rua vazia de vendedor é rua sua.</span></>}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[12.5px] leading-[1.45]" style={{ color: "#b9b3a6" }}>
                    Tô anotando o tempo de cada dia junto com o que você vende. Em uns dias eu te digo em que tempo você rende mais — e quanto a chuva te custa.
                  </p>
                )}
              </section>
            </div>
          )}

          {/* chance de chuva por hora */}
          {proximas.length > 0 && (
            <div className="px-4 mt-3.5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between px-1">
                <p className="orbis-section">Chance de chuva</p>
                <span className="text-[11.5px]" style={{ color: "#7e7869" }}>quantos modelos apostam</span>
              </div>
              <section className="rounded-[18px] border px-4 pt-3 pb-1.5 flex flex-col" style={{ background: "#131211", borderColor: "rgba(255,255,255,.07)" }}>
                {proximas.map((h) => {
                  const n = h.total > 0 ? h.fontes : Math.round(((h.prob ?? 0) / 100) * 6);
                  const tot = h.total > 0 ? h.total : 6;
                  const w = Math.max(4, Math.round((n / tot) * 100));
                  const c = n / tot >= 0.66 ? "#5b8def" : n / tot >= 0.34 ? "#F5B800" : "#3DD68C";
                  return (
                    <div key={h.iso} className="grid items-center gap-2.5 h-[38px]" style={{ gridTemplateColumns: "40px minmax(0,1fr) 52px 40px" }}>
                      <span className="orbis-num text-[13px] font-extrabold" style={{ color: n / tot >= 0.66 ? "#b9b3a6" : c }}>{h.hora}h</span>
                      <span className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.07)" }}><span className="orbis-fill block h-full rounded-full" style={{ width: `${w}%`, background: c }} /></span>
                      <span className="orbis-num text-right text-[12.5px]" style={{ color: "#b9b3a6" }}>{n} de {tot}</span>
                      <span className="orbis-num text-right text-[13px] font-extrabold">{h.temp != null ? `${Math.round(h.temp)}°` : "–"}</span>
                    </div>
                  );
                })}
                <p className="text-[12px] leading-[1.45] mt-1.5 mb-2" style={{ color: "#7e7869" }}>Barra cheia = todos os modelos apostam em chuva naquela hora. Quanto mais concordam, mais dá pra confiar na hora.</p>
              </section>
            </div>
          )}

          {/* O card "De onde o Orbis tirou isso" (nomes dos modelos + provedor) saiu
              a pedido do Mohamed, 11/09. A prova de confiança continua na tela:
              "6 fontes · 72%" no alto da cena e o "x de 6 modelos" hora a hora.
              Fica só o aviso de privacidade, que é promessa nossa com o vendedor. */}
          <div className="px-5 mt-3">
            <p className="text-[11.5px] leading-[1.45]" style={{ color: "#57534A" }}>
              Sua posição vai arredondada pra uns 5 km — ninguém precisa da esquina exata pra saber se chove.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Janela({ icone, fundo, titulo, txt, hora, cor, borda }: { icone: React.ReactNode; fundo: string; titulo: string; txt: string; hora: string; cor: string; borda?: boolean }) {
  return (
    /* linha enxuta: título e hora na MESMA linha, explicação embaixo em cinza */
    <div className="flex items-start gap-2.5 py-2.5" style={borda ? { borderTop: "1px solid rgba(255,255,255,.07)" } : undefined}>
      <span className="w-7 h-7 rounded-[9px] inline-flex items-center justify-center shrink-0 mt-[1px]" style={{ background: fundo }}>{icone}</span>
      <span className="flex-1 min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="text-[13.5px] font-extrabold flex-1 min-w-0 truncate">{titulo}</span>
          <span className="orbis-num text-[13px] font-extrabold whitespace-nowrap" style={{ color: cor }}>{hora}</span>
        </span>
        <span className="block text-[11.5px] leading-[1.35] mt-[1px]" style={{ color: "#8f8a80" }}>{txt}</span>
      </span>
    </div>
  );
}
