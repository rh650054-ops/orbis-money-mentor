/* ============================================================
   CLIMA DO VENDEDOR — centro de decisão (redesenho 08/10/2026).
   situação atual → decisão → janelas → hora a hora → próximos dias →
   alertas → plano do dia → aprendizado → radar/detalhes.
   Toda recomendação sai de decisao.ts (um lugar só, sem contradição);
   a IA fica com a "Opinião da Vant". Clima vem sozinho do GPS.
   Alerta grave (oficial laranja/vermelho ou tempestade) sobe pra logo
   depois do clima agora: segurança antes da venda.
   ============================================================ */
import { useMemo } from "react";
import { Loader2, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useClima } from "@/hooks/useClima";
import { cidadeCurta } from "@/components/clima/picos";
import { decisaoAgora, janelasDeVenda, planoDoDia, riscoSevero } from "@/components/clima/decisao";
import { HeroClima } from "@/components/clima/tela/HeroClima";
import { OpiniaoVant } from "@/components/clima/tela/OpiniaoVant";
import { JanelasVenda } from "@/components/clima/tela/JanelasVenda";
import { HoraAHora } from "@/components/clima/tela/HoraAHora";
import { ProximosDias } from "@/components/clima/tela/ProximosDias";
import { AlertasSeguranca } from "@/components/clima/tela/AlertasSeguranca";
import { PlanoAcao } from "@/components/clima/tela/PlanoAcao";
import { Aprendizado } from "@/components/clima/tela/Aprendizado";
import { montarInsights } from "@/components/clima/tela/insights";
import { RadarCard } from "@/components/clima/tela/RadarCard";
import { VantPersonagem } from "@/components/clima/tela/VantPersonagem";
import { useContextoClima } from "@/components/clima/tela/use-contexto-clima";
import "@/styles/clima.css";

const ehNoturno = (h?: number | null) => h != null && (h >= 19 || h <= 4);

export default function Clima() {
  const { user } = useAuth();
  const { contexto, perfilHoras, aprendizado } = useContextoClima(user?.id);
  const { tempo, extras, responder, opiniao, carregando, erro, permissao, recarregar, pedirPermissao } =
    useClima({ contexto: contexto ?? undefined, auto: contexto !== null });

  const noturno = ehNoturno(contexto?.melhorHora);
  const janelas = useMemo(() => (tempo ? janelasDeVenda(tempo, perfilHoras) : []), [tempo, perfilHoras]);
  const decisao = useMemo(() => (tempo ? decisaoAgora(tempo, { noturno }) : null), [tempo, noturno]);
  const plano = useMemo(() => (tempo ? planoDoDia(tempo, janelas, { ...contexto, noturno }) : []), [tempo, janelas, contexto, noturno]);
  const insights = useMemo(() => montarInsights(aprendizado, tempo?.padrao, extras.modelos), [aprendizado, tempo, extras.modelos]);

  if (!user) return null;

  if (!tempo) {
    const semPosicao = permissao === "perguntar" || permissao === "negada" || erro === "sem_posicao";
    return (
      <div className="px-4 pt-2 pb-10 max-w-2xl mx-auto">
        {semPosicao ? (
          <section className="relative overflow-hidden rounded-[22px] border p-5 flex flex-col gap-2.5" style={{ borderColor: "rgba(245,184,0,.4)", background: "#0e0e10" }}>
            <VantPersonagem estado="sol" altura={120} className="absolute right-1 bottom-16 pointer-events-none opacity-90" />
            <span className="inline-flex items-center gap-1.5 text-[12px] font-black tracking-[.14em] uppercase" style={{ color: "#F5B800" }}><MapPin className="w-4 h-4" strokeWidth={2.4} /> Onde você vende</span>
            <p className="text-[20px] font-extrabold leading-tight pr-[96px]">Me diz onde você tá que eu leio o céu por você.</p>
            <p className="text-[14px] leading-snug pr-[96px]" style={{ color: "#b3ada3" }}>
              {permissao === "negada" ? "A localização está bloqueada pra VANT. Libera nos ajustes do navegador ou do app." : "Vejo a chuva hora a hora e te digo a melhor janela de venda. Não guardo sua rua: arredondo pra uns 5 km."}
            </p>
            {permissao !== "negada" && (
              <button type="button" onClick={() => void pedirPermissao()} disabled={carregando}
                className="mt-1 h-[52px] rounded-[14px] flex items-center justify-center gap-2 text-[15px] font-black transition-transform duration-100 active:scale-[0.97]" style={{ background: "#F5B800", color: "#141005" }}>
                {carregando ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" strokeWidth={2.4} />}
                {carregando ? "Procurando você…" : "Liberar localização"}
              </button>
            )}
          </section>
        ) : erro === "falhou" ? (
          <section className="rounded-[22px] border p-5 text-center" style={{ background: "#0e0e10", borderColor: "rgba(255,255,255,.08)" }}>
            <p className="text-[16px] font-bold">Não consegui ler o céu agora</p>
            <p className="text-[14px] mt-1" style={{ color: "#b3ada3" }}>Tenta de novo em 1 minuto.</p>
          </section>
        ) : (
          <div className="flex flex-col gap-4">{[260, 150, 180].map((h) => <div key={h} className="rounded-[22px] animate-pulse" style={{ height: h, background: "#131211" }} />)}</div>
        )}
      </div>
    );
  }

  const cidade = tempo.cidade ? cidadeCurta(tempo.cidade, tempo.uf) : "";
  const sev = riscoSevero(tempo);
  const grave = !!sev;
  const alertas = <AlertasSeguranca t={tempo} cidade={cidade} />;

  return (
    <div className="px-4 pt-2 pb-12 max-w-2xl mx-auto flex flex-col gap-6">
      <HeroClima t={tempo} cidade={cidade} decisao={decisao!} rede={extras.rede} atualizadoEm={extras.atualizadoEm} carregando={carregando} onAtualizar={() => void recarregar()} />
      {grave && alertas}
      <OpiniaoVant falas={opiniao?.falas ?? []} fontes={tempo.fontesTotal} pensando={carregando} />
      <JanelasVenda janelas={janelas} aprendendo={perfilHoras.length === 0} pausadoPor={sev?.titulo ?? null} />
      <HoraAHora horas={tempo.horas} />
      <ProximosDias dias={tempo.dias ?? []} />
      {!grave && alertas}
      <PlanoAcao passos={plano} />
      <Aprendizado insights={insights} onResponder={responder} />
      <RadarCard horas={tempo.horas} cell={extras.cell} modelos={extras.modelos} />
    </div>
  );
}
