import React from 'react';

// One lightweight outline style for the complete admin navigation.
const paths = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  statistics: <><path d="M4 3v17h17M8 15v-4m5 4V7m5 8V4"/></>,
  stalls: <><path d="M3 10l2-6h14l2 6M4 10v10h16V10M3 10a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0M9 20v-6h6v6"/></>,
  foods: <><path d="M5 9a7 7 0 0114 0H5zM4 13h16M5 17h14v2H5zM9 5h.01M14 6h.01"/></>,
  'stall-menus': <><path d="M6 3h14v18H6a2 2 0 010-4h14M6 3a2 2 0 00-2 2v14M9 7h7M9 11h5"/></>,
  'stall-owners': <><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0112 0v3M16 4a3 3 0 010 6m2 4a5 5 0 013 4v3"/></>,
  orders: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 7h6M9 11h6M9 15h3"/></>,
  payments: <><rect x="2" y="4" width="20" height="15" rx="2"/><path d="M2 9h20M6 14h3m6 1 2 2 4-4"/></>,
  tickets: <><path d="M3 5h18v5a2 2 0 000 4v5H3v-5a2 2 0 000-4V5zM15 5v2m0 3v2m0 3v4"/></>,
  event: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18M8 15h2m4 0h2m-8 3h2"/></>,
  features: <><path d="M4 6h7m6 0h3M4 12h2m6 0h8M4 18h10m6 0h0"/><circle cx="14" cy="6" r="3"/><circle cx="9" cy="12" r="3"/><circle cx="17" cy="18" r="3"/></>,
  memories: <><path d="M3 7h4l2-3h6l2 3h4v13H3V7z"/><circle cx="12" cy="13" r="4"/></>,
  'crush-letters': <><rect x="2" y="5" width="20" height="15" rx="2"/><path d="M2 7l10 7L22 7M9 8c-2-2 1-4 3-2 2-2 5 0 3 2l-3 3-3-3z"/></>,
  'quiz-leaderboard': <><path d="M8 4h8v5a4 4 0 01-8 0V4zM5 5H3v2a3 3 0 003 3M19 5h2v2a3 3 0 01-3 3M9 15h6v3h2v2H7v-2h2v-3z"/></>,
};
export function NavIcon({name}) {
  return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]||paths.dashboard}</svg>;
}
