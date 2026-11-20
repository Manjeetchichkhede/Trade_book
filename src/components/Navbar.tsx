import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Calculator,
  Clock,
  Download,
  LayoutDashboard,
  Settings,
  TrendingUp,
  X,
} from 'lucide-react';
import { TabId } from '../types';
import { TradebookLogo } from './TradebookLogo';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface NavbarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onOpenSettings: () => void;
}

const NAV_ITEMS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] =
  [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'lotsize', label: 'Lot Size', icon: Calculator },
    { id: 'sessions', label: 'Sessions', icon: Clock },
    { id: 'roi', label: 'ROI', icon: TrendingUp },
  ];

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange, onOpenSettings }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Desktop sliding pill geometry
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  const updatePill = () => {
    const container = navContainerRef.current;
    const activeBtn = buttonRefs.current[activeTab];
    if (!container || !activeBtn) return;
    setPillStyle({
      left: activeBtn.offsetLeft,
      width: activeBtn.offsetWidth,
      ready: true,
    });
  };

  useLayoutEffect(() => {
    updatePill();
  }, [activeTab]);

  useEffect(() => {
    const onResize = () => updatePill();
    window.addEventListener('resize', onResize);
    // Re-measure after fonts settle
    const t = window.setTimeout(updatePill, 150);
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(t);
    };
  }, [activeTab]);

  return (
    <>
      <header className="sticky top-0 z-30 w-full px-4 sm:px-6 pt-3 pb-2">
        <div className="mx-auto max-w-[1360px] flex items-center justify-between gap-4">
          {/* Left: Brand & Greeting */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => onTabChange('overview')}
              className="flex items-center gap-2.5 text-left group focus:outline-none"
              aria-label="Go to Overview"
            >
              <TradebookLogo
                size={36}
                className="rounded-xl shadow-md transition-transform duration-150 group-hover:scale-105 shrink-0"
              />
              <div className="leading-tight">
                <span className="block text-lg font-bold tracking-tight lowercase text-[var(--text-primary)] whitespace-nowrap">
                  tradebook
                </span>
                <span className="hidden xl:block text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                  Welcome back, Mr. Manjeet Chichkhede
                </span>
              </div>
            </button>
          </div>

          {/* Center: Desktop Floating Frosted-Glass Pill Nav with Sliding Active Pill */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center justify-center"
          >
            <div
              ref={navContainerRef}
              className="tb-glass-nav relative flex items-center gap-1 rounded-full p-1.5"
            >
              {/* Smooth CSS sliding active pill */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1.5 bottom-1.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  transform: `translateX(${pillStyle.left - 6}px)`,
                  width: `${pillStyle.width}px`,
                  backgroundColor: 'var(--nav-pill)',
                  opacity: pillStyle.ready ? 1 : 0,
                }}
              />
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    ref={(el) => {
                      buttonRefs.current[id] = el;
                    }}
                    type="button"
                    onClick={() => onTabChange(id)}
                    className="relative z-10 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-200 cursor-pointer"
                    style={{
                      color: isActive ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
                    }}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Right: Install App (optional) + Settings Gear */}
          <div className="flex items-center gap-2 shrink-0">
            {!isInstalled && isInstallable && (
              <button
                type="button"
                onClick={install}
                className="tb-btn-primary flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install App</span>
              </button>
            )}
            {!isInstalled && !isInstallable && isIOS && (
              <button
                type="button"
                onClick={() => setShowIOSGuide(true)}
                className="tb-btn-ghost flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Open Settings"
              title="Settings"
              className="tb-glass-nav flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <Settings className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Floating Bottom Frosted-Glass Pill Navigation (< 768px) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pt-1"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="tb-glass-nav mx-auto max-w-md flex items-center justify-between rounded-full p-1.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-2 px-1 text-[11px] font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: isActive ? 'var(--nav-pill)' : 'transparent',
                  color: isActive ? 'var(--nav-pill-text)' : 'var(--text-secondary)',
                }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="leading-none">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* iOS Safari Install Guide Modal */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="tb-glass w-full max-w-sm rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Install tradebook on iOS
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-2 text-sm text-[var(--text-secondary)] list-decimal pl-5">
              <li>
                Tap the <strong className="text-[var(--text-primary)]">Share</strong> icon in the
                Safari toolbar.
              </li>
              <li>
                Scroll down and select{' '}
                <strong className="text-[var(--text-primary)]">Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong className="text-[var(--text-primary)]">Add</strong> to launch tradebook
                full-screen offline.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="tb-btn-primary mt-5 w-full rounded-xl py-2.5 text-sm font-semibold cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
