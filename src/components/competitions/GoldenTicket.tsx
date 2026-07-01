import { useEffect, useRef, useState } from "react";

export interface MiniPrize {
  valor: string;
  label: string;
  badge?: string;
  badgeTone?: "sub" | "hot" | "red";
}
export interface CommissionTier {
  nome: string;
  val: string;
}

interface Props {
  introTag?: string;
  introTitulo: string;
  introSub?: string;
  eventoLabel?: string;
  ticketNumber?: string;
  ticketTitulo?: string;
  grandPrizeLabel?: string;
  grandPrizeValue: string;
  grandPrizeDesc?: string;
  grandPrizeBadge?: string;
  grandPrizeBadgeTone?: "sub" | "hot" | "red";
  miniPrizes?: MiniPrize[];
  commissionTitle?: string;
  commissionTiers?: CommissionTier[];
  commissionNote?: string;
  commissionHighlight?: string;
  commissionBadge?: string;
  commissionBadgeTone?: "sub" | "hot" | "red";
  whatsappLabel?: string;
  onWhatsapp?: () => void;
  acceptLabel?: string;
  onAccept: () => void;
}

// Toca um "chime" dourado de desbloqueio (sintetizado). Respeita o ajuste de sons do app.
function playUnlockSound() {
  try {
    if (localStorage.getItem("orbis_sounds_enabled") === "false") return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      const t = now + i * 0.09;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.5);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1600);
  } catch {
    /* noop */
  }
}

