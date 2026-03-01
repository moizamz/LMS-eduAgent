import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import { Person, School, CheckCircle, Block } from '@mui/icons-material';
import api from '../services/api';
import { toast } from 'react-toastify';

const AdminPanel = () => {
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [tabValue]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tabValue === 0) {
        const response = await api.get('/auth/users/');
        const allUsers = Array.isArray(response.data) ? response.data : response.data.results || [];
        // Show only instructors in the admin panel user list
        setUsers(allUsers.filter((u) => u.role === 'instructor'));
      } else if (tabValue === 1) {
        const response = await api.get('/courses/');
        setCourses(Array.isArray(response.data) ? response.data : response.data.results || []);
      } else if (tabValue === 2) {
        const response = await api.get('/courses/analytics/');
        setAnalytics(response.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveInstructor = async (userId) => {
    try {
      await api.patch(`/auth/users/${userId}/approve/`);
      toast.success('Instructor approved');
      fetchData();
    } catch (error) {
      toast.error('Failed to approve instructor');
    }
  };

  const handleUnapproveInstructor = async (userId) => {
    try {
      await api.patch(`/auth/users/${userId}/unapprove/`);
      toast.success('Instructor unapproved');
      fetchData();
    } catch (error) {
      toast.error('Failed to unapprove instructor');
    }
  };

  const handleBlockUser = async (userId) => {
    try {
      await api.patch(`/auth/users/${userId}/block/`);
      toast.success('User blocked');
      fetchData();
    } catch (error) {
      toast.error('Failed to block user');
    }
  };

  const handleUnblockUser = async (userId) => {
    try {
      await api.patch(`/auth/users/${userId}/unblock/`);
      toast.success('User unblocked');
      fetchData();
    } catch (error) {
      toast.error('Failed to unblock user');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Admin Panel
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Users" />
          <Tab label="Courses" />
          <Tab label="Analytics" />
        </Tabs>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      ) : (
        <>
          {tabValue === 0 && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Username</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Chip label={user.role} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.is_approved ? 'Approved' : 'Pending'}
                          color={user.is_approved ? 'success' : 'warning'}
                          size="small"
                          sx={{ mr: user.is_active ? 1 : 0 }}
                        />
                        {!user.is_active && (
                          <Chip label="Blocked" color="error" size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        {user.is_approved ? (
                          <Button
                            size="small"
                            startIcon={<CheckCircle />}
                            onClick={() => handleUnapproveInstructor(user.id)}
                          >
                            Unapprove
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            startIcon={<CheckCircle />}
                            onClick={() => handleApproveInstructor(user.id)}
                          >
                            Approve
                          </Button>
                        )}
                        {user.is_active ? (
                          <Button
                            size="small"
                            color="error"
                            startIcon={<Block />}
                            onClick={() => handleBlockUser(user.id)}
                          >
                            Block
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            color="primary"
                            startIcon={<Block />}
                            onClick={() => handleUnblockUser(user.id)}
                          >
                            Unblock
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {tabValue === 1 && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Instructor</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Enrollments</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {courses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell>{course.title}</TableCell>
                      <TableCell>
                        {course.instructor?.first_name} {course.instructor?.last_name}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={course.is_published ? 'Published' : 'Draft'}
                          color={course.is_published ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{course.enrollment_count || 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {tabValue === 2 && analytics && (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Person sx={{ fontSize: 40, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h6">Total Users</Typography>
                    <Typography variant="h4">{analytics.total_users}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <School sx={{ fontSize: 40, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h6">Total Courses</Typography>
                    <Typography variant="h4">{analytics.total_courses}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">Total Enrollments</Typography>
                    <Typography variant="h4">{analytics.total_enrollments}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">Avg Progress</Typography>
                    <Typography variant="h4">
                      {analytics.average_progress?.toFixed(1) || 0}%
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </>
      )}
    </Container>
  );
};

export default AdminPanel;

