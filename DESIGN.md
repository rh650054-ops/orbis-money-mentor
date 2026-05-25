# Orbis Money Mentor — Design System

## Design intent

A serious money tool that happens to be gamified. The visual register is **calm, dense, confident**, not **flashy, decorative, generative-AI fintech**. When in doubt, do less.

## Brand anchors

- **Identity color**: gold, `hsl(45 100% 48%)`. Used for: primary CTA, progress fill, key numeric accents, ring focus. Never used for: card backgrounds, large surface fills, decorative text gradients, emoji glow.
- **Background hue**: warm-dark. `hsl(45 5% 5%)`. Not pure `#000`. Pure black against saturated gold reads as cheap OLED-fintech-template. A 5% warm tint reduces edge crush and grounds the gold.
- **Type**: system stack, weight + scale for hierarchy. No gradient text fills. No outline strokes.
- **Iconography**: lucide-react line icons. Emoji is allowed only when it is genuine data (user-set avatars, user-typed messages) - never as decorative ornament in chrome.
- **Surface**: solid `bg-card` cards with thin `border-border`. Glassmorphism (`.glass`) is reserved for **one** surface (sticky top header) and used nowhere else.

## Tokens (HSL, defined in `src/index.css`)

| Token | Value | Use |
|-------|-------|-----|
| `--background` | 45 5% 5% | App root surface |
| `--foreground` | 0 0% 100% | Body text |
| `--card` | 45 5% 7% | Card surface |
| `--card-foreground` | 0 0% 100% | Text on card |
| `--popover` | 45 5% 7% | Popovers, menus |
| `--primary` | 45 100% 48% | CTA, focus ring, progress |
| `--primary-foreground` | 0 0% 4% | Text on primary |
| `--secondary` | 45 5% 13% | Secondary buttons |
| `--accent` | 45 100% 48% | Same as primary |
| `--success` | 142 71% 45% | Goal hit, positive delta |
| `--destructive` | 0 84% 60% | Error, cost, negative delta |
| `--warning` | 38 92% 50% | Soft warning |
| `--muted` | 45 5% 11% | Muted surface |
| `--muted-foreground` | 0 0% 63% | Secondary text |
| `--border` | 0 0% 12% | Card/input borders |
| `--ring` | 45 100% 48% | Focus ring |
| `--radius` | 1rem | Default card radius |

Hover-state glow tokens (`shadow-glow-*`) tinted to brand gold, not legacy purple/cyan.

## Typography scale

| Token | Px | Use |
|-------|----|-----|
| `text-xs` | 12 | **Floor**. Captions, badges, metadata. |
| `text-sm` | 14 | Secondary body |
| `text-base` | 16 | Body |
| `text-lg` | 18 | Card titles |
| `text-xl` | 20 | Section heads |
| `text-2xl` | 24 | Page heads |
| `text-3xl` / `text-4xl` | 30 / 36 | Hero number only |

Never use `text-[10px]` or `text-[11px]`. Hierarchy comes from weight + color + scale, not from undersize.

## Touch targets

Minimum **44 x 44 px** hit area on every interactive element. Wrap small icons in a larger interactive parent if needed (`h-11 w-11 p-2.5` etc).

## Motion

- **Transitions**: scope by intent. `transition-colors`, `transition-transform`, `transition-opacity`. Avoid `transition-all` unless three+ properties truly transition together.
- **Duration**: 150-300ms for state changes. 300-500ms for layout reveals. **Never 1000ms** on interactive feedback - feels broken.
- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` (Tailwind default `ease-in-out` / `ease-out`).
- **Decorative loops are banned by default.** No infinite shine sweeps, holographic shifts, or floating bobs in chrome. Decorative motion is allowed only on:
  - First-mount reveal (run once).
  - Hover/focus state (active only while interacting).
  - Genuine progress (the bar fills because the value changed).
- `prefers-reduced-motion` must be honored. The battery-saver class in `index.css` also disables motion - keep it.

## Anti-patterns (banned)

1. **`.gradient-text-gold` text-fill**: solid `text-primary font-bold` is enough.
2. **`.glass` outside the sticky header**: solid card + border is the default.
3. **Side-stripe `border-l-* border-primary`**: read as "AI category reflex". Use full subtle border or background tint.
4. **Identical-card-grid**: two cards with identical dims and weight communicate "filler". Use asymmetric layout when values differ in importance.
5. **Stacked hero metrics**: one hero per surface. Demote the rest.
6. **Emoji decoration in chrome strings**: `🔥💪⚡🌴` etc. Allowed only in user-generated content.
7. **`animate-shine-sweep`, `holographic-shift`, `animate-float` as ambient loops**: dead.
8. **Hardcoded hex (`#1A1A1A`, `#F4A100`, `#333333`, `#6B21A8`, etc.)**: always use tokens.
9. **`focus:outline-none` without `focus-visible:ring`**: keyboard accessibility regression.
10. **Custom modals**: use `@radix-ui/react-dialog` via `src/components/ui/dialog.tsx`. Never roll a fixed-inset div with backdrop click.
11. **Sub-12px text**: floor is `text-xs`.
12. **Modal-first for non-blocking info**: inline banner > modal interrupt.

## A11y baseline

- WCAG 2.1 AA on every shipped surface.
- 2.4.7 Focus Visible: every interactive element shows a visible focus ring on keyboard navigation.
- 2.5.5 Target Size: 44x44 minimum.
- 1.4.4 Resize Text: respects browser font scaling, never relies on absolute px below 12.
- 4.1.2 Name/Role/Value: dialogs use `role="dialog"`, buttons are `<button>`, not `<div onClick>`.
- 2.1.2 No Keyboard Trap: every dialog has Escape + focus trap (Radix gives this for free).

## Layout

- Mobile-first. Designed at 360 width, scales up.
- Safe-area utilities (`pt-safe`, `pb-safe`) on full-bleed surfaces for iOS notch / Android gesture bar.
- Sticky top header is the one purposeful "chrome" surface and may use `.glass`.

## When to deviate

Document the deviation in this file and link the file:line that breaks the rule. Otherwise the rule wins.
