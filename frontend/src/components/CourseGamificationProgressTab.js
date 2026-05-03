import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
} from '@mui/material';
import { format, parseISO } from 'date-fns';
import api from '../services/api';

function BarChart({ counts }) {
  const entries = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No events logged yet — complete a lesson, quiz, or practice to see activity here.
      </Typography>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
      {entries.map(([k, v]) => (
        <Box key={k}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
              {k.replace(/_/g, ' ')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {v}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(v / max) * 100}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: '#ede9fe',
              '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: '#8b5cf6' },
            }}
          />
        </Box>
      ))}
    </Box>
  );
}

function XpSparkline({ points }) {
  if (!points?.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        XP trend appears after your first rewarded actions in this course.
      </Typography>
    );
  }
  const vals = points.map((p) => p.cumulative_logged_xp || 0);
  const max = Math.max(...vals, 1);
  const n = vals.length;
  const w = 320;
  const h = 90;
  const pad = 6;
  const coords = vals.map((y, i) => {
    const x = pad + (i / Math.max(1, n - 1)) * (w - pad * 2);
    const yy = h - pad - (y / max) * (h - pad * 2);
    return `${x},${yy}`;
  });
  const d = `M ${coords.join(' L ')}`;
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <linearGradient id="xpGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <path d={d} fill="none" stroke="url(#xpGrad)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            Cumulative XP from recent logged rewards (last {n} events shown).
      </Typography>
    </Box>
  );
}

export default function CourseGamificationProgressTab({ courseId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/gamification/course/${courseId}/history/`, { params: { limit: 120 } });
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.error || 'Could not load progress');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }
  if (error) {
    return (
      <Typography color="error" sx={{ py: 2 }}>
        {error}
      </Typography>
    );
  }

  const st = data?.state;

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%', boxShadow: '0 2px 12px rgba(124,58,237,0.12)' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, color: '#4c1d95' }}>
              Snapshot
            </Typography>
            {st ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Chip color="primary" label={`Level ${st.level}`} size="small" />
                <Typography variant="body2">
                  <strong>{st.total_xp}</strong> total XP
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Streak: {st.current_streak_days}d (best {st.longest_streak_days}d)
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {st.xp_into_level} XP into this level · {st.xp_to_next_level} XP to go for the next level
                </Typography>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No gamification state yet for this course.
              </Typography>
            )}
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Badges ({data?.badges?.length || 0})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {(data?.badges || []).slice(0, 12).map((b) => (
                  <Chip key={b.slug} size="small" variant="outlined" label={b.title || b.slug} />
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={8}>
        <Card sx={{ mb: 3, boxShadow: '0 2px 12px rgba(124,58,237,0.1)' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, color: '#4c1d95' }}>
              XP curve (recent rewards)
            </Typography>
            <XpSparkline points={data?.xp_curve || []} />
          </CardContent>
        </Card>
        <Card sx={{ mb: 3, boxShadow: '0 2px 12px rgba(124,58,237,0.1)' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, color: '#4c1d95' }}>
              Activity mix
            </Typography>
            <BarChart counts={data?.event_counts || {}} />
          </CardContent>
        </Card>
        <Card sx={{ boxShadow: '0 2px 12px rgba(124,58,237,0.1)' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, color: '#4c1d95' }}>
              Reward log
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 420, overflow: 'auto' }}>
              {(data?.ledger || []).map((row) => (
                <Box
                  key={row.id}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    background: 'linear-gradient(90deg, rgba(237,233,254,0.5) 0%, rgba(255,255,255,0.9) 100%)',
                    borderLeft: '4px solid #8b5cf6',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {(() => {
                        try {
                          return format(parseISO(row.created_at), 'MMM d, yyyy · HH:mm');
                        } catch {
                          return row.created_at;
                        }
                      })()}
                    </Typography>
                    <Chip size="small" label={`+${row.points_total} XP`} sx={{ bgcolor: '#ede9fe', fontWeight: 700 }} />
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize', mt: 0.5 }}>
                    {row.event_type?.replace(/_/g, ' ')}
                  </Typography>
                  {row.remark ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {row.remark}
                    </Typography>
                  ) : null}
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