const CSS = `
.obt { font-family: 'DM Sans', sans-serif; color: #fff; -webkit-user-select: none; user-select: none; }
.obt-ambient { position:absolute; inset:0; z-index:1; background: radial-gradient(ellipse 90% 50% at 50% 35%, rgba(201,168,76,0.15) 0%, transparent 55%); animation: obtAmbient 4s ease-in-out infinite; }
@keyframes obtAmbient { 0%,100%{opacity:.6} 50%{opacity:1} }
.obt-canvas { position:absolute; inset:0; z-index:2; pointer-events:none; }
.obt-rays { position:absolute; inset:0; z-index:1; opacity:0; transition:opacity 1s; overflow:hidden; }
.obt-rays.show { opacity:.5; }
.obt-ray { position:absolute; top:30%; left:50%; transform-origin:top center; width:2px; height:400px; background:linear-gradient(to bottom, rgba(245,215,142,.4), transparent); }
.obt-flash { position:absolute; inset:0; z-index:4; background:#F5D78E; opacity:0; pointer-events:none; }
.obt-flash.fire { animation: obtFlash .6s ease-out; }
@keyframes obtFlash { 0%{opacity:0} 15%{opacity:.9} 100%{opacity:0} }
.obt-stage { position:relative; z-index:3; min-height:90vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 24px; transition:opacity .5s, transform .5s; }
.obt-intro-tag { font-size:10px; letter-spacing:5px; color:#C9A84C; text-transform:uppercase; margin-bottom:14px; text-align:center; position:relative; }
.obt-intro-tag::before,.obt-intro-tag::after { content:''; position:absolute; top:50%; width:20px; height:1px; background:linear-gradient(90deg, transparent, rgba(201,168,76,.6)); }
.obt-intro-tag::before { left:-28px; } .obt-intro-tag::after { right:-28px; transform:scaleX(-1); }
.obt-intro-titulo { font-family:'Bebas Neue',sans-serif; font-size:32px; letter-spacing:2px; text-align:center; line-height:1; margin-bottom:10px; background:linear-gradient(135deg,#C9A84C 0%,#F5D78E 50%,#C9A84C 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; filter:drop-shadow(0 0 20px rgba(201,168,76,.3)); }
.obt-intro-sub { font-size:13px; color:#999; text-align:center; line-height:1.5; margin-bottom:36px; max-width:250px; }
.obt-ticket-3d { perspective:1000px; }
.obt-ticket { width:290px; position:relative; border-radius:22px; overflow:hidden; background:linear-gradient(135deg,#0F0B04 0%,#2A2008 25%,#4A3810 50%,#2A2008 75%,#0F0B04 100%); box-shadow:0 0 50px rgba(201,168,76,.25), inset 0 1px 0 rgba(245,215,142,.4), inset 0 -1px 0 rgba(0,0,0,.5); animation: obtFloat 4s ease-in-out infinite; transform-style:preserve-3d; }
.obt-ticket::after { content:''; position:absolute; inset:0; border-radius:22px; padding:1.5px; background:linear-gradient(135deg, rgba(245,215,142,.8), rgba(201,168,76,.2), rgba(245,215,142,.8)); -webkit-mask:linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite:xor; mask-composite:exclude; pointer-events:none; }
@keyframes obtFloat { 0%,100%{transform:translateY(0) rotateX(0) rotateY(-2deg)} 50%{transform:translateY(-10px) rotateX(2deg) rotateY(2deg)} }
.obt-ticket-shine { position:absolute; top:-50%; left:-100%; width:50%; height:200%; background:linear-gradient(90deg, transparent, rgba(245,215,142,.35), transparent); transform:rotate(25deg); animation: obtShine 4s ease-in-out infinite; }
@keyframes obtShine { 0%{left:-100%} 45%,100%{left:200%} }
.obt-ticket-texture { position:absolute; inset:0; opacity:.06; mix-blend-mode:overlay; background-image:repeating-linear-gradient(45deg,#C9A84C 0,#C9A84C 1px,transparent 1px,transparent 8px); }
.obt-ticket-top { padding:26px 24px 18px; text-align:center; border-bottom:1.5px dashed rgba(201,168,76,.35); position:relative; }
.obt-notch-l,.obt-notch-r { position:absolute; bottom:-10px; width:20px; height:20px; border-radius:50%; background:#030303; z-index:2; }
.obt-notch-l { left:-10px; } .obt-notch-r { right:-10px; }
.obt-ticket-logo { font-family:'Bebas Neue',sans-serif; font-size:28px; letter-spacing:7px; background:linear-gradient(135deg,#C9A84C,#F5D78E,#C9A84C); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; margin-bottom:5px; filter:drop-shadow(0 0 10px rgba(201,168,76,.4)); }
.obt-ticket-evento { font-size:9px; letter-spacing:3px; color:rgba(245,215,142,.7); text-transform:uppercase; }
.obt-ticket-body { padding:22px 24px 26px; text-align:center; position:relative; }
.obt-ticket-num { position:absolute; top:12px; right:16px; font-size:8px; letter-spacing:1px; color:rgba(245,215,142,.4); }
.obt-ticket-sel { font-size:10px; letter-spacing:3px; color:rgba(245,215,142,.6); text-transform:uppercase; margin-bottom:8px; }
.obt-ticket-titulo { font-family:'Bebas Neue',sans-serif; font-size:30px; letter-spacing:1px; color:#F5D78E; line-height:1; margin-bottom:10px; filter:drop-shadow(0 0 12px rgba(245,215,142,.4)); }
.obt-ticket-frase { font-size:11px; color:rgba(255,255,255,.45); line-height:1.5; margin-bottom:18px; }
.obt-ticket-seal { width:60px; height:60px; border-radius:50%; margin:0 auto; background:radial-gradient(circle, rgba(245,215,142,.3), rgba(201,168,76,.08)); border:1.5px solid rgba(245,215,142,.5); display:flex; align-items:center; justify-content:center; font-size:28px; animation: obtSeal 2s ease-in-out infinite; }
@keyframes obtSeal { 0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,.4)} 50%{box-shadow:0 0 0 8px rgba(201,168,76,0)} }
.obt-unlock { margin-top:32px; width:290px; background:rgba(0,0,0,.5); border:1.5px solid rgba(201,168,76,.35); border-radius:40px; padding:6px; position:relative; overflow:hidden; box-shadow:inset 0 2px 8px rgba(0,0,0,.5); }
.obt-unlock-text { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:11px; letter-spacing:3px; color:rgba(245,215,142,.55); text-transform:uppercase; white-space:nowrap; pointer-events:none; animation: obtTextPulse 2s ease-in-out infinite; }
@keyframes obtTextPulse { 0%,100%{opacity:.4} 50%{opacity:.9} }
.obt-unlock-fill { position:absolute; top:6px; left:6px; bottom:6px; width:58px; border-radius:40px; z-index:1; pointer-events:none; background:linear-gradient(90deg, rgba(201,168,76,.4), rgba(245,215,142,.25)); }
.obt-unlock-handle { width:58px; height:58px; border-radius:50%; background:linear-gradient(135deg,#F5D78E,#C9A84C); display:flex; align-items:center; justify-content:center; font-size:22px; color:#1A1408; cursor:grab; position:relative; z-index:2; box-shadow:0 0 24px rgba(201,168,76,.6), inset 0 1px 0 rgba(255,255,255,.4); touch-action:none; }
.obt-unlock-handle:active { cursor:grabbing; }
.obt-revealed { position:absolute; inset:0; z-index:5; background:radial-gradient(ellipse 100% 60% at 50% 15%, rgba(201,168,76,.18) 0%, transparent 55%), #030303; display:flex; flex-direction:column; padding:30px 22px 120px; overflow-y:auto; opacity:0; pointer-events:none; }
.obt-revealed.show { opacity:1; pointer-events:auto; }
.obt-rev-item { opacity:0; transform:translateY(20px); }
.obt-revealed.show .obt-rev-item { animation: obtRevIn .6s ease forwards; }
.obt-revealed.show .obt-rev-item:nth-child(1){animation-delay:.3s}
.obt-revealed.show .obt-rev-item:nth-child(2){animation-delay:.6s}
.obt-revealed.show .obt-rev-item:nth-child(3){animation-delay:.9s}
.obt-revealed.show .obt-rev-item:nth-child(4){animation-delay:1.2s}
.obt-revealed.show .obt-rev-item:nth-child(5){animation-delay:1.5s}
@keyframes obtRevIn { to { opacity:1; transform:translateY(0); } }
.obt-rev-header { text-align:center; margin-bottom:22px; }
.obt-rev-tag { font-size:10px; letter-spacing:4px; color:#C9A84C; text-transform:uppercase; margin-bottom:8px; }
.obt-rev-logo { font-family:'Bebas Neue',sans-serif; font-size:38px; letter-spacing:5px; background:linear-gradient(135deg,#C9A84C,#F5D78E,#C9A84C); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; line-height:1; margin-bottom:4px; filter:drop-shadow(0 0 16px rgba(201,168,76,.4)); }
.obt-rev-sub { font-size:11px; color:#888; letter-spacing:2px; }
.obt-prize-big { background:linear-gradient(135deg, rgba(201,168,76,.18), rgba(201,168,76,.04)); border:1.5px solid rgba(201,168,76,.45); border-radius:20px; padding:24px; text-align:center; margin-bottom:12px; position:relative; }
.obt-prize-label { font-size:9px; letter-spacing:3px; color:rgba(245,215,142,.8); text-transform:uppercase; margin-bottom:6px; }
.obt-prize-valor { font-family:'Bebas Neue',sans-serif; font-size:64px; letter-spacing:2px; color:#F8DFA0; -webkit-text-fill-color:#F8DFA0; line-height:1; text-shadow:0 0 26px rgba(201,168,76,.55); }
@keyframes obtPrizeGlow { 0%,100%{filter:drop-shadow(0 0 24px rgba(201,168,76,.4))} 50%{filter:drop-shadow(0 0 40px rgba(201,168,76,.7))} }
.obt-prize-desc { font-size:12.5px; color:#F5D78E; margin-top:7px; font-weight:600; letter-spacing:.3px; }
.obt-prize-row { display:flex; gap:10px; margin-bottom:12px; }
.obt-prize-mini { flex:1; background:rgba(255,255,255,.03); border:.5px solid rgba(201,168,76,.25); border-radius:16px; padding:16px; text-align:center; }
.obt-prize-mini-valor { font-family:'Bebas Neue',sans-serif; font-size:30px; letter-spacing:1px; color:#F8DFA0; -webkit-text-fill-color:#F8DFA0; text-shadow:0 0 14px rgba(201,168,76,.4); }
.obt-prize-mini-lbl { font-size:9px; color:#888; letter-spacing:1px; margin-top:3px; line-height:1.3; white-space:pre-line; }
.obt-comissao { background:linear-gradient(160deg, rgba(201,168,76,.1), rgba(255,255,255,.015)); border:1px solid rgba(201,168,76,.32); border-radius:18px; padding:18px 16px 16px; margin-bottom:16px; box-shadow:inset 0 1px 0 rgba(245,215,142,.15); }
.obt-comissao-titulo { font-size:11px; letter-spacing:2px; color:#F5D78E; text-transform:uppercase; margin-bottom:14px; text-align:center; font-weight:700; }
.obt-comissao-item { display:flex; justify-content:space-between; align-items:center; padding:10px 13px; margin-bottom:7px; border-radius:12px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.05); }
.obt-comissao-item:last-child { margin-bottom:0; }
.obt-comissao-item.top { background:linear-gradient(135deg, rgba(201,168,76,.22), rgba(245,215,142,.05)); border:1px solid rgba(245,215,142,.55); box-shadow:0 0 20px rgba(201,168,76,.28); }
.obt-comissao-nome { font-size:12.5px; color:#dcdcdc; display:flex; align-items:center; gap:8px; }
.obt-comissao-tag { font-size:7px; letter-spacing:.8px; font-weight:800; color:#1a1408; background:linear-gradient(135deg,#F5D78E,#C9A84C); padding:2px 6px; border-radius:5px; text-transform:uppercase; white-space:nowrap; }
.obt-comissao-val { font-family:'Bebas Neue',sans-serif; font-size:26px; letter-spacing:1px; color:#F8DFA0; -webkit-text-fill-color:#F8DFA0; }
.obt-comissao-hl { margin-top:13px; background:rgba(52,211,153,.09); border:1px solid rgba(52,211,153,.32); border-radius:12px; padding:12px 14px; text-align:center; font-size:12px; color:#cfe9dd; line-height:1.5; }
.obt-comissao-note { text-align:center; font-size:10px; color:#777; margin-top:11px; line-height:1.4; }
.obt-wpp { width:100%; margin-top:12px; padding:13px; border-radius:13px; background:#25D366; color:#04160c; font-weight:800; font-size:13.5px; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 0 22px rgba(37,211,102,.35); }
.obt-btn-aceitar { width:100%; padding:16px; border-radius:14px; background:linear-gradient(135deg,#C9A84C,#F5D78E); color:#000; font-weight:700; font-size:15px; letter-spacing:1px; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; box-shadow:0 0 30px rgba(201,168,76,.4); margin-top:auto; animation: obtBtn 2s ease-in-out infinite; }
@keyframes obtBtn { 0%,100%{box-shadow:0 0 24px rgba(201,168,76,.3)} 50%{box-shadow:0 0 44px rgba(201,168,76,.6)} }
.obt-badge { display:inline-block; font-size:8.5px; letter-spacing:1.2px; font-weight:800; padding:3px 9px; border-radius:6px; text-transform:uppercase; margin-top:9px; }
.obt-badge-sub { background:rgba(201,168,76,.09); border:1px solid rgba(201,168,76,.28); color:rgba(201,168,76,.72); }
.obt-badge-hot { background:rgba(52,211,153,.16); border:1px solid #34D399; color:#5df0bd; box-shadow:0 0 12px rgba(52,211,153,.35); animation:obtBadgePulse 1.6s ease-in-out infinite; }
.obt-badge-red { background:rgba(239,68,68,.16); border:1px solid rgba(239,68,68,.7); color:#ff9b9b; box-shadow:0 0 16px rgba(239,68,68,.35); padding:4px 12px; font-size:9px; }
@keyframes obtBadgePulse { 0%,100%{box-shadow:0 0 8px rgba(52,211,153,.3)} 50%{box-shadow:0 0 18px rgba(52,211,153,.6)} }
`;

