import React, { useState } from 'react';
import { ArrowRight, UserCheck } from 'lucide-react';
import { TradebookLogo } from './TradebookLogo';

interface StartupNameModalProps {
  open: boolean;
  onSaveName: (name: string) => void;
}

export const StartupNameModal: React.FC<StartupNameModalProps> = ({ open, onSaveName }) => {
  const [nameInput, setNameInput] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = nameInput.trim();
    if (!cleaned) return;
    onSaveName(cleaned);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="tb-glass w-full max-w-md rounded-2xl p-6 sm:p-7 space-y-5">
        <div className="flex flex-col items-center text-center space-y-3">
          <TradebookLogo size={64} className="rounded-2xl shadow-lg" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Welcome to <span className="lowercase">tradebook</span>
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[var(--text-secondary)]">
              Enter your trader name to personalize your workspace greeting. You can update it
              anytime in Settings.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="startup-trader-name"
              className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
            >
              Trader Name
            </label>
            <input
              id="startup-trader-name"
              type="text"
              autoFocus
              required
              maxLength={60}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Mr. Manjeet Chichkhede"
              className="tb-input w-full rounded-xl px-4 py-3 text-sm font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={!nameInput.trim()}
            className="tb-btn-primary w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserCheck className="w-4 h-4" />
            <span>Save &amp; Enter Terminal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
