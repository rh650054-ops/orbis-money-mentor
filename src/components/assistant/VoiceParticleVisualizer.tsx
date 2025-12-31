import { useRef, useEffect, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  opacity: number;
  phase: number;
}

interface VoiceParticleVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
  audioLevel?: number;
  className?: string;
}

export function VoiceParticleVisualizer({
  isListening,
  isSpeaking,
  audioLevel = 0,
  className = "",
}: VoiceParticleVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // Initialize particles
  const initParticles = useCallback((width: number, height: number) => {
    const particles: Particle[] = [];
    const centerX = width / 2;
    const centerY = height / 2;
    const particleCount = 80;

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const radius = 60 + Math.random() * 40;
      particles.push({
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: 2 + Math.random() * 3,
        baseRadius: 2 + Math.random() * 3,
        opacity: 0.4 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      });
    }
    particlesRef.current = particles;
  }, []);

  // Setup audio analyzer for microphone
  const setupAudioAnalyzer = useCallback(async () => {
    if (!isListening || audioContextRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch (error) {
      console.log("Audio analyzer not available:", error);
    }
  }, [isListening]);

  // Cleanup audio context
  const cleanupAudio = useCallback(() => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      analyserRef.current = null;
      dataArrayRef.current = null;
    }
  }, []);

  // Get current audio level
  const getAudioLevel = useCallback(() => {
    if (analyserRef.current && dataArrayRef.current) {
      const dataArray = dataArrayRef.current;
      analyserRef.current.getByteFrequencyData(dataArray as unknown as Uint8Array<ArrayBuffer>);
      let sum = 0;
      const len = dataArray.length;
      for (let i = 0; i < len; i++) {
        sum += dataArray[i];
      }
      const average = sum / len;
      return average / 255;
    }
    return audioLevel;
  }, [audioLevel]);

  // Animation loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear canvas with fade effect
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    ctx.fillRect(0, 0, width, height);

    const currentAudioLevel = getAudioLevel();
    const isActive = isListening || isSpeaking;
    const intensity = isActive ? 0.5 + currentAudioLevel * 2 : 0.2;
    const time = Date.now() * 0.001;

    // Update and draw particles
    particlesRef.current.forEach((particle, index) => {
      // Calculate distance from center
      const dx = particle.x - centerX;
      const dy = particle.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      // Orbit behavior
      const orbitSpeed = 0.002 + (isActive ? currentAudioLevel * 0.01 : 0);
      const newAngle = angle + orbitSpeed;

      // Pulsing radius based on audio
      const pulseRadius = isActive
        ? 60 + currentAudioLevel * 80 + Math.sin(time * 2 + particle.phase) * 20
        : 60 + Math.sin(time + particle.phase) * 10;

      // Smooth movement towards target position
      const targetX = centerX + Math.cos(newAngle) * pulseRadius;
      const targetY = centerY + Math.sin(newAngle) * pulseRadius;

      particle.x += (targetX - particle.x) * 0.05 + particle.vx;
      particle.y += (targetY - particle.y) * 0.05 + particle.vy;

      // Add some randomness when active
      if (isActive) {
        particle.vx += (Math.random() - 0.5) * currentAudioLevel * 0.5;
        particle.vy += (Math.random() - 0.5) * currentAudioLevel * 0.5;
      }

      // Dampen velocity
      particle.vx *= 0.95;
      particle.vy *= 0.95;

      // Update radius based on audio
      const targetRadius =
        particle.baseRadius * (1 + (isActive ? currentAudioLevel * 2 : 0));
      particle.radius += (targetRadius - particle.radius) * 0.1;

      // Draw particle
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);

      // Create gradient for glow effect
      const gradient = ctx.createRadialGradient(
        particle.x,
        particle.y,
        0,
        particle.x,
        particle.y,
        particle.radius * 2
      );

      const alpha = particle.opacity * intensity;
      gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      gradient.addColorStop(0.5, `rgba(200, 200, 255, ${alpha * 0.5})`);
      gradient.addColorStop(1, `rgba(150, 150, 255, 0)`);

      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw connecting lines to nearby particles
      particlesRef.current.forEach((other, otherIndex) => {
        if (index >= otherIndex) return;
        const odx = other.x - particle.x;
        const ody = other.y - particle.y;
        const dist = Math.sqrt(odx * odx + ody * ody);

        if (dist < 50) {
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(other.x, other.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${
            (1 - dist / 50) * 0.2 * intensity
          })`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });
    });

    // Draw center glow when active
    if (isActive) {
      const glowRadius = 30 + currentAudioLevel * 50;
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        glowRadius
      );
      gradient.addColorStop(0, `rgba(255, 255, 255, ${0.3 * intensity})`);
      gradient.addColorStop(0.5, `rgba(150, 150, 255, ${0.1 * intensity})`);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.beginPath();
      ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    animationRef.current = requestAnimationFrame(animate);
  }, [isListening, isSpeaking, getAudioLevel]);

  // Setup canvas and start animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
      initParticles(rect.width, rect.height);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [initParticles]);

  // Start/stop animation
  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  // Setup audio when listening
  useEffect(() => {
    if (isListening) {
      setupAudioAnalyzer();
    } else {
      cleanupAudio();
    }

    return () => {
      cleanupAudio();
    };
  }, [isListening, setupAudioAnalyzer, cleanupAudio]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ background: "transparent" }}
    />
  );
}
