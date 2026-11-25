import { DstMode } from '../types';

export type SessionCategory = 'session' | 'killzone' | 'silver-bullet';

export interface SessionWindowDef {
  id: string;
  name: string;
  shortLabel: string;
  category: SessionCategory;
  nyStartHour: number;
  nyStartMin: number;
  nyEndHour: number;
  nyEndMin: number;
  keyPairs: string[];
  color: string;
  note: string;
}

export const SESSION_WINDOWS: SessionWindowDef[] = [
  {
    id: 'asian-session',
    name: 'Asian Session',
    shortLabel: 'Asian',
    category: 'session',
    nyStartHour: 20,
    nyStartMin: 0,
    nyEndHour: 0,
    nyEndMin: 0,
    keyPairs: ['USDJPY', 'GBPJPY', 'XAUUSD', 'AUDUSD'],
    color: '#8b5cf6',
    note: 'Range construction & initial liquidity pool formation',
  },
  {
    id: 'asian-killzone',
    name: 'Asian Killzone',
    shortLabel: 'Asian KZ',
    category: 'killzone',
    nyStartHour: 20,
    nyStartMin: 0,
    nyEndHour: 22,
    nyEndMin: 0,
    keyPairs: ['USDJPY', 'EURJPY', 'GBPJPY', 'XAUUSD'],
    color: '#a855f7',
    note: 'Tokyo open expansion & Yen pair liquidity sweeps',
  },
  {
    id: 'london-open-kz',
    name: 'London Open Killzone',
    shortLabel: 'London KZ',
    category: 'killzone',
    nyStartHour: 2,
    nyStartMin: 0,
    nyEndHour: 5,
    nyEndMin: 0,
    keyPairs: ['EURUSD', 'GBPUSD', 'XAUUSD', 'EURJPY'],
    color: '#3b82f6',
    note: 'High-probability Asian range sweep & daily high/low formation',
  },
  {
    id: 'ny-session',
    name: 'New York Session',
    shortLabel: 'NY Session',
    category: 'session',
    nyStartHour: 8,
    nyStartMin: 0,
    nyEndHour: 17,
    nyEndMin: 0,
    keyPairs: ['XAUUSD', 'NAS100', 'US30', 'EURUSD', 'GBPUSD'],
    color: '#06b6d4',
    note: 'Full New York institutional trading session spanning AM open, London close & PM trend',
  },
  {
    id: 'ny-am-kz',
    name: 'New York AM Killzone',
    shortLabel: 'NY AM KZ',
    category: 'killzone',
    nyStartHour: 8,
    nyStartMin: 30,
    nyEndHour: 11,
    nyEndMin: 0,
    keyPairs: ['XAUUSD', 'NAS100', 'US30', 'NQ', 'EURUSD'],
    color: '#10b981',
    note: 'NYSE open volatility, CPI/NFP news releases & prime CISD setups',
  },
  {
    id: 'ny-am-sb',
    name: 'NY AM Silver Bullet',
    shortLabel: 'AM SB',
    category: 'silver-bullet',
    nyStartHour: 10,
    nyStartMin: 0,
    nyEndHour: 11,
    nyEndMin: 0,
    keyPairs: ['NAS100', 'NQ', 'XAUUSD', 'EURUSD'],
    color: '#f59e0b',
    note: '1-hour algorithmic liquidity draw window inside NY AM session',
  },
  {
    id: 'ny-pm-sb',
    name: 'NY PM Silver Bullet',
    shortLabel: 'PM SB',
    category: 'silver-bullet',
    nyStartHour: 14,
    nyStartMin: 0,
    nyEndHour: 15,
    nyEndMin: 0,
    keyPairs: ['NAS100', 'US30', 'NQ', 'XAUUSD'],
    color: '#ec4899',
    note: 'Afternoon index continuation & London close rebalance window',
  },
];

export interface ZonedClock {
  hours: number;
  minutes: number;
  seconds: number;
  totalMinutes: number;
  formatted24: string;
  formatted12: string;
  ampm: 'AM' | 'PM';
  dateLabel: string;
  offsetLabel: string;
  offsetMinutes: number;
}

/**
 * Returns NY UTC offset in minutes (-240 for EDT / UTC-4, -300 for EST / UTC-5)
 */
export function getNyOffsetMinutes(now: Date, dstMode: DstMode): number {
  if (dstMode === 'summer') return -240;
  if (dstMode === 'winter') return -300;
  // Auto DST via Intl.DateTimeFormat for America/New_York
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      timeZoneName: 'shortOffset',
    }).formatToParts(now);
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
    if (tzPart.includes('-4') || tzPart.includes('-04')) return -240;
    if (tzPart.includes('-5') || tzPart.includes('-05')) return -300;
  } catch {
    // Fallback heuristic: US DST runs 2nd Sunday in March to 1st Sunday in November
  }
  const month = now.getUTCMonth(); // 0..11
  return month >= 2 && month <= 10 ? -240 : -300;
}

