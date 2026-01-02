import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Tabs,
  Tab,
  Chip,
} from '@mui/material';
import { PlayArrow, Description, Link as LinkIcon, TextFields } from '@mui/icons-material';
import api from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';

const CourseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [enrolled, setEnrolled] = useState(false);

  useEffect(() => {
    fetchCourse();
    checkEnrollment();
  }, [id]);

  const fetchCourse = async () => {
    try {
      const response = await api.get(`/courses/${id}/`);
      setCourse(response.data);
    } catch (error) {
      console.error('Error fetching course:', error);
      toast.error('Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  const checkEnrollment = async () => {
    try {
      const response = await api.get('/courses/my-enrollments/');
      const enrollments = Array.isArray(response.data) ? response.data : [];
      setEnrolled(enrollments.some((e) => e.course?.id === parseInt(id)));
    } catch (error) {
      console.error('Error checking enrollment:', error);
    }
  };

  const handleEnroll = async () => {
    try {
      await api.post(`/courses/${id}/enroll/`);
      toast.success('Successfully enrolled!');
      setEnrolled(true);
      navigate('/my-courses');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to enroll');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!course) {
    return (
      <Container>
        <Typography variant="h6">Course not found</Typography>
      </Container>
    );
  }

  const getContentIcon = (contentType) => {
    switch (contentType) {
      case 'video':
        return <PlayArrow />;
      case 'pdf':
        return <Description />;
      case 'link':
        return <LinkIcon />;
      default:
        return <TextFields />;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          {course.title}
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          {course.description}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Chip label={`Instructor: ${course.instructor?.first_name} ${course.instructor?.last_name}`} />
          {course.enrollment_count > 0 && (
            <Chip label={`${course.enrollment_count} students enrolled`} />
          )}
        </Box>
        {user?.role === 'student' && !enrolled && (
          <Button variant="contained" onClick={handleEnroll}>
            Enroll in Course
          </Button>
        )}
        {enrolled && (
          <Button variant="contained" onClick={() => navigate('/my-courses')}>
            Go to My Courses
          </Button>
        )}
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Modules" />
          <Tab label="Assignments" />
          <Tab label="Quizzes" />
          <Tab label="Discussions" />
        </Tabs>
      </Box>

      {tabValue === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Course Modules
            </Typography>
            <List>
              {course.modules && course.modules.length > 0 ? (
                course.modules.map((module) => (
                  <ListItem key={module.id}>
                    {getContentIcon(module.content_type)}
                    <ListItemText
                      primary={module.title}
                      secondary={module.description}
                      sx={{ ml: 2 }}
                    />
                    <Chip label={module.content_type} size="small" />
                  </ListItem>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No modules available
                </Typography>
              )}
            </List>
          </CardContent>
        </Card>
      )}

      {tabValue === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Assignments
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Assignment list will be displayed here
            </Typography>
          </CardContent>
        </Card>
      )}

      {tabValue === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Quizzes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Quiz list will be displayed here
            </Typography>
          </CardContent>
        </Card>
      )}

      {tabValue === 3 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Discussions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Discussion forum will be displayed here
            </Typography>
          </CardContent>
        </Card>
      )}
    </Container>
  );
};

export default CourseDetail;

