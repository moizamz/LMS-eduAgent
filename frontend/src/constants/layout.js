/** Must match AppBar / sidebar brand strip height */
export const APP_BAR_HEIGHT = 64;

/** Top chrome (navbar + sidebar brand row) — keep in sync everywhere */
export const appBarChromeStyles = {
  background: 'linear-gradient(105deg, #4c1d95 0%, #6d28d9 42%, #7c3aed 100%)',
  borderBottom: '1px solid rgba(255,255,255,0.12)',
  boxShadow: '0 4px 24px rgba(76, 29, 149, 0.25)',
};

/** Same styles as `appBarChromeStyles` — used by the sidebar brand strip */
export const sidebarBrandChromeStyles = appBarChromeStyles;
