import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Edit3, Plus, Trash2, Wallet } from 'lucide-react';
import { AccountStage, AppSettings, PropAccount, Trade } from '../types';
import { computeAccountMetrics, getDrawdownColorClass } from '../utils/calculations';
import { formatMoney, formatPct } from '../utils/format';
import { AccountModal } from './AccountModal';

interface AccountsTabProps {
  accounts: PropAccount[];
  trades: Trade[];
  settings: AppSettings;
  onSaveAccount: (account: PropAccount) => void;
  onDeleteAccount: (accountId: string) => void;
  onQuickLogForAccount: (accountId: string) => void;
  onQuickPayoutForAccount: (accountId: string) => void;
}

type StageFilter = 'All' | AccountStage;
const STAGE_FILTERS: StageFilter[] = ['All', 'Funded', 'Eval Phase 1', 'Eval Phase 2'];

export const AccountsTab: React.FC<AccountsTabProps> = ({
  accounts,
  trades,
  settings,
  onSaveAccount,
  onDeleteAccount,
  onQuickLogForAccount,
  onQuickPayoutForAccount,
}) => {
  const [stageFilter, setStageFilter] = useState<StageFilter>('All');
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PropAccount | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const metricsList = useMemo(
    () => accounts.map((acc) => computeAccountMetrics(acc, trades)),
    [accounts, trades]
  );

  const filteredList = useMemo(
    () =>
      stageFilter === 'All'
        ? metricsList
        : metricsList.filter((m) => m.account.stage === stageFilter),
    [metricsList, stageFilter]
  );

  const totals = useMemo(() => {
    const starting = metricsList.reduce((s, m) => s + m.account.startingBalance, 0);
    const equity = metricsList.reduce((s, m) => s + m.equity, 0);
    const netPnl = equity - starting;
    const funded = metricsList.filter((m) => m.account.stage === 'Funded').length;
    const evals = metricsList.length - funded;
    return { starting, equity, netPnl, funded, evals };
  }, [metricsList]);

  return (
    <div className="space-y-6">
      {/* Portfolio Header Summary */}
      <section className="tb-glass rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Active Funded &amp; Eval Accounts
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[var(--text-muted)]">
              Real-time drawdown floors, consistency cap tracking, and prop-firm rule buffers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-2.5">
              <span className="block text-[10px] text-[var(--text-muted)]">Total Capital</span>
              <span className="font-mono-num text-sm sm:text-base font-bold text-[var(--text-primary)]">
                {formatMoney(totals.starting, settings.currency, settings.privacyMode, {
                  decimals: 0,
                })}
              </span>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-2.5">
              <span className="block text-[10px] text-[var(--text-muted)]">Combined Equity</span>
              <span className="font-mono-num text-sm sm:text-base font-bold text-[var(--text-primary)]">
                {formatMoney(totals.equity, settings.currency, settings.privacyMode, {
                  decimals: 0,
                })}
              </span>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-2.5">
              <span className="block text-[10px] text-[var(--text-muted)]">Open Portfolio P&amp;L</span>
              <span
                className="font-mono-num text-sm sm:text-base font-bold"
                style={{ color: totals.netPnl >= 0 ? 'var(--positive)' : 'var(--negative)' }}
              >
                {formatMoney(totals.netPnl, settings.currency, settings.privacyMode, {
                  signed: true,
                  decimals: 0,
                })}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingAccount(null);
                setAccountModalOpen(true);
              }}
              className="tb-btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-3 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          </div>
        </div>

        {/* Stage Filter Pills */}
        <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {STAGE_FILTERS.map((stage) => {
              const active = stageFilter === stage;
              const count =
                stage === 'All'
                  ? metricsList.length
                  : metricsList.filter((m) => m.account.stage === stage).length;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setStageFilter(stage)}
                  className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: active ? 'var(--nav-pill)' : 'var(--bg-input)',
                    color: active ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
                    border: active ? '1px solid transparent' : '1px solid var(--border-subtle)',
                  }}
                >
                  {stage} ({count})
                </button>
              );
            })}
          </div>
          <span className="text-xs text-[var(--text-muted)]">
            {totals.funded} Funded · {totals.evals} Evaluation
          </span>
        </div>
      </section>

      {/* Accounts Grid */}
      {filteredList.length === 0 ? (
        <div className="tb-glass rounded-2xl p-10 text-center">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {accounts.length === 0
              ? 'No prop accounts added yet'
              : `No accounts in "${stageFilter}" stage`}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Add a Funded or Evaluation account to track drawdown floors, targets, and consistency.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingAccount(null);
              setAccountModalOpen(true);
            }}
            className="tb-btn-primary mt-4 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>
      ) : (
        <section
          className={`grid gap-4 ${
            settings.compactAccounts
              ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
              : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
          }`}
        >
          {filteredList.map((m) => {
            const dailyColor = getDrawdownColorClass(m.dailyUsedPct);
            const maxColor = getDrawdownColorClass(m.maxDdUsedPct);
            const isDeleting = pendingDeleteId === m.account.id;
            const isEval = m.account.stage !== 'Funded';

            return (
              <article
                key={m.account.id}
                className={`tb-glass rounded-2xl flex flex-col justify-between ${
                  settings.compactAccounts ? 'p-4 space-y-3' : 'p-5 space-y-4'
                }`}
              >
                {/* Card Top Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <span className="font-semibold text-[var(--accent-text)]">
                        {m.account.firm}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{m.account.stage}</span>
                      <span aria-hidden="true">·</span>
                      <span>{m.account.drawdownType}</span>
                    </div>
                    <h2 className="mt-1 text-base font-bold text-[var(--text-primary)] truncate">
                      {m.account.name}
                    </h2>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAccount(m.account);
                        setAccountModalOpen(true);
                      }}
                      aria-label={`Edit ${m.account.name}`}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(isDeleting ? null : m.account.id)}
                      aria-label={`Delete ${m.account.name}`}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* In-card delete confirmation */}
                {isDeleting && (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-rose-300">Delete this account?</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteAccount(m.account.id);
                          setPendingDeleteId(null);
                        }}
                        className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white cursor-pointer"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                        className="tb-btn-ghost rounded-lg px-2.5 py-1 text-xs cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Live Equity & Net P&L */}
                <div className="flex items-baseline justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                  <div>
                    <span className="block text-[11px] text-[var(--text-muted)]">Live Equity</span>
                    <span className="font-mono-num text-xl font-bold text-[var(--text-primary)]">
                      {formatMoney(m.equity, settings.currency, settings.privacyMode)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[11px] text-[var(--text-muted)]">Net P&amp;L</span>
                    <span
                      className="font-mono-num text-sm font-semibold"
                      style={{ color: m.netPnl >= 0 ? 'var(--positive)' : 'var(--negative)' }}
                    >
                      {formatMoney(m.netPnl, settings.currency, settings.privacyMode, {
                        signed: true,
                      })}{' '}
                      ({formatPct(m.netPnlPct, true, 2)})
                    </span>
                  </div>
                </div>

                {/* Drawdown Progress Bars */}
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[var(--text-secondary)]">
                        Daily Drawdown{' '}
                        <span className={`font-medium ${dailyColor.text}`}>
                          ({m.dailyUsedPct.toFixed(0)}% · {dailyColor.label})
                        </span>
                      </span>
                      <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                        Floor:{' '}
                        {formatMoney(
                          m.dailyBreachFloor,
                          settings.currency,
                          settings.privacyMode,
                          { decimals: 0 }
                        )}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${dailyColor.bar}`}
                        style={{ width: `${Math.max(2, Math.min(100, m.dailyUsedPct))}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[var(--text-secondary)]">
                        Max Drawdown{' '}
                        <span className={`font-medium ${maxColor.text}`}>
                          ({m.maxDdUsedPct.toFixed(0)}% · {maxColor.label})
                        </span>
                      </span>
                      <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                        Floor:{' '}
                        {formatMoney(
                          m.maxDdBreachFloor,
                          settings.currency,
                          settings.privacyMode,
                          { decimals: 0 }
                        )}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${maxColor.bar}`}
                        style={{ width: `${Math.max(2, Math.min(100, m.maxDdUsedPct))}%` }}
                      />
                    </div>
                  </div>

                  {isEval && m.account.profitTarget && (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[var(--text-secondary)]">
                          Profit Target ({m.profitTargetPct.toFixed(0)}%)
                        </span>
                        <span className="font-mono-num text-[11px] text-[var(--text-muted)]">
                          Goal:{' '}
                          {formatMoney(
                            m.account.profitTarget,
                            settings.currency,
                            settings.privacyMode,
                            { decimals: 0 }
                          )}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${Math.min(100, m.profitTargetPct)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Rule Compliance Strip */}
                {!settings.compactAccounts && (
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-subtle)] px-3 py-2 text-xs">
                    <div>
                      <span className="text-[var(--text-muted)] block text-[11px]">
                        Min Trading Days
                      </span>
                      <span className="font-mono-num font-semibold text-[var(--text-primary)]">
                        {m.tradingDaysCount} / {m.account.minTradingDays} min
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[var(--text-muted)] block text-[11px]">
                        Consistency Cap
                      </span>
                      <span
                        className="font-mono-num font-semibold"
                        style={{
                          color:
                            m.consistencyPct > m.account.consistencyCapPct
                              ? 'var(--warning)'
                              : 'var(--text-primary)',
                        }}
                      >
                        {m.consistencyPct.toFixed(0)}% / {m.account.consistencyCapPct}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onQuickLogForAccount(m.account.id)}
                    className="tb-btn-primary flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold cursor-pointer"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    Log
                  </button>
                  <button
                    type="button"
                    onClick={() => onQuickPayoutForAccount(m.account.id)}
                    className="tb-btn-ghost flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium cursor-pointer"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    Payout
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <AccountModal
        open={accountModalOpen}
        editingAccount={editingAccount}
        onClose={() => setAccountModalOpen(false)}
        onSave={onSaveAccount}
      />
    </div>
  );
};
