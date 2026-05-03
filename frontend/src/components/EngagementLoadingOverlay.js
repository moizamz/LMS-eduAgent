import React, { useEffect, useState } from 'react';
import { Box, Typography, keyframes } from '@mui/material';
import { pickEngagementMessage } from '../constants/loadingEngagement';

const pulse = keyframes`
  0% { transform: scale(0.92); opacity: 0.55; }
  50% { transform: scale(1.06); opacity: 1; }
  100% { transform: scale(0.92); opacity: 0.55; }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

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
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: '3px solid transparent',
          borderTopColor: '#8b5cf6',
          borderRightColor: '#c4b5fd',
          animation: `${spin} 0.9s linear infinite`,
        }}
      />
      <Box
        sx={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          bgcolor: '#a78bfa',
          animation: `${pulse} 1.4s ease-in-out infinite`,
        }}
      />
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
