import React from 'react';

type IconProps = {
  s?: number;
  c?: string;
  className?: string;
};

export const IcGrid = ({ s = 18, c = 'currentColor', className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none" className={className}>
    <rect x="2" y="2" width="7" height="7" rx="2" stroke={c} strokeWidth="1.5" />
    <rect x="11" y="2" width="7" height="7" rx="2" stroke={c} strokeWidth="1.5" />
    <rect x="2" y="11" width="7" height="7" rx="2" stroke={c} strokeWidth="1.5" />
    <rect x="11" y="11" width="7" height="7" rx="2" stroke={c} strokeWidth="1.5" />
  </svg>
);

export const IcChart = ({ s = 18, c = 'currentColor', className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none" className={className}>
    <polyline points="2,15 7,9 11,12 17,4" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="2" y1="18" x2="18" y2="18" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const IcBrain = ({ s = 18, c = 'currentColor', className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none" className={className}>
    <circle cx="10" cy="10" r="7" stroke={c} strokeWidth="1.5" />
    <path d="M7 10c0-1.5 1-3 3-3s3 1.5 3 3-1 3-3 3" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="10" r="1.5" fill={c} />
  </svg>
);

export const IcBrief = ({ s = 18, c = 'currentColor', className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none" className={className}>
    <rect x="2" y="7" width="16" height="11" rx="2" stroke={c} strokeWidth="1.5" />
    <path d="M7 7V5a3 3 0 016 0v2" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const IcBkmrk = ({ s = 18, c = 'currentColor', className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none" className={className}>
    <path d="M5 2h10a1 1 0 011 1v15l-6-4-6 4V3a1 1 0 011-1z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

export const IcNews = ({ s = 18, c = 'currentColor', className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none" className={className}>
    <rect x="2" y="3" width="16" height="14" rx="2" stroke={c} strokeWidth="1.5" />
    <line x1="6" y1="8" x2="14" y2="8" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="6" y1="11" x2="11" y2="11" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const IcBell = ({ s = 18, c = 'currentColor', className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none" className={className}>
    <path d="M10 2a6 6 0 016 6v3l1.5 2.5H2.5L4 11V8a6 6 0 016-6z" stroke={c} strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M8 16a2 2 0 004 0" stroke={c} strokeWidth="1.5" />
  </svg>
);

export const IcGear = ({ s = 18, c = 'currentColor', className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none" className={className}>
    <circle cx="10" cy="10" r="3" stroke={c} strokeWidth="1.5" />
    <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const IcSearch = ({ s = 15, c = 'currentColor', className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none" className={className}>
    <circle cx="8.5" cy="8.5" r="5.5" stroke={c} strokeWidth="1.5" />
    <line x1="13" y1="13" x2="17.5" y2="17.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const IcSend = ({ s = 16, c = 'currentColor', className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none" className={className}>
    <path d="M18 2L9 11M18 2L12 18l-3-7-7-3 16-6z" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IcPlus = ({ s = 16, c = 'currentColor', className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none" className={className}>
    <line x1="10" y1="3" x2="10" y2="17" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="3" y1="10" x2="17" y2="10" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const IcTrash = ({ s = 15, c = 'currentColor', className }: IconProps) => (
  <svg width={s} height={s} viewBox="0 0 20 20" fill="none" className={className}>
    <path d="M4 5h12M8 5V3h4v2M6 5l1 12h6l1-12" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
