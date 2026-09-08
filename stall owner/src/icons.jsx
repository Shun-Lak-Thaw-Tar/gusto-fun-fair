import React from 'react';

// One lightweight outline style for the stall owner navigation.
const paths = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  statistics: <><path d="M4 3v17h17M8 15v-4m5 4V7m5 8V4"/></>,
  stalls: <><path d="M3 10l2-6h14l2 6M4 10v10h16V10M3 10a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0M9 20v-6h6v6"/></>,
  foods: <><path d="M5 9a7 7 0 0114 0H5zM4 13h16M5 17h14v2H5zM9 5h.01M14 6h.01"/></>,
  orders: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 7h6M9 11h6M9 15h3"/></>,
  tickets: <><path d="M3 5h18v5a2 2 0 000 4v5H3v-5a2 2 0 000-4V5zM15 5v2m0 3v2m0 3v4"/></>,
  share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></>,
};
export function NavIcon({name}) {
  return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]||paths.dashboard}</svg>;
}
