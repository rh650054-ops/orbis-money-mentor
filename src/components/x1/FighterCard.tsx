/* ============================================================
   CARD DE LUTADOR — a identidade do vendedor na Arena X1.
   Variantes:
     • "arena"  → card grande com foto, escudo, 4 stats e barra de XP
     • "luta"   → card compacto do lado do VS (foto, patente, placar)
     • "mini"   → card da grade de seleção (foto, nome, patente, potência)
   Foto real sempre (X1Avatar cai pra iniciais se não tiver).
   ============================================================ */
import { X1Avatar } from "./X1Avatar";
import { fmt, patenteCor, primeiroNome, proximaPatente, xpPct, type Recorde } from "./x1-lib";

const GOLD = "#F5B800";
const RED = "#F2465A";
const OK = "#3DD68C";
const HOT = "#ff7a1a";

export function Escudo({ patente, lado = "eu", texto }: { patente: string; lado?: "eu" | "ele"; texto?: string }) {
  const cor = lado === "eu" ? GOLD : RED;
  return (
    <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-black tracking-[.12em]" style={{ bottom: -9, background: cor, color: lado === "eu" ? "#1a1305" : "#fff", border: "2px solid #000" }}>
      {texto ?? patente}
    </span>
  );
}

export function XpBar({ r, animar = false, corTexto = GOLD }: { r: Recorde; animar?: boolean; corTexto?: string }) {
  const prox = proximaPatente(r.patente);
  return (
    <div className="mt-2.5">
      <div className="flex items-center justify-between text-[10px] font-black tracking-[.16em]" style={{ color: corTexto }}>
        <span>XP · {r.pontos}{r.pontos_proxima != null ? ` / ${r.pontos_proxima}` : ""}</span>
        <span>{prox ? `→ ${prox}` : "LENDA"}</span>
      </div>
      <div className="h-[10px] rounded-full overflow-hidden mt-1.5" style={{ background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.08)" }}>
        <i className={`block h-full rounded-full ${animar ? "x1-xp-fill" : ""}`} style={{ width: `${Math.round(xpPct(r) * 100)}%`, background: "linear-gradient(90deg,#B88700,#FFC63A)", boxShadow: "0 0 12px #F5B800" }} />
      </div>
    </div>
  );
}

/** Card grande (Arena) */
export function FighterCardArena({ nome, avatar, r, sub, posicao, className = "" }: { nome: string; avatar: string | null; r: Recorde; sub?: string | null; posicao?: number | null; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-[24px] px-4 pt-6 pb-4 text-center ${className}`}
      style={{ background: "linear-gradient(180deg,#1a1305 0%,#0b0b0d 70%)", border: `1.5px solid ${GOLD}88`, boxShadow: `0 30px 60px -30px ${GOLD}99` }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(80% 60% at 50% 0%,${GOLD}33,transparent 60%)` }} />
      <span className="x1-shine" />
      <div className="relative inline-block">
        <X1Avatar url={avatar} nome={nome} size={112} cor={GOLD} style={{ borderWidth: 3, boxShadow: `0 0 0 6px ${GOLD}22, 0 0 40px ${GOLD}55` }} />
        <Escudo patente={`${r.patente} · NÍVEL ${r.nivel}`} />
      </div>
      <p className="text-[24px] font-black tracking-[-.03em] mt-4 leading-none">{primeiroNome(nome)}</p>
      <p className="text-[11.5px] mt-1" style={{ color: "#b3ab9c" }}>{[sub, posicao ? `#${posicao} da arena` : null].filter(Boolean).join(" · ") || "sua primeira luta te coloca na arena"}</p>
      <div className="flex gap-1.5 mt-3">
        {[
          { k: "VITÓRIAS", v: String(r.vitorias), c: OK },
          { k: "DERROTAS", v: String(r.derrotas), c: "#fff" },
          { k: "SEQUÊNCIA", v: String(r.sequencia), c: r.sequencia >= 2 ? HOT : "#fff" },
          { k: "POTÊNCIA", v: r.potencia > 0 ? fmt(r.potencia) : "—", c: GOLD },
        ].map((s) => (
          <div key={s.k} className="flex-1 rounded-[12px] px-1 py-2" style={{ background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.07)" }}>
            <p className="text-[8.5px] font-black tracking-[.1em]" style={{ color: "#8a8378" }}>{s.k}</p>
            <p className="text-[15px] font-black tabular-nums mt-0.5" style={{ color: s.c }}>{s.v}</p>
          </div>
        ))}
      </div>
      <XpBar r={r} />
    </div>
  );
}

