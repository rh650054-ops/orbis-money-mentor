/* /simular-teste — só admin. Escolhe o dia do teste e o app inteiro passa a mostrar
   o que um vendedor em teste vê naquele dia. Nada vai pro banco. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { JORNADA, seloTeste } from "@/components/jornada/jornada-lib";
import { OfertaDoDia } from "@/components/jornada/OfertaDoDia";
import { useJornada } from "@/components/jornada/useJornada";
import { simular, zerarSimulacao, useSimulacao, type DiaSimulado } from "@/components/jornada/simulador";

const GOLD = "#F5B800";
const MUTE = "#7b766e";
const OFERTA: Record<string, string> = {
  nenhuma: "Nenhuma oferta (dia sem preço)",
  essencial: "VANT Essencial R$ 29,90 · botão principal = continuar o teste",
  pro: "Prévia do VANT Pro · banco trancado",
  planos: "Último dia: \"Você vendeu R$ X\" → escolher o plano",
};
const DIAS: { dia: DiaSimulado; rotulo: string }[] = [
  { dia: 0, rotulo: "Dia 0" }, { dia: 1, rotulo: "Dia 1" }, { dia: 2, rotulo: "Dia 2" },
  { dia: 3, rotulo: "Dia 3" }, { dia: 4, rotulo: "Acabou" },
];

export default function SimularTeste() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { whitelisted, loading } = useAdminAccess(user?.id);
  const sim = useSimulacao(user?.id);
  const { feitos } = useJornada();
  const [oferta, setOferta] = useState(0);

  if (loading) return null;
  if (!user || !whitelisted) {
    return <div className="min-h-screen p-6 text-center text-sm" style={{ background: "#000", color: MUTE }}>Só a equipe da VANT abre o simulador.</div>;
  }
  const j = sim != null && sim <= 3 ? JORNADA[sim] : null;
  const btn = "h-11 rounded-[12px] text-[13px] font-black w-full";

  return (
    <div className="min-h-screen px-4 pt-4 pb-24 max-w-xl mx-auto text-[#F4F1EA] space-y-4" style={{ background: "#000" }}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate("/")} aria-label="Voltar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ color: "#b9b3a6" }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <p className="text-[20px] font-black">Simulador do teste</p>
      </div>
      <p className="text-[12.5px] leading-snug" style={{ color: "#b9b3a6" }}>
        Escolha o dia. O app inteiro passa a mostrar o que um vendedor em teste vê nesse dia: missão no Início e no Foco,
        selo do topo, oferta no fim do Foco, planos e o bloqueio. Só muda o que <b>você</b> vê neste aparelho; nada é gravado na conta.
      </p>

      <div className="grid grid-cols-5 gap-1.5">
        {DIAS.map((d) => (
          <button key={d.dia} type="button" onClick={() => simular(user.id, d.dia)}
            className="h-11 rounded-[12px] text-[12px] font-black"
            style={sim === d.dia ? { background: GOLD, color: "#1A1200" } : { background: "#121211", border: "1px solid #26241f", color: "#b9b3a6" }}>
            {d.rotulo}
          </button>
        ))}
      </div>

      {sim == null && <p className="text-[12px] text-center" style={{ color: MUTE }}>Simulação desligada: o app está normal.</p>}

      {j && (
        <section className="rounded-[18px] p-4 space-y-3" style={{ background: "#0f0f10", border: "1px solid #26241f" }}>
          <div className="flex justify-between items-center">
            <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: GOLD }}>DIA {j.dia}</span>
            <span className="text-[11px] font-extrabold" style={{ color: MUTE }}>Selo: {seloTeste(j.dia)}</span>
          </div>
          <p className="text-[16px] font-black">{j.titulo}</p>
          <ul className="space-y-1.5">
            {j.passos.map((p) => (
              <li key={p.id} className="text-[13px] font-bold flex gap-2" style={{ color: feitos.has(p.id) ? "#3DD68C" : "#F4F1EA" }}>
                <span>{feitos.has(p.id) ? "✓" : "○"}</span>{p.nome}
              </li>
            ))}
          </ul>
          <p className="text-[12px]" style={{ color: "#b9b3a6" }}><b>Fim do Foco:</b> {OFERTA[j.oferta]}</p>
          {j.oferta !== "nenhuma" && (
            <button type="button" onClick={() => setOferta((n) => n + 1)} className={btn}
              style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200" }}>
              Ver a oferta do fim do Foco agora
            </button>
          )}
        </section>
      )}

      {sim === 4 && (
        <p className="text-[12.5px] rounded-[14px] p-3" style={{ background: "#160b09", border: "1px solid rgba(255,122,107,.4)", color: "#ffb4a8" }}>
          Teste acabado: abra o Início ou o Foco pra ver o bloqueio com os 3 planos. No bloqueio tem o botão "Sair da simulação".
        </p>
      )}

      {sim != null && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => navigate("/")} className={btn} style={{ background: "#121211", border: "1px solid #26241f" }}>Abrir o Início</button>
          <button type="button" onClick={() => navigate("/daily-goals")} className={btn} style={{ background: "#121211", border: "1px solid #26241f" }}>Abrir o Foco</button>
          <button type="button" onClick={() => navigate("/planos")} className={btn} style={{ background: "#121211", border: "1px solid #26241f" }}>Abrir os planos</button>
          <button type="button" onClick={() => zerarSimulacao(user.id)} className={btn} style={{ background: "#121211", border: "1px solid #26241f" }}>Zerar missões</button>
          <button type="button" onClick={() => simular(user.id, null)} className={`${btn} col-span-2`} style={{ border: "1px solid rgba(255,122,107,.45)", color: "#ff9a8a" }}>Desligar a simulação</button>
        </div>
      )}

      {oferta > 0 && <OfertaDoDia key={oferta} agora />}
    </div>
  );
}
