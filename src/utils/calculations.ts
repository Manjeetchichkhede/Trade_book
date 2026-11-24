import {
  AccountMetrics,
  PLAYBOOK_SETUPS,
  PlaybookSetup,
  PropAccount,
  RoiEntry,
  Trade,
} from '../types';
import { getTodayISO } from './format';

export function computeAccountMetrics(
  account: PropAccount,
  allTrades: Trade[],
  referenceDate: string = getTodayISO()
): AccountMetrics {
  const trades = allTrades
    .filter((t) => t.accountId === account.id && t.status !== 'open')
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  const dailyMap = new Map<string, number>();
  let running = account.startingBalance;
  let intradayHwm = account.startingBalance;

  for (const t of trades) {
    running += t.netPnl;
    if (running > intradayHwm) intradayHwm = running;
    dailyMap.set(t.date, (dailyMap.get(t.date) ?? 0) + t.netPnl);
  }

  let eodRunning = account.startingBalance;
  let eodHwm = account.startingBalance;
  let bestDayPnl = 0;

  const sortedDates = Array.from(dailyMap.keys()).sort();
  for (const d of sortedDates) {
    const dayPnl = dailyMap.get(d) ?? 0;
    if (dayPnl > bestDayPnl) bestDayPnl = dayPnl;
    eodRunning += dayPnl;
    if (eodRunning > eodHwm) eodHwm = eodRunning;
  }

  const equity = running;
  const netPnl = equity - account.startingBalance;
  const netPnlPct = account.startingBalance > 0 ? (netPnl / account.startingBalance) * 100 : 0;

  // Daily drawdown relative to start of referenceDate
  const todayPnl = dailyMap.get(referenceDate) ?? 0;
  const startOfDayBalance = equity - todayPnl;
  const dailyBreachFloor = startOfDayBalance - account.dailyLossLimit;
  const dailyUsed = Math.max(0, -todayPnl);
  const dailyUsedPct =
    account.dailyLossLimit > 0 ? Math.min(100, (dailyUsed / account.dailyLossLimit) * 100) : 0;
  const dailyRemaining = Math.max(0, account.dailyLossLimit - dailyUsed);

  // Max drawdown floor depending on DrawdownType
  let highWaterMark = account.startingBalance;
  let maxDdBreachFloor = account.startingBalance - account.maxDrawdown;

  if (account.drawdownType === 'EOD Trailing') {
    highWaterMark = eodHwm;
    // Trailing floor locks at starting balance once HWM exceeds startingBalance + maxDrawdown for Funded accounts
    const rawFloor = eodHwm - account.maxDrawdown;
    maxDdBreachFloor =
      account.stage === 'Funded' ? Math.min(account.startingBalance, rawFloor) : rawFloor;
  } else if (account.drawdownType === 'Intraday Trailing') {
    highWaterMark = intradayHwm;
    const rawFloor = intradayHwm - account.maxDrawdown;
    maxDdBreachFloor =
      account.stage === 'Funded' ? Math.min(account.startingBalance, rawFloor) : rawFloor;
  } else {
    // Static
    highWaterMark = account.startingBalance;
    maxDdBreachFloor = account.startingBalance - account.maxDrawdown;
  }

  const maxDdRemaining = Math.max(0, equity - maxDdBreachFloor);
  const maxDdUsed = Math.max(0, account.maxDrawdown - maxDdRemaining);
  const maxDdUsedPct =
    account.maxDrawdown > 0 ? Math.min(100, (maxDdUsed / account.maxDrawdown) * 100) : 0;

  const profitTargetPct =
    account.profitTarget && account.profitTarget > 0
      ? Math.max(0, Math.min(100, (netPnl / account.profitTarget) * 100))
      : 0;

  const tradingDaysCount = sortedDates.length;

  // Consistency score: Best positive day as % of total positive net profit
  const consistencyPct =
    netPnl > 0 && bestDayPnl > 0 ? Math.min(100, (bestDayPnl / netPnl) * 100) : 0;

  return {
    account,
    equity,
    netPnl,
    netPnlPct,
    todayPnl,
    dailyUsed,
    dailyUsedPct,
    dailyRemaining,
    dailyBreachFloor,
    highWaterMark,
    maxDdUsed,
    maxDdUsedPct,
    maxDdRemaining,
    maxDdBreachFloor,
    profitTargetPct,
    tradingDaysCount,
    consistencyPct,
    bestDayPnl,
    tradesCount: trades.length,
  };
}

