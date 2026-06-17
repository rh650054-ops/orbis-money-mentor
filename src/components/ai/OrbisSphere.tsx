import { useEffect, useRef } from "react";

export type SphereState = "idle" | "listening" | "processing" | "responding";

interface OrbisSphereProps {
  /** Tamanho do canvas em px (lado). 180 = modo voz, 36 = header, 20 = mensagem. */
  size?: number;
  state?: SphereState;
  /** Velocidade base da rotação. */
  speed?: number;
  /** Cor base das partículas. */
  color?: string;
  className?: string;
}

interface Particle {
  theta: number;
  phi: number;
  baseR: number;
  speed: number;
  phiSpeed: number;
  size: number;
  opacity: number;
  pulse: number;
  pulseSpeed: number;
}

/**
 * Esfera de partículas douradas — o "rosto" da Orbis IA.
 * Canvas puro, sem dependências. Reage ao estado (ouvindo/processando/respondendo).
 */
export function OrbisSphere({
  size = 180,
  state = "idle",
  speed = 1,
  color = "#C9A84C",
  className,
}: OrbisSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SphereState>(state);
  const rafRef = useRef<number>(0);

  // Mantém o estado atual acessível dentro do loop sem recriar a animação.
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const count = size > 100 ? 180 : size > 30 ? 60 : 20;
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = size * 0.38 * (0.7 + Math.random() * 0.3);
      particles.push({
        theta,
        phi,
        baseR: r,
        speed: (Math.random() - 0.5) * 0.003 * speed,
        phiSpeed: (Math.random() - 0.5) * 0.002 * speed,
        size: Math.random() * (size > 100 ? 1.8 : size > 30 ? 1.2 : 0.8) + 0.3,
        opacity: Math.random() * 0.6 + 0.3,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03,
      });
    }

    let rotation = 0;
    let stateTime = 0;
    const cx = size / 2;
    const cy = size / 2;

    const animate = () => {
      const st = stateRef.current;
      ctx.clearRect(0, 0, size, size);
      stateTime += 0.016;
      rotation += 0.004 * speed;
      if (st === "processing") rotation += 0.012 * speed;

      // Glow central
      const glowSize = size * 0.28;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize);
      grad.addColorStop(0, "rgba(201,168,76,0.06)");
      grad.addColorStop(1, "rgba(201,168,76,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowSize, 0, Math.PI * 2);
      ctx.fill();

      const projected = particles.map((p) => {
        p.theta += p.speed;
        p.phi += p.phiSpeed * 0.3;
        p.pulse += p.pulseSpeed;

        let r = p.baseR;
        if (st === "listening") r = p.baseR * (1 + Math.sin(stateTime * 3 + p.pulse) * 0.15);
        if (st === "responding") r = p.baseR * (1 + Math.sin(stateTime * 2 + p.pulse) * 0.08);

        const cosTheta = Math.cos(p.theta + rotation);
        const sinTheta = Math.sin(p.theta + rotation);
        const sinPhi = Math.sin(p.phi);
        const cosPhi = Math.cos(p.phi);

        const x = r * sinPhi * cosTheta;
        const y = r * sinPhi * sinTheta;
        const z = r * cosPhi;

        const perspective = (size * 0.8) / (size * 0.8 + z + size * 0.4);
        const sx = cx + x * perspective;
        const sy = cy + y * perspective;
        const depth = (z + r) / (2 * r);
        const opacity = p.opacity * (0.3 + depth * 0.7);
        const ps = p.size * perspective * (0.8 + depth * 0.4);

        return { sx, sy, z, opacity, ps, pulse: p.pulse };
      });

      projected.sort((a, b) => a.z - b.z);

      projected.forEach((p) => {
        const pulse = st === "processing" ? Math.sin(p.pulse * 3) * 0.3 + 0.7 : 1;
        ctx.globalAlpha = p.opacity * pulse;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, Math.max(p.ps, 0.3), 0, Math.PI * 2);
        ctx.fill();

        if (p.ps > 0.8 && size > 50) {
          ctx.globalAlpha = p.opacity * 0.15 * pulse;
          ctx.fillStyle = "#F5D78E";
          ctx.beginPath();
          ctx.arc(p.sx - p.ps * 0.3, p.sy - p.ps * 0.3, p.ps * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [size, speed, color]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: size, height: size, display: "block" }}
    />
  );
}

export default OrbisSphere;
