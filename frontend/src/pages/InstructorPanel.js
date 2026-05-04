import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Box,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { Add, Edit, Delete, MenuBook } from '@mui/icons-material';
import api from '../services/api';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import {
  sectionHeaderBandSx,
  workspacePageBackgroundSx,
  workspaceContentContainerSx,
  pageHeadingTitleSx,
} from '../theme/eduAgentSurfaces';

const InstructorPanel = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await api.get('/courses/');
      setCourses(Array.isArray(response.data) ? response.data : response.data.results || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async () => {
    try {
      // By default publish the course so students can discover it
      await api.post('/courses/', {
        ...formData,
        is_published: true,
      });
      toast.success('Course created successfully');
      setOpenDialog(false);
      setFormData({ title: '', description: '', price: '' });
      fetchCourses();
    } catch (error) {
      toast.error('Failed to create course');
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (window.confirm('Are you sure you want to delete this course?')) {
      try {
        await api.delete(`/courses/${courseId}/`);
        toast.success('Course deleted');
        fetchCourses();
      } catch (error) {
        toast.error('Failed to delete course');
      }
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
      <Box
        sx={{
          ...sectionHeaderBandSx,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', minWidth: 0 }}>
          <MenuBook color="primary" sx={{ fontSize: 28 }} />
          <Typography variant="h5" component="h1" sx={pageHeadingTitleSx}>
            My courses
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)}>
          Create course
        </Button>
      </Box>

      <Grid container spacing={3}>
        {courses.length === 0 ? (
          <Grid item xs={12}>
            <Typography variant="body1" align="center" color="text.secondary">
              You haven't created any courses yet.
            </Typography>
          </Grid>
        ) : (
          courses.map((course) => (
            <Grid item xs={12} sm={6} md={4} key={course.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {course.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {course.description}
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      Enrollments: {course.enrollment_count || 0}
                    </Typography>
                  </Box>
                </CardContent>
                <CardActions>
                  <Button size="small" onClick={() => navigate(`/courses/${course.id}`)}>
                    View
                  </Button>
                  <Button size="small" startIcon={<Edit />} onClick={() => navigate(`/courses/${course.id}/`)}>
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<Delete />}
                    onClick={() => handleDeleteCourse(course.id)}
                  >
                    Delete
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Course</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Title"
            margin="normal"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
          <TextField
            fullWidth
            label="Description"
            margin="normal"
            multiline
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />
          <TextField
            fullWidth
            label="Price"
            type="number"
            margin="normal"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateCourse} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>
      </Container>
    </Box>
  );
};

export default InstructorPanel;

