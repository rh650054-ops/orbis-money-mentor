/* ============================================================
   CLIMA DO VENDEDOR — tela cheia (Rick, 11/09/2026).
   A cena com o Orbis + a opinião do dia (IA com meta, contas e melhor hora)
   + janelas de sair/descansar/voltar + chance de chuva por hora (6 modelos).
   O clima vem sozinho do GPS; o vendedor não escolhe nada.
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Pause, Home, AlertTriangle, RefreshCw, Loader2, MapPinOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { formatCurrency } from "@/shared/lib/utils";
import { useClima, type ContextoClima } from "@/hooks/useClima";
import { ClimaCena } from "@/components/clima/ClimaCena";

// Tabelas que os tipos gerados (velhos) não conhecem: consulta genérica, sem `any`.
interface Q { select: (s: string) => Q; eq: (k: string, v: unknown) => Q; not: (k: string, op: string, v: unknown) => Q; lte: (k: string, v: unknown) => Q; order: (k: string) => Q; limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null }>; maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> }
const db = supabase as unknown as { from: (t: string) => Q };

const FONTES = ["ECMWF · Europa", "GFS · EUA", "ICON · Alemanha", "Météo-France", "GEM · Canadá", "JMA · Japão"];

export default function Clima() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contexto, setContexto] = useState<ContextoClima | null>(null);
  const [toques, setToques] = useState(0);

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
      const dias = (iso: string) => Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(`${hoje}T12:00:00`).getTime()) / 86400000);
      setContexto({
        meta, vendidoHoje,
        melhorHora: fichaMelhor != null ? Number(fichaMelhor) : null,
        contas: contasRows.map((b) => ({ nome: String(b.name), dias: dias(String(b.due_date)), valor: Number(b.amount) || 0 })),
      });
    })().catch(() => { if (vivo) setContexto({}); });
    return () => { vivo = false; };
  }, [user]);

  const { tempo, opiniao, fonteOpiniao, carregando, erro, recarregar } = useClima({ contexto: contexto ?? undefined, auto: contexto !== null });

  const fala = opiniao ? opiniao.falas[toques % opiniao.falas.length] ?? opiniao.falas[0] : null;
  const cor = useMemo(() => {
    const n = opiniao?.veredito.nota ?? 7;
    return n >= 8 ? "#3DD68C" : n >= 5 ? "#F5B800" : "#FF5C5C";
  }, [opiniao]);
  const linha = tempo ? `máx ${tempo.max != null ? Math.round(tempo.max) : "–"}° · mín ${tempo.min != null ? Math.round(tempo.min) : "–"}° · sensação ${Math.round(tempo.sensacao)}°${tempo.vento >= 20 ? ` · vento ${Math.round(tempo.vento)} km/h` : ""}` : "";
  const proximas = (tempo?.horas ?? []).slice(0, 10);
  const contexTxt = contexto ? [
    contexto.meta ? `meta de hoje ${formatCurrency(contexto.meta)}` : null,
    contexto.contas && contexto.contas[0] ? `${contexto.contas[0].nome} vence ${contexto.contas[0].dias <= 0 ? "hoje" : `em ${contexto.contas[0].dias} dias`}` : null,
    contexto.melhorHora != null ? `sua melhor hora é ${contexto.melhorHora}h` : null,
  ].filter(Boolean).join(" · ") : "";

  if (!user) return null;

  return (
    <div className="orbis-stagger bg-background pb-10 max-w-2xl mx-auto">
      {/* cabeçalho */}
      <div className="flex items-center gap-3 px-3 pt-3 pb-3">
        <button type="button" onClick={() => navigate(-1)} aria-label="Voltar" className="orbis-press w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0" style={{ background: "#131211", border: "1px solid rgba(255,255,255,.1)" }}>
          <ArrowLeft className="w-[18px] h-[18px]" style={{ color: "#b9b3a6" }} strokeWidth={2.4} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[20px] font-black tracking-tight leading-none">Clima do vendedor</p>
          <p className="text-[12px] mt-1" style={{ color: "#7e7869" }}>{tempo ? `${tempo.fontesTotal} modelos de previsão · atualiza a cada 3 h` : "lendo o céu…"}</p>
        </div>
        <button type="button" onClick={() => recarregar()} disabled={carregando} aria-label="Atualizar" className="orbis-press w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0 disabled:opacity-50" style={{ background: "#131211", border: "1px solid rgba(255,255,255,.1)" }}>
          {carregando ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#F5B800" }} /> : <RefreshCw className="w-4 h-4" style={{ color: "#b9b3a6" }} strokeWidth={2.2} />}
        </button>
      </div>

      {/* sem posição / erro */}
      {!tempo && erro === "sem_posicao" && (
        <div className="mx-4 rounded-2xl border p-5 flex flex-col items-center text-center gap-3" style={{ background: "#131211", borderColor: "rgba(255,255,255,.08)" }}>
          <MapPinOff className="w-8 h-8" style={{ color: "#7e7869" }} />
          <p className="text-[15px] font-bold">Preciso saber onde você está</p>
          <p className="text-[13px]" style={{ color: "#b9b3a6" }}>O clima vem do lugar onde você tá. Libera a localização pro Orbis (a mesma do Caça-Sinal) e tenta de novo.</p>
          <button type="button" onClick={() => recarregar()} className="orbis-cta w-full" style={{ height: 48 }}>TENTAR DE NOVO</button>
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
              cidade={tempo.cidade ? `${tempo.cidade}${tempo.uf ? `, ${tempo.uf}` : ""}` : ""}
              fontes={tempo.fontesTotal} concordancia={tempo.concordancia}
              toques={toques} onToque={() => setToques((t) => t + 1)}
            />
          </div>

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

          {/* janelas */}
          {opiniao && (
            <div className="px-4 mt-3.5 flex flex-col gap-2.5">
              <p className="orbis-section px-1">Seu dia, hora a hora</p>
              <section className="rounded-[18px] border px-4 py-1" style={{ background: "#131211", borderColor: "rgba(255,255,255,.07)" }}>
                <Janela icone={<ArrowRight className="w-[18px] h-[18px]" style={{ color: "#3DD68C" }} strokeWidth={2.4} />} fundo="rgba(61,214,140,.14)" titulo="Sair pra vender" txt={opiniao.sair.txt} hora={opiniao.sair.hora} cor="#3DD68C" />
                <Janela icone={<Pause className="w-[18px] h-[18px]" style={{ color: "#F5B800" }} strokeWidth={2.4} />} fundo="rgba(245,184,0,.14)" titulo="Descansar" txt={opiniao.pausa.txt} hora={opiniao.pausa.hora} cor="#F5B800" borda />
                <Janela icone={<Home className="w-[18px] h-[18px]" style={{ color: "#b9b3a6" }} strokeWidth={2.4} />} fundo="rgba(255,255,255,.08)" titulo="Voltar pra casa" txt={opiniao.volta.txt} hora={opiniao.volta.hora} cor="#ffffff" borda />
              </section>
              {contexTxt && <p className="px-1 text-[12px] leading-[1.45]" style={{ color: "#7e7869" }}>Levei em conta: {contexTxt}.{fonteOpiniao === "local" ? " (IA descansando — opinião pela regra da casa.)" : ""}</p>}
            </div>
          )}

          {/* alerta */}
          {tempo.alerta && (
            <div className="px-4 mt-3.5">
              <section className="rounded-[18px] border px-4 py-3.5 flex items-start gap-3" style={{ borderColor: "rgba(255,92,92,.55)", background: "linear-gradient(180deg,#24090c,#131211)" }}>
                <span className="w-9 h-9 rounded-[11px] inline-flex items-center justify-center shrink-0" style={{ background: "rgba(255,92,92,.16)" }}><AlertTriangle className="w-5 h-5" style={{ color: "#FF5C5C" }} strokeWidth={2.2} /></span>
                <span className="flex flex-col gap-1 min-w-0">
                  <span className="text-[14.5px] font-extrabold leading-[1.3]">{tempo.alerta.titulo}</span>
                  <span className="text-[12.5px] leading-[1.45]" style={{ color: "#b9b3a6" }}>{tempo.alerta.texto}</span>
                </span>
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

          {/* fontes */}
          <div className="px-4 mt-3.5">
            <section className="rounded-[18px] border px-4 py-3.5 flex flex-col gap-2.5" style={{ background: "#131211", borderColor: "rgba(255,255,255,.07)" }}>
              <div className="flex items-center justify-between gap-2"><span className="orbis-section">De onde o Orbis tirou isso</span><span className="orbis-num text-[12.5px] font-extrabold" style={{ color: "#3DD68C" }}>{tempo.concordancia}% de concordância</span></div>
              <div className="flex flex-wrap gap-1.5">
                {(tempo.fontesOk.length ? tempo.fontesOk : FONTES).map((f) => <span key={f} className="h-7 px-2.5 rounded-full text-[11.5px] font-bold inline-flex items-center" style={{ border: "1px solid rgba(255,255,255,.12)", color: "#b9b3a6" }}>{f}</span>)}
              </div>
              <p className="text-[12px] leading-[1.45]" style={{ color: "#7e7869" }}>Previsão pública (Open-Meteo). Sua posição vai arredondada pra uns 5 km — ninguém precisa da esquina exata pra saber se chove.</p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Janela({ icone, fundo, titulo, txt, hora, cor, borda }: { icone: React.ReactNode; fundo: string; titulo: string; txt: string; hora: string; cor: string; borda?: boolean }) {
  return (
    <div className="flex items-center gap-3 min-h-[60px] py-2.5" style={borda ? { borderTop: "1px solid rgba(255,255,255,.07)" } : undefined}>
      <span className="w-9 h-9 rounded-[11px] inline-flex items-center justify-center shrink-0" style={{ background: fundo }}>{icone}</span>
      <span className="flex-1 min-w-0 flex flex-col gap-0.5"><span className="text-[14.5px] font-extrabold">{titulo}</span><span className="text-[12px] leading-[1.35]" style={{ color: "#b9b3a6" }}>{txt}</span></span>
      <span className="orbis-num text-[14px] font-extrabold whitespace-nowrap" style={{ color: cor }}>{hora}</span>
    </div>
  );
}
