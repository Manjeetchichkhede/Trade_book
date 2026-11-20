import { CurrencyId } from '../types';

export const USD_TO_INR = 85;

export function formatMoney(
  usdAmount: number,
  currency: CurrencyId,
  privacyMode: boolean,
  options?: { signed?: boolean; compact?: boolean; decimals?: number }
): string {
  if (privacyMode) {
    return currency === 'INR' ? '₹•••••' : '$•••••';
  }
  const value = currency === 'INR' ? usdAmount * USD_TO_INR : usdAmount;
  const symbol = currency === 'INR' ? '₹' : '$';
  const sign = value < 0 ? '-' : options?.signed && value > 0 ? '+' : '';
  const abs = Math.abs(value);

  if (options?.compact) {
    if (abs >= 1_000_000) {
      return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`;
    }
    if (abs >= 1000) {
      return `${sign}${symbol}${(abs / 1000).toFixed(abs >= 10000 ? 1 : 2)}k`;
    }
  }

  const decimals = options?.decimals ?? (abs % 1 === 0 ? 0 : 2);
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return `${sign}${symbol}${abs.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatR(r: number, signed = true): string {
  const sign = signed && r > 0 ? '+' : '';
  return `${sign}${r.toFixed(2)}R`;
}

export function formatPct(pct: number, signed = false, decimals = 1): string {
  const sign = signed && pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(decimals)}%`;
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(baseIso: string, deltaDays: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate()
  ).padStart(2, '0')}`;
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
