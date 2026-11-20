import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Plus, Trash2 } from 'lucide-react';
import { AppSettings, PropAccount, RoiEntry, RoiEntryType } from '../types';
import { formatMoney, formatPct, formatShortDate, generateId, getTodayISO, USD_TO_INR } from '../utils/format';

interface RoiTabProps {
  accounts: PropAccount[];
  roiEntries: RoiEntry[];
  settings: AppSettings;
  preselectedPayoutAccountId?: string | null;
  onClearPreselectedPayout: () => void;
  onAddRoiEntry: (entry: RoiEntry) => void;
  onDeleteRoiEntry: (id: string) => void;
}

const ENTRY_TYPES: RoiEntryType[] = ['Payout', 'Challenge Fee', 'Reset Fee', 'Activation Fee'];

export const RoiTab: React.FC<RoiTabProps> = ({
  accounts,
  roiEntries,
  settings,
  preselectedPayoutAccountId,
  onClearPreselectedPayout,
  onAddRoiEntry,
  onDeleteRoiEntry,
}) => {
  const [entryType, setEntryType] = useState<RoiEntryType>('Payout');
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? '');
  const [customFirm, setCustomFirm] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayISO());
  const [grossAmount, setGrossAmount] = useState<string>('2000');
  const [traderSplitPct, setTraderSplitPct] = useState<string>('80');
  const [note, setNote] = useState<string>('');
  const [tableFilter, setTableFilter] = useState<'all' | 'payouts' | 'fees'>('all');

  useEffect(() => {
    if (preselectedPayoutAccountId) {
      setEntryType('Payout');
      setAccountId(preselectedPayoutAccountId);
      onClearPreselectedPayout();
    }
  }, [preselectedPayoutAccountId, onClearPreselectedPayout]);

  const computedNetPreview = useMemo(() => {
    const gross = Math.max(0, Number(grossAmount) || 0);
    if (entryType === 'Payout') {
      const split = Math.max(1, Math.min(100, Number(traderSplitPct) || 80));
      return (gross * split) / 100;
    }
    return -gross;
  }, [entryType, grossAmount, traderSplitPct]);

  const kpis = useMemo(() => {
    let totalPayouts = 0;
    let totalFees = 0;
    for (const e of roiEntries) {
      if (e.type === 'Payout') totalPayouts += Math.abs(e.netAmount);
      else totalFees += Math.abs(e.netAmount);
    }
    const netProfit = totalPayouts - totalFees;
    const roiPct = totalFees > 0 ? (netProfit / totalFees) * 100 : totalPayouts > 0 ? 100 : 0;
    return { totalPayouts, totalFees, netProfit, roiPct };
  }, [roiEntries]);

  // Monthly Fees vs. Payouts Bar Chart Data
  const monthlyData = useMemo(() => {
    const map = new Map<string, { monthKey: string; label: string; payouts: number; fees: number }>();
    const mult = settings.currency === 'INR' ? USD_TO_INR : 1;

    for (const e of roiEntries) {
      const monthKey = e.date.slice(0, 7); // YYYY-MM
      if (!map.has(monthKey)) {
        const [y, m] = monthKey.split('-').map(Number);
        const label = new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        });
        map.set(monthKey, { monthKey, label, payouts: 0, fees: 0 });
      }
      const bucket = map.get(monthKey)!;
      if (e.type === 'Payout') {
        bucket.payouts += Math.round(Math.abs(e.netAmount) * mult);
      } else {
        bucket.fees += Math.round(Math.abs(e.netAmount) * mult);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [roiEntries, settings.currency]);

  const filteredRows = useMemo(() => {
    return roiEntries
      .filter((e) => {
        if (tableFilter === 'payouts') return e.type === 'Payout';
        if (tableFilter === 'fees') return e.type !== 'Payout';
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [roiEntries, tableFilter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const gross = Math.max(0, Number(grossAmount) || 0);
    if (gross <= 0) return;

    const linkedAccount = accounts.find((a) => a.id === accountId);
    const firmName =
      accountId === '__custom'
        ? customFirm.trim() || 'Prop Firm'
        : linkedAccount?.firm || customFirm.trim() || 'Prop Firm';

    const split =
      entryType === 'Payout' ? Math.max(1, Math.min(100, Number(traderSplitPct) || 80)) : undefined;

    const entry: RoiEntry = {
      id: generateId('roi'),
      date,
      type: entryType,
      accountId: accountId !== '__custom' && accountId ? accountId : undefined,
      firm: firmName,
      grossAmount: gross,
      traderSplitPct: split,
      netAmount: entryType === 'Payout' ? (gross * (split ?? 80)) / 100 : -gross,
      note: note.trim(),
    };

    onAddRoiEntry(entry);
    setNote('');
  };

  const currencyPrefix = settings.currency === 'INR' ? '₹' : '$';
  const accountLookup = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  return (
    <div className="space-y-6">
      {/* 4 KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="tb-glass rounded-2xl p-5">
          <p className="text-xs font-medium text-[var(--text-muted)]">Total Payouts</p>
          <p
            className="mt-2 font-mono-num text-2xl sm:text-3xl font-bold"
            style={{ color: 'var(--positive)' }}
          >
            {formatMoney(kpis.totalPayouts, settings.currency, settings.privacyMode)}
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">Net received after profit split</p>
        </div>

        <div className="tb-glass rounded-2xl p-5">
          <p className="text-xs font-medium text-[var(--text-muted)]">Total Fees</p>
          <p
            className="mt-2 font-mono-num text-2xl sm:text-3xl font-bold"
            style={{ color: 'var(--negative)' }}
          >
            {formatMoney(kpis.totalFees, settings.currency, settings.privacyMode)}
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">
            Challenge, reset &amp; activation costs
          </p>
        </div>

        <div className="tb-glass rounded-2xl p-5">
          <p className="text-xs font-medium text-[var(--text-muted)]">Net Business Profit</p>
          <p
            className="mt-2 font-mono-num text-2xl sm:text-3xl font-bold"
            style={{ color: kpis.netProfit >= 0 ? 'var(--positive)' : 'var(--negative)' }}
          >
            {formatMoney(kpis.netProfit, settings.currency, settings.privacyMode, { signed: true })}
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">Realized net prop-firm cashflow</p>
        </div>

        <div className="tb-glass rounded-2xl p-5">
          <p className="text-xs font-medium text-[var(--text-muted)]">Cash-on-Cash ROI %</p>
          <p
            className="mt-2 font-mono-num text-2xl sm:text-3xl font-bold"
            style={{ color: kpis.roiPct >= 0 ? 'var(--accent-text)' : 'var(--negative)' }}
          >
            {formatPct(kpis.roiPct, true, 1)}
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">Return on evaluation capital spent</p>
        </div>
      </section>

      {/* Chart + Add Ledger Entry Form */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Monthly Fees vs. Payouts Bar Chart */}
        <div className="tb-glass lg:col-span-7 rounded-2xl p-5 flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Monthly Fees vs. Payouts
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Cashflow comparison of monthly evaluation expenses against net funded withdrawals.
            </p>
          </div>

          <div className="h-[300px] w-full">
            {monthlyData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                Add a payout or fee entry to populate monthly cashflow bars.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="label"
                    stroke="var(--chart-axis)"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--chart-axis)"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      settings.privacyMode ? '•••' : `${currencyPrefix}${v}`
                    }
                    width={64}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-card-solid)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '12px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                    }}
                    formatter={(val: unknown, name: unknown) => [
                      settings.privacyMode
                        ? `${currencyPrefix}•••••`
                        : `${currencyPrefix}${Number(val).toLocaleString()}`,
                      String(name),
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="payouts" name="Payouts" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="fees" name="Fees" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Add ROI Entry Form */}
        <div className="tb-glass lg:col-span-5 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Log Payout or Prop Fee
          </h2>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Record funded splits, challenge purchases, resets, and activation fees.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Entry Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ENTRY_TYPES.map((t) => {
                  const active = entryType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEntryType(t)}
                      className="rounded-xl py-2 px-2.5 text-xs font-semibold transition-all cursor-pointer"
                      style={{
                        backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-input)',
                        border: active
                          ? '1px solid var(--accent)'
                          : '1px solid var(--border-subtle)',
                        color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Account / Firm
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="tb-input w-full rounded-xl px-3 py-2.5 text-xs"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                  <option value="__custom">Other / Custom Firm</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="tb-input font-mono-num w-full rounded-xl px-3 py-2.5 text-xs"
                />
              </div>
            </div>

            {accountId === '__custom' && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Prop Firm Name
                </label>
                <input
                  type="text"
                  value={customFirm}
                  onChange={(e) => setCustomFirm(e.target.value)}
                  placeholder="e.g. Topstep, The5ers, Alpha Capital"
                  className="tb-input w-full rounded-xl px-3.5 py-2.5 text-xs"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  {entryType === 'Payout' ? 'Gross Profit ($)' : 'Fee Amount ($)'}
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={grossAmount}
                  onChange={(e) => setGrossAmount(e.target.value)}
                  className="tb-input font-mono-num w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                />
              </div>

              {entryType === 'Payout' ? (
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                    Trader Split (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={traderSplitPct}
                    onChange={(e) => setTraderSplitPct(e.target.value)}
                    className="tb-input font-mono-num w-full rounded-xl px-3.5 py-2.5 text-sm font-semibold"
                  />
                </div>
              ) : (
                <div className="flex flex-col justify-end">
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-2.5 text-xs">
                    <span className="text-[var(--text-muted)] block text-[10px]">Net Impact</span>
                    <span className="font-mono-num font-bold" style={{ color: 'var(--negative)' }}>
                      {formatMoney(computedNetPreview, settings.currency, settings.privacyMode, {
                        signed: true,
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {entryType === 'Payout' && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--positive-soft)] px-3.5 py-2.5 flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">Net Trader Payout Received</span>
                <span className="font-mono-num text-sm font-bold" style={{ color: 'var(--positive)' }}>
                  {formatMoney(computedNetPreview, settings.currency, settings.privacyMode, {
                    signed: true,
                  })}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Note
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Bi-weekly payout via Rise / Wise"
                className="tb-input w-full rounded-xl px-3.5 py-2.5 text-xs"
              />
            </div>

            <button
              type="submit"
              className="tb-btn-primary w-full inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add to ROI Ledger
            </button>
          </form>
        </div>
      </section>

      {/* History Table */}
      <section className="tb-glass rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            Challenge &amp; Payout Ledger History
          </h2>

          <div className="flex items-center gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] p-1">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'payouts', label: 'Payouts' },
                { id: 'fees', label: 'Fees' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTableFilter(f.id)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
                style={{
                  backgroundColor: tableFilter === f.id ? 'var(--nav-pill)' : 'transparent',
                  color: tableFilter === f.id ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-muted)]">
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="py-3 px-4 font-medium">Firm / Account</th>
                <th className="py-3 px-4 font-medium text-right">Gross</th>
                <th className="py-3 px-4 font-medium text-right">Split %</th>
                <th className="py-3 px-4 font-medium text-right">Net Cashflow</th>
                <th className="py-3 px-4 font-medium">Note</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[var(--text-muted)]">
                    No ledger entries yet.
                  </td>
                </tr>
              ) : (
                filteredRows.map((entry) => {
                  const isPayout = entry.type === 'Payout';
                  const accName = entry.accountId ? accountLookup.get(entry.accountId) : null;
                  return (
                    <tr key={entry.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="py-3 px-4 font-mono-num whitespace-nowrap text-[var(--text-secondary)]">
                        {formatShortDate(entry.date)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-semibold">
                        <span style={{ color: isPayout ? 'var(--positive)' : 'var(--negative)' }}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-[var(--text-primary)]">
                        {entry.firm}
                        {accName && (
                          <span className="text-[var(--text-muted)]"> · {accName}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono-num text-right text-[var(--text-secondary)]">
                        {formatMoney(entry.grossAmount, settings.currency, settings.privacyMode)}
                      </td>
                      <td className="py-3 px-4 font-mono-num text-right text-[var(--text-muted)]">
                        {entry.traderSplitPct ? `${entry.traderSplitPct}%` : '—'}
                      </td>
                      <td
                        className="py-3 px-4 font-mono-num font-bold text-right whitespace-nowrap"
                        style={{ color: isPayout ? 'var(--positive)' : 'var(--negative)' }}
                      >
                        {formatMoney(entry.netAmount, settings.currency, settings.privacyMode, {
                          signed: true,
                        })}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-muted)] max-w-[240px] truncate">
                        {entry.note || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onDeleteRoiEntry(entry.id)}
                          aria-label="Delete ROI entry"
                          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
