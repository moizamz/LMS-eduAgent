import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  LinearProgress,
  Box,
  CircularProgress,
} from '@mui/material';
import { CheckCircle, LibraryBooks } from '@mui/icons-material';
import {
  workspacePageBackgroundSx,
  workspaceContentContainerSx,
  workspacePageHeadingRowSx,
  pageHeadingTitleSx,
} from '../theme/eduAgentSurfaces';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const MyCourses = () => {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchEnrollments();
  }, []);

  const fetchEnrollments = async () => {
    try {
      const response = await api.get('/courses/my-enrollments/');
      setEnrollments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      toast.error('Failed to load enrollments');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={workspacePageBackgroundSx}>
        <Container maxWidth="lg" sx={workspaceContentContainerSx}>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
            <CircularProgress />
          </Box>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={workspacePageBackgroundSx}>
      <Container maxWidth="lg" sx={workspaceContentContainerSx}>
        <Box sx={workspacePageHeadingRowSx}>
          <LibraryBooks color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" component="h1" sx={pageHeadingTitleSx}>
            My courses
          </Typography>
        </Box>
      <Grid container spacing={3} sx={{ mt: 1 }}>
        {enrollments.length === 0 ? (
          <Grid item xs={12}>
            <Typography variant="body1" align="center" color="text.secondary">
              You haven't enrolled in any courses yet.
            </Typography>
            <Box textAlign="center" sx={{ mt: 2 }}>
              <Button variant="contained" onClick={() => navigate('/courses')}>
                Browse Courses
              </Button>
            </Box>
          </Grid>
        ) : (
          enrollments.map((enrollment) => (
            <Grid item xs={12} sm={6} md={4} key={enrollment.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {enrollment.course?.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {enrollment.course?.description?.substring(0, 100)}...
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      Progress: {enrollment.progress_percentage?.toFixed(1) || 0}%
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={enrollment.progress_percentage || 0}
                      sx={{ mt: 1 }}
                    />
                  </Box>
                  {enrollment.is_completed && (
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircle color="success" />
                      <Typography variant="body2" color="success.main">
                        Completed
                      </Typography>
                    </Box>
                  )}
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    onClick={() => navigate(`/courses/${enrollment.course?.id}`)}
                  >
                    Continue Learning
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))
        )}
      </Grid>
      </Container>
    </Box>
  );
};

export default MyCourses;

