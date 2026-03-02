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
  Tabs,
  Tab,
  Divider,
} from '@mui/material';
import { School, Assignment, Quiz, EmojiEvents } from '@mui/icons-material';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const StudentPanel = () => {
  const [tabValue, setTabValue] = useState(0);
  const [enrollments, setEnrollments] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [tabValue]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tabValue === 0) {
        const response = await api.get('/courses/my-enrollments/');
        setEnrollments(Array.isArray(response.data) ? response.data : []);
      } else if (tabValue === 1) {
        const response = await api.get('/assignments/my-submissions/');
        setAssignments(Array.isArray(response.data) ? response.data : []);
      } else if (tabValue === 2) {
        const response = await api.get('/quizzes/my-attempts/');
        setQuizzes(Array.isArray(response.data) ? response.data : []);
      } else if (tabValue === 3) {
        const response = await api.get('/certificates/my-certificates/');
        setCertificates(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const navigate = useNavigate();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Student Panel
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab icon={<School />} label="My Courses" />
          <Tab icon={<Assignment />} label="Assignments" />
          <Tab icon={<Quiz />} label="Quizzes" />
          <Tab icon={<EmojiEvents />} label="Certificates" />
        </Tabs>
      </Box>

      {tabValue === 0 && (
        <Grid container spacing={3}>
          {enrollments.length === 0 ? (
            <Grid item xs={12}>
              <Typography variant="body1" align="center" color="text.secondary">
                You haven't enrolled in any courses yet.
              </Typography>
            </Grid>
          ) : (
            enrollments.map((enrollment) => (
              <Grid item xs={12} sm={6} md={4} key={enrollment.id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {enrollment.course?.title}
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        Progress: {enrollment.progress_percentage?.toFixed(1) || 0}%
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={enrollment.progress_percentage || 0}
                      />
                    </Box>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      onClick={() => navigate(`/courses/${enrollment.course?.id}`)}
                    >
                      Continue
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {tabValue === 1 && (
        <Grid container spacing={3}>
          {assignments.length === 0 ? (
            <Grid item xs={12}>
              <Typography variant="body1" align="center" color="text.secondary">
                No assignments found.
              </Typography>
            </Grid>
          ) : (
            assignments.map((assignment) => (
              <Grid item xs={12} key={assignment.id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">{assignment.assignment?.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {assignment.assignment?.course?.title}
                    </Typography>
                    <Divider sx={{ my: 1.5 }} />
                    <Typography variant="body2" color="text.secondary">
                      Submitted at:{' '}
                      {assignment.submitted_at ? new Date(assignment.submitted_at).toLocaleString() : '—'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      File:{' '}
                      {assignment.submission_file_name
                        ? `${assignment.submission_file_name} (${assignment.submission_file_size ? (assignment.submission_file_size / (1024 * 1024)).toFixed(2) : '—'} MB)`
                        : '—'}
                    </Typography>
                    {assignment.is_graded && (
                      <Typography variant="body1" sx={{ mt: 1 }}>
                        Score: {assignment.score} / {assignment.assignment?.max_score}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions>
                    {assignment.submission_file && (
                      <Button
                        size="small"
                        onClick={() => window.open(assignment.submission_file, '_blank')}
                      >
                        Download submission
                      </Button>
                    )}
                    {!assignment.is_graded && (
                      <Button
                        size="small"
                        variant="contained"
                        component="label"
                      >
                        Edit submission
                        <input
                          type="file"
                          hidden
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const formData = new FormData();
                            formData.append('submission_file', f);
                            try {
                              await api.patch(`/assignments/submissions/${assignment.id}/`, formData);
                              toast.success('Submission updated');
                              fetchData();
                            } catch (err) {
                              toast.error(err.response?.data?.error || 'Failed to update submission');
                            } finally {
                              e.target.value = '';
                            }
                          }}
                        />
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {tabValue === 2 && (
        <Grid container spacing={3}>
          {quizzes.length === 0 ? (
            <Grid item xs={12}>
              <Typography variant="body1" align="center" color="text.secondary">
                No quiz attempts found.
              </Typography>
            </Grid>
          ) : (
            quizzes.map((quiz) => (
              <Grid item xs={12} key={quiz.id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6">{quiz.quiz?.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {quiz.quiz?.course?.title}
                    </Typography>
                    {quiz.is_completed && (
                      <Typography variant="body1" sx={{ mt: 1 }}>
                        Score: {quiz.score?.toFixed(1)}%
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}

      {tabValue === 3 && (
        <Grid container spacing={3}>
          {certificates.length === 0 ? (
            <Grid item xs={12}>
              <Typography variant="body1" align="center" color="text.secondary">
                No certificates yet. Complete courses to earn certificates!
              </Typography>
            </Grid>
          ) : (
            certificates.map((certificate) => (
              <Grid item xs={12} sm={6} md={4} key={certificate.id}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {certificate.enrollment?.course?.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Certificate #{certificate.certificate_number}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      onClick={() => {
                        window.open(
                          `http://localhost:8000/api/certificates/${certificate.id}/download/`,
                          '_blank'
                        );
                      }}
                    >
                      Download
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))
          )}
        </Grid>
      )}
    </Container>
  );
};

export default StudentPanel;

