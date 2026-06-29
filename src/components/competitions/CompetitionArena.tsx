import { useEffect, useRef, useState } from "react";
import { Info, Share2 } from "lucide-react";
import { getTier } from "@/components/ranking/tier";

// Cores metalicas (dourado / platina / bronze) — identidade premium da competicao.
const GOLD = "#C9A84C";
const GOLD_LT = "#F5D78E";
const PLAT = "#E5E4E2";
const PLAT_DK = "#A8A8A8";
const BRONZE = "#CD9B6A";
const BRONZE_DK = "#8B6914";

export interface ArenaRow {
  user_id: string;
  nickname: string | null;
  avatar_url: string | null;
  value: number;
}

interface Props {
  title: string;
  sealText: string;
  prizeLabel: string;
  prizeValue: number;
  datesStatus: string;
  rows: ArenaRow[];
  me?: string;
  isCount?: boolean;
  formatCurrency: (v: number) => string;
  onOpenProfile: (uid: string) => void;
  onShare?: () => void;
}

// Partículas douradas/platina flutuando no fundo (igual ao mockup).
function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const parts = Array.from({ length: 32 }, () => ({
      x: Math.random() * (canvas.width || 440),
      y: Math.random() * (canvas.height || 800),
      r: Math.random() * 1.2 + 0.3,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      o: Math.random() * 0.4 + 0.15,
      p: Math.random() * Math.PI * 2,
      gold: Math.random() > 0.5,
    }));
    const draw = () => {
      if (!canvas.width) resize();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.p += 0.015;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + Math.sin(p.p) * 0.3, 0, Math.PI * 2);
        const c = p.gold ? "201,168,76" : "229,228,226";
        ctx.fillStyle = `rgba(${c},${p.o + Math.sin(p.p) * 0.1})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 0, opacity: 0.4, pointerEvents: "none" }} />;
}

function Avatar({ row, size, font, ring, glow }: { row?: ArenaRow; size: number; font: number; ring: string; glow: string }) {
  return (
    <div style={{ borderRadius: "50%", padding: 2.5, background: ring, boxShadow: `0 0 ${size * 0.36}px ${glow}` }}>
      <div
        style={{
          width: size, height: size, borderRadius: "50%", background: "#141414", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Bebas Neue', sans-serif", fontSize: font, color: "#fff",
        }}
      >
        {row?.avatar_url ? (
          <img src={row.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          (row?.nickname ?? "?").charAt(0).toUpperCase()
        )}
      </div>
    </div>
  );
}

function PodCol({ row, pos, isCount, formatCurrency, onOpenProfile }: {
  row?: ArenaRow; pos: 1 | 2 | 3; isCount?: boolean; formatCurrency: (v: number) => string; onOpenProfile: (uid: string) => void;
}) {
  if (!row) return <div style={{ flex: 1, maxWidth: "33%" }} />;
  const gold = pos === 1, plat = pos === 2;
  const ring = gold
    ? `linear-gradient(135deg, ${GOLD_LT}, ${GOLD}, ${GOLD_LT})`
    : plat
      ? `linear-gradient(135deg, ${PLAT}, ${PLAT_DK}, ${PLAT})`
      : `linear-gradient(135deg, ${BRONZE}, ${BRONZE_DK}, ${BRONZE})`;
  const glow = gold ? "rgba(201,168,76,0.4)" : plat ? "rgba(229,228,226,0.3)" : "rgba(205,155,106,0.3)";
  const badge = gold
    ? `linear-gradient(135deg, ${GOLD_LT}, ${GOLD})`
    : plat
      ? `linear-gradient(135deg, ${PLAT}, ${PLAT_DK})`
      : `linear-gradient(135deg, ${BRONZE}, ${BRONZE_DK})`;
  const avSize = gold ? 82 : 60;
  const baseH = gold ? 96 : plat ? 68 : 52;
  const baseBg = gold
    ? "linear-gradient(180deg, rgba(201,168,76,0.25), rgba(201,168,76,0.05))"
    : plat
      ? "linear-gradient(180deg, rgba(229,228,226,0.18), rgba(229,228,226,0.03))"
      : "linear-gradient(180deg, rgba(205,155,106,0.18), rgba(205,155,106,0.03))";
  const baseBorder = gold ? "rgba(201,168,76,0.4)" : plat ? "rgba(229,228,226,0.25)" : "rgba(205,155,106,0.25)";
  const baseColor = gold ? GOLD_LT : plat ? PLAT : BRONZE;
  const tier = getTier(pos);
  const val = isCount ? String(Math.round(row.value)) : formatCurrency(row.value);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", maxWidth: "33%", minWidth: 0 }}>
      <button onClick={() => onOpenProfile(row.user_id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <div style={{ position: "relative", marginBottom: 10 }}>
          {gold && (
            <div style={{ position: "absolute", top: -22, left: "50%", transform: "translateX(-50%)", fontSize: 22, filter: "drop-shadow(0 0 10px rgba(201,168,76,0.7))", animation: "orbisCrownFloat 3s ease-in-out infinite" }}>👑</div>
          )}
          <Avatar row={row} size={avSize} font={gold ? 32 : 24} ring={ring} glow={glow} />
          <div style={{ position: "absolute", bottom: -4, right: -4, width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: "#000", border: "2px solid #080808", background: badge }}>{pos}</div>
        </div>
        <div style={{ fontSize: gold ? 15 : 14, fontWeight: 600, color: "#fff", marginBottom: 3, textAlign: "center", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.nickname || "Vendedor"}</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: gold ? 24 : 18, letterSpacing: 1, marginBottom: 3, color: gold ? undefined : "#999", background: gold ? `linear-gradient(135deg, ${GOLD}, ${GOLD_LT})` : undefined, WebkitBackgroundClip: gold ? "text" : undefined, WebkitTextFillColor: gold ? "transparent" : undefined }}>{val}</div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, marginBottom: 14, color: baseColor }}>{tier.label}</div>
      </button>
      <div style={{ width: "100%", borderRadius: "10px 10px 0 0", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 14, fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: gold ? 48 : 36, position: "relative", overflow: "hidden", height: baseH, background: baseBg, border: `1px solid ${baseBorder}`, borderBottom: "none", color: baseColor }}>
        <div style={{ position: "absolute", top: 0, left: "-100%", width: "50%", height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)", animation: "orbisBaseShine 4s ease-in-out infinite" }} />
        {pos}
      </div>
    </div>
  );
}

export function CompetitionArena({ title, sealText, prizeLabel, prizeValue, datesStatus, rows, me, isCount, formatCurrency, onOpenProfile, onShare }: Props) {
  const top1 = rows[0], top2 = rows[1], top3 = rows[2];
  const rest = rows.slice(3, 20);
  const [showHow, setShowHow] = useState(false);

  return (
    <div style={{ position: "relative", width: "100vw", left: "50%", marginLeft: "-50vw", minHeight: "82vh", overflow: "hidden", background: "radial-gradient(ellipse 90% 36% at 50% 0%, rgba(201,168,76,0.14) 0%, transparent 58%), linear-gradient(180deg, #0D0B07 0%, #080808 55%, #060606 100%)" }}>
      <style>{`
        @keyframes orbisCrownFloat { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-4px)} }
        @keyframes orbisBaseShine { 0%{left:-100%} 50%,100%{left:200%} }
      `}</style>
      <Particles />
      <div style={{ position: "relative", zIndex: 2, maxWidth: 520, margin: "0 auto", paddingBottom: "6.5rem" }}>

        {/* Header: selo + título + prêmio */}
        <div style={{ textAlign: "center", padding: "32px 28px 24px", position: "relative", zIndex: 2 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 18px", borderRadius: 30, marginBottom: 20, background: "linear-gradient(135deg, rgba(201,168,76,0.12), rgba(229,228,226,0.06))", border: "1px solid rgba(201,168,76,0.3)" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: GOLD, boxShadow: `0 0 8px ${GOLD}` }} />
            <div style={{ fontSize: 10, letterSpacing: 3, fontWeight: 600, textTransform: "uppercase", background: `linear-gradient(135deg, ${PLAT}, ${GOLD})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{sealText}</div>
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 700, letterSpacing: 0.5, lineHeight: 1, marginBottom: 12, background: `linear-gradient(135deg, ${PLAT} 0%, ${GOLD} 50%, ${PLAT} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{title}</div>
          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", padding: "16px 32px", borderRadius: 16, background: "linear-gradient(135deg, rgba(201,168,76,0.1), rgba(0,0,0,0.2))", border: "1px solid rgba(201,168,76,0.25)" }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "rgba(229,228,226,0.6)", textTransform: "uppercase", marginBottom: 6 }}>🏆 Prêmio do Campeão</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, letterSpacing: 2, lineHeight: 1, background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LT})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {prizeLabel}{prizeValue ? ` · ${formatCurrency(prizeValue)}` : ""}
            </div>
            <div style={{ fontSize: 11, color: "#666", marginTop: 6, letterSpacing: 0.5 }}>{datesStatus}</div>
          </div>

          <button
            onClick={() => setShowHow((v) => !v)}
            style={{ marginTop: 16, background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, letterSpacing: 1, color: "rgba(201,168,76,0.85)", fontWeight: 600 }}
          >
            <Info style={{ width: 13, height: 13 }} /> COMO FUNCIONA {showHow ? "▲" : "▼"}
          </button>
          {showHow && (
            <div style={{ marginTop: 12, textAlign: "left", maxWidth: 360, marginLeft: "auto", marginRight: "auto", padding: 14, borderRadius: 12, background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.2)", fontSize: 12, lineHeight: 1.7, color: "rgba(229,228,226,0.85)", display: "flex", flexDirection: "column", gap: 6 }}>
            <div>💳 Só <b style={{ color: "#fff" }}>cartão + Pix</b> conta. Dinheiro vivo não entra.</div>
            <div>📤 No fim do DEFCON, <b style={{ color: "#fff" }}>suba seu extrato</b> do dia.</div>
            <div>⚡ Durante o dia conta <b style={{ color: "#fff" }}>ao vivo</b>; o extrato confirma o valor.</div>
            <div>⏰ Prazo: até as <b style={{ color: "#fff" }}>9h</b> da manhã seguinte (Pix atrasado).</div>
            <div>🛡️ A IA confere e ignora auto-transferência e duplicata.</div>
            </div>
          )}
        </div>

        {/* Pódio */}
        <div style={{ padding: "16px 24px 32px", position: "relative", zIndex: 2 }}>
          <div style={{ textAlign: "center", fontSize: 11, letterSpacing: 4, color: "rgba(201,168,76,0.6)", textTransform: "uppercase", marginBottom: 32, fontWeight: 500 }}>Pódio da Liga</div>
          {top1 ? (
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 10 }}>
              <PodCol row={top2} pos={2} isCount={isCount} formatCurrency={formatCurrency} onOpenProfile={onOpenProfile} />
              <PodCol row={top1} pos={1} isCount={isCount} formatCurrency={formatCurrency} onOpenProfile={onOpenProfile} />
              <PodCol row={top3} pos={3} isCount={isCount} formatCurrency={formatCurrency} onOpenProfile={onOpenProfile} />
            </div>
          ) : (
            <p style={{ textAlign: "center", color: "#666", fontSize: 13, padding: "20px 0" }}>Ninguém participando ainda. Seja o primeiro!</p>
          )}
        </div>

        {/* Lista 4º+ */}
        {rest.length > 0 && (
          <div style={{ padding: "0 20px 28px", position: "relative", zIndex: 2 }}>
            {rest.map((r, idx) => {
              const pos = idx + 4;
              const you = r.user_id === me;
              return (
                <button
                  key={r.user_id}
                  onClick={() => onOpenProfile(r.user_id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", marginBottom: 8,
                    borderRadius: 14, cursor: "pointer", textAlign: "left",
                    background: you ? "linear-gradient(135deg, rgba(201,168,76,0.1), rgba(201,168,76,0.02))" : "rgba(255,255,255,0.025)",
                    border: `1px solid ${you ? "rgba(201,168,76,0.35)" : "rgba(255,255,255,0.05)"}`,
                  }}
                >
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 22, color: you ? GOLD : "#555", minWidth: 28, textAlign: "center" }}>{pos}</div>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, flexShrink: 0, overflow: "hidden", color: "#fff" }}>
                    {r.avatar_url ? <img src={r.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (r.nickname ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.nickname || "Vendedor"}
                      {you && <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1, color: "#000", background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LT})`, padding: "2px 7px", borderRadius: 10, marginLeft: 6 }}>VOCÊ</span>}
                    </div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 1 }}>{getTier(pos).label}</div>
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 0.5, color: "#ccc" }}>{isCount ? String(Math.round(r.value)) : formatCurrency(r.value)}</div>
                </button>
              );
            })}
          </div>
        )}

        {/* Compartilhar */}
        {onShare && (
          <button
            onClick={onShare}
            style={{ margin: "0 20px 24px", width: "calc(100% - 40px)", padding: 16, borderRadius: 16, position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "linear-gradient(135deg, rgba(201,168,76,0.08), rgba(229,228,226,0.04))", border: "1px solid rgba(201,168,76,0.25)", cursor: "pointer" }}
          >
            <Share2 style={{ width: 16, height: 16, color: GOLD }} />
            <span style={{ fontSize: 13, fontWeight: 600, background: `linear-gradient(135deg, ${PLAT}, ${GOLD})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Compartilhar minha posição na Liga</span>
          </button>
        )}
      </div>
    </div>
  );
}
