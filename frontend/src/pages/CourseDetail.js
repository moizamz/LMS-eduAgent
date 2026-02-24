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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
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
  const [quizzes, setQuizzes] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [createQuizOpen, setCreateQuizOpen] = useState(false);
  const [quizForm, setQuizForm] = useState({
    title: '',
    description: '',
    time_limit_minutes: 30,
    passing_score: 60,
    max_attempts: 3,
  });

  useEffect(() => {
    fetchCourse();
    checkEnrollment();
    fetchQuizzes();
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

  const fetchQuizzes = async () => {
    try {
      setQuizLoading(true);
      const response = await api.get('/quizzes/', {
        params: { course_id: id },
      });
      const data = Array.isArray(response.data)
        ? response.data
        : response.data.results || [];
      setQuizzes(data);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
    } finally {
      setQuizLoading(false);
    }
  };

  const handleStartQuiz = async (quiz) => {
    try {
      const attemptRes = await api.post(`/quizzes/${quiz.id}/start/`);
      const attempt = attemptRes.data;
      const questionsRes = await api.get(
        `/quizzes/${quiz.id}/attempts/${attempt.id}/questions/`
      );
      setActiveQuiz(quiz);
      setActiveAttempt(attempt);
      setQuizQuestions(Array.isArray(questionsRes.data) ? questionsRes.data : []);
      setQuizAnswers({});
      setQuizDialogOpen(true);
    } catch (error) {
      console.error('Error starting quiz:', error);
      toast.error(error.response?.data?.error || 'Failed to start quiz');
    }
  };

  const handleAnswerChange = (questionId, choiceId) => {
    setQuizAnswers((prev) => ({
      ...prev,
      [questionId]: choiceId,
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!activeQuiz || !activeAttempt) return;
    const answersPayload = Object.entries(quizAnswers).map(
      ([questionId, choiceId]) => ({
        question_id: parseInt(questionId, 10),
        choice_id: choiceId,
      })
    );
    if (!answersPayload.length) {
      toast.error('Please answer at least one question');
      return;
    }

    try {
      const res = await api.post(
        `/quizzes/${activeQuiz.id}/attempts/${activeAttempt.id}/submit/`,
        { answers: answersPayload }
      );
      toast.success(
        `Quiz submitted! Score: ${res.data.score !== null ? res.data.score.toFixed(1) : 0}%`
      );
      setQuizDialogOpen(false);
      setActiveQuiz(null);
      setActiveAttempt(null);
      setQuizQuestions([]);
      setQuizAnswers({});
      fetchQuizzes();
    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast.error(error.response?.data?.error || 'Failed to submit quiz');
    }
  };

  const handleCreateQuiz = async () => {
    try {
      await api.post('/quizzes/', {
        ...quizForm,
        course_id: parseInt(id, 10),
      });
      toast.success('Quiz created successfully');
      setCreateQuizOpen(false);
      setQuizForm({
        title: '',
        description: '',
        time_limit_minutes: 30,
        passing_score: 60,
        max_attempts: 3,
      });
      fetchQuizzes();
    } catch (error) {
      console.error('Error creating quiz:', error);
      toast.error(error.response?.data?.error || 'Failed to create quiz');
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
        <>
          {user?.role === 'instructor' && (
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" onClick={() => setCreateQuizOpen(true)}>
                Create Quiz
              </Button>
            </Box>
          )}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quizzes
              </Typography>
              {quizLoading ? (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    py: 3,
                  }}
                >
                  <CircularProgress size={24} />
                </Box>
              ) : quizzes.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No quizzes available for this course.
                </Typography>
              ) : (
                <List>
                  {quizzes.map((quiz) => (
                    <ListItem
                      key={quiz.id}
                      secondaryAction={
                        user?.role === 'student' && (
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleStartQuiz(quiz)}
                          >
                            Start Quiz
                          </Button>
                        )
                      }
                    >
                      <ListItemText
                        primary={quiz.title}
                        secondary={
                          quiz.description ||
                          `${quiz.question_count || 0} questions · Passing score ${
                            quiz.passing_score
                          }%`
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>

          {/* Take Quiz Dialog for students */}
          <Dialog
            open={quizDialogOpen}
            onClose={() => setQuizDialogOpen(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              {activeQuiz ? activeQuiz.title : 'Quiz'}
            </DialogTitle>
            <DialogContent dividers>
              {quizQuestions.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No questions available for this quiz.
                </Typography>
              ) : (
                quizQuestions.map((question, index) => (
                  <Box key={question.id} sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      {index + 1}. {question.question_text}
                    </Typography>
                    <RadioGroup
                      value={quizAnswers[question.id] || ''}
                      onChange={(e) =>
                        handleAnswerChange(question.id, parseInt(e.target.value, 10))
                      }
                    >
                      {question.choices.map((choice) => (
                        <FormControlLabel
                          key={choice.id}
                          value={choice.id}
                          control={<Radio />}
                          label={choice.choice_text}
                        />
                      ))}
                    </RadioGroup>
                  </Box>
                ))
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setQuizDialogOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={handleSubmitQuiz}>
                Submit Quiz
              </Button>
            </DialogActions>
          </Dialog>

          {/* Create Quiz Dialog for instructors */}
          <Dialog
            open={createQuizOpen}
            onClose={() => setCreateQuizOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Create Quiz</DialogTitle>
            <DialogContent>
              <TextField
                fullWidth
                label="Title"
                margin="normal"
                value={quizForm.title}
                onChange={(e) =>
                  setQuizForm((prev) => ({ ...prev, title: e.target.value }))
                }
                required
              />
              <TextField
                fullWidth
                label="Description"
                margin="normal"
                multiline
                rows={3}
                value={quizForm.description}
                onChange={(e) =>
                  setQuizForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <TextField
                  label="Time Limit (minutes)"
                  type="number"
                  fullWidth
                  margin="normal"
                  value={quizForm.time_limit_minutes}
                  onChange={(e) =>
                    setQuizForm((prev) => ({
                      ...prev,
                      time_limit_minutes: Number(e.target.value),
                    }))
                  }
                />
                <TextField
                  label="Passing Score (%)"
                  type="number"
                  fullWidth
                  margin="normal"
                  value={quizForm.passing_score}
                  onChange={(e) =>
                    setQuizForm((prev) => ({
                      ...prev,
                      passing_score: Number(e.target.value),
                    }))
                  }
                />
              </Box>
              <TextField
                label="Max Attempts"
                type="number"
                fullWidth
                margin="normal"
                value={quizForm.max_attempts}
                onChange={(e) =>
                  setQuizForm((prev) => ({
                    ...prev,
                    max_attempts: Number(e.target.value),
                  }))
                }
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCreateQuizOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={handleCreateQuiz}>
                Create
              </Button>
            </DialogActions>
          </Dialog>
        </>
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

