import { useMemo } from "react";

export function DustParticles({ count = 40 }: { count?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => {
        const size = 1 + Math.random() * 3;
        const left = Math.random() * 100;
        const duration = 18 + Math.random() * 28;
        const delay = -Math.random() * duration;
        const opacity = 0.15 + Math.random() * 0.5;
        const drift = (Math.random() - 0.5) * 120;
        return { i, size, left, duration, delay, opacity, drift };
      }),
    [count],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <span
          key={p.i}
          className="dust absolute bottom-[-10px] rounded-full bg-white"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            // @ts-expect-error custom prop
            "--o": p.opacity,
            "--x": `${p.drift}px`,
            filter: "blur(0.4px)",
          }}
        />
      ))}
    </div>
  );
}
