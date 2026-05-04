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
  LinearProgress,
  Divider,
} from '@mui/material';
import { Person, School, CheckCircle, Block, Analytics } from '@mui/icons-material';
import {
  workspacePageBackgroundSx,
  workspaceContentContainerSx,
  workspacePageHeadingRowSx,
  pageHeadingTitleSx,
  workspaceTablePaperSx,
} from '../theme/eduAgentSurfaces';
import api from '../services/api';
import { toast } from 'react-toastify';

const AdminPanel = () => {
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [eduagentAnalytics, setEduagentAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchData is recreated each render; tabValue drives reload
  }, [tabValue]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tabValue === 0) {
        const response = await api.get('/auth/users/');
        const allUsers = Array.isArray(response.data) ? response.data : response.data.results || [];
        setUsers(allUsers.filter((u) => u.role === 'instructor'));
      } else if (tabValue === 1) {
        const response = await api.get('/auth/users/');
        const allUsers = Array.isArray(response.data) ? response.data : response.data.results || [];
        setStudents(allUsers.filter((u) => u.role === 'student'));
      } else if (tabValue === 2) {
        const response = await api.get('/courses/');
        setCourses(Array.isArray(response.data) ? response.data : response.data.results || []);
      } else if (tabValue === 3) {
        const response = await api.get('/courses/analytics/');
        setAnalytics(response.data);
      } else if (tabValue === 4) {
        const response = await api.get('/quizzes/admin/eduagent-analytics/');
        setEduagentAnalytics(response.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      if (tabValue === 4) setEduagentAnalytics(null);
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
    <Box sx={workspacePageBackgroundSx}>
      <Container maxWidth="lg" sx={workspaceContentContainerSx}>
        <Box sx={workspacePageHeadingRowSx}>
          <Analytics color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h5" component="h1" sx={pageHeadingTitleSx}>
            Admin
          </Typography>
        </Box>

      <Box sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Instructors" />
          <Tab label="Students" />
          <Tab label="Courses" />
          <Tab label="Analytics" />
          <Tab label="EduAgent" />
        </Tabs>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      ) : (
        <>
          {tabValue === 0 && (
            <TableContainer component={Paper} sx={workspaceTablePaperSx}>
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
            <TableContainer component={Paper} sx={workspaceTablePaperSx}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Username</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <Typography variant="body2" color="text.secondary">
                          No student accounts found.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    students.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {user.first_name} {user.last_name}
                        </TableCell>
                        <TableCell>
                          {!user.is_active ? <Chip label="Blocked" color="error" size="small" /> : <Chip label="Active" color="success" size="small" />}
                        </TableCell>
                        <TableCell>
                          {user.is_active ? (
                            <Button size="small" color="error" startIcon={<Block />} onClick={() => handleBlockUser(user.id)}>
                              Block
                            </Button>
                          ) : (
                            <Button size="small" color="primary" startIcon={<Block />} onClick={() => handleUnblockUser(user.id)}>
                              Unblock
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {tabValue === 2 && (
            <TableContainer component={Paper} sx={workspaceTablePaperSx}>
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

          {tabValue === 3 && analytics && (
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

          {tabValue === 4 && !loading && !eduagentAnalytics && (
            <Typography color="text.secondary" sx={{ py: 4 }}>
              EduAgent metrics could not be loaded (check admin role) or no adaptive sessions exist yet.
            </Typography>
          )}

          {tabValue === 4 && eduagentAnalytics && (
            <Box>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  mb: 3,
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 55%, #6d28d9 100%)',
                  color: '#fff',
                }}
              >
                <Typography variant="overline" sx={{ letterSpacing: 4, opacity: 0.9 }}>
                  EDUAGENT ANALYTICS DASHBOARD
                </Typography>
                <Typography variant="caption" display="block" sx={{ opacity: 0.85, mt: 0.5 }}>
                  admin · adaptive banks & validation aggregates
                </Typography>
              </Paper>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography color="text.secondary" variant="body2">
                        Questions generated (kept)
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: '#4c1d95' }}>
                        {(eduagentAnalytics.questions_generated_kept || 0).toLocaleString()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        raw LLM rows: {(eduagentAnalytics.questions_generated_raw || 0).toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography color="text.secondary" variant="body2">
                        Validation pass rate
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: '#4c1d95' }}>
                        {eduagentAnalytics.validation_pass_rate_pct != null
                          ? `${eduagentAnalytics.validation_pass_rate_pct}%`
                          : '—'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography color="text.secondary" variant="body2">
                        Faithfulness score
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: '#4c1d95' }}>
                        {eduagentAnalytics.faithfulness_score_pct != null
                          ? `${eduagentAnalytics.faithfulness_score_pct}%`
                          : '—'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography color="text.secondary" variant="body2">
                        Curated MCQs (DB)
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: '#4c1d95' }}>
                        {(eduagentAnalytics.curated_question_bank_count || 0).toLocaleString()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Analytics color="primary" />
                        Difficulty distribution (bank items sampled)
                      </Typography>
                      {['easy', 'moderate', 'hard'].map((k) => {
                        const pct =
                          k === 'moderate'
                            ? eduagentAnalytics.difficulty_distribution_pct?.moderate
                            : eduagentAnalytics.difficulty_distribution_pct?.[k];
                        const label = k === 'easy' ? 'Easy' : k === 'hard' ? 'Hard' : 'Moderate';
                        return (
                          <Box key={k} sx={{ mb: 1.5 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Typography variant="body2">{label}</Typography>
                              <Typography variant="body2" fontWeight={600}>
                                {pct ?? 0}%
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(100, pct || 0)}
                              sx={{ height: 10, borderRadius: 2, '& .MuiLinearProgress-bar': { bgcolor: '#7c3aed' } }}
                            />
                          </Box>
                        );
                      })}
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                        Generation latency
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        Average:{' '}
                        <strong>{eduagentAnalytics.average_generation_time_sec ?? '—'} sec</strong>
                      </Typography>
                      <Typography variant="body1" gutterBottom>
                        p95: <strong>{eduagentAnalytics.p95_latency_sec ?? '—'} sec</strong>
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Samples: {eduagentAnalytics.latency_samples ?? 0} · Adaptive sessions scanned:{' '}
                        {eduagentAnalytics.adaptive_sessions_scanned ?? 0}
                        {eduagentAnalytics.generative_sessions_with_quality_report != null
                          ? ` · Sessions w/ quality report: ${eduagentAnalytics.generative_sessions_with_quality_report}`
                          : ''}
                      </Typography>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="body1">
                        Avg discrimination (proxy):{' '}
                        <strong>{eduagentAnalytics.average_discrimination_proxy ?? '—'}</strong>
                        {eduagentAnalytics.discrimination_samples != null
                          ? ` · n=${eduagentAnalytics.discrimination_samples} strata buckets`
                          : ''}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 3, mb: 1.5, color: '#312e81' }}>
                LLM judge pipeline (second pass)
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Aggregated from <code>quality_report.llm_judge</code> on adaptive + practice sessions after deterministic
                checks.
              </Typography>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderColor: 'rgba(99,102,241,0.35)' }}>
                    <CardContent>
                      <Typography color="text.secondary" variant="body2">
                        Judge sessions
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: '#4338ca' }}>
                        {eduagentAnalytics.llm_judge_sessions ?? 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        degraded (fallback): {eduagentAnalytics.llm_judge_degraded_sessions ?? 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderColor: 'rgba(99,102,241,0.35)' }}>
                    <CardContent>
                      <Typography color="text.secondary" variant="body2">
                        Mean session pass rate (judge)
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 800, color: '#4338ca' }}>
                        {eduagentAnalytics.llm_judge_pass_rate_mean_pct != null
                          ? `${eduagentAnalytics.llm_judge_pass_rate_mean_pct}%`
                          : '—'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderColor: 'rgba(99,102,241,0.35)' }}>
                    <CardContent>
                      <Typography color="text.secondary" variant="body2">
                        Avg judge scores (1–10)
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Overall: {eduagentAnalytics.llm_judge_avg_overall_score ?? '—'}
                      </Typography>
                      <Typography variant="body2">
                        Clarity: {eduagentAnalytics.llm_judge_avg_clarity ?? '—'} · Grounding:{' '}
                        {eduagentAnalytics.llm_judge_avg_grounding ?? '—'}
                      </Typography>
                      <Typography variant="body2">
                        Distractors: {eduagentAnalytics.llm_judge_avg_distractor_quality ?? '—'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderColor: 'rgba(99,102,241,0.35)' }}>
                    <CardContent>
                      <Typography color="text.secondary" variant="body2">
                        Judge latency (batched calls)
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        Avg: {eduagentAnalytics.llm_judge_latency_avg_sec ?? '—'} sec
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        p95: {eduagentAnalytics.llm_judge_latency_p95_sec ?? '—'} sec
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        Rejected items (sum): {eduagentAnalytics.llm_judge_rejected_items_total ?? 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </>
      )}
      </Container>
    </Box>
  );
};

export default AdminPanel;

