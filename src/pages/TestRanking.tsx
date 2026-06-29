import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { CompetitionArena, type ArenaRow } from "@/components/competitions/CompetitionArena";
import { formatCurrency } from "@/shared/lib/utils";

// Simulador do ranking (SÓ ADMIN). Vendedores fake + controle de Dia/Hora pra
// verificar todos os momentos: disputa ao vivo, corte das 9h, encerramento de domingo.
// 100% client-side — não toca em nenhum dado real, ninguém além do admin vê.

interface FakeVendor {
  id: string;
  nome: string;
  dias: number[]; // faturamento de cada dia (01–05/07)
}

const FAKES: FakeVendor[] = [
  { id: "f1", nome: "Zé do Açaí", dias: [450, 380, 420, 500, 460] },
  { id: "f2", nome: "Lu Brigadeiro", dias: [380, 350, 390, 360, 400] },
  { id: "f3", nome: "Carlos Doceiro", dias: [320, 280, 410, 350, 300] },
  { id: "f4", nome: "Rosa Tapioca", dias: [290, 310, 280, 330, 300] },
  { id: "f5", nome: "Bia Salgados", dias: [260, 300, 240, 280, 320] },
  { id: "f6", nome: "Pedro Caldo", dias: [210, 230, 250, 220, 240] },
  { id: "f7", nome: "Marina Pipoca", dias: [180, 220, 190, 250, 210] },
  { id: "f8", nome: "Tonho Churros", dias: [150, 170, 200, 180, 160] },
];
const EU: FakeVendor = { id: "me-teste", nome: "VOCÊ (teste)", dias: [340, 360, 380, 400, 420] };

// Vende das 8h às 20h — quanto do dia já rolou até a hora atual (0 a 1).
function progressoDia(hora: number): number {
  return Math.max(0, Math.min(1, (hora - 8) / 12));
}
// Faturamento acumulado até (dia, hora): dias anteriores completos + dia atual parcial.
function faturamento(dias: number[], dia: number, hora: number): number {
  let total = 0;
  for (let d = 1; d < dia; d++) total += dias[d - 1] ?? 0;
  total += (dias[dia - 1] ?? 0) * progressoDia(hora);
  return Math.round(total);
}

const JUMPS = [
  { lbl: "🌅 D1 · 6h", d: 1, h: 6 },
  { lbl: "🌞 D1 · 14h", d: 1, h: 14 },
  { lbl: "🌙 D2 · 8h", d: 2, h: 8 },
  { lbl: "🔥 D3 · 16h", d: 3, h: 16 },
  { lbl: "🏁 D5 · 23h", d: 5, h: 23 },
];

export default function TestRanking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { whitelisted, role, loading } = useAdminAccess(user?.id);
  const isAdmin = whitelisted && role === "admin";

  const [dia, setDia] = useState(1);
  const [hora, setHora] = useState(14);

  const rows = useMemo<ArenaRow[]>(() => {
    const all = [EU, ...FAKES].map((v) => ({
      user_id: v.id,
      nickname: v.nome,
      avatar_url: null,
      value: faturamento(v.dias, dia, hora),
    }));
    return all.sort((a, b) => b.value - a.value);
  }, [dia, hora]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!isAdmin) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
        <button onClick={() => navigate("/ranking")} className="text-primary underline">Voltar</button>
      </div>
    );
  }

  const dataLabel = `0${dia}/07`;
  const encerrado = dia === 5 && hora >= 23;
  const momento = encerrado
    ? "🏁 Encerrou! (domingo 23:59) — vencedor definido."
    : hora < 9
      ? "🕘 Antes das 9h — o extrato de ontem ainda pode subir e contar."
      : "🟢 Disputa rolando ao vivo.";
  const datesStatus = `SIMULAÇÃO · ${dataLabel} · ${String(hora).padStart(2, "0")}h · ${encerrado ? "encerrada" : "ao vivo"}`;

  return (
    <div>
      {/* Painel de controle do tempo (sticky) */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "#0a0a0a", borderBottom: "1px solid #222", padding: "12px 16px", marginBottom: 4 }}>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate("/ranking")} className="flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </button>
          <span className="text-[11px] font-bold tracking-wider" style={{ color: "#C9A84C" }}>🧪 SIMULADOR · SÓ VOCÊ VÊ</span>
        </div>

        <div className="flex items-center gap-3 mb-1.5">
          <span className="text-xs text-muted-foreground w-10">Dia</span>
          <input type="range" min={1} max={5} value={dia} onChange={(e) => setDia(Number(e.target.value))} className="flex-1" />
          <span className="text-xs font-bold text-foreground w-16 text-right">{dataLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-10">Hora</span>
          <input type="range" min={0} max={23} value={hora} onChange={(e) => setHora(Number(e.target.value))} className="flex-1" />
          <span className="text-xs font-bold text-foreground w-16 text-right">{String(hora).padStart(2, "0")}:00</span>
        </div>

        <div className="text-[11px] mt-2" style={{ color: encerrado ? "#F5D78E" : hora < 9 ? "#e0b15a" : "#8fd19e" }}>{momento}</div>

        <div className="flex gap-1.5 mt-2 flex-wrap">
          {JUMPS.map((j) => (
            <button
              key={j.lbl}
              onClick={() => { setDia(j.d); setHora(j.h); }}
              className="text-[10px] px-2 py-1 rounded-md border border-border bg-card text-muted-foreground active:scale-95 transition"
            >
              {j.lbl}
            </button>
          ))}
        </div>
      </div>

      <CompetitionArena
        title="Liga Semanal"
        sealText="Modo Teste"
        prizeLabel="Campeão"
        prizeValue={100}
        datesStatus={datesStatus}
        rows={rows}
        me="me-teste"
        formatCurrency={formatCurrency}
        onOpenProfile={() => {}}
      />
    </div>
  );
}