export function buildZonedClock(now: Date, offsetMinutes: number, offsetLabel: string): ZonedClock {
  const shiftedMs = now.getTime() + offsetMinutes * 60_000;
  const d = new Date(shiftedMs);
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const seconds = d.getUTCSeconds();

  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const ampm: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
  const pad = (n: number) => String(n).padStart(2, '0');

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateLabel = `${days[d.getUTCDay()]}, ${pad(d.getUTCDate())} ${months[d.getUTCMonth()]}`;

  return {
    hours,
    minutes,
    seconds,
    totalMinutes: hours * 60 + minutes + seconds / 60,
    formatted24: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
    formatted12: `${pad(h12)}:${pad(minutes)}:${pad(seconds)}`,
    ampm,
    dateLabel,
    offsetLabel,
    offsetMinutes,
  };
}

export function getIstAndNyClocks(now: Date, dstMode: DstMode): {
  ist: ZonedClock;
  ny: ZonedClock;
} {
  const istOffset = 330; // UTC+5:30
  const nyOffset = getNyOffsetMinutes(now, dstMode);
  const nyLabel = nyOffset === -240 ? 'EDT (UTC-4)' : 'EST (UTC-5)';
  return {
    ist: buildZonedClock(now, istOffset, 'IST (UTC+5:30)'),
    ny: buildZonedClock(now, nyOffset, nyLabel),
  };
}

function formatHHMM(totalMinutes: number): string {
  const m = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export interface EvaluatedSession {
  def: SessionWindowDef;
  isLive: boolean;
  nyRangeText: string;
  istRangeText: string;
  nyStartMin: number;
  nyEndMin: number;
  istStartMin: number;
  istEndMin: number;
  remainingSec: number;
  countdownLabel: string;
  countdownText: string;
}

export function formatDurationSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export function evaluateSessions(now: Date, dstMode: DstMode): EvaluatedSession[] {
  const { ny } = getIstAndNyClocks(now, dstMode);
  const nyNowSec = ny.hours * 3600 + ny.minutes * 60 + ny.seconds;
  // Delta in minutes from NY to IST: e.g. EDT (-240) -> IST (+330) = +570 min (+9h30m); EST (-300) -> IST (+330) = +630 min (+10h30m)
  const nyToIstDeltaMin = 330 - ny.offsetMinutes;

  return SESSION_WINDOWS.map((def) => {
    const startMin = def.nyStartHour * 60 + def.nyStartMin;
    const endMinRaw = def.nyEndHour * 60 + def.nyEndMin;
    const endMin = endMinRaw === 0 ? 1440 : endMinRaw;

    const startSec = startMin * 60;
    const endSec = endMin * 60;

    let isLive = false;
    let remainingSec = 0;

    if (endSec > startSec) {
      if (nyNowSec >= startSec && nyNowSec < endSec) {
        isLive = true;
        remainingSec = endSec - nyNowSec;
      } else if (nyNowSec < startSec) {
        remainingSec = startSec - nyNowSec;
      } else {
        remainingSec = 86400 - nyNowSec + startSec;
      }
    } else {
      // Cross-midnight window
      if (nyNowSec >= startSec || nyNowSec < endSec) {
        isLive = true;
        remainingSec = nyNowSec >= startSec ? 86400 - nyNowSec + endSec : endSec - nyNowSec;
      } else {
        remainingSec = startSec - nyNowSec;
      }
    }

    const istStartMin = (startMin + nyToIstDeltaMin) % 1440;
    const istEndMin = (endMin + nyToIstDeltaMin) % 1440;

    return {
      def,
      isLive,
      nyRangeText: `${formatHHMM(startMin)} – ${formatHHMM(endMin)} NY`,
      istRangeText: `${formatHHMM(istStartMin)} – ${formatHHMM(istEndMin)} IST`,
      nyStartMin: startMin % 1440,
      nyEndMin: endMin % 1440,
      istStartMin,
      istEndMin,
      remainingSec,
      countdownLabel: isLive ? 'Closes in' : 'Opens in',
      countdownText: formatDurationSeconds(remainingSec),
    };
  });
}

export function getActiveSessionHeadline(now: Date, dstMode: DstMode): {
  name: string;
  isLive: boolean;
  nextCountdown: string;
} {
  const evaluated = evaluateSessions(now, dstMode);
  // Prioritize Silver Bullet > Killzone > Session if overlapping
  const live = evaluated.filter((e) => e.isLive);
  if (live.length > 0) {
    const priorityOrder: SessionCategory[] = ['silver-bullet', 'killzone', 'session'];
    live.sort(
      (a, b) => priorityOrder.indexOf(a.def.category) - priorityOrder.indexOf(b.def.category)
    );
    return {
      name: live[0].def.name,
      isLive: true,
      nextCountdown: `${live[0].countdownLabel} ${live[0].countdownText}`,
    };
  }

  // Otherwise pick the nearest upcoming window
  const nearest = [...evaluated].sort((a, b) => a.remainingSec - b.remainingSec)[0];
  return {
    name: 'Off-Peak / Market Quiet',
    isLive: false,
    nextCountdown: `Next: ${nearest.def.shortLabel} in ${nearest.countdownText}`,
  };
}
