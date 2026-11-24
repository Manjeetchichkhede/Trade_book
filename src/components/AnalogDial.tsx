import React from 'react';
import { ClockStyleId } from '../types';
import { ZonedClock } from '../utils/sessions';

const ROMAN_NUMERALS = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

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
  const effectiveStyle = styleId === 'digital' ? 'modern' : styleId;
  const secDeg = clock.seconds * 6;
  const minDeg = clock.minutes * 6 + clock.seconds * 0.1;
  const hrDeg = (clock.hours % 12) * 30 + clock.minutes * 0.5;

  const isNeon = effectiveStyle === 'neon';
  const isRoman = effectiveStyle === 'roman';

  return (
    <svg viewBox="0 0 180 180" className={`${sizeClass} shrink-0`} aria-hidden="true">
      {/* Outer Rim */}
      <circle
        cx="90"
        cy="90"
        r="84"
        fill={isNeon ? 'rgba(6, 12, 26, 0.92)' : 'var(--bg-input)'}
        stroke={isNeon ? '#38bdf8' : 'var(--border-strong)'}
        strokeWidth={isNeon ? '2.5' : '2'}
      />
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

      {/* Hour markers / Roman numerals */}
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
        y1="90"
        x2="90"
        y2="46"
        stroke={isNeon ? '#e0f2fe' : 'var(--text-primary)'}
        strokeWidth={isRoman ? '3.5' : '4'}
        strokeLinecap="round"
        transform={`rotate(${hrDeg} 90 90)`}
      />

      {/* Minute Hand */}
      <line
        x1="90"
        y1="90"
        x2="90"
        y2="30"
        stroke={isNeon ? '#38bdf8' : 'var(--text-secondary)'}
        strokeWidth="2.6"
        strokeLinecap="round"
        transform={`rotate(${minDeg} 90 90)`}
      />

      {/* Second Hand */}
      <line
        x1="90"
        y1="102"
        x2="90"
        y2="24"
        stroke={isNeon ? '#10b981' : 'var(--accent)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        transform={`rotate(${secDeg} 90 90)`}
      />

      {/* Center Cap */}
      <circle cx="90" cy="90" r="4" fill={isNeon ? '#10b981' : 'var(--accent)'} />
    </svg>
  );
};
