import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Typography } from '@mui/material';

/** Official EduAgent mark — `public/eduagent-logo.png` */
export const EDUAGENT_LOGO_PATH = `${process.env.PUBLIC_URL || ''}/eduagent-logo.png`;

const sizes = {
  /** AppBar + 64px sidebar strip (matches official site ~40px mark) */
  toolbar: { logo: 40, title: 'subtitle1', tagline: false },
  small: { logo: 36, title: 'subtitle1', tagline: false },
  medium: { logo: 44, title: 'h6', tagline: true },
  large: { logo: 52, title: 'h5', tagline: true },
};

function LogoMark({ px, inverse }) {
  return (
    <Box
      component="img"
      src={EDUAGENT_LOGO_PATH}
      alt=""
      height={px}
      width={px}
      sx={{
        height: px,
        width: px,
        objectFit: 'contain',
        flexShrink: 0,
        display: 'block',
        filter: inverse ? 'brightness(1.08) drop-shadow(0 1px 2px rgba(0,0,0,0.2))' : 'none',
      }}
      draggable={false}
    />
  );
}

/**
 * Official EduAgent logo + wordmark.
 * @param {string} [to] — if set, brand is a Router link
 * @param {'toolbar'|'small'|'medium'|'large'} [size]
 * @param {boolean} [inverse] — light text for purple / dark bars
 * @param {boolean} [stacked] — logo above text (e.g. auth cards)
 */
export default function EduAgentBrand({
  to,
  size = 'medium',
  showTagline,
  inverse = false,
  stacked = false,
  sx: sxProp,
}) {
  const s = sizes[size] || sizes.medium;
  const tagline = showTagline !== undefined ? showTagline : s.tagline;

  const titleSx = inverse
    ? { fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }
    : {
        fontWeight: 800,
        letterSpacing: '-0.02em',
        background: 'linear-gradient(120deg, #5b21b6 0%, #7c3aed 55%, #6366f1 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      };

  const taglineSx = inverse
    ? { color: 'rgba(255,255,255,0.78)', fontWeight: 500 }
    : { color: 'text.secondary', fontWeight: 500 };

  const textBlock = (
    <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
      <Typography
        variant={s.title}
        component="span"
        sx={{
          ...titleSx,
          display: 'block',
          lineHeight: stacked ? 1.15 : 1.1,
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
        }}
      >
        EduAgent
      </Typography>
      {tagline && (
        <Typography
          variant="caption"
          sx={{
            ...taglineSx,
            display: 'block',
            mt: stacked ? 0.35 : 0.15,
            lineHeight: 1.35,
            whiteSpace: stacked ? 'normal' : 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}
        >
          Learning, amplified
        </Typography>
      )}
    </Box>
  );

  const inner = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: stacked ? 'column' : 'row',
        alignItems: stacked ? 'flex-start' : 'center',
        gap: stacked ? 1 : 1.25,
        color: 'inherit',
        ...sxProp,
      }}
    >
      <LogoMark px={s.logo} inverse={inverse} />
      {textBlock}
    </Box>
  );

  const wrapSx = {
    textDecoration: 'none',
    color: 'inherit',
    display: stacked ? 'flex' : 'inline-flex',
    alignItems: stacked ? 'stretch' : 'center',
    maxWidth: '100%',
    minWidth: 0,
    transition: 'opacity 0.15s ease',
    '&:hover': { opacity: 0.92 },
  };

  if (to) {
    return (
      <Box component={RouterLink} to={to} sx={wrapSx} aria-label="EduAgent — go to dashboard">
        {inner}
      </Box>
    );
  }

  return <Box sx={{ display: stacked ? 'flex' : 'inline-flex', alignItems: 'center', maxWidth: '100%', minWidth: 0 }}>{inner}</Box>;
}
