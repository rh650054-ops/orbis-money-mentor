import { useEffect, useRef } from "react";
import { readThemeColor } from "@/shared/lib/theme-colors";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  phase: number;
}

export default function GoldParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rootStyle = getComputedStyle(document.documentElement);
    const primaryRaw = rootStyle.getPropertyValue("--primary").trim();
    const particleHsl = (alpha: number) => `hsl(${primaryRaw} / ${alpha})`;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * pixelRatio;
      canvas.height = window.innerHeight * pixelRatio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    if (particlesRef.current.length === 0) {
      const isSmallMobile = window.innerWidth <= 430;
      particlesRef.current = Array.from({ length: isSmallMobile ? 28 : 46 }, () => ({
        x: Math.random() * W(),
        y: Math.random() * H(),
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        size: Math.random() * 1.3 + 0.9,
        opacity: Math.random() * 0.35 + 0.35,
        phase: Math.random() * Math.PI * 2,
      }));
    }
    const particles = particlesRef.current;

    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W(), H());
      t += 0.01;

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        const pi = particles[i]!;
        for (let j = i + 1; j < particles.length; j++) {
          const pj = particles[j]!;
          const dx = pi.x - pj.x;
          const dy = pi.y - pj.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = particleHsl(0.1 * (1 - dist / 120));
            ctx.lineWidth = 0.5;
            ctx.moveTo(pi.x, pi.y);
            ctx.lineTo(pj.x, pj.y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W();
        if (p.x > W()) p.x = 0;
        if (p.y < 0) p.y = H();
        if (p.y > H()) p.y = 0;

        const breathSize = p.size + Math.sin(t * 2 + p.phase) * 0.75;
        ctx.beginPath();
        ctx.arc(p.x, p.y, breathSize, 0, Math.PI * 2);
        ctx.fillStyle = particleHsl(p.opacity);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ background: `radial-gradient(ellipse at center, ${readThemeColor("--card")} 0%, ${readThemeColor("--background")} 70%)` }}
    />
  );
}
