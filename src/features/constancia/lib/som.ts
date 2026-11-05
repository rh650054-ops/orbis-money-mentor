/* Sounds of the flame, made on the device (no audio file): a rising "charge", a bright chord when
   the number flips, a short "tlim" per week check and ice cracking when it unfreezes.
   Off when the seller turned it off in the app (orbis_som_constancia = "0"). */
export type SomChama = "carga" | "virou" | "check" | "gelo";

type Ctx = AudioContext;
let ctx: Ctx | null = null;

export function somLigado(): boolean {
  try { return localStorage.getItem("orbis_som_constancia") !== "0"; } catch { return true; }
}
export function ligarSom(on: boolean) {
  try { localStorage.setItem("orbis_som_constancia", on ? "1" : "0"); } catch { /* sem storage */ }
}

export function tocar(tipo: SomChama) {
  if (!somLigado()) return;
  try {
    const C = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return;
    ctx = ctx ?? new C();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    const tom = (freq: number, ini: number, dur: number, onda: OscillatorType, vol: number, freqFim?: number) => {
      const o = ctx!.createOscillator(); const g = ctx!.createGain();
      o.type = onda; o.frequency.setValueAtTime(freq, t + ini);
      if (freqFim) o.frequency.exponentialRampToValueAtTime(freqFim, t + ini + dur);
      g.gain.setValueAtTime(0.0001, t + ini);
      g.gain.exponentialRampToValueAtTime(vol, t + ini + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ini + dur);
      o.connect(g); g.connect(ctx!.destination); o.start(t + ini); o.stop(t + ini + dur + 0.05);
    };
    if (tipo === "carga") { tom(180, 0, 0.65, "sine", 0.18, 720); tom(360, 0.1, 0.55, "triangle", 0.06, 1100); }
    if (tipo === "virou") { tom(1318.5, 0, 0.5, "triangle", 0.22); tom(1760, 0.09, 0.7, "triangle", 0.2); tom(2637, 0.18, 0.9, "sine", 0.1); tom(110, 0, 0.35, "sine", 0.25, 55); }
    if (tipo === "check") tom(880, 0, 0.12, "triangle", 0.12, 1320);
    if (tipo === "gelo") { tom(2200, 0, 0.08, "square", 0.05, 900); tom(1500, 0.06, 0.1, "square", 0.05, 600); tom(900, 0.14, 0.25, "triangle", 0.08, 300); }
  } catch { /* sem áudio neste aparelho */ }
}
