/* ============================================================
   RESULTADO DO X1 — card que aparece ao abrir a arena depois do fechamento
   (23:59). Vitória = dourado com troféu; derrota = vermelho com "revanche";
   empate = neutro. Compartilhar (navigator.share) + revanche amanhã.
   ============================================================ */
import { createPortal } from "react-dom";
import { Trophy, Share2, Swords, X, RotateCcw } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { X1Avatar } from "./X1Avatar";
import { fmt, primeiroNome, type Pessoa, type Recorde } from "./x1-lib";

const GOLD = "#F5B800";
const RED = "#F2465A";
const OK = "#3DD68C";

export interface Resultado {
  id: string;
  tipo: "vitoria" | "derrota" | "empate";
  meu: number;
  dele: number;
  premio: number; // líquido que caiu na carteira (0 em amistoso)
  aposta: number;
}

export function X1ResultadoCard({ r, eu, ele, recorde, onFechar, onRevanche }: {
  r: Resultado; eu: Pessoa; ele: Pessoa; recorde: Recorde; onFechar: () => void; onRevanche: () => void;
}) {
  const nome = primeiroNome(ele.nome);
  const cor = r.tipo === "vitoria" ? GOLD : r.tipo === "derrota" ? RED : "#b3ab9c";
  const titulo = r.tipo === "vitoria" ? `Você venceu ${nome}` : r.tipo === "derrota" ? `${nome} levou essa` : `Empate com ${nome}`;
  const faltam = recorde.proxima != null ? Math.max(0, recorde.proxima - recorde.vitorias) : 0;

  const compartilhar = async () => {
    const texto = r.tipo === "vitoria"
      ? `Venci ${nome} no X1 do Orbis: ${fmt(r.meu)} × ${fmt(r.dele)}. ${recorde.vitorias} vitórias na arena. Quem é o próximo?`
      : r.tipo === "derrota" ? `Perdi pro ${nome} no X1 do Orbis por ${fmt(r.dele - r.meu)}. Amanhã tem revanche.` : `Empate no X1 do Orbis com ${nome}: ${fmt(r.meu)} cada. Amanhã decide.`;
    try {
      if (navigator.share) await navigator.share({ text: texto });
      else { await navigator.clipboard.writeText(texto); toast({ title: "Copiado! Cola no story." }); }
    } catch { /* cancelou */ }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4" style={{ background: "rgba(0,0,0,.82)" }} onClick={onFechar}>
      <div className="orbis-card-in w-full max-w-sm rounded-[24px] border text-center px-5 pt-6 pb-5 relative"
        onClick={(e) => e.stopPropagation()}
        style={{ borderColor: `${cor}66`, background: r.tipo === "vitoria" ? "linear-gradient(160deg,#1C1608,#111)" : r.tipo === "derrota" ? "linear-gradient(160deg,#2a0c11,#111)" : "linear-gradient(160deg,#16151a,#0e0e10)", boxShadow: `0 24px 70px -24px ${cor}88` }}>
        <button type="button" onClick={onFechar} aria-label="Fechar" className="absolute right-3 top-3 w-8 h-8 rounded-full flex items-center justify-center" style={{ color: "rgba(255,255,255,.5)" }}><X className="w-4 h-4" /></button>

        {r.tipo === "vitoria" ? (
          <span className="mx-auto w-[52px] h-[52px] rounded-[14px] flex items-center justify-center" style={{ background: "linear-gradient(180deg,#FFC63A,#F5B800)", boxShadow: "0 4px 0 #B88700" }}>
            <Trophy className="w-7 h-7" style={{ color: "#1A1200" }} strokeWidth={2.8} />
          </span>
        ) : (
          <span className="mx-auto w-[52px] h-[52px] rounded-[14px] flex items-center justify-center" style={{ background: `${cor}22`, border: `1px solid ${cor}66` }}>
            <Swords className="w-7 h-7" style={{ color: cor }} strokeWidth={2.6} />
          </span>
        )}
        <p className="text-[10px] font-black tracking-[.16em] mt-3" style={{ color: cor }}>X1 FECHADO · 23:59</p>
        <p className="text-[26px] font-black leading-[1.15] tracking-tight mt-1.5">{titulo}</p>

        <div className="flex items-center gap-2 mt-3.5 p-2.5 rounded-[14px]" style={{ background: "#0b0b0d", border: "1px solid #22201a" }}>
          <div className="flex-1 flex items-center gap-2">
            <X1Avatar url={eu.avatar_url} nome={eu.nome} size={36} cor={GOLD} />
            <div className="text-left"><p className="text-[20px] font-black tabular-nums leading-none" style={{ color: r.tipo === "vitoria" ? OK : "#fff" }}>{fmt(r.meu)}</p><p className="text-[11px]" style={{ color: "#8a8378" }}>você</p></div>
          </div>
          <span className="text-[14px] font-black italic" style={{ color: GOLD }}>×</span>
          <div className="flex-1 flex items-center gap-2 justify-end">
            <div className="text-right"><p className="text-[20px] font-black tabular-nums leading-none" style={{ color: r.tipo === "derrota" ? "#ff7d8c" : "#fff" }}>{fmt(r.dele)}</p><p className="text-[11px]" style={{ color: "#8a8378" }}>{nome}</p></div>
            <X1Avatar url={ele.avatar_url} nome={ele.nome} size={36} cor={RED} />
          </div>
        </div>

        <p className="text-[16px] font-black tabular-nums mt-3" style={{ color: r.tipo === "vitoria" ? OK : r.tipo === "derrota" ? "#ff7d8c" : "#e9e4d8" }}>
          {r.tipo === "vitoria" && r.premio > 0 ? `+ ${fmt(r.premio)} na carteira · ` : r.tipo === "derrota" && r.aposta > 0 ? `− ${fmt(r.aposta)} · ` : r.tipo === "empate" && r.aposta > 0 ? "aposta devolvida · " : ""}
          {recorde.vitorias}V {recorde.derrotas}D{recorde.sequencia >= 2 ? ` · sequência ${recorde.sequencia}` : ""}
        </p>
        <p className="text-[11.5px] mt-0.5" style={{ color: "#8a8378" }}>
          {recorde.proxima != null ? `faltam ${faltam} ${faltam === 1 ? "vitória" : "vitórias"} pra ${recorde.patente === "NOVATO" ? "BRIGÃO" : recorde.patente === "BRIGÃO" ? "DUELISTA" : recorde.patente === "DUELISTA" ? "CAMPEÃO" : "LENDA"}` : "você é LENDA da arena"}
        </p>

        <button type="button" onClick={compartilhar} className="orbis-cta w-full mt-4"><Share2 className="w-4 h-4" strokeWidth={2.6} /> COMPARTILHAR</button>
        <button type="button" onClick={onRevanche} className="w-full h-[42px] rounded-[12px] mt-2 inline-flex items-center justify-center gap-1.5 text-[12.5px] font-black" style={{ background: "#16151a", border: "1px solid #2a2823", color: "#e9e4d8" }}>
          <RotateCcw className="w-4 h-4" strokeWidth={2.6} /> {r.tipo === "vitoria" ? `Revanche com ${nome} amanhã` : "Pedir revanche amanhã"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
