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
} from '@mui/material';
import { TrendingUp, EmojiEvents } from '@mui/icons-material';
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

const MyProgress = () => {
  const { user } = useAuth();
  const [progress, setProgress] = useState([]);
  const [rewardDash, setRewardDash] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  const fetchProgress = async () => {
    try {
      const [enRes, gRes] = await Promise.all([
        api.get('/courses/my-enrollments/'),
        user?.role === 'student'
          ? api.get('/gamification/student/dashboard/').catch(() => null)
          : Promise.resolve(null),
      ]);
      const enrollments = Array.isArray(enRes.data) ? enRes.data : [];
      setProgress(enrollments);
      if (gRes?.data) setRewardDash(gRes.data);
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
