import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Box,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const Dashboard = () => {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const isInstructorLike = user?.role === 'instructor' || user?.role === 'admin';

  const [stats, setStats] = useState({
    avgQuizScore: 0,
    highestScore: 0,
    lowestScore: 0,
    totalTimeSpent: 0,
    weeklyStreak: 1,
    longestStreak: 15,
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

  useEffect(() => {
    if (!user) return;

    const loadDashboard = async () => {
      setLoading(true);
      try {
        if (isStudent) {
          await Promise.all([fetchStats(), fetchEnrollments()]);
        } else if (isInstructorLike) {
          await fetchInstructorData();
        }
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchStats = async () => {
    try {
      // Fetch quiz attempts for student
      if (isStudent) {
        try {
          const response = await api.get('/quizzes/my-attempts/');
          const attempts = Array.isArray(response.data) ? response.data : [];
          if (attempts.length > 0) {
            const scores = attempts
              .filter(a => a.is_completed && a.score !== null)
              .map(a => a.score);
            if (scores.length > 0) {
              const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
              const highest = Math.max(...scores);
              const lowest = Math.min(...scores);
              const last = scores[scores.length - 1];
              setStats(prev => ({
                ...prev,
                avgQuizScore: avg,
                highestScore: highest,
                lowestScore: lowest,
                lastQuizScore: last,
              }));
            }
          }
        } catch (error) {
          console.error('Error fetching quiz attempts:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchEnrollments = async () => {
    try {
      const response = await api.get('/courses/my-enrollments/');
      setEnrollments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
    }
  };

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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  // Top summary cards: same size in one row with a simple hover effect
  const statCardStyle = {
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    borderRadius: 2,
    // Fixed height so all top dashboard boxes look exactly the same size
    height: 230,
    display: 'flex',
    flexDirection: 'column',
    transition: 'box-shadow 0.15s ease-in-out, background-color 0.15s ease-in-out',
    '&:hover': {
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
      backgroundColor: '#faf5ff',
      cursor: 'pointer',
    },
  };

  // Course cards keep the original style without the strong hover lift
  const courseCardStyle = {
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    borderRadius: 2,
  };

  return (
    <Box sx={{ backgroundColor: '#f5f5f5', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#212121', mb: 4 }}>
          Dashboard
        </Typography>

        {isInstructorLike ? (
          <>
            {/* Instructor / Admin analytics */}
            <Box
              sx={{
                display: 'flex',
                gap: 3,
                mb: 4,
                flexWrap: { xs: 'wrap', md: 'nowrap' },
              }}
            >
              <Box sx={{ flex: 1, minWidth: 220 }}>
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

              <Box sx={{ flex: 1, minWidth: 220 }}>
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

              <Box sx={{ flex: 1, minWidth: 220 }}>
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

              <Box sx={{ flex: 1, minWidth: 220 }}>
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
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#212121', mb: 2 }}>
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
              <Typography variant="h5" sx={{ fontWeight: 600, color: '#212121', mb: 2 }}>
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
            <Box
              sx={{
                display: 'flex',
                gap: 3,
                mb: 4,
                flexWrap: { xs: 'wrap', md: 'nowrap' },
              }}
            >
              {/* Avg Quiz Score Card */}
              <Box sx={{ flex: 1, minWidth: 220 }}>
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
              <Box sx={{ flex: 1, minWidth: 220 }}>
                <Card sx={statCardStyle}>
                  <CardContent>
                    <Typography sx={{ color: '#757575', fontSize: '0.875rem', mb: 1 }}>
                      Total Time Spent
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#8b5cf6', fontWeight: 600, mb: 2 }}>
                      {stats.totalTimeSpent} Hours
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#757575', mb: 1, display: 'block' }}>
                      This Week
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {[1, 2, 3, 4, 5].map((day) => (
                        <Box
                          key={day}
                          sx={{
                            width: 24,
                            height: 24,
                            backgroundColor: day <= 3 ? '#8b5cf6' : '#e0e0e0',
                            borderRadius: 1,
                          }}
                        />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Box>

              {/* Weekly Streak Card */}
              <Box sx={{ flex: 1, minWidth: 220 }}>
                <Card sx={statCardStyle}>
                  <CardContent>
                    <Typography sx={{ color: '#757575', fontSize: '0.875rem', mb: 1 }}>
                      Weekly Streak
                    </Typography>
                    <Typography variant="h4" sx={{ color: '#8b5cf6', fontWeight: 600, mb: 1 }}>
                      {stats.weeklyStreak} Days
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#757575', mb: 2, display: 'block' }}>
                      Longest Streak {stats.longestStreak} days
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((day) => (
                        <Box
                          key={day}
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            backgroundColor: day === 1 ? '#8b5cf6' : '#e0e0e0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: day === 1 ? '#ffffff' : '#757575',
                            fontSize: '0.75rem',
                          }}
                        >
                          ✓
                        </Box>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Box>

              {/* Last Quiz Score Card */}
              <Box sx={{ flex: 1, minWidth: 220 }}>
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

            {/* My Courses Section */}
            {isStudent && (
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 600, color: '#212121', mb: 3 }}>
                  My Courses
                </Typography>
                <Grid container spacing={3}>
                  {enrollments.length === 0 ? (
                    <Grid item xs={12}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        align="center"
                        sx={{ py: 4 }}
                      >
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
