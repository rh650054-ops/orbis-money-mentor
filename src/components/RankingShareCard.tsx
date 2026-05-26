import { forwardRef } from "react";
import { Crown, Flame, Trophy, Sparkles, Star } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { RANKING_TIER_COLORS } from "@/shared/lib/theme-colors";

const C = RANKING_TIER_COLORS;

interface RankingShareCardProps {
  league: "faturamento" | "constancia";
  position: number | null;
  totalParticipants: number;
  nickname: string;
  avatarUrl: string | null;
  primaryValue: string; // ex "R$ 12.300,00" ou "18 dias"
  secondaryValue?: string; // ex "5 seguidos"
  monthLabel: string;
}

const EXCLUSIVE_EMOJIS = ["🦁", "🐺", "🦅", "🔥", "⚡", "💎", "🚀", "👑", "🎯", "💪", "🏆", "⭐", "🐉", "🦈", "🐯", "🦊"];
const isEmoji = (a: string | null) => !!a && EXCLUSIVE_EMOJIS.includes(a);

// Literal "#fff" usages below are intentional: html2canvas exports this surface to PNG
// for IG Story sharing and resolves CSS vars unreliably. Token system does not apply here.
/**
 * Card 1080x1920 (Instagram Story). Renderizado em escala via CSS no captura,
 * mas mantém proporção 9:16 fixa para print perfeito.
 */
export const RankingShareCard = forwardRef<HTMLDivElement, RankingShareCardProps>(
  ({ league, position, totalParticipants, nickname, avatarUrl, primaryValue, secondaryValue, monthLabel }, ref) => {
    const isFat = league === "faturamento";
    const Icon = isFat ? Crown : Flame;
    const leagueLabel = isFat ? "LIGA DO FATURAMENTO" : "LIGA DA CONSTÂNCIA";
    const positionStr = position ? `#${position}` : "—";
    const isTop3 = position !== null && position <= 3 && position > 0;

    return (
      <div
        ref={ref}
        // 1080x1920 — story format
        style={{
          width: 1080,
          height: 1920,
          background: `radial-gradient(120% 80% at 50% 0%, ${C.shareCardBgDeep} 0%, ${C.shareCardBgBlack} 55%, ${C.shareCardBgBlack} 100%)`,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow gold blob */}
        <div
          style={{
            position: "absolute",
            top: -200,
            left: "50%",
            transform: "translateX(-50%)",
            width: 1200,
            height: 1200,
            background: "radial-gradient(circle, rgba(245,180,0,0.35) 0%, rgba(245,180,0,0) 60%)",
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -300,
            right: -200,
            width: 900,
            height: 900,
            background: "radial-gradient(circle, rgba(245,180,0,0.18) 0%, rgba(245,180,0,0) 70%)",
            filter: "blur(40px)",
          }}
        />

        {/* Subtle grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
            opacity: 0.6,
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            padding: "120px 90px 100px",
          }}
        >
          {/* Header */}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 18,
                padding: "16px 36px",
                borderRadius: 999,
                border: "2px solid rgba(245,180,0,0.5)",
                background: "rgba(245,180,0,0.08)",
                marginBottom: 40,
              }}
            >
              <Sparkles size={28} color={C.goldBright} />
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: 6,
                  color: C.goldBright,
                }}
              >
                ORBIS · RANKING
              </span>
              <Sparkles size={28} color={C.goldBright} />
            </div>

            <div
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: "rgba(255,255,255,0.55)",
                letterSpacing: 4,
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              {monthLabel}
            </div>

            <h1
              style={{
                fontSize: 78,
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: -2,
                margin: "10px 0 0",
                background: `linear-gradient(180deg, ${C.goldLight} 0%, ${C.goldBright} 60%, ${C.goldDeep} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {leagueLabel}
            </h1>
          </div>

          {/* Position */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 50,
            }}
          >
            {/* Icon trophy */}
            <div
              style={{
                width: 200,
                height: 200,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${C.goldBright}, ${C.goldDeep})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 80px rgba(245,180,0,0.6), inset 0 -20px 40px rgba(0,0,0,0.3)",
              }}
            >
              <Icon size={110} color={C.iconStroke} strokeWidth={2.5} />
            </div>

            {/* Position number */}
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 44,
                  color: "rgba(255,255,255,0.6)",
                  fontWeight: 600,
                  letterSpacing: 8,
                  marginBottom: 10,
                }}
              >
                MINHA POSIÇÃO
              </div>
              <div
                style={{
                  fontSize: 360,
                  fontWeight: 900,
                  lineHeight: 0.9,
                  letterSpacing: -10,
                  background: isTop3
                    ? `linear-gradient(180deg, ${C.goldHighlight} 0%, ${C.goldBright} 50%, ${C.goldDark} 100%)`
                    : `linear-gradient(180deg, ${C.podiumWhite} 0%, ${C.silverDark} 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 10px 40px rgba(245,180,0,0.4))",
                }}
              >
                {positionStr}
              </div>
              <div
                style={{
                  fontSize: 36,
                  color: "rgba(255,255,255,0.5)",
                  fontWeight: 600,
                  marginTop: 14,
                }}
              >
                de {totalParticipants} vendedores
              </div>
            </div>

            {/* Stats card */}
            <div
              style={{
                width: "100%",
                padding: "44px 50px",
                borderRadius: 36,
                border: "2px solid rgba(245,180,0,0.4)",
                background: "linear-gradient(180deg, rgba(245,180,0,0.12) 0%, rgba(0,0,0,0.4) 100%)",
                backdropFilter: "blur(10px)",
                display: "flex",
                alignItems: "center",
                gap: 36,
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: "50%",
                  border: `4px solid ${C.goldBright}`,
                  background: "linear-gradient(135deg, rgba(245,180,0,0.3), rgba(245,180,0,0.05))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  overflow: "hidden",
                  fontSize: 70,
                  color: C.goldBright,
                  fontWeight: 900,
                }}
              >
                {isEmoji(avatarUrl) ? (
                  <span>{avatarUrl}</span>
                ) : avatarUrl ? (
                  <img src={avatarUrl} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span>{(nickname || "U").charAt(0).toUpperCase()}</span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 48,
                    fontWeight: 800,
                    color: "#fff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginBottom: 8,
                  }}
                >
                  {nickname || "Vendedor"}
                </div>
                <div
                  style={{
                    fontSize: 56,
                    fontWeight: 900,
                    color: C.goldBright,
                    lineHeight: 1,
                  }}
                >
                  {primaryValue}
                </div>
                {secondaryValue && (
                  <div
                    style={{
                      fontSize: 32,
                      color: "rgba(255,255,255,0.6)",
                      marginTop: 10,
                      fontWeight: 600,
                    }}
                  >
                    {secondaryValue}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 18,
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={28} color={C.goldBright} fill={C.goldBright} />
              ))}
            </div>
            <div
              style={{
                fontSize: 38,
                fontWeight: 800,
                color: "#fff",
                letterSpacing: 1,
              }}
            >
              Eu sou Orbis. Eu vendo todo dia.
            </div>
            <div
              style={{
                fontSize: 28,
                color: "rgba(255,255,255,0.5)",
                letterSpacing: 4,
                fontWeight: 600,
              }}
            >
              ORBISAPP.COM.BR
            </div>
          </div>
        </div>
      </div>
    );
  }
);

RankingShareCard.displayName = "RankingShareCard";