export interface PortfolioKpis {
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  profitFactor: number;
  avgR: number;
  bestTradePnl: number;
  bestTradeSymbol: string;
  todayNetPnl: number;
  totalFundedCapital: number;
  fundedCount: number;
  evalCount: number;
  totalPayouts: number;
  totalFees: number;
  netRoiProfit: number;
  roiPct: number;
}

export function computePortfolioKpis(
  accounts: PropAccount[],
  trades: Trade[],
  roiEntries: RoiEntry[]
): PortfolioKpis {
  const today = getTodayISO();
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalR = 0;
  let bestTradePnl = 0;
  let bestTradeSymbol = '—';
  let todayNetPnl = 0;

  const closedTrades = trades.filter((t) => t.status !== 'open');

  for (const t of closedTrades) {
    if (t.netPnl > 0) {
      wins++;
      grossProfit += t.netPnl;
    } else if (t.netPnl < 0) {
      losses++;
      grossLoss += Math.abs(t.netPnl);
    } else {
      breakeven++;
    }
    totalR += t.rMultiple;
    if (t.netPnl > bestTradePnl) {
      bestTradePnl = t.netPnl;
      bestTradeSymbol = t.symbol;
    }
    if (t.date === today) {
      todayNetPnl += t.netPnl;
    }
  }

  const decided = wins + losses;
  const winRate = decided > 0 ? (wins / decided) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 9.99 : 0;
  const avgR = closedTrades.length > 0 ? totalR / closedTrades.length : 0;

  const totalFundedCapital = accounts.reduce((sum, a) => sum + a.startingBalance, 0);
  const fundedCount = accounts.filter((a) => a.stage === 'Funded').length;
  const evalCount = accounts.length - fundedCount;

  let totalPayouts = 0;
  let totalFees = 0;
  for (const entry of roiEntries) {
    if (entry.type === 'Payout') {
      totalPayouts += Math.abs(entry.netAmount);
    } else {
      totalFees += Math.abs(entry.netAmount);
    }
  }
  const netRoiProfit = totalPayouts - totalFees;
  const roiPct = totalFees > 0 ? (netRoiProfit / totalFees) * 100 : totalPayouts > 0 ? 100 : 0;

  return {
    totalTrades: trades.length,
    wins,
    losses,
    breakeven,
    winRate,
    profitFactor,
    avgR,
    bestTradePnl,
    bestTradeSymbol,
    todayNetPnl,
    totalFundedCapital,
    fundedCount,
    evalCount,
    totalPayouts,
    totalFees,
    netRoiProfit,
    roiPct,
  };
}

export interface CurvePoint {
  date: string;
  label: string;
  dailyPnl: number;
  cumulativePnl: number;
}

export function buildPerformanceCurve(trades: Trade[]): CurvePoint[] {
  const byDate = new Map<string, number>();
  for (const t of trades) {
    if (t.status === 'open') continue;
    byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.netPnl);
  }
  const sortedDates = Array.from(byDate.keys()).sort();
  let cum = 0;
  return sortedDates.map((d) => {
    const daily = byDate.get(d) ?? 0;
    cum += daily;
    const [, m, day] = d.split('-');
    return {
      date: d,
      label: `${day}/${m}`,
      dailyPnl: Math.round(daily * 100) / 100,
      cumulativePnl: Math.round(cum * 100) / 100,
    };
  });
}

