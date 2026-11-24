import React, { useEffect, useRef } from 'react';
import { CursorEffectId, ThemeId } from '../types';

interface CursorBackgroundProps {
  effect: CursorEffectId;
  theme: ThemeId;
}

interface Palette {
  primary: string;
  secondary: string;
  ring: string;
  gridLine: string;
  particleRgb: string;
  lineRgb: string;
  spotlight: string;
  crosshairLine: string;
  crosshairDot: string;
}

const THEME_PALETTES: Record<ThemeId, Palette> = {
  dark: {
    primary: 'rgba(59, 130, 246, 0.22)',
    secondary: 'rgba(99, 102, 241, 0.14)',
    ring: 'rgba(56, 189, 248, 0.16)',
    gridLine: 'rgba(148, 163, 184, 0.08)',
    particleRgb: '147, 197, 253',
    lineRgb: '96, 165, 250',
    spotlight: 'rgba(59, 130, 246, 0.18)',
    crosshairLine: 'rgba(147, 197, 253, 0.2)',
    crosshairDot: 'rgba(56, 189, 248, 0.65)',
  },
  light: {
    primary: 'rgba(37, 99, 235, 0.14)',
    secondary: 'rgba(99, 102, 241, 0.1)',
    ring: 'rgba(37, 99, 235, 0.14)',
    gridLine: 'rgba(15, 23, 42, 0.065)',
    particleRgb: '37, 99, 235',
    lineRgb: '59, 130, 246',
    spotlight: 'rgba(37, 99, 235, 0.11)',
    crosshairLine: 'rgba(15, 23, 42, 0.16)',
    crosshairDot: 'rgba(37, 99, 235, 0.55)',
  },
  monochrome: {
    primary: 'rgba(244, 244, 245, 0.16)',
    secondary: 'rgba(161, 161, 170, 0.11)',
    ring: 'rgba(255, 255, 255, 0.14)',
    gridLine: 'rgba(255, 255, 255, 0.06)',
    particleRgb: '244, 244, 245',
    lineRgb: '212, 212, 216',
    spotlight: 'rgba(255, 255, 255, 0.13)',
    crosshairLine: 'rgba(244, 244, 245, 0.14)',
    crosshairDot: 'rgba(255, 255, 255, 0.5)',
  },
  bw: {
    primary: 'rgba(255, 255, 255, 0.18)',
    secondary: 'rgba(255, 255, 255, 0.1)',
    ring: 'rgba(255, 255, 255, 0.18)',
    gridLine: 'rgba(255, 255, 255, 0.08)',
    particleRgb: '255, 255, 255',
    lineRgb: '229, 229, 229',
    spotlight: 'rgba(255, 255, 255, 0.15)',
    crosshairLine: 'rgba(255, 255, 255, 0.2)',
    crosshairDot: 'rgba(255, 255, 255, 0.7)',
  },
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export const CursorBackground: React.FC<CursorBackgroundProps> = ({ effect, theme }) => {
  const primaryOrbRef = useRef<HTMLDivElement | null>(null);
  const trailingOrbRef = useRef<HTMLDivElement | null>(null);
  const gridRevealRef = useRef<HTMLDivElement | null>(null);
  const spotlightRef = useRef<HTMLDivElement | null>(null);
  const crossHRef = useRef<HTMLDivElement | null>(null);
  const crossVRef = useRef<HTMLDivElement | null>(null);
  const crossReticleRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const palette = THEME_PALETTES[theme] ?? THEME_PALETTES.monochrome;

  // DOM-based effects: aurora-grid, spotlight, crosshair
  useEffect(() => {
    if (effect !== 'aurora-grid' && effect !== 'spotlight' && effect !== 'crosshair') return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    if (reducedMotion || coarsePointer) return;

    let targetX = window.innerWidth * 0.5;
    let targetY = window.innerHeight * 0.35;
    let curX = targetX;
    let curY = targetY;
    let trailX = targetX;
    let trailY = targetY;
    let active = false;
    let rafId = 0;

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      targetX = e.clientX;
      targetY = e.clientY;
      active = true;
    };

    const onPointerLeave = () => {
      active = false;
    };

    const tick = () => {
      const ease = effect === 'crosshair' ? 0.28 : 0.14;
      curX += (targetX - curX) * ease;
      curY += (targetY - curY) * ease;
      trailX += (targetX - trailX) * 0.06;
      trailY += (targetY - trailY) * 0.06;

      if (effect === 'aurora-grid') {
        if (primaryOrbRef.current) {
          primaryOrbRef.current.style.transform = `translate3d(${curX - 240}px, ${curY - 240}px, 0)`;
          primaryOrbRef.current.style.opacity = active ? '1' : '0.45';
        }
        if (trailingOrbRef.current) {
          trailingOrbRef.current.style.transform = `translate3d(${trailX - 310}px, ${
            trailY - 310
          }px, 0)`;
          trailingOrbRef.current.style.opacity = active ? '0.9' : '0.35';
        }
        if (gridRevealRef.current) {
          const mask = `radial-gradient(280px circle at ${curX}px ${curY}px, rgba(0,0,0,0.95) 0%, transparent 100%)`;
          gridRevealRef.current.style.webkitMaskImage = mask;
          gridRevealRef.current.style.maskImage = mask;
          gridRevealRef.current.style.opacity = active ? '1' : '0';
        }
      } else if (effect === 'spotlight') {
        if (spotlightRef.current) {
          spotlightRef.current.style.transform = `translate3d(${curX - 260}px, ${curY - 260}px, 0)`;
          spotlightRef.current.style.opacity = active ? '1' : '0';
        }
      } else if (effect === 'crosshair') {
        const op = active ? '1' : '0';
        if (crossHRef.current) {
          crossHRef.current.style.transform = `translate3d(0, ${curY}px, 0)`;
          crossHRef.current.style.opacity = op;
        }
        if (crossVRef.current) {
          crossVRef.current.style.transform = `translate3d(${curX}px, 0, 0)`;
          crossVRef.current.style.opacity = op;
        }
        if (crossReticleRef.current) {
          crossReticleRef.current.style.transform = `translate3d(${curX - 18}px, ${curY - 18}px, 0)`;
          crossReticleRef.current.style.opacity = op;
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave, { passive: true });
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      window.cancelAnimationFrame(rafId);
    };
  }, [effect]);

  // Canvas-based effects: particles, magnetic-rings
  useEffect(() => {
    if (effect !== 'particles' && effect !== 'magnetic-rings') return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    if (reducedMotion || coarsePointer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    let targetX = width * 0.5;
    let targetY = height * 0.4;
    let lastSpawnX = targetX;
    let lastSpawnY = targetY;
    let active = false;

    const particles: Particle[] = [];
    const ripples: Ripple[] = [];
    const rings = [
      { x: targetX, y: targetY, ease: 0.24, radius: 14, alpha: 0.42 },
      { x: targetX, y: targetY, ease: 0.12, radius: 32, alpha: 0.24 },
      { x: targetX, y: targetY, ease: 0.06, radius: 56, alpha: 0.13 },
    ];

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      targetX = e.clientX;
      targetY = e.clientY;
      active = true;

      if (effect === 'particles') {
        const dx = targetX - lastSpawnX;
        const dy = targetY - lastSpawnY;
        const dist = Math.hypot(dx, dy);
        if (dist > 8) {
          lastSpawnX = targetX;
          lastSpawnY = targetY;
          const count = Math.min(3, Math.ceil(dist / 24));
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.25 + Math.random() * 0.7;
            particles.push({
              x: targetX + (Math.random() - 0.5) * 10,
              y: targetY + (Math.random() - 0.5) * 10,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 0.15,
              life: 0,
              maxLife: 42 + Math.random() * 28,
              size: 1.4 + Math.random() * 2.1,
            });
          }
          if (particles.length > 90) {
            particles.splice(0, particles.length - 90);
          }
        }
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      if (effect === 'magnetic-rings') {
        ripples.push({
          x: e.clientX,
          y: e.clientY,
          radius: 10,
          maxRadius: 115,
          alpha: 0.45,
        });
      } else if (effect === 'particles') {
        for (let i = 0; i < 10; i++) {
          const angle = (Math.PI * 2 * i) / 10 + Math.random() * 0.3;
          const speed = 1 + Math.random() * 1.4;
          particles.push({
            x: e.clientX,
            y: e.clientY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0,
            maxLife: 36 + Math.random() * 20,
            size: 1.5 + Math.random() * 1.8,
          });
        }
      }
    };

    const onPointerLeave = () => {
      active = false;
    };

    let rafId = 0;
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (effect === 'particles') {
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.985;
          p.vy *= 0.985;
          p.life += 1;
          if (p.life >= p.maxLife) {
            particles.splice(i, 1);
            continue;
          }
          const alpha = (1 - p.life / p.maxLife) * 0.55;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${palette.particleRgb}, ${alpha.toFixed(3)})`;
          ctx.fill();
        }

        // Connect nearby particles with delicate constellation threads
        ctx.lineWidth = 0.75;
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const a = particles[i];
            const b = particles[j];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < 78) {
              const lifeFade = Math.min(1 - a.life / a.maxLife, 1 - b.life / b.maxLife);
              const alpha = (1 - d / 78) * lifeFade * 0.24;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.strokeStyle = `rgba(${palette.lineRgb}, ${alpha.toFixed(3)})`;
              ctx.stroke();
            }
          }
        }
      } else if (effect === 'magnetic-rings') {
        if (active) {
          for (const r of rings) {
            r.x += (targetX - r.x) * r.ease;
            r.y += (targetY - r.y) * r.ease;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${palette.particleRgb}, ${r.alpha})`;
            ctx.lineWidth = 1.15;
            ctx.stroke();
          }

          // Subtle center precision dot
          ctx.beginPath();
          ctx.arc(rings[0].x, rings[0].y, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${palette.particleRgb}, 0.55)`;
          ctx.fill();
        }

        for (let i = ripples.length - 1; i >= 0; i--) {
          const rp = ripples[i];
          rp.radius += (rp.maxRadius - rp.radius) * 0.09 + 0.7;
          rp.alpha *= 0.93;
          if (rp.alpha < 0.015 || rp.radius >= rp.maxRadius) {
            ripples.splice(i, 1);
            continue;
          }
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${palette.particleRgb}, ${rp.alpha.toFixed(3)})`;
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }
      }

      rafId = window.requestAnimationFrame(render);
    };

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave, { passive: true });
    rafId = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointerleave', onPointerLeave);
      window.cancelAnimationFrame(rafId);
    };
  }, [effect, palette.particleRgb, palette.lineRgb]);

  if (effect === 'none') return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden select-none"
    >
      {effect === 'aurora-grid' && (
        <>
          <div
            ref={gridRevealRef}
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              opacity: 0,
              backgroundImage: `linear-gradient(to right, ${palette.gridLine} 1px, transparent 1px), linear-gradient(to bottom, ${palette.gridLine} 1px, transparent 1px)`,
              backgroundSize: '42px 42px',
            }}
          />
          <div
            ref={trailingOrbRef}
            className="absolute top-0 left-0 h-[620px] w-[620px] rounded-full will-change-transform transition-opacity duration-500"
            style={{
              opacity: 0.35,
              background: `radial-gradient(circle, ${palette.secondary} 0%, transparent 66%)`,
              filter: 'blur(36px)',
            }}
          />
          <div
            ref={primaryOrbRef}
            className="absolute top-0 left-0 h-[480px] w-[480px] rounded-full will-change-transform transition-opacity duration-300"
            style={{
              opacity: 0.45,
              background: `radial-gradient(circle, ${palette.primary} 0%, ${palette.ring} 32%, transparent 68%)`,
              filter: 'blur(26px)',
            }}
          />
        </>
      )}

      {effect === 'spotlight' && (
        <div
          ref={spotlightRef}
          className="absolute top-0 left-0 h-[520px] w-[520px] rounded-full will-change-transform transition-opacity duration-300"
          style={{
            opacity: 0,
            background: `radial-gradient(circle, ${palette.spotlight} 0%, transparent 64%)`,
            filter: 'blur(18px)',
          }}
        />
      )}

      {effect === 'crosshair' && (
        <>
          <div
            ref={crossHRef}
            className="absolute left-0 right-0 top-0 h-px will-change-transform transition-opacity duration-200"
            style={{
              opacity: 0,
              backgroundImage: `repeating-linear-gradient(to right, ${palette.crosshairLine} 0px, ${palette.crosshairLine} 6px, transparent 6px, transparent 12px)`,
            }}
          />
          <div
            ref={crossVRef}
            className="absolute top-0 bottom-0 left-0 w-px will-change-transform transition-opacity duration-200"
            style={{
              opacity: 0,
              backgroundImage: `repeating-linear-gradient(to bottom, ${palette.crosshairLine} 0px, ${palette.crosshairLine} 6px, transparent 6px, transparent 12px)`,
            }}
          />
          <div
            ref={crossReticleRef}
            className="absolute top-0 left-0 h-9 w-9 rounded-full will-change-transform transition-opacity duration-200 flex items-center justify-center"
            style={{
              opacity: 0,
              border: `1px solid ${palette.crosshairLine}`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: palette.crosshairDot }}
            />
          </div>
        </>
      )}

      {(effect === 'particles' || effect === 'magnetic-rings') && (
        <canvas ref={canvasRef} className="block h-full w-full" />
      )}
    </div>
  );
};
