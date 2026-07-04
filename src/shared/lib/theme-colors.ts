const cssVarCache = new Map<string, string>();

function getRootStyle(): CSSStyleDeclaration | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  return getComputedStyle(document.documentElement);
}

export function readThemeColor(varName: string, fallback = "0 0% 0%"): string {
  if (cssVarCache.has(varName)) return cssVarCache.get(varName)!;
  const root = getRootStyle();
  const raw = root?.getPropertyValue(varName).trim() || fallback;
  const value = `hsl(${raw})`;
  cssVarCache.set(varName, value);
  return value;
}

export function readThemeColorWithAlpha(varName: string, alpha: number, fallback = "0 0% 0%"): string {
  const root = getRootStyle();
  const raw = root?.getPropertyValue(varName).trim() || fallback;
  return `hsl(${raw} / ${alpha})`;
}

export function clearThemeColorCache(): void {
  cssVarCache.clear();
}

export const THEME_VARS = {
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  success: "--success",
  warning: "--warning",
  destructive: "--destructive",
  background: "--background",
  card: "--card",
  border: "--border",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  foreground: "--foreground",
  accent: "--accent",
  ring: "--ring",
  tierBronze: "--tier-bronze",
  tierSilver: "--tier-silver",
  tierGold: "--tier-gold",
  tierPlatinum: "--tier-platinum",
  tierLegendary: "--tier-legendary",
  streakWarm: "--streak-warm",
  streakStrong: "--streak-strong",
  streakLegendary: "--streak-legendary",
} as const;

export const THEME_COLORS = {
  get primary() {
    return readThemeColor(THEME_VARS.primary);
  },
  get success() {
    return readThemeColor(THEME_VARS.success);
  },
  get warning() {
    return readThemeColor(THEME_VARS.warning);
  },
  get destructive() {
    return readThemeColor(THEME_VARS.destructive);
  },
  get background() {
    return readThemeColor(THEME_VARS.background);
  },
  get card() {
    return readThemeColor(THEME_VARS.card);
  },
  get border() {
    return readThemeColor(THEME_VARS.border);
  },
  get muted() {
    return readThemeColor(THEME_VARS.muted);
  },
  get mutedForeground() {
    return readThemeColor(THEME_VARS.mutedForeground);
  },
  get foreground() {
    return readThemeColor(THEME_VARS.foreground);
  },
};

export const BRAND_COLORS = {
  WHATSAPP: "#25D366",
  // Pix = dinheiro que entrou. Antes era o teal oficial do Pix (#32BCAD), que puxava
  // pro AZUL — fora da identidade do app. Trocado por verde (money in), sem azul.
  PIX: "#16A34A",
  INSTAGRAM_GRADIENT: {
    from: "#F58529",
    via: "#DD2A7B",
    to: "#8134AF",
  },
} as const;

export const RANKING_TIER_COLORS = {
  gold: "#F4A100",
  goldBright: "#F5B400",
  goldSoft: "#FFD27A",
  goldLight: "#FFE89A",
  goldHighlight: "#FFF1B8",
  goldDeep: "#C77E00",
  goldDark: "#8B5A00",
  silver: "#C0C0C0",
  silverSoft: "#E8E8E8",
  silverDark: "#BDBDBD",
  bronze: "#A8703A",
  bronzeSoft: "#D9A371",
  podiumWhite: "#FFFFFF",
  iconStroke: "#0A0A0A",
  shareCardBgDeep: "#1A1100",
  shareCardBgBlack: "#000000",
} as const;

export const RANKING_FIRE_GRADIENT = [
  RANKING_TIER_COLORS.gold,
  RANKING_TIER_COLORS.goldSoft,
  RANKING_TIER_COLORS.podiumWhite,
  RANKING_TIER_COLORS.goldDeep,
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  food: "#F59E0B",
  housing: "#3B82F6",
  transport: "#10B981",
  education: "#8B5CF6",
  health: "#EF4444",
  leisure: "#EC4899",
  merchandise: "#6366F1",
  other: "#64748B",
};

export const CATEGORY_DEFAULT_COLOR = CATEGORY_COLORS.housing;

export const HOUR_BLOCK_COLORS = {
  gold: "#F4A100",
  violet: "#6B21A8",
  violetSoft: "#A78BFA",
  blockBg: "#0F0F0F",
} as const;

export const GOLD_PARTICLES_CANVAS = {
  bgDeep: "#1A0533",
  bgEdge: "#000000",
} as const;
