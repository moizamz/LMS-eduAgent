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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Divider,
  Checkbox,
  ListItemIcon,
  Collapse,
  Menu,
  Paper,
} from '@mui/material';
import {
  PlayArrow, Description, Link as LinkIcon, TextFields,
  Add, Delete, UploadFile, Folder, InsertDriveFile, GetApp, AutoAwesome, Edit, Lightbulb, FileDownload, FileUpload,
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
  const [createQuizTab, setCreateQuizTab] = useState(0); // 0 = manual, 1 = generate
  const [quizForm, setQuizForm] = useState({
    title: '',
    description: '',
    time_limit_minutes: 30,
    passing_score: 60,
    max_attempts: 3,
  });
  const [manualQuestions, setManualQuestions] = useState([
    { statement: '', marks: 1, explanation: '', hint: '', difficulty: 'medium', taxonomy: 'understand', options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }] },
  ]);
  const [generateSelectedLectureIds, setGenerateSelectedLectureIds] = useState([]);
  const [numQuestionsToGenerate, setNumQuestionsToGenerate] = useState(5);
  const [createQuizSubmitting, setCreateQuizSubmitting] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [editQuizOpen, setEditQuizOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [quizReviewOpen, setQuizReviewOpen] = useState(false);
  const [reviewAttempt, setReviewAttempt] = useState(null);
  const [questionHintsShown, setQuestionHintsShown] = useState({});
  const [quizCurrentQuestionIndex, setQuizCurrentQuestionIndex] = useState(0);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [exportMenuQuiz, setExportMenuQuiz] = useState(null);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [subsectionDialogOpen, setSubsectionDialogOpen] = useState(false);
  const [sectionForm, setSectionForm] = useState({ title: '', order: 0 });
  const [subsectionForm, setSubsectionForm] = useState({ title: '', order: 0, pdf_file: null });
  const [selectedSection, setSelectedSection] = useState(null);
  const [viewingPdf, setViewingPdf] = useState(null);
  const [viewingPdfBlobUrl, setViewingPdfBlobUrl] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    description: '',
    due_date: '',
    max_score: 100,
    instruction_file: null,
  });
  const [assignmentSubmissionsOpen, setAssignmentSubmissionsOpen] = useState(false);
  const [assignmentSubmissionsLoading, setAssignmentSubmissionsLoading] = useState(false);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState([]);
  const [assignmentSubmissionsAssignment, setAssignmentSubmissionsAssignment] = useState(null);

  // Chat tab
  const [chatFiles, setChatFiles] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]); // {role:'user'|'assistant', content:string}
  const [chatSending, setChatSending] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);

  // Practice tab (student)
  const [practiceSelectedLectureIds, setPracticeSelectedLectureIds] = useState([]);
  const [practiceNumQuestions, setPracticeNumQuestions] = useState(5);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceSelectedChoice, setPracticeSelectedChoice] = useState(null);
  const [practiceChecked, setPracticeChecked] = useState(false);
  const [practiceShowHint, setPracticeShowHint] = useState(false);
  const [practiceWasCorrect, setPracticeWasCorrect] = useState(null);

  useEffect(() => {
    fetchCourse();
    checkEnrollment();
    fetchQuizzes();
    fetchAssignments();
    fetchChatSessions();
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

  const fetchAssignments = async () => {
    try {
      setAssignmentsLoading(true);
      const res = await api.get('/assignments/', { params: { course_id: id } });
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setAssignments(data);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Failed to load assignments');
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const fetchChatSessions = async () => {
    try {
      const res = await api.get('/quizzes/chat-sessions/');
      setChatSessions(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Failed to load chat sessions', e);
    }
  };

  const handleViewAssignmentSubmissions = async (assignment) => {
    try {
      setAssignmentSubmissionsAssignment(assignment);
      setAssignmentSubmissionsOpen(true);
      setAssignmentSubmissionsLoading(true);
      const res = await api.get(`/assignments/${assignment.id}/submissions/`);
      setAssignmentSubmissions(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to load submissions');
    } finally {
      setAssignmentSubmissionsLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setChatInput('');
    setChatSending(true);
    try {
      const form = new FormData();
      form.append('message', msg);
      form.append('course_id', String(id));
      if (currentChatId) {
        form.append('session_id', currentChatId);
      }
      chatFiles.forEach((f) => form.append('files', f));
      const res = await api.post('/quizzes/chat/', form);
      const reply = res.data.reply || '';
      const session = res.data.session;
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      if (session) {
        setCurrentChatId(session.id);
        setChatSessions((prev) => {
          const others = prev.filter((s) => s.id !== session.id);
          return [session, ...others];
        });
      }
    } catch (e) {
      console.error('Chat error', e);
      toast.error(e.response?.data?.error || 'Chat failed');
    } finally {
      setChatSending(false);
    }
  };

  const handleGeneratePractice = async () => {
    if (!practiceSelectedLectureIds.length) {
      toast.error('Select at least one PDF lecture');
      return;
    }
    setPracticeLoading(true);
    setPracticeQuestions([]);
    setPracticeIndex(0);
    setPracticeSelectedChoice(null);
    setPracticeChecked(false);
    setPracticeShowHint(false);
    setPracticeWasCorrect(null);
    try {
      const res = await api.post('/quizzes/generate-questions/', {
        timeout: 360000, 
        subsection_ids: practiceSelectedLectureIds,
        num_questions: practiceNumQuestions,
      });
      const qs = res.data.questions || [];
      if (!qs.length) {
        toast.error('No questions generated');
        return;
      }
      setPracticeQuestions(qs);
      toast.success(`Generated ${qs.length} practice questions`);
    } catch (e) {
      console.error('[Practice] Error generating questions:', e);
      console.error('[Practice] Response:', e?.response?.data);
      toast.error(e?.response?.data?.error || e?.message || 'Failed to generate practice questions');
    } finally {
      setPracticeLoading(false);
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
      setQuizCurrentQuestionIndex(0);
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
      setReviewAttempt(res.data);
      setQuizReviewOpen(true);
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

  const getAvailableLectures = () => {
    if (!course?.sections) return [];
    const list = [];
    course.sections.forEach((sec) => {
      (sec.subsections || []).forEach((sub) => {
        if (sub.pdf_url || sub.pdf_file) {
          list.push({ ...sub, sectionTitle: sec.title });
        }
      });
    });
    return list;
  };

  const addManualQuestion = () => {
    setManualQuestions((prev) => [
      ...prev,
      { statement: '', marks: 1, explanation: '', hint: '', difficulty: 'medium', taxonomy: 'understand', options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }] },
    ]);
  };

  const removeManualQuestion = (index) => {
    setManualQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateManualQuestion = (index, field, value) => {
    setManualQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addOption = (qIndex) => {
    setManualQuestions((prev) => {
      const next = [...prev];
      next[qIndex].options = [...(next[qIndex].options || []), { text: '', isCorrect: false }];
      return next;
    });
  };

  const removeOption = (qIndex, optIndex) => {
    setManualQuestions((prev) => {
      const next = [...prev];
      const opts = next[qIndex].options.filter((_, i) => i !== optIndex);
      if (opts.length < 2) return prev;
      next[qIndex].options = opts;
      return next;
    });
  };

  const updateOption = (qIndex, optIndex, text) => {
    setManualQuestions((prev) => {
      const next = [...prev];
      next[qIndex].options[optIndex] = { ...next[qIndex].options[optIndex], text };
      return next;
    });
  };

  const setCorrectOption = (qIndex, optIndex) => {
    setManualQuestions((prev) => {
      const next = [...prev];
      next[qIndex].options = next[qIndex].options.map((o, i) => ({
        ...o,
        isCorrect: i === optIndex,
      }));
      return next;
    });
  };

  const handleGenerateQuestions = async () => {
    if (!generateSelectedLectureIds?.length) {
      toast.error('Please select at least one lecture');
      return;
    }
    console.log('[Generate] Starting with lecture IDs:', generateSelectedLectureIds, 'num_questions:', numQuestionsToGenerate);
    setGenerateLoading(true);
    try {
      const payload = {
        subsection_ids: generateSelectedLectureIds,
        num_questions: numQuestionsToGenerate,
      };
      console.log('[Generate] POST /quizzes/generate-questions/', payload);
      const res = await api.post('/quizzes/generate-questions/', payload);
      console.log('[Generate] Response status:', res.status, 'data:', res.data);
      const questions = res.data.questions || [];
      console.log('[Generate] Parsed questions count:', questions.length, questions);
      if (questions.length === 0) {
        toast.warning('No questions generated. Try different lectures or ensure Ollama is running with llama3.');
        return;
      }
      const converted = questions.map((q) => ({
        statement: q.statement || '',
        marks: q.marks || 1,
        explanation: q.explanation || '',
        hint: q.hint || '',
        difficulty: q.difficulty || 'medium',
        taxonomy: q.taxonomy || 'understand',
        options: (q.options || []).map((opt, idx) => ({
          text: typeof opt === 'string' ? opt : (opt?.text || opt),
          isCorrect: idx === (q.correct_index ?? 0),
        })),
      }));
      setManualQuestions(converted);
      setCreateQuizTab(0);
      toast.success(`Generated ${converted.length} questions. Review and edit, then click Create quiz.`);
    } catch (error) {
      console.error('[Generate] Error:', error);
      console.error('[Generate] Response:', error.response?.data);
      console.error('[Generate] Status:', error.response?.status);
      toast.error(error.response?.data?.error || error.message || 'Failed to generate questions. Check console and ensure Ollama is running.');
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleCreateQuiz = async () => {
    if (!quizForm.title.trim()) {
      toast.error('Quiz title is required');
      return;
    }
    const validQuestions = manualQuestions.filter(
      (q) => q.statement.trim() && q.options && q.options.length >= 2
    );
    const hasCorrect = validQuestions.every((q) =>
      q.options.some((o) => o.isCorrect && o.text.trim())
    );
    if (validQuestions.length === 0) {
      toast.error('Add at least one question with statement and at least 2 options');
      return;
    }
    if (!hasCorrect) {
      toast.error('Each question must have one correct option with text');
      return;
    }

    setCreateQuizSubmitting(true);
    try {
      const quizRes = await api.post('/quizzes/', {
        ...quizForm,
        course_id: parseInt(id, 10),
      });
      const quizId = quizRes.data.id;
      for (let i = 0; i < validQuestions.length; i++) {
        const q = validQuestions[i];
        const questionRes = await api.post('/quizzes/questions/', {
          quiz: quizId,
          question_text: q.statement.trim(),
          question_type: 'mcq',
          points: Math.max(1, parseInt(q.marks, 10) || 1),
          order: i,
          explanation: (q.explanation || '').trim() || null,
          hint: (q.hint || '').trim() || null,
          difficulty: q.difficulty || 'medium',
          taxonomy: q.taxonomy || 'understand',
        });
        const questionId = questionRes.data.id;
        const options = q.options.filter((o) => o.text.trim());
        for (let j = 0; j < options.length; j++) {
          await api.post('/quizzes/choices/', {
            question: questionId,
            choice_text: options[j].text.trim(),
            is_correct: !!options[j].isCorrect,
            order: j,
          });
        }
      }
      toast.success('Quiz created successfully');
      handleCreateQuizDialogClose();
      fetchQuizzes();
    } catch (error) {
      console.error('Error creating quiz:', error);
      toast.error(error.response?.data?.error || error.response?.data?.detail || 'Failed to create quiz');
    } finally {
      setCreateQuizSubmitting(false);
    }
  };

  const handleCreateQuizDialogClose = () => {
    setCreateQuizOpen(false);
    setEditQuizOpen(false);
    setEditingQuiz(null);
    setCreateQuizTab(0);
    setNumQuestionsToGenerate(5);
    setManualQuestions([
      { statement: '', marks: 1, explanation: '', hint: '', difficulty: 'medium', taxonomy: 'understand', options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }] },
    ]);
    setGenerateSelectedLectureIds([]);
  };

  const handleEditQuiz = async (quiz) => {
    try {
      const res = await api.get(`/quizzes/${quiz.id}/`);
      const fullQuiz = res.data;
      setEditingQuiz(fullQuiz);
      setQuizForm({
        title: fullQuiz.title,
        description: fullQuiz.description || '',
        time_limit_minutes: fullQuiz.time_limit_minutes || 30,
        passing_score: fullQuiz.passing_score || 60,
        max_attempts: fullQuiz.max_attempts || 3,
      });
      const qs = (fullQuiz.questions || []).map((q) => ({
        id: q.id,
        statement: q.question_text,
        marks: q.points || 1,
        explanation: q.explanation || '',
        hint: q.hint || '',
        difficulty: q.difficulty || 'medium',
        taxonomy: q.taxonomy || 'understand',
        options: (q.choices || []).map((c) => ({ text: c.choice_text, isCorrect: !!c.is_correct })),
      }));
      setManualQuestions(qs.length ? qs : [{ statement: '', marks: 1, explanation: '', hint: '', difficulty: 'medium', taxonomy: 'understand', options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }] }]);
      setEditQuizOpen(true);
    } catch (error) {
      toast.error('Failed to load quiz');
    }
  };

  const handleExportQuiz = async (quiz, format) => {
    try {
      console.log('[Export] Requesting export', { quizId: quiz.id, format });
      const res = await api.get(`/quizzes/${quiz.id}/export/`, {
        params: { format },
        responseType: 'blob',
      });
      console.log('[Export] Response status', res.status, 'headers', res.headers);
      const blob = res.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quiz.title}_questions.${format === 'xml' ? 'xml' : format === 'gift' ? 'gift' : 'csv'}`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('[Export] Error', error);
      const msg =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        error.message ||
        'Export failed';
      toast.error(msg);
    }
  };

  const handleImportQuestions = async (file, format) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);
    try {
      const res = await api.post('/quizzes/import-questions/', formData);
      const questions = res.data.questions || [];
      if (questions.length === 0) {
        toast.warning('No valid questions found in file');
        return;
      }
      const converted = questions.map((q) => ({
        statement: q.statement || '',
        marks: q.marks || 1,
        explanation: q.explanation || '',
        hint: q.hint || '',
        difficulty: q.difficulty || 'medium',
        taxonomy: q.taxonomy || 'understand',
        options: (q.options || []).map((opt, idx) => ({
          text: typeof opt === 'string' ? opt : opt.text || '',
          isCorrect: idx === (q.correct_index ?? 0),
        })),
      }));
      setManualQuestions(converted);
      toast.success(`Imported ${converted.length} questions`);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Import failed');
    }
  };

  const handleSaveEditQuiz = async () => {
    if (!editingQuiz || !quizForm.title.trim()) return;
    setCreateQuizSubmitting(true);
    try {
      await api.patch(`/quizzes/${editingQuiz.id}/`, quizForm);
      const validQuestions = manualQuestions.filter((q) => q.statement.trim() && q.options && q.options.length >= 2);
      const existingQuestions = (editingQuiz.questions || []).filter((q) => q.id);
      const existingIds = new Set(existingQuestions.map((q) => q.id));
      const localWithId = validQuestions.filter((q) => q.id && existingIds.has(q.id));
      const localNew = validQuestions.filter((q) => !q.id);

      for (const local of localWithId) {
        const q = existingQuestions.find((eq) => eq.id === local.id);
        if (!q) continue;
        await api.patch(`/quizzes/questions/${q.id}/`, {
          question_text: local.statement.trim(),
          points: Math.max(1, parseInt(local.marks, 10) || 1),
          explanation: (local.explanation || '').trim() || null,
          hint: (local.hint || '').trim() || null,
          difficulty: local.difficulty || 'medium',
          taxonomy: local.taxonomy || 'understand',
        });
        for (const c of q.choices || []) {
          await api.delete(`/quizzes/choices/${c.id}/`);
        }
        const opts = local.options.filter((o) => o.text.trim());
        for (let j = 0; j < opts.length; j++) {
          await api.post('/quizzes/choices/', {
            question: q.id,
            choice_text: opts[j].text.trim(),
            is_correct: !!opts[j].isCorrect,
            order: j,
          });
        }
      }
      for (let i = 0; i < localNew.length; i++) {
        const q = localNew[i];
        const questionRes = await api.post('/quizzes/questions/', {
          quiz: editingQuiz.id,
          question_text: q.statement.trim(),
          question_type: 'mcq',
          points: Math.max(1, parseInt(q.marks, 10) || 1),
          order: existingQuestions.length + i,
          explanation: (q.explanation || '').trim() || null,
          hint: (q.hint || '').trim() || null,
          difficulty: q.difficulty || 'medium',
          taxonomy: q.taxonomy || 'understand',
        });
        const opts = q.options.filter((o) => o.text.trim());
        for (let j = 0; j < opts.length; j++) {
          await api.post('/quizzes/choices/', {
            question: questionRes.data.id,
            choice_text: opts[j].text.trim(),
            is_correct: !!opts[j].isCorrect,
            order: j,
          });
        }
      }
      for (const q of existingQuestions) {
        if (!validQuestions.some((lq) => lq.id === q.id)) {
          await api.delete(`/quizzes/questions/${q.id}/`);
        }
      }
      toast.success('Quiz updated');
      setEditQuizOpen(false);
      setEditingQuiz(null);
      fetchQuizzes();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update quiz');
    } finally {
      setCreateQuizSubmitting(false);
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
      const wasCompleted = (enrollment?.completed_subsection_ids || []).includes(subsectionId);
      toast.success(wasCompleted ? 'Marked as uncomplete' : 'Marked as complete');
      checkEnrollment();
      fetchCourse();
    } catch (error) {
      toast.error(error.response?.data?.detail || error.response?.data?.error || 'Failed to update');
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
          <Tab label="Chat" />
          <Tab label="Practice" />
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
                                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                                  {sub.pdf_url && (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<GetApp />}
                                      component="a"
                                      href={sub.pdf_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download
                                    >
                                      Download PDF
                                    </Button>
                                  )}
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
                                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<Description />}
                                      onClick={() => {
                                        setViewingPdf(sub);
                                        setViewingPdfBlobUrl(null);
                                        if (sub.id) {
                                          api.get(`/courses/subsections/${sub.id}/pdf/`, { responseType: 'blob' })
                                            .then((r) => {
                                              const url = URL.createObjectURL(r.data);
                                              setViewingPdfBlobUrl(url);
                                            })
                                            .catch((e) => {
                                              console.error('PDF load error:', e);
                                              toast.error('Could not load PDF');
                                            });
                                        }
                                      }}
                                    >
                                      View PDF
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      startIcon={<GetApp />}
                                      component="a"
                                      href={sub.pdf_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download
                                    >
                                      Download PDF
                                    </Button>
                                    {enrolled && (
                                      <Button
                                        size="small"
                                        variant={(enrollment?.completed_subsection_ids || []).includes(sub.id) ? 'outlined' : 'contained'}
                                        onClick={() => handleMarkSubsectionComplete(sub.id)}
                                      >
                                        {(enrollment?.completed_subsection_ids || []).includes(sub.id) ? 'Mark Uncomplete' : 'Mark Complete'}
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
            onClose={() => {
              if (viewingPdfBlobUrl) URL.revokeObjectURL(viewingPdfBlobUrl);
              setViewingPdfBlobUrl(null);
              setViewingPdf(null);
            }}
            maxWidth="lg"
            fullWidth
            PaperProps={{ sx: { height: '90vh' } }}
          >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <span>{viewingPdf?.title}</span>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {viewingPdf?.pdf_url && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<GetApp />}
                    component="a"
                    href={viewingPdf.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                  >
                    Download PDF
                  </Button>
                )}
                <Button onClick={() => { if (viewingPdfBlobUrl) URL.revokeObjectURL(viewingPdfBlobUrl); setViewingPdfBlobUrl(null); setViewingPdf(null); }}>Close</Button>
              </Box>
            </DialogTitle>
            <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
              {viewingPdfBlobUrl ? (
                <iframe
                  title={viewingPdf?.title}
                  src={viewingPdfBlobUrl}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              ) : viewingPdf && (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <CircularProgress />
                  <Typography sx={{ mt: 1 }}>Loading PDF...</Typography>
                </Box>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}

      {tabValue === 1 && (
        <>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Assignments
                </Typography>
                {isInstructorOrAdmin && (
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => {
                      setAssignmentForm({
                        title: '',
                        description: '',
                        due_date: '',
                        max_score: 100,
                        instruction_file: null,
                      });
                      setAssignmentDialogOpen(true);
                    }}
                  >
                    Create Assignment
                  </Button>
                )}
              </Box>
              {assignmentsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : assignments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No assignments for this course.
                </Typography>
              ) : (
                <List>
                  {assignments.map((a) => (
                    <ListItem key={a.id} divider>
                      <ListItemText
                        primary={a.title}
                        secondary={
                          <>
                            <Typography variant="body2" color="text.secondary">
                              {a.description}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Due: {a.due_date ? new Date(a.due_date).toLocaleString() : 'Not set'} · Max score: {a.max_score}
                            </Typography>
                          </>
                        }
                      />
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        {a.instruction_file_url && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<GetApp />}
                            component="a"
                            href={a.instruction_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                          >
                            Instructions
                          </Button>
                        )}
                        {user?.role === 'student' && (
                          <Button
                            size="small"
                            variant="contained"
                            component="label"
                          >
                            Submit
                            <input
                              type="file"
                              hidden
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                const formData = new FormData();
                                formData.append('submission_file', f);
                                try {
                                  await api.post(`/assignments/${a.id}/submit/`, formData);
                                  toast.success('Assignment submitted');
                                } catch (err) {
                                  toast.error(err.response?.data?.error || 'Submission failed');
                                } finally {
                                  e.target.value = '';
                                }
                              }}
                            />
                          </Button>
                        )}
                        {isInstructorOrAdmin && (
                          <Button size="small" variant="outlined" onClick={() => handleViewAssignmentSubmissions(a)}>
                            View submissions
                          </Button>
                        )}
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>

          {/* Create Assignment Dialog for instructors */}
          <Dialog
            open={assignmentDialogOpen}
            onClose={() => setAssignmentDialogOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Create Assignment</DialogTitle>
            <DialogContent>
              <TextField
                fullWidth
                label="Title"
                margin="normal"
                value={assignmentForm.title}
                onChange={(e) => setAssignmentForm((p) => ({ ...p, title: e.target.value }))}
              />
              <TextField
                fullWidth
                label="Description"
                margin="normal"
                multiline
                rows={3}
                value={assignmentForm.description}
                onChange={(e) => setAssignmentForm((p) => ({ ...p, description: e.target.value }))}
              />
              <TextField
                fullWidth
                type="datetime-local"
                label="Due date"
                margin="normal"
                InputLabelProps={{ shrink: true }}
                value={assignmentForm.due_date}
                onChange={(e) => setAssignmentForm((p) => ({ ...p, due_date: e.target.value }))}
              />
              <TextField
                fullWidth
                type="number"
                label="Max score"
                margin="normal"
                value={assignmentForm.max_score}
                onChange={(e) => setAssignmentForm((p) => ({ ...p, max_score: Number(e.target.value) || 100 }))}
              />
              <Box sx={{ mt: 2 }}>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<UploadFile />}
                  fullWidth
                >
                  {assignmentForm.instruction_file ? assignmentForm.instruction_file.name : 'Upload instructions PDF (optional)'}
                  <input
                    type="file"
                    accept="application/pdf"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setAssignmentForm((p) => ({ ...p, instruction_file: f }));
                    }}
                  />
                </Button>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAssignmentDialogOpen(false)}>Cancel</Button>
              <Button
                variant="contained"
                onClick={async () => {
                  if (!assignmentForm.title.trim()) {
                    toast.error('Assignment title is required');
                    return;
                  }
                  if (!assignmentForm.due_date) {
                    toast.error('Due date is required');
                    return;
                  }
                  const formData = new FormData();
                  formData.append('title', assignmentForm.title);
                  formData.append('description', assignmentForm.description);
                  if (assignmentForm.due_date) {
                    formData.append('due_date', assignmentForm.due_date);
                  }
                  formData.append('max_score', String(assignmentForm.max_score || 100));
                  formData.append('course_id', String(id));
                  if (assignmentForm.instruction_file) {
                    formData.append('instruction_file', assignmentForm.instruction_file);
                  }
                  try {
                    await api.post('/assignments/', formData);
                    toast.success('Assignment created');
                    setAssignmentDialogOpen(false);
                    fetchAssignments();
                  } catch (err) {
                    toast.error(err.response?.data?.error || 'Failed to create assignment');
                  }
                }}
              >
                Create
              </Button>
            </DialogActions>
          </Dialog>

          {/* Assignment submissions dialog (instructor) */}
          <Dialog
            open={assignmentSubmissionsOpen}
            onClose={() => { setAssignmentSubmissionsOpen(false); setAssignmentSubmissions([]); setAssignmentSubmissionsAssignment(null); }}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              Submissions {assignmentSubmissionsAssignment ? `— ${assignmentSubmissionsAssignment.title}` : ''}
            </DialogTitle>
            <DialogContent dividers>
              {assignmentSubmissionsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : assignmentSubmissions.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No submissions yet.</Typography>
              ) : (
                <List>
                  {assignmentSubmissions.map((s) => (
                    <ListItem key={s.id} divider>
                      <ListItemText
                        primary={`${s.student?.first_name || ''} ${s.student?.last_name || ''}`.trim() || s.student?.username || 'Student'}
                        secondary={`Submitted: ${s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'}`}
                      />
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        {s.submission_file && (
                          <Button size="small" variant="outlined" component="a" href={s.submission_file} target="_blank" rel="noopener noreferrer">
                            Download
                          </Button>
                        )}
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => { setAssignmentSubmissionsOpen(false); setAssignmentSubmissions([]); setAssignmentSubmissionsAssignment(null); }}>Close</Button>
            </DialogActions>
          </Dialog>
        </>
      )}

      {tabValue === 4 && (
        <Card>
          <CardContent sx={{ display: 'flex', gap: 2, minHeight: 420 }}>
            {/* Left: sessions list */}
            <Box sx={{ width: 260, borderRight: 1, borderColor: 'divider', pr: 2, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle1">Chats</Typography>
                <Button
                  size="small"
                  onClick={() => {
                    setCurrentChatId(null);
                    setChatMessages([]);
                    setChatFiles([]);
                  }}
                >
                  New
                </Button>
              </Box>
              <List dense sx={{ flex: 1, overflowY: 'auto' }}>
                {chatSessions.length === 0 ? (
                  <ListItem>
                    <ListItemText
                      primary={
                        <Typography variant="body2" color="text.secondary">
                          No chats yet.
                        </Typography>
                      }
                    />
                  </ListItem>
                ) : (
                  chatSessions.map((s) => (
                    <ListItem
                      key={s.id}
                      button
                      selected={s.id === currentChatId}
                      onClick={async () => {
                        try {
                          const res = await api.get(`/quizzes/chat-sessions/${s.id}/`);
                          const msgs = (res.data.messages || []).map((m) => ({
                            role: m.role,
                            content: m.content,
                          }));
                          setCurrentChatId(s.id);
                          setChatMessages(msgs);
                        } catch (e) {
                          toast.error(e.response?.data?.error || 'Failed to load chat');
                        }
                      }}
                    >
                      <ListItemText
                        primary={s.title || 'Chat'}
                        secondary={s.last_message?.content || ''}
                        primaryTypographyProps={{ noWrap: true }}
                        secondaryTypographyProps={{ noWrap: true }}
                      />
                    </ListItem>
                  ))
                )}
              </List>
            </Box>

            {/* Right: conversation */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>Chat</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Upload files once per chat. Gemini is tried first; if it fails, the local LLM is used.
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                <Button component="label" variant="outlined" startIcon={<UploadFile />}>
                  Upload files
                  <input
                    type="file"
                    hidden
                    multiple
                    accept=".pdf,.txt,.md"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length) setChatFiles((prev) => [...prev, ...files]);
                      e.target.value = '';
                    }}
                  />
                </Button>
                {chatFiles.length > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Files: {chatFiles.map((f) => f.name).join(', ')}
                  </Typography>
                )}
                {chatFiles.length > 0 && (
                  <Button size="small" color="error" onClick={() => setChatFiles([])}>Clear files</Button>
                )}
              </Box>

              <Paper variant="outlined" sx={{ p: 2, flex: 1, overflowY: 'auto', mb: 2 }}>
                {chatMessages.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Ask a question about your course or uploaded files.
                  </Typography>
                ) : (
                  chatMessages.map((m, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                        mb: 1.5,
                      }}
                    >
                      <Box
                        sx={{
                          maxWidth: '75%',
                          px: 1.5,
                          py: 1,
                          borderRadius: 2,
                          bgcolor: m.role === 'user' ? '#7c3aed' : '#f3f4f6',
                          color: m.role === 'user' ? '#fff' : 'inherit',
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{ display: 'block', mb: 0.5, opacity: 0.8 }}
                        >
                          {m.role === 'user' ? 'You' : 'Assistant'}
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {m.content}
                        </Typography>
                      </Box>
                    </Box>
                  ))
                )}
              </Paper>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!chatSending) handleSendChat();
                    }
                  }}
                />
                <Button variant="contained" disabled={chatSending || !chatInput.trim()} onClick={handleSendChat}>
                  {chatSending ? 'Sending...' : 'Send'}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {tabValue === 5 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Practice</Typography>
            {user?.role !== 'student' ? (
              <Typography variant="body2" color="text.secondary">Practice is available for students.</Typography>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select lecture PDFs, generate questions, then attempt them one by one with hints and instant explanations.
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
                  <FormControl sx={{ minWidth: 280 }} size="small">
                    <InputLabel>Select lectures</InputLabel>
                    <Select
                      multiple
                      value={practiceSelectedLectureIds}
                      label="Select lectures"
                      renderValue={(selected) => {
                        const lectures = getAvailableLectures();
                        return lectures
                          .filter((l) => selected.includes(l.id))
                          .map((l) => l.title)
                          .join(', ');
                      }}
                      onChange={(e) => setPracticeSelectedLectureIds(e.target.value)}
                    >
                      {getAvailableLectures().map((sub) => (
                        <MenuItem key={sub.id} value={sub.id}>
                          <Checkbox checked={practiceSelectedLectureIds.includes(sub.id)} />
                          <ListItemText primary={`${sub.sectionTitle}: ${sub.title}`} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    label="Questions"
                    type="number"
                    size="small"
                    sx={{ width: 140 }}
                    value={practiceNumQuestions}
                    onChange={(e) => setPracticeNumQuestions(Math.max(1, Math.min(15, Number(e.target.value) || 5)))}
                  />

                  <Button variant="contained" startIcon={<AutoAwesome />} disabled={practiceLoading} onClick={handleGeneratePractice}>
                    {practiceLoading ? 'Generating...' : 'Generate'}
                  </Button>
                </Box>

                {practiceQuestions.length > 0 && (
                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      Question {practiceIndex + 1} of {practiceQuestions.length}
                    </Typography>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      {practiceQuestions[practiceIndex]?.statement}
                    </Typography>

                    {practiceQuestions[practiceIndex]?.hint && (
                      <Box sx={{ mb: 1 }}>
                        <Button size="small" startIcon={<Lightbulb />} onClick={() => setPracticeShowHint((v) => !v)}>
                          {practiceShowHint ? 'Hide hint' : 'Show hint'}
                        </Button>
                        <Collapse in={practiceShowHint}>
                          <Typography variant="body2" sx={{ p: 1, backgroundColor: '#fff8e1', borderRadius: 1, mt: 0.5 }}>
                            {practiceQuestions[practiceIndex]?.hint}
                          </Typography>
                        </Collapse>
                      </Box>
                    )}

                    <RadioGroup
                      value={practiceSelectedChoice ?? ''}
                      onChange={(e) => setPracticeSelectedChoice(Number(e.target.value))}
                    >
                      {(practiceQuestions[practiceIndex]?.options || []).map((opt, idx) => (
                        <FormControlLabel key={idx} value={idx} control={<Radio />} label={opt} />
                      ))}
                    </RadioGroup>

                    {practiceChecked && (
                      <Box sx={{ mt: 1, p: 1.5, borderRadius: 1, backgroundColor: practiceWasCorrect ? '#e8f5e9' : '#ffebee' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {practiceWasCorrect ? 'Correct' : 'Incorrect'} — Correct answer: {practiceQuestions[practiceIndex]?.options?.[practiceQuestions[practiceIndex]?.correct_index]}
                        </Typography>
                        {practiceQuestions[practiceIndex]?.explanation && (
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            Explanation: {practiceQuestions[practiceIndex]?.explanation}
                          </Typography>
                        )}
                      </Box>
                    )}

                    <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'space-between' }}>
                      <Button
                        disabled={practiceIndex === 0}
                        onClick={() => {
                          setPracticeIndex((i) => Math.max(0, i - 1));
                          setPracticeSelectedChoice(null);
                          setPracticeChecked(false);
                          setPracticeShowHint(false);
                          setPracticeWasCorrect(null);
                        }}
                      >
                        Previous
                      </Button>

                      {!practiceChecked ? (
                        <Button
                          variant="contained"
                          disabled={practiceSelectedChoice === null}
                          onClick={() => {
                            const q = practiceQuestions[practiceIndex];
                            const isCorrect = Number(practiceSelectedChoice) === Number(q.correct_index);
                            setPracticeWasCorrect(isCorrect);
                            setPracticeChecked(true);
                          }}
                        >
                          Check answer
                        </Button>
                      ) : (
                        <Button
                          variant="contained"
                          onClick={() => {
                            if (practiceIndex < practiceQuestions.length - 1) {
                              setPracticeIndex((i) => i + 1);
                              setPracticeSelectedChoice(null);
                              setPracticeChecked(false);
                              setPracticeShowHint(false);
                              setPracticeWasCorrect(null);
                            } else {
                              toast.success('Practice complete');
                            }
                          }}
                        >
                          {practiceIndex < practiceQuestions.length - 1 ? 'Next' : 'Finish'}
                        </Button>
                      )}
                    </Box>
                  </Card>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tabValue === 2 && (
        <>
          {isInstructorOrAdmin && (
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                onClick={() => {
                  setEditingQuiz(null);
                  setEditQuizOpen(false);
                  setCreateQuizTab(0);
                  setQuizForm({ title: '', description: '', time_limit_minutes: 30, passing_score: 60, max_attempts: 3 });
                  setManualQuestions([{ statement: '', marks: 1, explanation: '', hint: '', difficulty: 'medium', taxonomy: 'understand', options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }] }]);
                  setGenerateSelectedLectureIds([]);
                  setCreateQuizOpen(true);
                }}
              >
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
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {user?.role === 'student' && (
                            <>
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => handleStartQuiz(quiz)}
                              >
                                Start Quiz
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => {
                                  setReviewAttempt(null);
                                  api.get(`/quizzes/${quiz.id}/results/`).then((r) => {
                                    const attempts = Array.isArray(r.data) ? r.data : [];
                                    const completed = attempts.filter((a) => a.is_completed);
                                    const last = completed[0] || attempts[0];
                                    if (last) {
                                      setReviewAttempt(last);
                                      setQuizReviewOpen(true);
                                    } else {
                                      toast.info('Complete a quiz attempt first to review.');
                                    }
                                  }).catch(() => toast.error('No attempts to review'));
                                }}
                              >
                                Review
                              </Button>
                            </>
                          )}
                          {isInstructorOrAdmin && (
                            <>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<Edit />}
                                onClick={() => handleEditQuiz(quiz)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<FileDownload />}
                                onClick={(e) => { setExportMenuAnchor(e.currentTarget); setExportMenuQuiz(quiz); }}
                              >
                                Export
                              </Button>
                            </>
                          )}
                        </Box>
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

          <Menu
            anchorEl={exportMenuAnchor}
            open={Boolean(exportMenuAnchor)}
            onClose={() => { setExportMenuAnchor(null); setExportMenuQuiz(null); }}
          >
            <MenuItem onClick={() => { if (exportMenuQuiz) handleExportQuiz(exportMenuQuiz, 'csv'); setExportMenuAnchor(null); setExportMenuQuiz(null); }}>Export as CSV</MenuItem>
            <MenuItem onClick={() => { if (exportMenuQuiz) handleExportQuiz(exportMenuQuiz, 'xml'); setExportMenuAnchor(null); setExportMenuQuiz(null); }}>Export as Moodle XML</MenuItem>
            <MenuItem onClick={() => { if (exportMenuQuiz) handleExportQuiz(exportMenuQuiz, 'gift'); setExportMenuAnchor(null); setExportMenuQuiz(null); }}>Export as GIFT</MenuItem>
          </Menu>

          {/* Take Quiz Dialog for students - one question at a time */}
          <Dialog
            open={quizDialogOpen}
            onClose={() => setQuizDialogOpen(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              {activeQuiz ? activeQuiz.title : 'Quiz'}
              {quizQuestions.length > 0 && (
                <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  (Question {quizCurrentQuestionIndex + 1} of {quizQuestions.length})
                </Typography>
              )}
            </DialogTitle>
            <DialogContent dividers>
              {quizQuestions.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No questions available for this quiz.
                </Typography>
              ) : (
                (() => {
                  const question = quizQuestions[quizCurrentQuestionIndex];
                  if (!question) return null;
                  return (
                    <Box key={question.id}>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        {question.question_text}
                      </Typography>
                      {question.hint && (
                        <Box sx={{ mb: 1 }}>
                          <Button
                            size="small"
                            startIcon={<Lightbulb />}
                            onClick={() => setQuestionHintsShown((p) => ({ ...p, [question.id]: !p[question.id] }))}
                          >
                            {questionHintsShown[question.id] ? 'Hide hint' : 'Show hint'}
                          </Button>
                          <Collapse in={!!questionHintsShown[question.id]}>
                            <Typography variant="body2" sx={{ p: 1, backgroundColor: '#fff8e1', borderRadius: 1, mt: 0.5 }}>
                              {question.hint}
                            </Typography>
                          </Collapse>
                        </Box>
                      )}
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
                  );
                })()
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setQuizDialogOpen(false)}>Cancel</Button>
              <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 1 }}>
                <Button
                  disabled={quizCurrentQuestionIndex === 0}
                  onClick={() => setQuizCurrentQuestionIndex((i) => Math.max(0, i - 1))}
                >
                  Previous
                </Button>
                {quizCurrentQuestionIndex < quizQuestions.length - 1 ? (
                  <Button
                    variant="contained"
                    onClick={() => setQuizCurrentQuestionIndex((i) => Math.min(quizQuestions.length - 1, i + 1))}
                  >
                    Next
                  </Button>
                ) : (
                  <Button variant="contained" onClick={handleSubmitQuiz}>
                    Submit Quiz
                  </Button>
                )}
              </Box>
            </DialogActions>
          </Dialog>

          {/* Quiz Review Dialog (after submit or from Review button) */}
          <Dialog
            open={quizReviewOpen}
            onClose={() => { setQuizReviewOpen(false); setReviewAttempt(null); }}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              Quiz Review {reviewAttempt && `— Score: ${reviewAttempt.score != null ? reviewAttempt.score.toFixed(1) : 0}%`}
            </DialogTitle>
            <DialogContent dividers>
              {!reviewAttempt ? (
                <Typography variant="body2" color="text.secondary">No attempt to review.</Typography>
              ) : (
                (reviewAttempt.answers || []).map((ans, idx) => (
                  <Box key={ans.id || idx} sx={{ mb: 3, p: 2, backgroundColor: ans.is_correct ? '#e8f5e9' : '#ffebee', borderRadius: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {idx + 1}. {ans.question?.question_text}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Your answer: {ans.selected_choice?.choice_text || '(none)'}
                      {ans.is_correct ? ' ✓' : ' ✗'}
                    </Typography>
                    {!ans.is_correct && ans.question?.choices?.find((c) => c.is_correct) && (
                      <Typography variant="body2" color="text.secondary">
                        Correct: {ans.question.choices.find((c) => c.is_correct)?.choice_text}
                      </Typography>
                    )}
                    {ans.question?.explanation && (
                      <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                        Explanation: {ans.question.explanation}
                      </Typography>
                    )}
                  </Box>
                ))
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => { setQuizReviewOpen(false); setReviewAttempt(null); }}>Close</Button>
            </DialogActions>
          </Dialog>

          {/* Create Quiz Dialog for instructors */}
          <Dialog
            open={createQuizOpen || editQuizOpen}
            onClose={() => {
              handleCreateQuizDialogClose();
              setEditQuizOpen(false);
              setEditingQuiz(null);
            }}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>{editingQuiz ? 'Edit Quiz' : 'Create Quiz'}</DialogTitle>
            <DialogContent>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Quiz details (shared)</Typography>
              <TextField
                fullWidth
                label="Quiz Title"
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
                rows={2}
                value={quizForm.description}
                onChange={(e) =>
                  setQuizForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  label="Time Limit (minutes)"
                  type="number"
                  size="small"
                  sx={{ width: 140 }}
                  value={quizForm.time_limit_minutes}
                  onChange={(e) =>
                    setQuizForm((prev) => ({
                      ...prev,
                      time_limit_minutes: Number(e.target.value) || 30,
                    }))
                  }
                />
                <TextField
                  label="Passing Score (%)"
                  type="number"
                  size="small"
                  sx={{ width: 140 }}
                  value={quizForm.passing_score}
                  onChange={(e) =>
                    setQuizForm((prev) => ({
                      ...prev,
                      passing_score: Number(e.target.value) || 60,
                    }))
                  }
                />
                <TextField
                  label="Max Attempts"
                  type="number"
                  size="small"
                  sx={{ width: 120 }}
                  value={quizForm.max_attempts}
                  onChange={(e) =>
                    setQuizForm((prev) => ({
                      ...prev,
                      max_attempts: Number(e.target.value) || 3,
                    }))
                  }
                />
              </Box>
              <Divider sx={{ my: 2 }} />
              {!editingQuiz && (
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                  <Tabs value={createQuizTab} onChange={(e, v) => setCreateQuizTab(v)}>
                    <Tab label="Create manually" />
                    <Tab label="Generate from lecture" />
                  </Tabs>
                </Box>
              )}

              {(createQuizTab === 0 || editingQuiz) && (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Questions
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {!editingQuiz && (
                        <Button component="label" size="small" variant="outlined" startIcon={<FileUpload />}>
                          Import (CSV, XML, GIFT)
                          <input
                            type="file"
                            accept=".csv,.xml,.gift,.txt"
                            hidden
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              const ext = (f.name.split('.').pop() || '').toLowerCase();
                              const fmt = ext === 'xml' ? 'xml' : (ext === 'gift' || ext === 'txt') ? 'gift' : 'csv';
                              handleImportQuestions(f, fmt);
                              e.target.value = '';
                            }}
                          />
                        </Button>
                      )}
                      {editingQuiz && (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Button size="small" variant="outlined" startIcon={<FileDownload />} onClick={() => handleExportQuiz(editingQuiz, 'csv')}>CSV</Button>
                          <Button size="small" variant="outlined" startIcon={<FileDownload />} onClick={() => handleExportQuiz(editingQuiz, 'xml')}>XML</Button>
                          <Button size="small" variant="outlined" startIcon={<FileDownload />} onClick={() => handleExportQuiz(editingQuiz, 'gift')}>GIFT</Button>
                        </Box>
                      )}
                    </Box>
                  </Box>
                  {manualQuestions.map((q, qIndex) => (
                    <Card key={qIndex} variant="outlined" sx={{ mb: 2, p: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Question {qIndex + 1}
                        </Typography>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeManualQuestion(qIndex)}
                          disabled={manualQuestions.length <= 1}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                      <TextField
                        fullWidth
                        label="Question statement"
                        margin="dense"
                        value={q.statement}
                        onChange={(e) => updateManualQuestion(qIndex, 'statement', e.target.value)}
                        placeholder="Enter the question text"
                        multiline
                        minRows={2}
                      />
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                        <TextField
                          label="Marks"
                          type="number"
                          size="small"
                          sx={{ width: 100 }}
                          value={q.marks}
                          onChange={(e) =>
                            updateManualQuestion(qIndex, 'marks', Math.max(1, parseInt(e.target.value, 10) || 1))
                          }
                        />
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <InputLabel>Difficulty</InputLabel>
                          <Select
                            value={q.difficulty || 'medium'}
                            label="Difficulty"
                            onChange={(e) => updateManualQuestion(qIndex, 'difficulty', e.target.value)}
                          >
                            <MenuItem value="easy">Easy</MenuItem>
                            <MenuItem value="medium">Medium</MenuItem>
                            <MenuItem value="hard">Hard</MenuItem>
                          </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                          <InputLabel>Taxonomy</InputLabel>
                          <Select
                            value={q.taxonomy || 'understand'}
                            label="Taxonomy"
                            onChange={(e) => updateManualQuestion(qIndex, 'taxonomy', e.target.value)}
                          >
                            <MenuItem value="remember">Remember</MenuItem>
                            <MenuItem value="understand">Understand</MenuItem>
                            <MenuItem value="apply">Apply</MenuItem>
                            <MenuItem value="analyze">Analyze</MenuItem>
                            <MenuItem value="evaluate">Evaluate</MenuItem>
                            <MenuItem value="create">Create</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>
                      <TextField
                        fullWidth
                        label="Hint"
                        margin="dense"
                        size="small"
                        value={q.hint || ''}
                        onChange={(e) => updateManualQuestion(qIndex, 'hint', e.target.value)}
                        placeholder="Hint for students (shown during attempt)"
                        multiline
                        minRows={1}
                      />
                      <TextField
                        fullWidth
                        label="Explanation"
                        margin="dense"
                        size="small"
                        value={q.explanation || ''}
                        onChange={(e) => updateManualQuestion(qIndex, 'explanation', e.target.value)}
                        placeholder="Explanation (shown after submit)"
                        multiline
                        minRows={2}
                      />
                      <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>Options (select correct)</Typography>
                      {(q.options || []).map((opt, optIndex) => (
                        <Box
                          key={optIndex}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 0.5,
                          }}
                        >
                          <FormControlLabel
                            control={
                              <Radio
                                checked={!!opt.isCorrect}
                                onChange={() => setCorrectOption(qIndex, optIndex)}
                                size="small"
                              />
                            }
                            label=""
                          />
                          <TextField
                            fullWidth
                            size="small"
                            placeholder={`Option ${optIndex + 1}`}
                            value={opt.text}
                            onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                          />
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removeOption(qIndex, optIndex)}
                            disabled={(q.options || []).length <= 2}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>
                      ))}
                      <Button
                        size="small"
                        startIcon={<Add />}
                        onClick={() => addOption(qIndex)}
                        sx={{ mt: 0.5 }}
                      >
                        Add option
                      </Button>
                    </Card>
                  ))}
                  <Button
                    variant="outlined"
                    startIcon={<Add />}
                    onClick={addManualQuestion}
                    fullWidth
                    sx={{ mt: 1 }}
                  >
                    Add question
                  </Button>
                </>
              )}

              {createQuizTab === 1 && !editingQuiz && (
                <Box sx={{ py: 2 }}>
                  <TextField
                    label="Number of questions to generate"
                    type="number"
                    size="small"
                    sx={{ mb: 2, width: 220 }}
                    value={numQuestionsToGenerate}
                    onChange={(e) => setNumQuestionsToGenerate(Math.max(1, Math.min(15, parseInt(e.target.value, 10) || 5)))}
                    inputProps={{ min: 1, max: 15 }}
                  />
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Select lectures (multiple)</InputLabel>
                    <Select
                      multiple
                      value={generateSelectedLectureIds}
                      label="Select lectures (multiple)"
                      onChange={(e) => setGenerateSelectedLectureIds(e.target.value)}
                      renderValue={(selected) => selected.map((sid) => {
                        const sub = getAvailableLectures().find((s) => s.id === sid);
                        return sub ? `${sub.sectionTitle} — ${sub.title}` : sid;
                      }).join(', ')}
                    >
                      {getAvailableLectures().map((sub) => (
                        <MenuItem key={sub.id} value={sub.id}>
                          <Checkbox checked={generateSelectedLectureIds.indexOf(sub.id) > -1} />
                          <ListItemIcon>
                            <InsertDriveFile fontSize="small" />
                          </ListItemIcon>
                          <ListItemText primary={`${sub.sectionTitle} — ${sub.title}`} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {getAvailableLectures().length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      No lectures with PDF content yet. Add sections and upload PDFs in the Modules tab first.
                    </Typography>
                  )}
                  <Button
                    variant="contained"
                    startIcon={<AutoAwesome />}
                    onClick={handleGenerateQuestions}
                    disabled={!generateSelectedLectureIds?.length || getAvailableLectures().length === 0}
                  >
                    {generateLoading ? 'Generating…' : 'Generate questions'}
                  </Button>
                  <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                    Questions will appear in the manual tab for review and editing before creating the quiz.
                  </Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => { handleCreateQuizDialogClose(); setEditQuizOpen(false); setEditingQuiz(null); }}>Cancel</Button>
              {(createQuizTab === 0 || editingQuiz) && (
                <Button
                  variant="contained"
                  onClick={editingQuiz ? handleSaveEditQuiz : handleCreateQuiz}
                  disabled={createQuizSubmitting}
                >
                  {createQuizSubmitting ? (editingQuiz ? 'Saving…' : 'Creating…') : (editingQuiz ? 'Save' : 'Create quiz')}
                </Button>
              )}
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

