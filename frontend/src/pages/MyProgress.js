import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CircularProgress,
  LinearProgress,
  Grid,
  Chip,
  Divider,
  Paper,
} from '@mui/material';
import { TrendingUp, EmojiEvents, Psychology } from '@mui/icons-material';
import { format, parseISO } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

function XpByDayChart({ points }) {
  if (!points?.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        No XP logged in the last two weeks — open a course and complete a lesson, quiz, or practice.
      </Typography>
    );
  }
  const max = Math.max(1, ...points.map((p) => p.xp || 0));
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, flexWrap: 'wrap', minHeight: 120, pt: 2 }}>
      {points.map((p) => (
        <Box key={p.date} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 36 }}>
          <Box
            sx={{
              width: 28,
              height: `${Math.max(8, (p.xp / max) * 72)}px`,
              borderRadius: '6px 6px 0 0',
              background: 'linear-gradient(180deg, #c4b5fd, #7c3aed)',
              transition: 'height 0.2s ease',
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.65rem', textAlign: 'center' }}>
            {(() => {
              try {
                return format(parseISO(`${p.date}T12:00:00`), 'MMM d');
              } catch {
                return p.date?.slice(5);
              }
            })()}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function ThetaByCourseChart({ courses }) {
  const rows = (courses || []).filter((c) => c && c.course_title);
  if (!rows.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        Enroll in a course and run adaptive practice to populate ability estimates.
      </Typography>
    );
  }
  const maxAbs = Math.max(0.5, ...rows.map((c) => Math.abs(Number(c.theta) || 0)));
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
      {rows.map((c) => {
        const t = Number(c.theta) || 0;
        const pct = 50 + (t / maxAbs) * 45;
        return (
          <Box key={c.course_id}>
            <Typography variant="caption" sx={{ fontWeight: 600 }} noWrap title={c.course_title}>
              {c.course_title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36 }}>
                θ {t.toFixed(2)}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.max(0, pct))}
                sx={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  '& .MuiLinearProgress-bar': { bgcolor: t >= 0 ? '#7c3aed' : '#f59e0b' },
                }}
              />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

const MyProgress = () => {
  const { user } = useAuth();
  const [progress, setProgress] = useState([]);
  const [rewardDash, setRewardDash] = useState(null);
  const [learningSummary, setLearningSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const fetchProgress = async () => {
    try {
      const [enRes, gRes, learnRes] = await Promise.all([
        api.get('/courses/my-enrollments/'),
        user?.role === 'student'
          ? api.get('/gamification/student/dashboard/').catch(() => null)
          : Promise.resolve(null),
        user?.role === 'student'
          ? api.get('/quizzes/my-learning-summary/').catch(() => null)
          : Promise.resolve(null),
      ]);
      const enrollments = Array.isArray(enRes.data) ? enRes.data : [];
      setProgress(enrollments);
      if (gRes?.data) setRewardDash(gRes.data);
      if (learnRes?.data) {
        setLearningSummary(learnRes.data);
      } else if (user?.role === 'student') {
        setLearningSummary({ courses: [] });
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: '#f5f5f5', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        <Box display="flex" alignItems="center" mb={3}>
          <TrendingUp sx={{ mr: 2, color: '#8b5cf6', fontSize: 32 }} />
          <Typography variant="h4" sx={{ color: '#212121', fontWeight: 700 }}>
            My Progress
          </Typography>
        </Box>

        {user?.role === 'student' && learningSummary && (
          <Box sx={{ mb: 4 }}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                mb: 2,
                textAlign: 'center',
                background: 'linear-gradient(90deg, #ede9fe 0%, #faf5ff 45%, #fff 100%)',
                border: '1px solid #ddd6fe',
              }}
            >
              <Typography variant="overline" sx={{ letterSpacing: 3, color: '#4c1d95', fontWeight: 700 }}>
                MY LEARNING
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                Adaptive ability, topics, and quiz trajectory across your courses
              </Typography>
            </Paper>
            <Grid container spacing={3}>
              <Grid item xs={12} md={5}>
                <Card sx={{ boxShadow: '0 2px 12px rgba(124,58,237,0.12)', height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#4c1d95', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Psychology color="primary" />
                      Ability (θ) by course
                    </Typography>
                    <ThetaByCourseChart courses={learningSummary.courses} />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={7}>
                <Card sx={{ boxShadow: '0 2px 12px rgba(124,58,237,0.12)' }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#4c1d95', mb: 2 }}>
                      Course detail
                    </Typography>
                    {!learningSummary.courses?.length ? (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No enrollments yet, or adaptive practice has not updated your profile. Open a course, run adaptive
                        practice, and your θ / topic strengths will appear here.
                      </Typography>
                    ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 420, overflow: 'auto' }}>
                      {learningSummary.courses.map((c) => (
                        <Box
                          key={c.course_id}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            border: '1px solid #ede9fe',
                            background: 'linear-gradient(180deg, #fafafa 0%, #fff 100%)',
                          }}
                        >
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {c.course_title}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            Current ability (θ):{' '}
                            <strong>
                              {c.theta?.toFixed?.(2) ?? c.theta} {c.theta_trend || ''}
                            </strong>
                            {c.theta_session_delta_hint != null && (
                              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                last session Δθ {c.theta_session_delta_hint > 0 ? '+' : ''}
                                {c.theta_session_delta_hint}
                              </Typography>
                            )}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.75 }}>
                            Recommended difficulty: <strong>{c.recommended_difficulty}</strong>
                          </Typography>
                          <Grid container spacing={1} sx={{ mt: 1 }}>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
                                Strong topics
                              </Typography>
                              <Box sx={{ mt: 0.5 }}>
                                {(c.strong_topics || []).length ? (
                                  (c.strong_topics || []).map((t) => (
                                    <Chip key={t} size="small" label={`✔ ${t}`} sx={{ mr: 0.5, mb: 0.5, bgcolor: '#ecfdf5' }} />
                                  ))
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    —
                                  </Typography>
                                )}
                              </Box>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
                                Weak topics
                              </Typography>
                              <Box sx={{ mt: 0.5 }}>
                                {(c.weak_topics || []).length ? (
                                  (c.weak_topics || []).map((t) => (
                                    <Chip key={t} size="small" label={`⚠ ${t}`} sx={{ mr: 0.5, mb: 0.5, bgcolor: '#fffbeb' }} />
                                  ))
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    —
                                  </Typography>
                                )}
                              </Box>
                            </Grid>
                          </Grid>
                          <Divider sx={{ my: 1.5 }} />
                          <Typography variant="caption" color="text.secondary">
                            Progress (quiz scores, chronological)
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 0.5 }}>
                            <Box>
                              <Typography variant="caption">Pre (earliest)</Typography>
                              <Typography variant="h6" sx={{ color: '#6366f1' }}>
                                {c.pre_test_pct != null ? `${c.pre_test_pct}%` : '—'}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption">Post (latest)</Typography>
                              <Typography variant="h6" sx={{ color: '#7c3aed' }}>
                                {c.post_test_pct != null ? `${c.post_test_pct}%` : '—'}
                              </Typography>
                            </Box>
                            <Box sx={{ alignSelf: 'flex-end' }}>
                              <Typography variant="caption" color="text.secondary">
                                attempts: {c.quiz_attempts_count ?? 0}
                              </Typography>
                            </Box>
                          </Box>
                          {c.pre_test_pct != null && c.post_test_pct != null && (
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(100, Math.max(0, c.post_test_pct))}
                              sx={{
                                mt: 1.5,
                                height: 8,
                                borderRadius: 4,
                                '& .MuiLinearProgress-bar': { bgcolor: '#8b5cf6' },
                              }}
                            />
                          )}
                        </Box>
                      ))}
                    </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {user?.role === 'student' && rewardDash && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Card sx={{ boxShadow: '0 2px 12px rgba(124,58,237,0.12)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <EmojiEvents sx={{ color: '#8b5cf6' }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#4c1d95' }}>
                      XP pulse (14 days)
                    </Typography>
                  </Box>
                  <XpByDayChart points={rewardDash.xp_by_day || []} />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={{ boxShadow: '0 2px 12px rgba(124,58,237,0.12)' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#4c1d95', mb: 2 }}>
                    Recent rewards & nudges
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, maxHeight: 280, overflow: 'auto' }}>
                    {(rewardDash.recent_activity || []).length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        Nothing here yet — your personalized lines will appear after your next XP event.
                      </Typography>
                    ) : (
                      rewardDash.recent_activity.map((row, idx) => (
                        <Box
                          key={`${row.created_at}-${idx}`}
                          sx={{
                            p: 1.25,
                            borderRadius: 2,
                            borderLeft: '4px solid #a78bfa',
                            bgcolor: 'rgba(250,245,255,0.9)',
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            {(() => {
                              try {
                                return format(parseISO(row.created_at), 'MMM d, HH:mm');
                              } catch {
                                return row.created_at;
                              }
                            })()}{' '}
                            · {row.course_title}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.35, textTransform: 'capitalize' }}>
                            {row.event_type?.replace(/_/g, ' ')} · +{row.points} XP
                          </Typography>
                          {row.remark ? (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                              {row.remark}
                            </Typography>
                          ) : null}
                        </Box>
                      ))
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        <Typography variant="h6" sx={{ fontWeight: 600, color: '#212121', mb: 2 }}>
          Course completion
        </Typography>
        <Grid container spacing={3}>
          {progress.length === 0 ? (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                    No progress data available
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ) : (
            progress.map((enrollment) => {
              const course = enrollment.course;
              const progressValue = enrollment.progress ?? enrollment.progress_percentage ?? 0;
              return (
                <Grid item xs={12} key={enrollment.id}>
                  <Card sx={{ backgroundColor: '#ffffff', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2 }}>
                        {course?.title || 'Course'}
                      </Typography>
                      <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" color="text.secondary">
                            Overall Progress
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#8b5cf6', fontWeight: 600 }}>
                            {Number(progressValue).toFixed(1)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, Number(progressValue) || 0)}
                          sx={{
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: '#e0e0e0',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: '#8b5cf6',
                            },
                          }}
                        />
                      </Box>
                      {user?.role === 'student' && rewardDash?.courses && (
                        <Box sx={{ mt: 1.5 }}>
                          {(() => {
                            const g = rewardDash.courses.find((c) => c.course_id === course?.id);
                            if (!g) return null;
                            return (
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                                <Chip size="small" color="primary" variant="outlined" label={`Level ${g.level}`} />
                                <Chip size="small" label={`${g.total_xp} XP`} />
                                <Chip size="small" variant="outlined" label={`${g.badge_count} badges`} />
                              </Box>
                            );
                          })()}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })
          )}
        </Grid>
      </Container>
    </Box>
  );
};

export default MyProgress;
