import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { pickEngagementMessage } from '../constants/loadingEngagement';

/**
 * Full-bleed overlay with playful copy rotation while `active` is true.
 */
export default function EngagementLoadingOverlay({ active, messages, subtitle }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 2800);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  const msg = pickEngagementMessage(messages, tick);

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        px: 3,
        py: 4,
        borderRadius: 2,
        background: 'linear-gradient(135deg, rgba(250,245,255,0.97) 0%, rgba(237,233,254,0.98) 50%, rgba(243,232,255,0.97) 100%)',
        backdropFilter: 'blur(6px)',
        border: '1px solid rgba(139, 92, 246, 0.25)',
      }}
    >
      <CircularProgress size={56} thickness={4} sx={{ color: '#8b5cf6' }} />
      <Typography
        variant="subtitle1"
        align="center"
        sx={{
          maxWidth: 420,
          fontWeight: 600,
          color: '#4c1d95',
          lineHeight: 1.45,
          textShadow: '0 1px 0 rgba(255,255,255,0.8)',
        }}
      >
        {msg}
      </Typography>
      {subtitle ? (
        <Typography variant="caption" color="text.secondary" align="center">
          {subtitle}
        </Typography>
      ) : null}
    </Box>
  );
}
