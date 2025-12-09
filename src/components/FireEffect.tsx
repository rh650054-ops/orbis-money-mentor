import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface FireParticle {
  id: number;
  x: number;
  delay: number;
  size: number;
}

interface FireEffectProps {
  show: boolean;
  onComplete?: () => void;
}

export function FireEffect({ show, onComplete }: FireEffectProps) {
  const [particles, setParticles] = useState<FireParticle[]>([]);

  useEffect(() => {
    if (show) {
      // Generate fire particles
      const newParticles: FireParticle[] = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        size: Math.random() * 20 + 10,
      }));
      setParticles(newParticles);

      // Clean up after animation
      const timer = setTimeout(() => {
        setParticles([]);
        onComplete?.();
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute animate-fire-rise"
          style={{
            left: `${particle.x}%`,
            bottom: "-20px",
            animationDelay: `${particle.delay}s`,
          }}
        >
          <div
            className="fire-emoji"
            style={{
              fontSize: `${particle.size}px`,
            }}
          >
            🔥
          </div>
        </div>
      ))}
    </div>
  );
}

// CSS animations will be added to index.css
