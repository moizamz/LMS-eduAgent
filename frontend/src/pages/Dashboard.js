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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    if (user?.role === 'student') {
      fetchEnrollments();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      // Fetch quiz attempts for student
      if (user?.role === 'student') {
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
    } finally {
      setLoading(false);
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
        <Typography variant="h4" sx={{ fontWeight: 700, color: '#212121', mb: 4 }}>
          Dashboard
        </Typography>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          {/* Avg Quiz Score Card */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#ffffff', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', borderRadius: 2 }}>
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
                        backgroundColor: '#42a5f5',
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
          </Grid>

          {/* Total Time Spent Card */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#ffffff', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', borderRadius: 2 }}>
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
                        backgroundColor: day <= 3 ? '#42a5f5' : '#e0e0e0',
                        borderRadius: 1,
                      }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Weekly Streak Card */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#ffffff', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', borderRadius: 2 }}>
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
          </Grid>

          {/* Last Quiz Score Card */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#ffffff', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', borderRadius: 2 }}>
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
          </Grid>
        </Grid>

        {/* My Courses Section */}
        {user?.role === 'student' && (
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#212121', mb: 3 }}>
              My Courses
            </Typography>
            <Grid container spacing={3}>
              {enrollments.length === 0 ? (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                    No enrolled courses yet
                  </Typography>
                </Grid>
              ) : (
                enrollments.map((enrollment) => {
                  const course = enrollment.course;
                  const progress = enrollment.progress || 0;
                  return (
                    <Grid item xs={12} key={enrollment.id}>
                      <Card sx={{ backgroundColor: '#ffffff', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)', borderRadius: 2 }}>
                        <CardContent>
                          <Typography variant="h6" sx={{ mb: 1 }}>
                            {course?.title || 'Course'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
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
                            <Typography variant="body2" sx={{ color: '#8b5cf6', minWidth: 50, textAlign: 'right' }}>
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
      </Container>
    </Box>
  );
};

export default Dashboard;
