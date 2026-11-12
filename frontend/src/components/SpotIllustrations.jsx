import React from 'react';

// Hand-drawn Notion-style SVG spot illustrations (1.5px clean stroke, ink color, warm honey accent fill)

export function BeeSpot({ className = '', size = 80 }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 80 80" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Dashed flight trail */}
      <path 
        d="M12 58C18 58 20 48 28 48C36 48 38 62 46 62C52 62 54 52 60 50" 
        stroke="#1C1B19" 
        strokeWidth="1.5" 
        strokeDasharray="3 3" 
        strokeLinecap="round" 
      />
      {/* Bee body */}
      <ellipse cx="50" cy="38" rx="14" ry="10" transform="rotate(-15 50 38)" fill="#FDF6EC" stroke="#1C1B19" strokeWidth="1.5" />
      {/* Bee stripes */}
      <path d="M46 30C47 34 46 40 43 45" stroke="#1C1B19" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M52 28C53 33 52 40 49 44" stroke="#1C1B19" strokeWidth="1.5" strokeLinecap="round" fill="#E58E1A" />
      {/* Bee head */}
      <circle cx="61" cy="32" r="5" fill="#1C1B19" />
      {/* Antenna */}
      <path d="M63 28C65 24 68 24 70 25" stroke="#1C1B19" strokeWidth="1.25" strokeLinecap="round" />
      {/* Stinger */}
      <path d="M36 41L31 43L36 45" stroke="#1C1B19" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      {/* Wings */}
      <path d="M48 28C48 20 42 16 38 18C34 20 37 28 44 30" fill="#FFFFFF" stroke="#1C1B19" strokeWidth="1.5" />
      <path d="M44 29C42 22 36 20 33 22C30 24 33 30 40 31" fill="#FFFFFF" stroke="#1C1B19" strokeWidth="1.25" opacity="0.7" />
    </svg>
  );
}

export function ChainLinkSpot({ size = 72 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="18" y="24" width="22" height="14" rx="7" transform="rotate(-30 18 24)" stroke="#1C1B19" strokeWidth="1.75" fill="#FDF6EC" />
      <rect x="30" y="32" width="22" height="14" rx="7" transform="rotate(-30 30 32)" stroke="#1C1B19" strokeWidth="1.75" fill="#FFFFFF" />
      <line x1="28" y1="36" x2="40" y2="29" stroke="#E58E1A" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function CalendarSpot({ size = 72 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="16" y="20" width="40" height="38" rx="6" stroke="#1C1B19" strokeWidth="1.75" fill="#FFFFFF" />
      <path d="M16 30H56" stroke="#1C1B19" strokeWidth="1.5" />
      <line x1="26" y1="16" x2="26" y2="22" stroke="#1C1B19" strokeWidth="2" strokeLinecap="round" />
      <line x1="46" y1="16" x2="46" y2="22" stroke="#1C1B19" strokeWidth="2" strokeLinecap="round" />
      <rect x="24" y="38" width="6" height="6" rx="2" fill="#E58E1A" />
      <rect x="34" y="38" width="6" height="6" rx="2" fill="#F4F2ED" stroke="#1C1B19" strokeWidth="1" />
      <rect x="44" y="38" width="6" height="6" rx="2" fill="#F4F2ED" stroke="#1C1B19" strokeWidth="1" />
      <rect x="24" y="47" width="6" height="6" rx="2" fill="#F4F2ED" stroke="#1C1B19" strokeWidth="1" />
      <rect x="34" y="47" width="6" height="6" rx="2" fill="#F4F2ED" stroke="#1C1B19" strokeWidth="1" />
    </svg>
  );
}

export function EmptyTraySpot({ size = 80 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M16 38L24 60H56L64 38H50L46 44H34L30 38H16Z" stroke="#1C1B19" strokeWidth="1.75" fill="#FDF6EC" strokeLinejoin="round" />
      <line x1="28" y1="26" x2="52" y2="26" stroke="#8F8D87" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
      <line x1="32" y1="20" x2="48" y2="20" stroke="#8F8D87" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
      <circle cx="40" cy="50" r="3" fill="#E58E1A" />
    </svg>
  );
}

export function ExpiredLinkSpot({ size = 80 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="40" cy="40" r="26" stroke="#1C1B19" strokeWidth="1.75" fill="#FDF6EC" />
      <path d="M40 26V40L48 46" stroke="#1C1B19" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="20" y1="20" x2="60" y2="60" stroke="#B91C1C" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

