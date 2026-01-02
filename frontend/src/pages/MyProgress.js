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
} from '@mui/material';
import { TrendingUp } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const MyProgress = () => {
  const { user } = useAuth();
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      const response = await api.get('/courses/my-enrollments/');
      const enrollments = Array.isArray(response.data) ? response.data : [];
      setProgress(enrollments);
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
              const progressValue = enrollment.progress || 0;
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
                            {progressValue.toFixed(1)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={progressValue}
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
