/**
 * Shared surface styles (Dashboard insights, section bands) aligned with global Card/Tabs theme in App.js.
 */
import { alpha } from '@mui/material/styles';

/** Band behind a section title (e.g. “Your insights”, “My learning”). */
export const sectionHeaderBandSx = {
  py: 1.25,
  px: 2,
  borderRadius: 2,
  background: `linear-gradient(90deg, ${alpha('#7c3aed', 0.08)} 0%, transparent 100%)`,
  border: `1px solid ${alpha('#7c3aed', 0.15)}`,
};

/**
 * @param {'positive'|'attention'|'neutral'} variant
 * @returns {{ chip: string, chipSx: object, border: string, bg: string, bar: string, shadow: string, iconColor: string }}
 */
export function insightVariantPalette(variant) {
  const v = variant === 'positive' ? 'positive' : variant === 'attention' ? 'attention' : 'neutral';
  if (v === 'positive') {
    return {
      chip: 'Momentum',
      chipSx: { bgcolor: '#dcfce7', color: '#166534', fontWeight: 700 },
      border: alpha('#16a34a', 0.35),
      bg: `linear-gradient(142deg, ${alpha('#dcfce7', 0.5)} 0%, #ffffff 48%, #ffffff 100%)`,
      bar: 'linear-gradient(180deg, #4ade80 0%, #16a34a 100%)',
      shadow: `0 6px 24px ${alpha('#16a34a', 0.12)}`,
      iconColor: '#16a34a',
    };
  }
  if (v === 'attention') {
    return {
      chip: 'Focus',
      chipSx: { bgcolor: '#ffedd5', color: '#c2410c', fontWeight: 700 },
      border: alpha('#ea580c', 0.38),
      bg: `linear-gradient(142deg, ${alpha('#ffedd5', 0.65)} 0%, #ffffff 50%, #ffffff 100%)`,
      bar: 'linear-gradient(180deg, #fb923c 0%, #ea580c 100%)',
      shadow: `0 6px 24px ${alpha('#ea580c', 0.12)}`,
      iconColor: '#ea580c',
    };
  }
  return {
    chip: 'Insight',
    chipSx: { bgcolor: '#ede9fe', color: '#5b21b6', fontWeight: 700 },
    border: alpha('#8b5cf6', 0.35),
    bg: `linear-gradient(142deg, ${alpha('#ede9fe', 0.7)} 0%, #ffffff 50%, #faf5ff 100%)`,
    bar: 'linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)',
    shadow: `0 6px 24px ${alpha('#6d28d9', 0.12)}`,
    iconColor: '#7c3aed',
  };
}

/** Full-width page shell (Dashboard, workspace tabs, instructor hub). */
export const workspacePageBackgroundSx = {
  bgcolor: '#f5f5f5',
  minHeight: '100vh',
  width: '100%',
};

/** Horizontal + vertical padding for main content inside the shell. */
export const workspaceContentContainerSx = {
  px: { xs: 2, sm: 3 },
  pt: { xs: 3, sm: 4 },
  pb: { xs: 4, sm: 5 },
};

/** Primary page title (matches instructor band heading). */
export const pageHeadingTitleSx = {
  fontWeight: 800,
  color: '#312e81',
  letterSpacing: '-0.02em',
};

/** Icon + title row above tabs (purple band). */
export const workspacePageHeadingRowSx = {
  ...sectionHeaderBandSx,
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  mb: 2.5,
};

/** Admin / data tables on a Paper surface. */
export const workspaceTablePaperSx = {
  borderRadius: 3,
  overflow: 'hidden',
  border: `1px solid ${alpha('#7c3aed', 0.12)}`,
  boxShadow: `0 4px 18px ${alpha('#4c1d95', 0.06)}`,
};