/** Card compacto do lado do VS (luta ao vivo) */
export function FighterCardLuta({ nome, avatar, patente, total, lado, lidera, className = "" }: { nome: string; avatar: string | null; patente: string; total: number; lado: "eu" | "ele"; lidera: boolean; className?: string }) {
  const cor = lado === "eu" ? GOLD : RED;
  return (
    <div className={`relative overflow-hidden rounded-[20px] px-2 pt-4 pb-3 text-center flex-1 ${className}`}
      style={{ background: lado === "eu" ? "linear-gradient(180deg,#1a1305 0%,#0b0b0d 70%)" : "linear-gradient(180deg,#2a0c11 0%,#0b0b0d 70%)", border: `1.5px solid ${cor}88`, boxShadow: `0 30px 60px -30px ${cor}99` }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(80% 60% at 50% 0%,${cor}33,transparent 60%)` }} />
      <div className="relative inline-block">
        <X1Avatar url={avatar} nome={nome} size={76} cor={cor} style={{ borderWidth: 3, boxShadow: `0 0 0 5px ${cor}22, 0 0 30px ${cor}55` }} />
        <Escudo patente={patente} lado={lado} />
      </div>
      <p className="text-[16px] font-black tracking-[-.02em] mt-4 leading-none truncate">{primeiroNome(nome)}</p>
      <p className="text-[26px] font-black tabular-nums mt-1 leading-none" style={{ color: lidera ? (lado === "eu" ? OK : "#ff7d8c") : "#fff" }}>{fmt(total).replace("R$", "").trim()}</p>
    </div>
  );
}

/** Card da grade de seleção */
export function FighterCardMini({ nome, avatar, patente, vitorias, derrotas, linha, selo, seloCor, potencia, selecionado, onClick, style }: {
  nome: string; avatar: string | null; patente: string; vitorias: number; derrotas: number; linha: string; selo?: string | null; seloCor?: string; potencia: number; selecionado: boolean; onClick: () => void; style?: React.CSSProperties;
}) {
  const cor = patenteCor(patente);
  const barras = Math.max(1, Math.min(5, Math.round(potencia / 150)));
  return (
    <button type="button" onClick={onClick} className="relative rounded-[18px] px-2.5 pt-4 pb-3 text-center active:scale-[0.97] transition-transform" style={{
      background: selecionado ? "linear-gradient(180deg,#1a1305,#0b0b0d)" : "linear-gradient(180deg,#141216,#0b0b0d)",
      border: `1px solid ${selecionado ? GOLD : "#2a2823"}`, boxShadow: selecionado ? `0 0 0 2px ${GOLD}44, 0 16px 40px -16px ${GOLD}88` : "none", ...style,
    }}>
      {selo && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-[3px] text-[8.5px] font-black tracking-[.08em]" style={{ top: -8, background: "#0e0e10", border: `1.5px solid ${seloCor || "#2a2823"}`, color: seloCor || "#e9e4d8" }}>{selo}</span>}
      <X1Avatar url={avatar} nome={nome} size={64} cor={selecionado ? GOLD : cor} />
      <p className="text-[13px] font-black mt-2.5 truncate">{primeiroNome(nome)}</p>
      <p className="text-[9px] font-black tracking-[.1em] mt-0.5" style={{ color: cor }}>{patente}</p>
      <p className="text-[10.5px] mt-0.5 truncate" style={{ color: "#8a8378" }}>{vitorias}V {derrotas}D{linha ? ` · ${linha}` : ""}</p>
      <div className="flex justify-center gap-[2px] mt-1.5">
        {[1, 2, 3, 4, 5].map((n) => <i key={n} className="block w-[10px] h-[4px] rounded-[2px]" style={{ background: n <= barras ? HOT : "#2a2823" }} />)}
      </div>
    </button>
  );
}
