import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Grid,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Psychology, Speed, TrendingUp, School, FactCheck } from '@mui/icons-material';
import api from '../services/api';

function MiniBars({ values, label }) {
  if (!values?.length) {
    return (
      <Typography variant="caption" color="text.secondary">
        No session traces yet — finish at least one adaptive run with 2+ steps.
      </Typography>
    );
  }
  const max = Math.max(0.01, ...values.map((v) => Math.abs(v)));
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 72 }}>
        {values.slice(0, 14).map((v, i) => {
          const h = 8 + (Math.abs(v) / max) * 56;
          const pos = v >= 0;
          return (
            <Box
              key={i}
              title={`Δθ ${v.toFixed(3)}`}
              sx={{
                width: 10,
                height: `${h}px`,
                borderRadius: '4px 4px 0 0',
                bgcolor: pos ? '#7c3aed' : '#f59e0b',
                opacity: 0.85,
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}

export default function StudentAdaptiveAnalytics({ courseId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const res = await api.get(`/quizzes/adaptive-insights/${courseId}/`);
        if (!c) setData(res.data);
      } catch (e) {
        if (!c) setErr(e?.response?.data?.error || 'Could not load adaptive analytics');
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [courseId]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={3}>
        <CircularProgress size={32} />
      </Box>
    );
  }
  if (err) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        {err}
      </Alert>
    );
  }
  if (!data) return null;

  const faithMean = data.faithfulness_series_mean;
  const covMean = data.coverage_series_mean;
  const lat = data.generation_latency || {};
  const lb = data.latest_bank_quality || {};
  const psych = data.stratum_psychometrics || [];

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, color: '#4c1d95', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Psychology color="primary" />
        Adaptive practice intelligence
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Hybrid policy: tabular Q-learning + UCB bandit + linear TD head (DQN-style), plus θ (IRT-lite) and topic balancing
        on top of the same selector.
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ borderColor: 'rgba(124,58,237,0.35)', height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <TrendingUp fontSize="small" /> Ability (θ)
              </Typography>
              <Typography variant="h4" sx={{ color: '#7c3aed', fontWeight: 800 }}>
                {Number(data.theta ?? 0).toFixed(2)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Updated each practice step (1PL-style on item difficulty).
              </Typography>
              <Box sx={{ mt: 2 }}>
                <MiniBars values={data.theta_session_deltas || []} label="Recent session Δθ (end − start)" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ borderColor: 'rgba(124,58,237,0.35)', height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <FactCheck fontSize="small" /> Faithfulness & coverage
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                Mean citation grounding (bank generations)
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, (faithMean ?? 0) * 100)}
                sx={{ height: 10, borderRadius: 2, mb: 1.5, '& .MuiLinearProgress-bar': { bgcolor: '#8b5cf6' } }}
              />
              <Typography variant="body2" sx={{ mb: 2 }}>
                {(faithMean != null ? (faithMean * 100).toFixed(0) : '—')}% avg · last bank:{' '}
                {lb.faithfulness_pct_display != null ? `${lb.faithfulness_pct_display}%` : '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                Bloom blueprint coverage (last bank)
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, lb.coverage_blueprint_pct ?? covMean ?? 0)}
                sx={{ height: 10, borderRadius: 2, '& .MuiLinearProgress-bar': { bgcolor: '#a78bfa' } }}
              />
              <Typography variant="body2">
                {lb.coverage_blueprint_pct != null ? `${lb.coverage_blueprint_pct}%` : covMean != null ? `${covMean.toFixed(0)}% avg` : '—'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ borderColor: 'rgba(124,58,237,0.35)', height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <Speed fontSize="small" /> Latency & cost (est.)
              </Typography>
              <Typography variant="body2" gutterBottom>
                p50: <strong>{lat.p50_ms != null ? `${lat.p50_ms} ms` : '—'}</strong> · p95:{' '}
                <strong>{lat.p95_ms != null ? `${lat.p95_ms} ms` : '—'}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Samples: {lat.samples ?? 0} adaptive banks · tokens/item (last bank):{' '}
                {lb.tokens_per_item_est != null ? lb.tokens_per_item_est : '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Last provider: {lb.provider || '—'} · validation kept {lb.validation_summary?.kept_count ?? '—'} /{' '}
                {lb.validation_summary?.input_count ?? '—'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ borderColor: 'rgba(124,58,237,0.25)' }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                <School fontSize="small" /> Weak topics & recommendations
              </Typography>
              {(data.recommendations || []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Keep practicing — we will surface Bloom levels that need work once we have enough responses per topic.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  {data.recommendations.map((r, i) => (
                    <Alert key={i} severity="info" icon={false} sx={{ py: 0.75 }}>
                      <Typography variant="subtitle2">{r.title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {r.detail}
                      </Typography>
                    </Alert>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ borderColor: 'rgba(124,58,237,0.25)' }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Stratum psychometrics (pilot)
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
                Empirical p-value = fraction correct per difficulty|lecture::taxonomy bucket. Discrimination proxy activates when N≥8
                in that bucket.
              </Typography>
              <Box sx={{ maxHeight: 220, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {psych.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No stratum data yet.
                  </Typography>
                ) : (
                  psych.slice(0, 12).map((row) => (
                    <Box key={row.stratum}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {row.stratum}
                        </Typography>
                        <Chip size="small" label={`n=${row.n}`} />
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, row.p_value_empirical * 100)}
                        sx={{ height: 6, borderRadius: 3, mb: 0.25 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        p̂ = {row.p_value_empirical} · disc. {row.discrimination_proxy != null ? row.discrimination_proxy : '—'}
                      </Typography>
                    </Box>
                  ))
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card variant="outlined" sx={{ bgcolor: '#faf5ff' }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Evaluation · human review (sample)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Suggested sample rate: {data.human_review?.sample_pct ?? 5}% of bank items for educator rubric (clarity,
                alignment). Status: <strong>{data.human_review?.status || 'not_scheduled'}</strong>.
              </Typography>
              {data.post_test && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Latest quiz signal: <strong>{data.post_test.last_quiz_score?.toFixed?.(1) ?? data.post_test.last_quiz_score}%</strong> on{' '}
                  {data.post_test.quiz_title}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
