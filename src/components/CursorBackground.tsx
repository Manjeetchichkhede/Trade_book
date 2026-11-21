import React, { useEffect, useRef } from 'react';
import { ThemeId } from '../types';

interface CursorBackgroundProps {
  enabled: boolean;
  theme: ThemeId;
}

const THEME_PALETTES: Record<
  ThemeId,
  {
    primary: string;
    secondary: string;
    ring: string;
    gridLine: string;
  }
> = {
  dark: {
    primary: 'rgba(59, 130, 246, 0.24)',
    secondary: 'rgba(16, 185, 129, 0.16)',
    ring: 'rgba(147, 197, 253, 0.18)',
    gridLine: 'rgba(148, 163, 184, 0.06)',
  },
  light: {
    primary: 'rgba(37, 99, 235, 0.16)',
    secondary: 'rgba(99, 102, 241, 0.12)',
    ring: 'rgba(37, 99, 235, 0.14)',
    gridLine: 'rgba(15, 23, 42, 0.045)',
  },
  monochrome: {
    primary: 'rgba(228, 228, 231, 0.16)',
    secondary: 'rgba(161, 161, 170, 0.12)',
    ring: 'rgba(255, 255, 255, 0.14)',
    gridLine: 'rgba(255, 255, 255, 0.045)',
  },
  bw: {
    primary: 'rgba(255, 255, 255, 0.13)',
    secondary: 'rgba(255, 255, 255, 0.07)',
    ring: 'rgba(255, 255, 255, 0.2)',
    gridLine: 'rgba(255, 255, 255, 0.055)',
  },
};

export const CursorBackground: React.FC<CursorBackgroundProps> = ({ enabled, theme }) => {
  const primaryOrbRef = useRef<HTMLDivElement | null>(null);
  const trailingOrbRef = useRef<HTMLDivElement | null>(null);
  const gridRevealRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

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
      // Smooth spring-like inertia for primary and secondary orbs
      curX += (targetX - curX) * 0.14;
      curY += (targetY - curY) * 0.14;
      trailX += (targetX - trailX) * 0.06;
      trailY += (targetY - trailY) * 0.06;

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
  }, [enabled]);

  if (!enabled) return null;

  const palette = THEME_PALETTES[theme];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden select-none"
    >
      {/* Subtle interactive grid illuminated near cursor */}
      <div
        ref={gridRevealRef}
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: 0,
          backgroundImage: `linear-gradient(to right, ${palette.gridLine} 1px, transparent 1px), linear-gradient(to bottom, ${palette.gridLine} 1px, transparent 1px)`,
          backgroundSize: '42px 42px',
        }}
      />

      {/* Trailing secondary aura */}
      <div
        ref={trailingOrbRef}
        className="absolute top-0 left-0 h-[620px] w-[620px] rounded-full will-change-transform transition-opacity duration-500"
        style={{
          opacity: 0.35,
          background: `radial-gradient(circle, ${palette.secondary} 0%, transparent 66%)`,
          filter: 'blur(36px)',
        }}
      />

      {/* Primary cursor spotlight glow */}
      <div
        ref={primaryOrbRef}
        className="absolute top-0 left-0 h-[480px] w-[480px] rounded-full will-change-transform transition-opacity duration-300"
        style={{
          opacity: 0.45,
          background: `radial-gradient(circle, ${palette.primary} 0%, ${palette.ring} 32%, transparent 68%)`,
          filter: 'blur(26px)',
        }}
      />
    </div>
  );
};
