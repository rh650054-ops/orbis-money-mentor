import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { FocoHero } from "./components/defcon/foco/foco-hero";
import { MesCard } from "./components/defcon/foco/mes-card";
import { ReplanejarMes } from "./components/metas/ReplanejarMes";
import { DefconStartScreen } from "./components/defcon/DefconStartScreen";
import { MetaAdaptativaCard } from "./components/defcon/foco/meta-adaptativa-card";
import type { MetaDoDia } from "./shared/lib/meta-viavel";
const meta: MetaDoDia = { hoje: "2026-10-18", diaSemana: 0, ritmo: 980, amostraDia: 4, precisaDia: 1295, diasRestantes: 12, vendidoMes: 14467, metaMensal: 30000, faltaMes: 15533, meta: 1270, minimo: 1020, turbo: 1520, status: "apertado", mesViavel: 26000, ticket: 25, curva: [], modo: "adaptativo", metaAdaptativa: 1270, diasVendidos: 20, missao: null,
  maximo: { diasExtra: ["saturday"], blocos: 8, metaDia: 1400, diasRestantes: 14, projecao: 30000, pct: 100, chega: true, vendasDia: 56, vendasHora: 7, vendasDiaRealista: 47 } };
const q = new URLSearchParams(location.search).get("v");
// 25/10: ?v=padrao (meta do planejamento) · ?v=adapt (3 faixas) · ?v=replan
const padrao: MetaDoDia = { ...meta, modo: "padrao", meta: 1360, precisaDia: 1360, metaAdaptativa: 1270, minimo: 1020, turbo: 1520 };
const m = q === "adapt" ? meta : padrao;
function Tela() {
  if (q === "start") return <DefconStartScreen dailyGoal={1270} totalBlocks={6} onStart={() => {}} onExit={() => {}} />;
  return (
    <div style={{ width: 390, padding: "12px 16px", background: "#000", color: "#f4f1ea" }}>
      <p className="orbis-mini">Foco · domingo, 18 de out</p>
      <h1 className="font-display text-[24px] font-extrabold tracking-tight mt-2 leading-tight">Bora pro corre, Mohamed.</h1>
      <FocoHero estado="antes" meta={m} temFaixas={m.modo === "adaptativo"} overnightOpen={false} exporting={false} onEditar={() => {}} onIrDefcon={() => {}} onPDF={() => {}}
        n={{ dailyGoal: m.meta, totalVendido: 0, totalCaiu: 0, faltaCair: 0, lucro: 0, workHours: 6, blocosTot: 6, projecao: 0, ontem: 1092, pctOntem: 85, semana: 4506, vendas: 0, abord: 0, conv: 0, rankPos: 4, ligaCor: "#5ac8fa", ligaLabel: "Diamante", horaInicio: 9, ativoDesde: null }} />
      <MesCard m={m} onReplanejar={() => {}} />
      <MetaAdaptativaCard m={m} estado="antes" salvando={false} onTrocar={() => {}} />
      {q === "replan" && <ReplanejarMes aberto onFechar={() => {}} m={m} onEscolher={() => {}} />}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><Tela /></MemoryRouter></QueryClientProvider>);
