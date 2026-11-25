import React from 'react';
import { ClockStyleId } from '../types';
import { ZonedClock } from '../utils/sessions';

export const CLOCK_STYLES: { id: ClockStyleId; label: string }[] = [
  { id: 'modern', label: 'Modern Minimal' },
  { id: 'roman', label: 'Roman Classic' },
  { id: 'neon', label: 'Neon Terminal' },
  { id: 'swiss', label: 'Swiss Railway' },
  { id: 'chronograph', label: 'Chronograph' },
  { id: 'digital', label: 'Digital Only' },
];

const ROMAN_NUMERALS = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
const CARDINAL_NUMBERS: Record<number, string> = { 0: '12', 3: '3', 6: '6', 9: '9' };

interface AnalogDialProps {
  clock: ZonedClock;
  styleId: ClockStyleId;
  sizeClass?: string;
}

export const AnalogDial: React.FC<AnalogDialProps> = ({
  clock,
  styleId,
  sizeClass = 'w-36 h-36 sm:w-40 sm:h-40',
}) => {
  const secDeg = clock.seconds * 6;
  const minDeg = clock.minutes * 6 + clock.seconds * 0.1;
  const hrDeg = (clock.hours % 12) * 30 + clock.minutes * 0.5;

  const effectiveStyle: Exclude<ClockStyleId, 'digital'> =
    styleId === 'digital' ? 'modern' : styleId;
  const isNeon = effectiveStyle === 'neon';
  const isRoman = effectiveStyle === 'roman';
  const isSwiss = effectiveStyle === 'swiss';
  const isChrono = effectiveStyle === 'chronograph';

  return (
    <svg viewBox="0 0 180 180" className={`${sizeClass} shrink-0`}>
      {/* Outer Rim */}
      <circle
        cx="90"
        cy="90"
        r="84"
        fill={isNeon ? 'rgba(6, 12, 26, 0.92)' : 'var(--bg-input)'}
        stroke={isNeon ? '#38bdf8' : isSwiss ? 'var(--text-primary)' : 'var(--border-strong)'}
        strokeWidth={isNeon || isSwiss ? '2.6' : isChrono ? '2.4' : '2'}
      />

      {/* Neon dashed inner ring */}
      {isNeon && (
        <circle
          cx="90"
          cy="90"
          r="76"
          fill="none"
          stroke="#3b82f6"
          strokeOpacity="0.35"
          strokeDasharray="4 4"
          strokeWidth="1.5"
        />
      )}

      {/* Chronograph inner bezel & sub-dial ring */}
      {isChrono && (
        <>
          <circle
            cx="90"
            cy="90"
            r="75"
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth="1"
          />
          <circle
            cx="90"
            cy="122"
            r="16"
            fill="none"
            stroke="var(--border-strong)"
            strokeWidth="1"
            strokeOpacity="0.65"
          />
          <line
            x1="90"
            y1="122"
            x2="90"
            y2="110"
            stroke="var(--accent)"
            strokeWidth="1.4"
            strokeLinecap="round"
            transform={`rotate(${secDeg} 90 122)`}
          />
          <circle cx="90" cy="122" r="2" fill="var(--accent)" />
        </>
      )}

      {/* Swiss & Chronograph 60-minute chapter ticks */}
      {(isSwiss || isChrono) &&
        Array.from({ length: 60 }).map((_, m) => {
          if (m % 5 === 0) return null;
          const angle = (m * 6 - 90) * (Math.PI / 180);
          const r1 = isSwiss ? 74 : 76;
          const r2 = 79;
          return (
            <line
              key={`m-${m}`}
              x1={90 + Math.cos(angle) * r1}
              y1={90 + Math.sin(angle) * r1}
              x2={90 + Math.cos(angle) * r2}
              y2={90 + Math.sin(angle) * r2}
              stroke="var(--text-muted)"
              strokeOpacity="0.55"
              strokeWidth="1"
            />
          );
        })}

      {/* Hour markers / numerals */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 - 90) * (Math.PI / 180);

        if (isRoman) {
          const tx = 90 + Math.cos(angle) * 65;
          const ty = 90 + Math.sin(angle) * 65 + 4;
          return (
            <text
              key={i}
              x={tx}
              y={ty}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="600"
              fontFamily="Georgia, serif"
              fill="var(--text-secondary)"
            >
              {ROMAN_NUMERALS[i]}
            </text>
          );
        }

        if (isChrono && CARDINAL_NUMBERS[i]) {
          const tx = 90 + Math.cos(angle) * 61;
          const ty = 90 + Math.sin(angle) * 61 + 4;
          return (
            <text
              key={i}
              x={tx}
              y={ty}
              textAnchor="middle"
              fontSize="11.5"
              fontWeight="700"
              fill="var(--text-primary)"
            >
              {CARDINAL_NUMBERS[i]}
            </text>
          );
        }

        if (isSwiss) {
          const r1 = i % 3 === 0 ? 60 : 64;
          const r2 = 78;
          return (
            <line
              key={i}
              x1={90 + Math.cos(angle) * r1}
              y1={90 + Math.sin(angle) * r1}
              x2={90 + Math.cos(angle) * r2}
              y2={90 + Math.sin(angle) * r2}
              stroke="var(--text-primary)"
              strokeWidth={i % 3 === 0 ? '4.2' : '2.8'}
              strokeLinecap="butt"
            />
          );
        }

        const r1 = i % 3 === 0 ? 66 : 71;
        const r2 = 77;
        return (
          <line
            key={i}
            x1={90 + Math.cos(angle) * r1}
            y1={90 + Math.sin(angle) * r1}
            x2={90 + Math.cos(angle) * r2}
            y2={90 + Math.sin(angle) * r2}
            stroke={
              isNeon
                ? i % 3 === 0
                  ? '#38bdf8'
                  : '#1e40af'
                : i % 3 === 0
                ? 'var(--text-primary)'
                : 'var(--text-muted)'
            }
            strokeWidth={i % 3 === 0 ? '2.4' : '1.3'}
            strokeLinecap="round"
          />
        );
      })}

      {/* Hour Hand */}
      <line
        x1="90"
        y1={isSwiss ? '100' : '90'}
        x2="90"
        y2={isSwiss ? '45' : '46'}
        stroke={isNeon ? '#e0f2fe' : 'var(--text-primary)'}
        strokeWidth={isSwiss ? '5.2' : isRoman ? '3.5' : '4'}
        strokeLinecap={isSwiss ? 'butt' : 'round'}
        transform={`rotate(${hrDeg} 90 90)`}
      />

      {/* Minute Hand */}
      <line
        x1="90"
        y1={isSwiss ? '104' : '90'}
        x2="90"
        y2={isSwiss ? '26' : '30'}
        stroke={isNeon ? '#38bdf8' : isSwiss ? 'var(--text-primary)' : 'var(--text-secondary)'}
        strokeWidth={isSwiss ? '3.8' : '2.6'}
        strokeLinecap={isSwiss ? 'butt' : 'round'}
        transform={`rotate(${minDeg} 90 90)`}
      />

      {/* Second Hand */}
      <g transform={`rotate(${secDeg} 90 90)`}>
        <line
          x1="90"
          y1={isSwiss ? '110' : '102'}
          x2="90"
          y2={isSwiss ? '34' : '24'}
          stroke={isSwiss ? '#ef4444' : isNeon ? '#10b981' : 'var(--accent)'}
          strokeWidth={isSwiss ? '1.8' : '1.5'}
          strokeLinecap="round"
        />
        {isSwiss && <circle cx="90" cy="34" r="4.6" fill="#ef4444" />}
      </g>

      {/* Center Cap */}
      <circle
        cx="90"
        cy="90"
        r={isSwiss ? '3.5' : '4'}
        fill={isSwiss ? '#ef4444' : isNeon ? '#10b981' : 'var(--accent)'}
      />
    </svg>
  );
};
