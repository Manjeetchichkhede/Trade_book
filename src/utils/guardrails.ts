import { DstMode, EconomicNewsEvent, GuardrailConfig, Trade } from '../types';
import { getTodayISO } from './format';
import { formatDurationSeconds, getNyOffsetMinutes } from './sessions';

export type NewsEventState = 'restricted' | 'imminent' | 'upcoming' | 'passed';

export interface EvaluatedNewsEvent {
  event: EconomicNewsEvent;
  utcMs: number;
  istTimeLabel: string;
  istDateLabel: string;
  nyTimeLabel: string;
  state: NewsEventState;
  deltaSeconds: number; // positive = in future, negative = in past
  countdownText: string;
}

function formatTime24(hours: number, mins: number): string {
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function evaluateNewsEvents(
  events: EconomicNewsEvent[],
  now: Date,
  dstMode: DstMode,
  bufferMinutes: number
): EvaluatedNewsEvent[] {
  const nyOffsetMin = getNyOffsetMinutes(now, dstMode);
  const istOffsetMin = 330; // UTC+5:30
  const nowMs = now.getTime();
  const bufferSec = bufferMinutes * 60;

  return events
    .map((event) => {
      const [y, m, d] = event.date.split('-').map(Number);
      const [hh, mm] = event.nyTime.split(':').map(Number);

      // Build UTC epoch from NY local wall-clock date & time
      const wallUtcMs = Date.UTC(y || 2026, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
      // Since NY local = UTC + nyOffsetMin, UTC = wallUtcMs - nyOffsetMin * 60000
      const utcMs = wallUtcMs - nyOffsetMin * 60_000;

      // Convert UTC epoch to IST wall clock
      const istDate = new Date(utcMs + istOffsetMin * 60_000);
      const istTimeLabel = `${formatTime24(istDate.getUTCHours(), istDate.getUTCMinutes())} IST`;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const istDateLabel = `${String(istDate.getUTCDate()).padStart(2, '0')} ${
        months[istDate.getUTCMonth()]
      }`;

      const deltaSeconds = Math.round((utcMs - nowMs) / 1000);

      let state: NewsEventState = 'upcoming';
      let countdownText = '';

      if (event.impact === 'High' && Math.abs(deltaSeconds) <= bufferSec) {
        state = 'restricted';
        countdownText =
          deltaSeconds >= 0
            ? `Release in ${formatDurationSeconds(deltaSeconds)}`
            : `Buffer clears in ${formatDurationSeconds(bufferSec + deltaSeconds)}`;
      } else if (deltaSeconds < -bufferSec) {
        state = 'passed';
        const minsAgo = Math.floor(Math.abs(deltaSeconds) / 60);
        countdownText =
          minsAgo < 60
            ? `${minsAgo}m ago`
            : minsAgo < 1440
            ? `${Math.floor(minsAgo / 60)}h ago`
            : `${Math.floor(minsAgo / 1440)}d ago`;
      } else if (event.impact === 'High' && deltaSeconds <= 1800) {
        state = 'imminent';
        countdownText = `In ${formatDurationSeconds(deltaSeconds)}`;
      } else {
        state = 'upcoming';
        if (deltaSeconds < 86400) {
          countdownText = `In ${formatDurationSeconds(deltaSeconds)}`;
        } else {
          const days = Math.floor(deltaSeconds / 86400);
          const remHrs = Math.floor((deltaSeconds % 86400) / 3600);
          countdownText = `In ${days}d ${remHrs}h`;
        }
      }

      return {
        event,
        utcMs,
        istTimeLabel,
        istDateLabel,
        nyTimeLabel: `${event.nyTime} NY`,
        state,
        deltaSeconds,
        countdownText,
      };
    })
    .sort((a, b) => a.utcMs - b.utcMs);
}

export interface ActiveNewsAlert {
  level: 'restricted' | 'imminent';
  event: EvaluatedNewsEvent;
}

export function getActiveNewsAlert(evaluated: EvaluatedNewsEvent[]): ActiveNewsAlert | null {
  const restricted = evaluated.find((e) => e.state === 'restricted');
  if (restricted) return { level: 'restricted', event: restricted };
  const imminent = evaluated.find((e) => e.state === 'imminent');
  if (imminent) return { level: 'imminent', event: imminent };
  return null;
}

export interface DailyDisciplineMetrics {
  todayTradesCount: number;
  consecutiveLossesToday: number;
  revengeOrAnxiousLossesToday: number;
  maxTradesReached: boolean;
  tiltStreakReached: boolean;
  isLockedOut: boolean;
  lockoutRemainingSec: number;
  lockoutRemainingText: string;
  lockoutReason: string | null;
}

export function computeDailyDiscipline(
  trades: Trade[],
  config: GuardrailConfig,
  now: Date
): DailyDisciplineMetrics {
  const today = getTodayISO();
  const todayTrades = trades
    .filter((t) => t.date === today)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let consecutiveLossesToday = 0;
  for (let i = todayTrades.length - 1; i >= 0; i--) {
    if (todayTrades[i].netPnl < 0) consecutiveLossesToday++;
    else break;
  }

  const revengeOrAnxiousLossesToday = todayTrades.filter(
    (t) => t.netPnl < 0 && (t.mentalState === 'Revenge' || t.mentalState === 'Anxious')
  ).length;

  let lockoutRemainingSec = 0;
  if (config.lockoutUntilIso) {
    const untilMs = new Date(config.lockoutUntilIso).getTime();
    if (!Number.isNaN(untilMs)) {
      lockoutRemainingSec = Math.max(0, Math.ceil((untilMs - now.getTime()) / 1000));
    }
  }

  const isLockedOut = lockoutRemainingSec > 0;

  return {
    todayTradesCount: todayTrades.length,
    consecutiveLossesToday,
    revengeOrAnxiousLossesToday,
    maxTradesReached: todayTrades.length >= config.maxTradesPerDay,
    tiltStreakReached: consecutiveLossesToday >= config.maxConsecutiveLosses,
    isLockedOut,
    lockoutRemainingSec,
    lockoutRemainingText: formatDurationSeconds(lockoutRemainingSec),
    lockoutReason: isLockedOut ? config.lockoutReason : null,
  };
}

export function evaluatePostTradeTiltTrigger(
  newTrade: Trade,
  existingTrades: Trade[],
  config: GuardrailConfig
): { triggered: boolean; reason: string } {
  if (!config.enableTiltGuard) return { triggered: false, reason: '' };
  const today = getTodayISO();
  if (newTrade.date !== today) return { triggered: false, reason: '' };

  const combined = [...existingTrades, newTrade]
    .filter((t) => t.date === today)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (newTrade.netPnl < 0 && (newTrade.mentalState === 'Revenge' || newTrade.mentalState === 'Anxious')) {
    return {
      triggered: true,
      reason: `Tilt Guard: Loss logged in "${newTrade.mentalState}" state — step away for ${config.cooldownMinutes}m reset.`,
    };
  }

  let streak = 0;
  for (let i = combined.length - 1; i >= 0; i--) {
    if (combined[i].netPnl < 0) streak++;
    else break;
  }

  if (streak >= config.maxConsecutiveLosses) {
    return {
      triggered: true,
      reason: `Tilt Guard: ${streak} consecutive losses today (limit: ${config.maxConsecutiveLosses}). Mandatory ${config.cooldownMinutes}m cooldown.`,
    };
  }

  if (combined.length >= config.maxTradesPerDay) {
    return {
      triggered: true,
      reason: `Daily Trade Cap Reached (${combined.length} / ${config.maxTradesPerDay} trades). Cooldown activated to prevent overtrading.`,
    };
  }

  return { triggered: false, reason: '' };
}
