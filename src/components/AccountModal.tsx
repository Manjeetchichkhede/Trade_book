import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { AccountStage, DrawdownType, PropAccount } from '../types';
import { generateId, getTodayISO } from '../utils/format';

interface AccountModalProps {
  open: boolean;
  editingAccount: PropAccount | null;
  onClose: () => void;
  onSave: (account: PropAccount) => void;
}

const STAGES: AccountStage[] = ['Funded', 'Eval Phase 1', 'Eval Phase 2'];
const DD_TYPES: DrawdownType[] = ['EOD Trailing', 'Intraday Trailing', 'Static'];

export const AccountModal: React.FC<AccountModalProps> = ({
  open,
  editingAccount,
  onClose,
  onSave,
}) => {
  const [firm, setFirm] = useState('FTMO');
  const [name, setName] = useState('');
  const [stage, setStage] = useState<AccountStage>('Funded');
  const [startingBalance, setStartingBalance] = useState('100000');
  const [drawdownType, setDrawdownType] = useState<DrawdownType>('EOD Trailing');
  const [dailyLossLimit, setDailyLossLimit] = useState('5000');
  const [maxDrawdown, setMaxDrawdown] = useState('10000');
  const [profitTarget, setProfitTarget] = useState('8000');
  const [minTradingDays, setMinTradingDays] = useState('5');
  const [consistencyCapPct, setConsistencyCapPct] = useState('30');
  const [evalFee, setEvalFee] = useState('540');

  useEffect(() => {
    if (!open) return;
    if (editingAccount) {
      setFirm(editingAccount.firm);
      setName(editingAccount.name);
      setStage(editingAccount.stage);
      setStartingBalance(String(editingAccount.startingBalance));
      setDrawdownType(editingAccount.drawdownType);
      setDailyLossLimit(String(editingAccount.dailyLossLimit));
      setMaxDrawdown(String(editingAccount.maxDrawdown));
      setProfitTarget(String(editingAccount.profitTarget ?? 0));
      setMinTradingDays(String(editingAccount.minTradingDays));
      setConsistencyCapPct(String(editingAccount.consistencyCapPct));
      setEvalFee(String(editingAccount.evalFee));
    } else {
      setFirm('FTMO');
      setName('');
      setStage('Eval Phase 1');
      setStartingBalance('50000');
      setDrawdownType('EOD Trailing');
      setDailyLossLimit('2500');
      setMaxDrawdown('5000');
      setProfitTarget('4000');
      setMinTradingDays('5');
      setConsistencyCapPct('30');
      setEvalFee('299');
    }
  }, [open, editingAccount]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const bal = Math.max(1000, Number(startingBalance) || 50000);
    const acc: PropAccount = {
      id: editingAccount ? editingAccount.id : generateId('acc'),
      firm: firm.trim() || 'Prop Firm',
      name: name.trim() || `${firm.trim() || 'Prop'} ${(bal / 1000).toFixed(0)}K ${stage}`,
      stage,
      startingBalance: bal,
      drawdownType,
      dailyLossLimit: Math.max(50, Number(dailyLossLimit) || bal * 0.05),
      maxDrawdown: Math.max(100, Number(maxDrawdown) || bal * 0.1),
      profitTarget:
        stage === 'Funded' ? undefined : Math.max(100, Number(profitTarget) || bal * 0.08),
      minTradingDays: Math.max(1, Number(minTradingDays) || 5),
      consistencyCapPct: Math.max(5, Math.min(100, Number(consistencyCapPct) || 30)),
      evalFee: Math.max(0, Number(evalFee) || 0),
      createdAt: editingAccount ? editingAccount.createdAt : getTodayISO(),
    };
    onSave(acc);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="tb-glass w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {editingAccount ? 'Edit Prop Account' : 'Add Funded / Eval Account'}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Configure firm rules, drawdown floor type, and consistency targets.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Prop Firm
              </label>
              <input
                type="text"
                required
                value={firm}
                onChange={(e) => setFirm(e.target.value)}
                placeholder="e.g. FTMO, FundingPips, Apex"
                className="tb-input w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Account Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. FTMO 100K Swing Funded"
                className="tb-input w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Account Stage
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as AccountStage)}
                className="tb-input w-full rounded-xl px-3.5 py-2.5 text-sm"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Drawdown Type
              </label>
              <select
                value={drawdownType}
                onChange={(e) => setDrawdownType(e.target.value as DrawdownType)}
                className="tb-input w-full rounded-xl px-3.5 py-2.5 text-sm"
              >
                {DD_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Starting Balance ($)
              </label>
              <input
                type="number"
                min="1000"
                step="100"
                required
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                className="tb-input font-mono-num w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Daily Loss Limit ($)
              </label>
              <input
                type="number"
                min="50"
                step="50"
                required
                value={dailyLossLimit}
                onChange={(e) => setDailyLossLimit(e.target.value)}
                className="tb-input font-mono-num w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Max Drawdown ($)
              </label>
              <input
                type="number"
                min="100"
                step="50"
                required
                value={maxDrawdown}
                onChange={(e) => setMaxDrawdown(e.target.value)}
                className="tb-input font-mono-num w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stage !== 'Funded' && (
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  Profit Target ($)
                </label>
                <input
                  type="number"
                  min="100"
                  step="50"
                  value={profitTarget}
                  onChange={(e) => setProfitTarget(e.target.value)}
                  className="tb-input font-mono-num w-full rounded-xl px-3.5 py-2.5 text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Min Trading Days
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={minTradingDays}
                onChange={(e) => setMinTradingDays(e.target.value)}
                className="tb-input font-mono-num w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Consistency Cap %
              </label>
              <input
                type="number"
                min="10"
                max="100"
                value={consistencyCapPct}
                onChange={(e) => setConsistencyCapPct(e.target.value)}
                className="tb-input font-mono-num w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Eval Fee ($)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={evalFee}
                onChange={(e) => setEvalFee(e.target.value)}
                className="tb-input font-mono-num w-full rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              className="tb-btn-ghost rounded-xl px-4 py-2.5 text-sm font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="tb-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold cursor-pointer"
            >
              {editingAccount ? 'Save Changes' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
