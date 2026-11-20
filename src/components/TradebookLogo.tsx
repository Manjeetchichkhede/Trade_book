import React from 'react';

interface TradebookLogoProps {
  size?: number;
  className?: string;
}

export const TradebookLogo: React.FC<TradebookLogoProps> = ({ size = 36, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="tradebook logo"
    >
      <defs>
        <linearGradient id="tb-logo-bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="55%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
        <linearGradient id="tb-logo-shine" x1="0" y1="0" x2="512" y2="256" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#tb-logo-bg)" />
      <rect width="512" height="512" rx="112" fill="url(#tb-logo-shine)" />
      <rect
        x="18"
        y="18"
        width="476"
        height="476"
        rx="96"
        stroke="#ffffff"
        strokeOpacity="0.2"
        strokeWidth="6"
      />
      <line x1="154" y1="128" x2="154" y2="366" stroke="#93c5fd" strokeWidth="18" strokeLinecap="round" />
      <rect x="128" y="188" width="52" height="118" rx="14" fill="#ffffff" />
      <line x1="256" y1="104" x2="256" y2="398" stroke="#bfdbfe" strokeWidth="18" strokeLinecap="round" />
      <rect x="230" y="148" width="52" height="172" rx="14" fill="#60a5fa" />
      <line x1="358" y1="138" x2="358" y2="386" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" />
      <rect x="332" y="176" width="52" height="134" rx="14" fill="#ffffff" />
      <path
        d="M116 392C160 374 216 374 256 398C296 374 352 374 396 392"
        stroke="#ffffff"
        strokeWidth="20"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
