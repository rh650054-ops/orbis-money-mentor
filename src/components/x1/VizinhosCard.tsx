/* ============================================================
   RELATÓRIO DO DIA → "hoje você vendeu mais que N vizinhos do ranking".
   Compara o que VOCÊ vendeu hoje com os vizinhos (±3 posições) e sugere o
   X1 de amanhã com o mais próximo. Fotos reais. Só Supabase (x1_vizinhos_hoje).
   ============================================================ */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Swords } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { X1Avatar } from "./X1Avatar";
import { fmt, primeiroNome } from "./x1-lib";

const GOLD = "#F5B800";
const RED = "#F2465A";

interface Vizinho { user_id: string; nome: string; avatar_url: string | null; posicao: number; vendido_hoje: number }

export function VizinhosCard({ userId, totalSold }: { userId: string | undefined; totalSold: number }) {
  const navigate = useNavigate();
  const [viz, setViz] = useState<Vizinho[]>([]);

  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    (supabase as any).rpc("x1_vizinhos_hoje").then(({ data }: { data: any[] | null }) => {
      if (vivo) setViz(((data as any[]) || []).map((v) => ({ ...v, vendido_hoje: Number(v.vendido_hoje) || 0 })));
    }).catch(() => {});
    return () => { vivo = false; };
  }, [userId]);

  if (!userId || viz.length === 0) return null;

  const batidos = viz.filter((v) => v.vendido_hoje < totalSold);
  const perdeu = viz.filter((v) => v.vendido_hoje >= totalSold).sort((a, b) => a.vendido_hoje - b.vendido_hoje);
  // alvo: o mais próximo que você passou (vitória moral) ou, se ninguém, o que vendeu logo acima
  const alvo = batidos.sort((a, b) => b.vendido_hoje - a.vendido_hoje)[0] || perdeu[0];
  if (!alvo) return null;
  const venci = alvo.vendido_hoje < totalSold;
  const nome = primeiroNome(alvo.nome);

  return (
    <div className="rounded-[22px] border mt-3 p-4" style={{ borderColor: "#3a2f0c", background: "linear-gradient(160deg,#151004,#0e0e10)" }}>
      <p className="text-[10px] font-black tracking-[.16em]" style={{ color: GOLD }}>
        {batidos.length > 0 ? `HOJE VOCÊ VENDEU MAIS QUE ${batidos.length} ${batidos.length === 1 ? "VIZINHO" : "VIZINHOS"} DO RANKING` : "SEUS VIZINHOS DO RANKING VENDERAM MAIS HOJE"}
      </p>
      <div className="flex items-center gap-3 mt-2.5">
        <span className="inline-flex items-center shrink-0">
          {(batidos.length > 0 ? batidos : perdeu).slice(0, 3).map((v, i) => (
            <X1Avatar key={v.user_id} url={v.avatar_url} nome={v.nome} size={32} cor={RED} style={{ marginLeft: i === 0 ? 0 : -10 }} />
          ))}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black leading-tight">{nome} vendeu {fmt(alvo.vendido_hoje)}. Você, {fmt(totalSold)}.</p>
          <p className="text-[11.5px] mt-0.5" style={{ color: "#8a8378" }}>
            {venci ? "Teria ganhado um X1 hoje. Chama ele pra luta." : `Faltou ${fmt(alvo.vendido_hoje - totalSold)}. Chama ele pra revanche.`}
          </p>
        </div>
      </div>
      <button type="button" onClick={() => navigate(`/x1/escolher?alvo=${alvo.user_id}`)} className="orbis-cta w-full mt-3">
        <Swords className="w-4 h-4" strokeWidth={2.6} /> DESAFIAR {nome.toUpperCase()}
      </button>
    </div>
  );
}
