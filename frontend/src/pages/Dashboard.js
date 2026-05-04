import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Box,
  CircularProgress,
  LinearProgress,
  Button,
  Chip,
} from '@mui/material';
import { EmojiEvents, TrendingUp, Insights as InsightsIcon, AutoAwesome } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import {
  insightVariantPalette,
  sectionHeaderBandSx,
  workspacePageBackgroundSx,
  workspaceContentContainerSx,
  workspacePageHeadingRowSx,
  pageHeadingTitleSx,
} from '../theme/eduAgentSurfaces';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStudent = user?.role === 'student';
  const isInstructorLike = user?.role === 'instructor' || user?.role === 'admin';

  const [stats, setStats] = useState({
    avgQuizScore: 0,
    highestScore: 0,
    lowestScore: 0,
    totalTimeSpent: 0,
    weeklyStreak: 0,
    longestStreak: 0,
    lastQuizScore: null,
  });
  const [enrollments, setEnrollments] = useState([]);
  const [instructorStats, setInstructorStats] = useState({
    totalStudents: 0,
    totalCourses: 0,
    avgProgress: 0,
    avgQuizScore: 0,
  });
  const [instructorEnrollments, setInstructorEnrollments] = useState([]);
  const [instructorAttempts, setInstructorAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rewardDash, setRewardDash] = useState(null);
  const [studentInsights, setStudentInsights] = useState([]);

  const fetchStats = useCallback(async () => {
    try {
      if (isStudent) {
        try {
          const response = await api.get('/quizzes/my-attempts/');
          const attempts = Array.isArray(response.data) ? response.data : [];
          const completed = attempts.filter((a) => a.is_completed && a.score !== null && a.score !== undefined);
          if (completed.length > 0) {
            const scores = completed.map((a) => Number(a.score));
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            const highest = Math.max(...scores);
            const lowest = Math.min(...scores);
            const last = Number(completed[0].score);
            setStats((prev) => ({
              ...prev,
              avgQuizScore: avg,
              highestScore: highest,
              lowestScore: lowest,
              lastQuizScore: last,
            }));
          }
        } catch (error) {
          console.error('Error fetching quiz attempts:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [isStudent]);

  const fetchEnrollments = async () => {
    try {
      const response = await api.get('/courses/my-enrollments/');
      setEnrollments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
    }
  };

  const fetchRewardDashboard = useCallback(async () => {
    try {
      const res = await api.get('/gamification/student/dashboard/');
      setRewardDash(res.data);
      const d = res.data || {};
      setStudentInsights(Array.isArray(d.insights) ? d.insights : []);
      setStats((prev) => ({
        ...prev,
        totalTimeSpent: d.total_practice_quiz_hours ?? 0,
        weeklyStreak: d.weekly_active_streak_days ?? 0,
        longestStreak: d.longest_streak_days ?? 0,
      }));
    } catch (error) {
      console.error('Error fetching gamification dashboard:', error);
      setRewardDash(null);
      setStudentInsights([]);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const loadDashboard = async () => {
      setLoading(true);
      try {
        if (isStudent) {
          await Promise.all([fetchStats(), fetchEnrollments(), fetchRewardDashboard()]);
        } else if (isInstructorLike) {
          await fetchInstructorData();
        }
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fetchRewardDashboard, fetchStats]);

  useEffect(() => {
    if (!isStudent || !user) return undefined;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      fetchRewardDashboard();
      fetchStats();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isStudent, user, fetchRewardDashboard, fetchStats]);

  const fetchInstructorData = async () => {
    try {
      const [coursesRes, enrollmentsRes, attemptsRes] = await Promise.all([
        api.get('/courses/'),
        api.get('/courses/my-enrollments/'),
        api.get('/quizzes/my-attempts/'),
      ]);

      const courses = Array.isArray(coursesRes.data)
        ? coursesRes.data
        : coursesRes.data.results || [];
      const enrolls = Array.isArray(enrollmentsRes.data)
        ? enrollmentsRes.data
        : [];
      const attempts = Array.isArray(attemptsRes.data)
        ? attemptsRes.data
        : [];

      setInstructorEnrollments(enrolls);
      setInstructorAttempts(attempts);

      const studentIds = new Set(
        enrolls
          .map((e) => e.student?.id)
          .filter((id) => id !== null && id !== undefined)
      );

      const avgProgress =
        enrolls.length > 0
          ? enrolls.reduce(
              (sum, e) => sum + (e.progress_percentage || 0),
              0
            ) / enrolls.length
          : 0;

      const completedScores = attempts
        .filter((a) => a.is_completed && a.score !== null)
        .map((a) => a.score);
      const avgQuizScore =
        completedScores.length > 0
          ? completedScores.reduce((a, b) => a + b, 0) /
            completedScores.length
          : 0;

      setInstructorStats({
        totalStudents: studentIds.size,
        totalCourses: courses.length,
        avgProgress,
        avgQuizScore,
      });
    } catch (error) {
      console.error('Error fetching instructor analytics:', error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ ...workspacePageBackgroundSx, py: 4, textAlign: 'left' }}>
        <Container maxWidth="xl" sx={{ ...workspaceContentContainerSx, textAlign: 'left' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
            <CircularProgress />
          </Box>
        </Container>
      </Box>
    );
  }

  // KPI layout (surface look comes from global MuiCard theme in App.js)
  const statCardStyle = {
    textAlign: 'center',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    '& .MuiCardContent-root': {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
    },
  };

  const courseCardStyle = {
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    borderRadius: 2,
    textAlign: 'left',
  };

  /** Stat / KPI rows: equal-width cards across full container width */
  const statRowSx = {
    display: 'flex',
    gap: 2,
    mb: 4,
    flexWrap: { xs: 'wrap', md: 'nowrap' },
    width: '100%',
    alignItems: 'stretch',
  };
  const statSlotSx = {
    flex: { xs: '1 1 100%', md: '1 1 0' },
    minWidth: { xs: '100%', sm: 200, md: 0 },
    display: 'flex',
    alignItems: 'stretch',
  };

  return (
    <Box sx={{ ...workspacePageBackgroundSx, py: 4, textAlign: 'left' }}>
      <Container maxWidth="xl" sx={{ ...workspaceContentContainerSx, textAlign: 'left' }}>
        <Box sx={{ ...workspacePageHeadingRowSx, mb: 4 }}>
          <InsightsIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" component="h1" sx={pageHeadingTitleSx}>
            Dashboard
          </Typography>
        </Box>

        {isInstructorLike ? (
          <>
            {/* Instructor / Admin analytics */}
            <Box sx={statRowSx}>
              <Box sx={statSlotSx}>
                <Card sx={statCardStyle}>
                  <CardContent>
                    <Typography sx={{ color: '#757575', fontSize: '0.875rem', mb: 1 }}>
                      Total Students
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#8b5cf6', fontWeight: 600 }}>
                      {instructorStats.totalStudents}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              <Box sx={statSlotSx}>
                <Card sx={statCardStyle}>
                  <CardContent>
                    <Typography sx={{ color: '#757575', fontSize: '0.875rem', mb: 1 }}>
                      Courses Taught
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#8b5cf6', fontWeight: 600 }}>
                      {instructorStats.totalCourses}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              <Box sx={statSlotSx}>
                <Card sx={statCardStyle}>
                  <CardContent>
                    <Typography sx={{ color: '#757575', fontSize: '0.875rem', mb: 1 }}>
                      Avg Course Progress
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#8b5cf6', fontWeight: 600, mb: 1 }}>
                      {instructorStats.avgProgress.toFixed(1)}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={instructorStats.avgProgress}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: '#e0e0e0',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: '#8b5cf6',
                        },
                      }}
                    />
                  </CardContent>
                </Card>
              </Box>

              <Box sx={statSlotSx}>
                <Card sx={statCardStyle}>
                  <CardContent>
                    <Typography sx={{ color: '#757575', fontSize: '0.875rem', mb: 1 }}>
                      Avg Quiz Score
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#8b5cf6', fontWeight: 600, mb: 1 }}>
                      {instructorStats.avgQuizScore.toFixed(1)}%
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Box>

            {/* Student course progress */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#212121', mb: 2, textAlign: 'left' }}>
                Student Course Progress
              </Typography>
              {instructorEnrollments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No enrollments yet for your courses.
                </Typography>
              ) : (
                <Grid container spacing={3}>
                  {instructorEnrollments.map((enrollment) => {
                    const course = enrollment.course;
                    const student = enrollment.student;
                    const progress = enrollment.progress_percentage || 0;
                    return (
                      <Grid item xs={12} md={6} key={enrollment.id}>
                        <Card sx={courseCardStyle}>
                          <CardContent>
                            <Typography variant="subtitle2" sx={{ color: '#757575' }}>
                              {student?.first_name} {student?.last_name} ({student?.username})
                            </Typography>
                            <Typography variant="h6" sx={{ mb: 1 }}>
                              {course?.title || 'Course'}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                              <Typography variant="body2" sx={{ minWidth: 70 }}>
                                Progress
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={progress}
                                sx={{
                                  flexGrow: 1,
                                  height: 8,
                                  borderRadius: 4,
                                  backgroundColor: '#e0e0e0',
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: '#8b5cf6',
                                  },
                                }}
                              />
                              <Typography
                                variant="body2"
                                sx={{ color: '#8b5cf6', minWidth: 50, textAlign: 'right' }}
                              >
                                {progress.toFixed(1)}%
                              </Typography>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </Box>

            {/* Recent quiz attempts */}
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#212121', mb: 2, textAlign: 'left' }}>
                Recent Quiz Attempts
              </Typography>
              {instructorAttempts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No quiz attempts yet for your quizzes.
                </Typography>
              ) : (
                <Grid container spacing={2}>
                  {instructorAttempts.slice(0, 8).map((attempt) => (
                    <Grid item xs={12} md={6} key={attempt.id}>
                      <Card sx={courseCardStyle}>
                        <CardContent>
                          <Typography variant="subtitle2" sx={{ color: '#757575', mb: 0.5 }}>
                            {attempt.student?.first_name} {attempt.student?.last_name} (
                            {attempt.student?.username})
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {attempt.quiz?.title}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            Score:{' '}
                            <span style={{ color: '#8b5cf6', fontWeight: 600 }}>
                              {attempt.score !== null ? attempt.score.toFixed(1) : 0}%
                            </span>
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          </>
        ) : (
          <>
            {/* Top stats row: 4 cards, same width in a single line on desktop */}
            <Box sx={statRowSx}>
              {/* Avg Quiz Score Card */}
              <Box sx={statSlotSx}>
                <Card sx={statCardStyle}>
                  <CardContent>
                    <Typography sx={{ color: '#757575', fontSize: '0.875rem', mb: 1 }}>
                      Avg Quiz Score
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#8b5cf6', fontWeight: 600, mb: 2 }}>
                      {stats.avgQuizScore.toFixed(1)}%
                    </Typography>
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="caption" sx={{ color: '#757575' }}>
                        Highest Score {stats.highestScore.toFixed(0)}%
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={stats.highestScore}
                        sx={{
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: '#e0e0e0',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: '#8b5cf6',
                          },
                        }}
                      />
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: '#757575' }}>
                        Lowest Score {stats.lowestScore.toFixed(0)}%
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={stats.lowestScore}
                        sx={{
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: '#e0e0e0',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: '#ffb74d',
                          },
                        }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Box>

              {/* Total Time Spent Card */}
              <Box sx={statSlotSx}>
                <Card sx={statCardStyle}>
                  <CardContent>
                    <Typography sx={{ color: '#757575', fontSize: '0.875rem', mb: 1 }}>
                      Total Time Spent
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#8b5cf6', fontWeight: 600, mb: 2 }}>
                      {stats.totalTimeSpent > 0 && stats.totalTimeSpent < 1
                        ? `${Math.round(stats.totalTimeSpent * 60)} min`
                        : `${Number(stats.totalTimeSpent).toFixed(1)} h`}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#757575', display: 'block' }}>
                      Quiz + adaptive practice (completed sessions). See weekly activity in Learning streak →
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              {/* Activity streak card */}
              <Box sx={statSlotSx}>
                <Card sx={statCardStyle}>
                  <CardContent>
                    <Typography sx={{ color: '#757575', fontSize: '0.875rem', mb: 1 }}>
                      Learning streak
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#8b5cf6', fontWeight: 600, mb: 1 }}>
                      {stats.weeklyStreak} Days
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#757575', mb: 2, display: 'block' }}>
                      Longest streak (any course): {stats.longestStreak}d · best current:{' '}
                      {rewardDash?.current_streak_best_course ?? 0}d
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#757575', mb: 1, display: 'block' }}>
                      Last 7 days activity
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                      {(rewardDash?.week_activity || []).map((day) => (
                        <Box
                          key={`w-${day.date}`}
                          sx={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            backgroundColor: day.active ? '#8b5cf6' : '#e0e0e0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: day.active ? '#ffffff' : '#bdbdbd',
                            fontSize: '0.7rem',
                          }}
                        >
                          {day.active ? '✓' : ''}
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Box>

              {/* Last Quiz Score Card */}
              <Box sx={statSlotSx}>
                <Card sx={statCardStyle}>
                  <CardContent>
                    <Typography sx={{ color: '#757575', fontSize: '0.875rem', mb: 1 }}>
                      Last Quiz Score
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#8b5cf6', fontWeight: 600, mb: 1 }}>
                      {stats.lastQuizScore !== null ? `${stats.lastQuizScore.toFixed(1)}%` : 'N/A%'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#757575' }}>
                      {stats.lastQuizScore !== null ? 'Last attempt' : 'No quiz attempts'}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </Box>

            {isStudent && studentInsights.length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 1.25,
                    mb: 2,
                    ...sectionHeaderBandSx,
                  }}
                >
                  <InsightsIcon sx={{ color: '#7c3aed', fontSize: 28 }} />
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#312e81', textAlign: 'left', letterSpacing: '-0.02em' }}>
                    Your insights
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 900 }}>
                  Personalized from your enrollments, quiz attempts, assignment grades, adaptive topic data, practice
                  sessions, and streaks — recomputed on each load and when you return to this tab.
                </Typography>
                <Grid container spacing={2.5}>
                  {studentInsights.map((ins) => {
                    const palette = insightVariantPalette(ins.variant);
                    return (
                      <Grid item xs={12} md={6} key={ins.id}>
                        <Card
                          sx={{
                            height: '100%',
                            borderRadius: 3,
                            overflow: 'hidden',
                            position: 'relative',
                            border: `1px solid ${palette.border}`,
                            background: palette.bg,
                            boxShadow: palette.shadow,
                            transition: 'transform 0.22s ease, box-shadow 0.22s ease',
                            '&:hover': {
                              transform: 'translateY(-3px)',
                              boxShadow: '0 14px 36px rgba(76, 29, 149, 0.14)',
                            },
                            '&::before': {
                              content: '""',
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: 5,
                              background: palette.bar,
                              borderRadius: '10px 0 0 10px',
                            },
                          }}
                        >
                          <CardContent sx={{ pl: 2.75, pr: 2, py: 2.25, position: 'relative' }}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: 1.5,
                                mb: 1.25,
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                                <AutoAwesome sx={{ fontSize: 20, color: palette.iconColor, flexShrink: 0 }} />
                                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1e1b4b', lineHeight: 1.3 }}>
                                  {ins.title}
                                </Typography>
                              </Box>
                              <Chip size="small" label={palette.chip} sx={{ ...palette.chipSx, flexShrink: 0 }} />
                            </Box>
                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65, fontSize: '0.9rem' }}>
                              {ins.body}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              </Box>
            )}

            {/* Rewards & XP snapshot */}
            {isStudent && rewardDash && (
              <Box sx={{ mb: 4 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, color: '#212121', mb: 2, textAlign: 'left' }}>
                  Rewards & momentum
                </Typography>
                <Grid container spacing={3} alignItems="stretch">
                  <Grid item xs={12} md={6} sx={{ display: 'flex', alignItems: 'stretch' }}>
                    <Card sx={statCardStyle}>
                      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <EmojiEvents sx={{ color: '#8b5cf6' }} />
                          <Typography sx={{ color: '#757575', fontSize: '0.875rem' }}>
                            Total XP (all courses)
                          </Typography>
                        </Box>
                        <Typography variant="h3" sx={{ color: '#7c3aed', fontWeight: 800, lineHeight: 1.1 }}>
                          {rewardDash.total_xp_across_courses ?? 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          {rewardDash.badge_total ?? 0} badges unlocked across your enrollments.
                        </Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        <Button
                          variant="contained"
                          startIcon={<TrendingUp />}
                          onClick={() => navigate('/my-progress')}
                          sx={{ mt: 2, alignSelf: 'flex-start' }}
                        >
                          View full progress & charts
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
                    <Card sx={{ ...courseCardStyle, height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
                      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                          Top courses by XP
                        </Typography>
                        {(rewardDash.courses || []).length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            Enroll and complete activities to start earning XP.
                          </Typography>
                        ) : (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                            {(rewardDash.courses || []).slice(0, 4).map((c) => (
                              <Box
                                key={c.course_id}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: 1,
                                  py: 0.75,
                                  px: 1,
                                  borderRadius: 1,
                                  bgcolor: '#faf5ff',
                                }}
                              >
                                <Typography variant="body2" sx={{ fontWeight: 600, maxWidth: '70%' }}>
                                  {c.course_title}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                                  <Chip size="small" label={`Lv ${c.level}`} color="primary" variant="outlined" />
                                  <Chip size="small" label={`${c.total_xp} XP`} />
                                  <Chip size="small" variant="outlined" label={`${c.current_streak_days}d streak`} />
                                </Box>
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

            {/* My Courses Section */}
            {isStudent && (
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 600, color: '#212121', mb: 3, textAlign: 'left' }}>
                  My Courses
                </Typography>
                <Grid container spacing={3}>
                  {enrollments.length === 0 ? (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'left' }}>
                        No enrolled courses yet
                      </Typography>
                    </Grid>
                  ) : (
                    enrollments.map((enrollment) => {
                      const course = enrollment.course;
                      const progress =
                        enrollment.progress_percentage ??
                        enrollment.progress ??
                        0;
                      return (
                        <Grid item xs={12} key={enrollment.id}>
                          <Card sx={courseCardStyle}>
                            <CardContent>
                              <Typography variant="h6" sx={{ mb: 1 }}>
                                {course?.title || 'Course'}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mb: 2 }}
                              >
                                {course?.description || ''}
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Typography variant="body2" sx={{ minWidth: 60 }}>
                                  Progress
                                </Typography>
                                <LinearProgress
                                  variant="determinate"
                                  value={progress}
                                  sx={{
                                    flexGrow: 1,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: '#e0e0e0',
                                    '& .MuiLinearProgress-bar': {
                                      backgroundColor: '#8b5cf6',
                                    },
                                  }}
                                />
                                <Typography
                                  variant="body2"
                                  sx={{ color: '#8b5cf6', minWidth: 50, textAlign: 'right' }}
                                >
                                  {progress.toFixed(1)}%
                                </Typography>
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>
                      );
                    })
                  )}
                </Grid>
              </Box>
            )}
          </>
        )}
      </Container>
    </Box>
  );
};

export default Dashboard;