export interface SetupAuditItem {
  setup: PlaybookSetup;
  trades: number;
  wins: number;
  winRate: number;
  netPnl: number;
  avgR: number;
}

export interface DisciplineAudit {
  setups: SetupAuditItem[];
  followedCount: number;
  followedPnl: number;
  followedWinRate: number;
  brokenCount: number;
  brokenPnl: number;
  brokenWinRate: number;
  compliancePct: number;
}

export function computeDisciplineAudit(trades: Trade[]): DisciplineAudit {
  const closed = trades.filter((t) => t.status !== 'open');
  const setups: SetupAuditItem[] = PLAYBOOK_SETUPS.map((setup) => {
    const matching = closed.filter((t) => t.setup === setup);
    const wins = matching.filter((t) => t.netPnl > 0).length;
    const decided = matching.filter((t) => t.netPnl !== 0).length;
    const netPnl = matching.reduce((s, t) => s + t.netPnl, 0);
    const avgR =
      matching.length > 0 ? matching.reduce((s, t) => s + t.rMultiple, 0) / matching.length : 0;
    return {
      setup,
      trades: matching.length,
      wins,
      winRate: decided > 0 ? (wins / decided) * 100 : 0,
      netPnl,
      avgR,
    };
  });

  const followed = closed.filter((t) => t.ruleFollowed);
  const broken = closed.filter((t) => !t.ruleFollowed);

  const followedWins = followed.filter((t) => t.netPnl > 0).length;
  const brokenWins = broken.filter((t) => t.netPnl > 0).length;

  return {
    setups,
    followedCount: followed.length,
    followedPnl: followed.reduce((s, t) => s + t.netPnl, 0),
    followedWinRate: followed.length > 0 ? (followedWins / followed.length) * 100 : 0,
    brokenCount: broken.length,
    brokenPnl: broken.reduce((s, t) => s + t.netPnl, 0),
    brokenWinRate: broken.length > 0 ? (brokenWins / broken.length) * 100 : 0,
    compliancePct: closed.length > 0 ? (followed.length / closed.length) * 100 : 0,
  };
}

export interface DrawdownPreview {
  projectedEquity: number;
  projectedDailyBuffer: number;
  projectedMaxDdBuffer: number;
  dailyBreached: boolean;
  maxDdBreached: boolean;
  anyBreach: boolean;
}

export function computeDrawdownImpact(
  account: PropAccount | undefined,
  existingTrades: Trade[],
  date: string,
  draftPnl: number
): DrawdownPreview | null {
  if (!account) return null;
  const current = computeAccountMetrics(account, existingTrades, date);
  const projectedEquity = current.equity + draftPnl;
  const projectedTodayPnl = current.todayPnl + draftPnl;
  const projectedDailyUsed = Math.max(0, -projectedTodayPnl);
  const projectedDailyBuffer = account.dailyLossLimit - projectedDailyUsed;

  const projectedMaxDdBuffer = projectedEquity - current.maxDdBreachFloor;

  const dailyBreached = projectedDailyBuffer < 0;
  const maxDdBreached = projectedMaxDdBuffer < 0;

  return {
    projectedEquity,
    projectedDailyBuffer,
    projectedMaxDdBuffer,
    dailyBreached,
    maxDdBreached,
    anyBreach: dailyBreached || maxDdBreached,
  };
}

export function getDrawdownColorClass(usedPct: number): {
  bar: string;
  text: string;
  label: string;
} {
  if (usedPct >= 85) {
    return {
      bar: 'bg-rose-500',
      text: 'text-rose-400',
      label: 'Critical',
    };
  }
  if (usedPct >= 60) {
    return {
      bar: 'bg-amber-500',
      text: 'text-amber-400',
      label: 'Caution',
    };
  }
  return {
    bar: 'bg-emerald-500',
    text: 'text-emerald-400',
    label: 'Safe',
  };
}
