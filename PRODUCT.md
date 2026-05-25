# Orbis Money Mentor — Product Brief

## What this is

Orbis is a **financial mentor PWA + Android app for autonomous sellers and small entrepreneurs in Brazil**. It is not a generic budgeting app and not a fintech wallet. The user is a person who hustles for daily revenue (food vendor, freelance service, small commerce, delivery, sales rep) and needs:

1. A **daily target to hit** and a record of whether they hit it.
2. A **monthly goal trajectory** so today's effort connects to a real number.
3. **Gamified accountability** (streaks, ranks, rewards) so habit forms without willpower.
4. **AI nudges** that interpret the numbers and tell them what to do next.

It is the dashboard they open when they wake up and the dashboard they close before sleep.

## Who uses it

- Brazilian, mobile-first, often on mid-range Android.
- Sells products or services for cash/PIX. Income variable, day to day.
- Not a finance professional. No spreadsheet habit. No appetite for jargon.
- Reads at a glance, on the bus or behind a counter. Will not read paragraphs.
- Sensitive to looking "scammy". A money product must look serious or they uninstall.

## Core surfaces

- **Index (dashboard)**: the room they spend most time in. One hero number (monthly revenue trajectory), secondary today number, gamified tier progress.
- **Daily Checklist / Routine**: morning commit, day-end report. Habit loop.
- **Defcon**: focused sales sprint mode (timer + quick-sale buttons).
- **Ranking / Competitions / Rewards**: social proof, retention.
- **Spot Finder**: locations + opportunities.
- **Finances / Transactions / History / Insights**: ledger + AI-generated takes.
- **Bank Connections (Pluggy)**: automated income capture.
- **MyAccount / Settings / Payment (Hotmart)**: profile + subscription.

## Anti-goals

- Do **not** look like a generic fintech mock. The category reflex (pure black + saturated gold + emoji shower + shine sweeps + holographic gradients + glassmorphism) is the first answer any AI design tool gives for "fintech app" and it screams "template". On a money product, that erodes trust on first open.
- Do **not** decorate over substance. Every animated sweep, glow, or emoji that does not communicate a state change is noise.
- Do **not** assume the user has 30 seconds. The screen must answer "am I winning today?" in under 2 seconds.
- Do **not** ship modal-first patterns for non-blocking info. Inline beats interrupt.

## Constraints

- Portuguese (Brazilian) UI strings. English only in code identifiers + this doc.
- Mobile-first. Designs must work at 360 wide. Touch targets >= 44px.
- Offline-tolerant: OfflineIndicator is shipped, write actions queue.
- PWA + Capacitor Android. No native iOS yet.
- Supabase backend, edge functions for AI (Anthropic) and webhooks.
- Free trial + Hotmart subscription gate. TrialExpiredModal must remain enforceable.

## Success looks like

- User opens app, sees one number, knows the answer, closes app. Done in 5 seconds.
- Daily streak unbroken for weeks because the loop is frictionless.
- The app feels like a tool a senior product designer at Nubank or Mercado Livre would ship - serious, restrained, calm.
