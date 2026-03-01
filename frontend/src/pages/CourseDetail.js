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
import {
  PlayArrow, Description, Link as LinkIcon, TextFields,
  Add, Delete, UploadFile, Folder, InsertDriveFile,
} from '@mui/icons-material';
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
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [subsectionDialogOpen, setSubsectionDialogOpen] = useState(false);
  const [sectionForm, setSectionForm] = useState({ title: '', order: 0 });
  const [subsectionForm, setSubsectionForm] = useState({ title: '', order: 0, pdf_file: null });
  const [selectedSection, setSelectedSection] = useState(null);
  const [viewingPdf, setViewingPdf] = useState(null);
  const [enrollment, setEnrollment] = useState(null);

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
      const myEnrollment = enrollments.find((e) => e.course?.id === parseInt(id));
      setEnrolled(!!myEnrollment);
      setEnrollment(myEnrollment || null);
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

  const isInstructorOrAdmin = user?.role === 'instructor' || user?.role === 'admin';

  const handleCreateSection = async () => {
    if (!sectionForm.title.trim()) {
      toast.error('Section title is required');
      return;
    }
    try {
      await api.post('/courses/sections/', {
        course: parseInt(id, 10),
        title: sectionForm.title.trim(),
        order: sectionForm.order,
      });
      toast.success('Section created');
      setSectionDialogOpen(false);
      setSectionForm({ title: '', order: 0 });
      fetchCourse();
    } catch (error) {
      toast.error(error.response?.data?.detail || error.response?.data?.error || 'Failed to create section');
    }
  };

  const handleDeleteSection = async (sectionId) => {
    if (!window.confirm('Delete this section and all its subsections?')) return;
    try {
      await api.delete(`/courses/sections/${sectionId}/`);
      toast.success('Section deleted');
      fetchCourse();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete section');
    }
  };

  const handleCreateSubsection = async () => {
    if (!selectedSection || !subsectionForm.title.trim()) {
      toast.error('Subsection title is required');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('section', selectedSection.id);
      formData.append('title', subsectionForm.title.trim());
      formData.append('order', subsectionForm.order);
      if (subsectionForm.pdf_file) {
        formData.append('pdf_file', subsectionForm.pdf_file);
      }
      await api.post('/courses/subsections/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Subsection created');
      setSubsectionDialogOpen(false);
      setSubsectionForm({ title: '', order: 0, pdf_file: null });
      setSelectedSection(null);
      fetchCourse();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create subsection');
    }
  };

  const handleDeleteSubsection = async (subsectionId) => {
    if (!window.confirm('Delete this lecture?')) return;
    try {
      await api.delete(`/courses/subsections/${subsectionId}/`);
      toast.success('Lecture deleted');
      fetchCourse();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete lecture');
    }
  };

  const handleUploadPdf = async (subsectionId, file) => {
    if (!file || file.type !== 'application/pdf') {
      toast.error('Please select a PDF file');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('pdf_file', file);
      await api.patch(`/courses/subsections/${subsectionId}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('PDF uploaded');
      fetchCourse();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload PDF');
    }
  };

  const handleMarkSubsectionComplete = async (subsectionId) => {
    if (!enrollment) return;
    try {
      await api.post(`/courses/${enrollment.id}/subsections/${subsectionId}/complete/`);
      toast.success('Marked as complete');
      checkEnrollment();
      fetchCourse();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark complete');
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
        <>
          {isInstructorOrAdmin && (
            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setSectionDialogOpen(true)}
              >
                Add Section
              </Button>
            </Box>
          )}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Course Content
              </Typography>
              {course.sections && course.sections.length > 0 ? (
                course.sections.map((section) => (
                  <Box key={section.id} sx={{ mb: 3 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1,
                        p: 1,
                        backgroundColor: '#f5f5f5',
                        borderRadius: 1,
                      }}
                    >
                      <Folder sx={{ color: '#8b5cf6' }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
                        {section.title}
                      </Typography>
                      {isInstructorOrAdmin && (
                        <>
                          <Button
                            size="small"
                            startIcon={<Add />}
                            onClick={() => {
                              setSelectedSection(section);
                              setSubsectionForm({ title: '', order: section.subsections?.length || 0, pdf_file: null });
                              setSubsectionDialogOpen(true);
                            }}
                          >
                            Add Lecture
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<Delete />}
                            onClick={() => handleDeleteSection(section.id)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </Box>
                    <List dense sx={{ pl: 2 }}>
                      {section.subsections && section.subsections.length > 0 ? (
                        section.subsections.map((sub) => (
                          <ListItem
                            key={sub.id}
                            sx={{
                              borderLeft: '3px solid #8b5cf6',
                              mb: 1,
                              backgroundColor: '#fafafa',
                              borderRadius: 1,
                            }}
                            secondaryAction={
                              isInstructorOrAdmin ? (
                                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                  <Button
                                    component="label"
                                    size="small"
                                    startIcon={<UploadFile />}
                                  >
                                    {sub.pdf_file ? 'Replace PDF' : 'Upload PDF'}
                                    <input
                                      type="file"
                                      accept="application/pdf"
                                      hidden
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) handleUploadPdf(sub.id, f);
                                      }}
                                    />
                                  </Button>
                                  <Button
                                    size="small"
                                    color="error"
                                    startIcon={<Delete />}
                                    onClick={() => handleDeleteSubsection(sub.id)}
                                  >
                                    Delete
                                  </Button>
                                </Box>
                              ) : (
                                sub.pdf_url && (
                                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<Description />}
                                      onClick={() => setViewingPdf(sub)}
                                    >
                                      View PDF
                                    </Button>
                                    {enrolled && (
                                      <Button
                                        size="small"
                                        variant="contained"
                                        onClick={() => handleMarkSubsectionComplete(sub.id)}
                                      >
                                        Mark Complete
                                      </Button>
                                    )}
                                  </Box>
                                )
                              )
                            }
                          >
                            <InsertDriveFile sx={{ mr: 1, color: '#757575' }} />
                            <ListItemText
                              primary={sub.title}
                              secondary={sub.pdf_file ? 'PDF attached' : 'No PDF uploaded'}
                            />
                          </ListItem>
                        ))
                      ) : (
                        <ListItem>
                          <Typography variant="body2" color="text.secondary">
                            No lectures in this section
                          </Typography>
                        </ListItem>
                      )}
                    </List>
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {isInstructorOrAdmin
                    ? 'No sections yet. Click "Add Section" to create course content.'
                    : 'No content available for this course.'}
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Create Section Dialog */}
          <Dialog open={sectionDialogOpen} onClose={() => setSectionDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Add Section</DialogTitle>
            <DialogContent>
              <TextField
                fullWidth
                label="Section Title"
                margin="normal"
                value={sectionForm.title}
                onChange={(e) => setSectionForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Week 1: Introduction"
              />
              <TextField
                fullWidth
                label="Order"
                type="number"
                margin="normal"
                value={sectionForm.order}
                onChange={(e) => setSectionForm((p) => ({ ...p, order: parseInt(e.target.value, 10) || 0 }))}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSectionDialogOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={handleCreateSection}>Create</Button>
            </DialogActions>
          </Dialog>

          {/* Create Subsection Dialog */}
          <Dialog open={subsectionDialogOpen} onClose={() => setSubsectionDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Add Lecture</DialogTitle>
            <DialogContent>
              {selectedSection && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Section: {selectedSection.title}
                </Typography>
              )}
              <TextField
                fullWidth
                label="Lecture Title"
                margin="normal"
                value={subsectionForm.title}
                onChange={(e) => setSubsectionForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Lecture 1: Introduction to Python"
              />
              <TextField
                fullWidth
                label="Order"
                type="number"
                margin="normal"
                value={subsectionForm.order}
                onChange={(e) => setSubsectionForm((p) => ({ ...p, order: parseInt(e.target.value, 10) || 0 }))}
              />
              <Box sx={{ mt: 2 }}>
                <Button component="label" variant="outlined" startIcon={<UploadFile />} fullWidth>
                  {subsectionForm.pdf_file ? subsectionForm.pdf_file.name : 'Upload PDF (optional)'}
                  <input
                    type="file"
                    accept="application/pdf"
                    hidden
                    onChange={(e) => setSubsectionForm((p) => ({ ...p, pdf_file: e.target.files?.[0] || null }))}
                  />
                </Button>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSubsectionDialogOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={handleCreateSubsection}>Create</Button>
            </DialogActions>
          </Dialog>

          {/* PDF Viewer Dialog for students */}
          <Dialog
            open={!!viewingPdf}
            onClose={() => setViewingPdf(null)}
            maxWidth="lg"
            fullWidth
            PaperProps={{ sx: { height: '90vh' } }}
          >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {viewingPdf?.title}
              <Button onClick={() => setViewingPdf(null)}>Close</Button>
            </DialogTitle>
            <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
              {viewingPdf?.pdf_url && (
                <iframe
                  title={viewingPdf.title}
                  src={viewingPdf.pdf_url}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              )}
            </DialogContent>
          </Dialog>
        </>
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
          {isInstructorOrAdmin && (
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