export function GoldenTicket({
  introTag = "Você foi selecionado",
  introTitulo,
  introSub = "Um dos pioneiros do maior movimento de vendedores do Brasil.",
  eventoLabel = "Bilhete de Acesso · Pioneiro",
  ticketNumber = "001",
  ticketTitulo = "VOCÊ ESTÁ DENTRO",
  grandPrizeLabel = "🏆 Grande Prêmio",
  grandPrizeValue,
  grandPrizeDesc,
  grandPrizeBadge,
  grandPrizeBadgeTone,
  miniPrizes = [],
  commissionTitle,
  commissionTiers = [],
  commissionNote,
  commissionHighlight,
  commissionBadge,
  commissionBadgeTone,
  whatsappLabel,
  onWhatsapp,
  acceptLabel = "ACEITAR O DESAFIO →",
  onAccept,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const [flash, setFlash] = useState(false);
  const [raysShow, setRaysShow] = useState(false);
  const [stageOut, setStageOut] = useState(false);
  const [handleIcon, setHandleIcon] = useState("🔓");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const burstRef = useRef<(() => void) | null>(null);
  const drag = useRef({ on: false, startX: 0, max: 0, done: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ambient = Array.from({ length: 40 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.3, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15,
      o: Math.random() * 0.4 + 0.2, p: Math.random() * Math.PI * 2,
    }));
    let burst: Array<{ x: number; y: number; vx: number; vy: number; r: number; life: number; o: number }> = [];
    burstRef.current = () => {
      const cx = canvas.width / 2, cy = canvas.height * 0.4;
      for (let i = 0; i < 80; i++) {
        const a = Math.random() * Math.PI * 2, sp = Math.random() * 8 + 3;
        burst.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: Math.random() * 2.5 + 1, life: 1, o: 1 });
      }
    };
    const draw = () => {
      if (!canvas.width) resize();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ambient.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.p += 0.02;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r + Math.sin(p.p) * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,168,76,${p.o + Math.sin(p.p) * 0.1})`; ctx.fill();
      });
      burst = burst.filter((b) => b.life > 0);
      burst.forEach((b) => {
        b.x += b.vx; b.y += b.vy; b.vy += 0.15; b.vx *= 0.98; b.life -= 0.012; b.o = b.life;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * b.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${Math.random() > 0.5 ? "245,215,142" : "201,168,76"},${b.o})`; ctx.fill();
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

  const complete = () => {
    if (drag.current.done) return;
    drag.current.done = true;
    drag.current.on = false;
    setHandleIcon("🔥");
    playUnlockSound();
    if (navigator.vibrate) navigator.vibrate([40, 30, 80]);
    burstRef.current?.();
    setFlash(true);
    setRaysShow(true);
    setStageOut(true);
    setTimeout(() => setRevealed(true), 400);
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current.done) return;
    const track = trackRef.current, handle = handleRef.current;
    if (!track || !handle) return;
    drag.current = { on: true, startX: e.clientX, max: track.offsetWidth - handle.offsetWidth - 12, done: false };
    handle.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.on) return;
    const delta = Math.max(0, Math.min(e.clientX - d.startX, d.max));
    if (handleRef.current) handleRef.current.style.transform = `translateX(${delta}px)`;
    if (fillRef.current) fillRef.current.style.width = `${58 + delta}px`;
    if (delta >= d.max - 4) complete();
  };
  const onUp = () => {
    const d = drag.current;
    if (!d.on || d.done) return;
    d.on = false;
    const handle = handleRef.current, fill = fillRef.current;
    if (handle && fill) {
      handle.style.transition = "transform 0.3s"; fill.style.transition = "width 0.3s";
      handle.style.transform = "translateX(0)"; fill.style.width = "58px";
      setTimeout(() => { handle.style.transition = ""; fill.style.transition = ""; }, 300);
    }
  };

  return (
    <div className="obt" style={{ position: "relative", width: "100%", minHeight: "100vh", overflow: "hidden", background: "#030303" }}>
      <style>{CSS}</style>
      <div className="obt-ambient" />
      <div className={`obt-rays ${raysShow ? "show" : ""}`}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="obt-ray" style={{ transform: `rotate(${i * 30}deg)` }} />
        ))}
      </div>
      <canvas ref={canvasRef} className="obt-canvas" />
      <div className={`obt-flash ${flash ? "fire" : ""}`} />

      <div className="obt-stage" style={{ opacity: stageOut ? 0 : 1, transform: stageOut ? "scale(1.1)" : "scale(1)" }}>
        <div className="obt-intro-tag">{introTag}</div>
        <div className="obt-intro-titulo">{introTitulo}</div>
        {introSub && <div className="obt-intro-sub">{introSub}</div>}

        <div className="obt-ticket-3d">
          <div className="obt-ticket">
            <div className="obt-ticket-shine" />
            <div className="obt-ticket-texture" />
            <div className="obt-ticket-top">
              <div className="obt-ticket-logo">ORBIS</div>
              <div className="obt-ticket-evento">{eventoLabel}</div>
              <div className="obt-notch-l" />
              <div className="obt-notch-r" />
            </div>
            <div className="obt-ticket-body">
              <div className="obt-ticket-num">Nº {ticketNumber}</div>
              <div className="obt-ticket-sel">Convite exclusivo</div>
              <div className="obt-ticket-titulo">{ticketTitulo}</div>
              <div className="obt-ticket-frase">Desbloqueie para revelar seus prêmios</div>
              <div className="obt-ticket-seal">🎟️</div>
            </div>
          </div>
        </div>

        <div className="obt-unlock" ref={trackRef}>
          <div className="obt-unlock-fill" ref={fillRef} />
          <div className="obt-unlock-text">ARRASTE PARA DESBLOQUEAR →</div>
          <div className="obt-unlock-handle" ref={handleRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            {handleIcon}
          </div>
        </div>
      </div>

      <div className={`obt-revealed ${revealed ? "show" : ""}`}>
        <div className="obt-rev-header obt-rev-item">
          <div className="obt-rev-tag">{introTitulo}</div>
          <div className="obt-rev-logo">ORBIS</div>
          <div className="obt-rev-sub">SEUS PRÊMIOS DESBLOQUEADOS</div>
        </div>

        <div className="obt-prize-big obt-rev-item">
          <div className="obt-prize-label">{grandPrizeLabel}</div>
          <div className="obt-prize-valor">{grandPrizeValue}</div>
          {grandPrizeDesc && <div className="obt-prize-desc">{grandPrizeDesc}</div>}
          {grandPrizeBadge && <div className={`obt-badge obt-badge-${grandPrizeBadgeTone || "sub"}`}>{grandPrizeBadge}</div>}
        </div>

        {miniPrizes.length > 0 && (
          <div className="obt-prize-row obt-rev-item">
            {miniPrizes.map((m, i) => (
              <div className="obt-prize-mini" key={i}>
                <div className="obt-prize-mini-valor">{m.valor}</div>
                <div className="obt-prize-mini-lbl">{m.label}</div>
                {m.badge && <div className={`obt-badge obt-badge-${m.badgeTone || "sub"}`}>{m.badge}</div>}
              </div>
            ))}
          </div>
        )}

        {commissionTiers.length > 0 && (
          <div className="obt-comissao obt-rev-item">
            {commissionTitle && <div className="obt-comissao-titulo">{commissionTitle}</div>}
            {commissionBadge && (
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <span className={`obt-badge obt-badge-${commissionBadgeTone || "sub"}`} style={{ marginTop: 0 }}>{commissionBadge}</span>
              </div>
            )}
            {commissionTiers.map((t, i) => {
              const isTop = i === commissionTiers.length - 1;
              return (
                <div className={`obt-comissao-item${isTop ? " top" : ""}`} key={i}>
                  <span className="obt-comissao-nome">
                    {t.nome}
                    {isTop && <span className="obt-comissao-tag">Maior margem</span>}
                  </span>
                  <span className="obt-comissao-val">{t.val}</span>
                </div>
              );
            })}
            {commissionHighlight && <div className="obt-comissao-hl">{commissionHighlight}</div>}
            {commissionNote && <div className="obt-comissao-note">{commissionNote}</div>}
            {onWhatsapp && (
              <button className="obt-wpp" onClick={onWhatsapp}>
                📲 {whatsappLabel || "Pegar meu link de afiliado"}
              </button>
            )}
          </div>
        )}

        <button className="obt-btn-aceitar obt-rev-item" onClick={onAccept}>{acceptLabel}</button>
      </div>
    </div>
  );
}
