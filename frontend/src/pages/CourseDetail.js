import React, { useCallback, useEffect, useState } from 'react';
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
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
} from '@mui/material';
import {
  Description,
  Add, Delete, UploadFile, Folder, InsertDriveFile, GetApp, AutoAwesome, Edit, Lightbulb, FileDownload, FileUpload,
  PictureAsPdf,
  EmojiEvents,
  People,
} from '@mui/icons-material';
import api from '../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import EngagementLoadingOverlay from '../components/EngagementLoadingOverlay';
import CourseGamificationProgressTab from '../components/CourseGamificationProgressTab';
import { LLM_WAIT_MESSAGES, PRACTICE_WAIT_MESSAGES, CHAT_WAIT_MESSAGES } from '../constants/loadingEngagement';
import {
  workspacePageBackgroundSx,
  workspaceContentContainerSx,
  sectionHeaderBandSx,
  pageHeadingTitleSx,
} from '../theme/eduAgentSurfaces';

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
    instruction_cleared: false,
  });
  const [assignmentEditingId, setAssignmentEditingId] = useState(null);
  const [assignmentExistingInstructionUrl, setAssignmentExistingInstructionUrl] = useState(null);
  const [assignmentSubmissionsOpen, setAssignmentSubmissionsOpen] = useState(false);
  const [assignmentSubmissionsLoading, setAssignmentSubmissionsLoading] = useState(false);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState([]);
  const [assignmentSubmissionsAssignment, setAssignmentSubmissionsAssignment] = useState(null);
  const [assignmentAiGradingId, setAssignmentAiGradingId] = useState(null);
  const [assignmentGradeDialogOpen, setAssignmentGradeDialogOpen] = useState(false);
  const [assignmentGradeSubmission, setAssignmentGradeSubmission] = useState(null);
  const [assignmentGradeScore, setAssignmentGradeScore] = useState('');
  const [assignmentGradeFeedback, setAssignmentGradeFeedback] = useState('');
  const [myAssignmentSubmissions, setMyAssignmentSubmissions] = useState({});
  const [studentSubmitDialogAssignment, setStudentSubmitDialogAssignment] = useState(null);
  const [studentSubmitText, setStudentSubmitText] = useState('');
  const [studentSubmitFile, setStudentSubmitFile] = useState(null);
  const [studentSubmitSaving, setStudentSubmitSaving] = useState(false);

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
  const [practiceSessionId, setPracticeSessionId] = useState(null);
  const [practiceSessionStartMs, setPracticeSessionStartMs] = useState(null);
  const [practiceStepDisplay, setPracticeStepDisplay] = useState(1);
  const [practiceStepTotal, setPracticeStepTotal] = useState(5);
  const [practiceShownAtMs, setPracticeShownAtMs] = useState(null);
  const [practiceAnswerLog, setPracticeAnswerLog] = useState([]);
  const [practiceNextLoading, setPracticeNextLoading] = useState(false);

  const [gamificationSummary, setGamificationSummary] = useState(null);
  const [engagementFeed, setEngagementFeed] = useState([]);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [classroomDialogOpen, setClassroomDialogOpen] = useState(false);
  const [classroomTab, setClassroomTab] = useState(0);
  const [instructorStudents, setInstructorStudents] = useState([]);
  const [instructorStudentsLoading, setInstructorStudentsLoading] = useState(false);

  const refreshGamification = useCallback(async () => {
    if (user?.role !== 'student' || !enrolled || !id) return;
    try {
      const res = await api.get(`/gamification/course/${id}/summary/`);
      setGamificationSummary(res.data);
    } catch (_) {
      /* ignore */
    }
  }, [user?.role, enrolled, id]);

  const pushEngagement = useCallback((entry) => {
    setEngagementFeed((prev) => {
      const row = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}` };
      return [row, ...prev].slice(0, 14);
    });
  }, []);

  useEffect(() => {
    fetchCourse();
    checkEnrollment();
    fetchQuizzes();
    fetchAssignments();
    fetchChatSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when route id changes; handlers intentionally stable via closure
  }, [id]);

  useEffect(() => {
    if (tabValue === 6 && !(user?.role === 'student' && enrolled)) {
      setTabValue(0);
    }
  }, [tabValue, user?.role, enrolled]);

  useEffect(() => {
    if (user?.role !== 'student' || !enrolled || !id) return;
    let cancelled = false;
    (async () => {
      await refreshGamification();
      if (cancelled) return;
      const k = `gam_daily_${id}_${new Date().toDateString()}`;
      if (sessionStorage.getItem(k)) {
        await refreshGamification();
        return;
      }
      try {
        const ev = await api.post('/gamification/events/', {
          course_id: id,
          event_type: 'daily_login',
          metadata: {},
        });
        sessionStorage.setItem(k, '1');
        if (!cancelled && ev.data?.remark) {
          pushEngagement({
            headline: ev.data.points_awarded > 0 ? 'Daily check-in' : 'Welcome back',
            body: ev.data.remark,
            sub: ev.data.points_awarded > 0 ? `+${ev.data.points_awarded} XP · ${ev.data.bandit_arm || ''}` : '',
            badges: ev.data.badges || [],
          });
        }
        await refreshGamification();
      } catch (_) {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.role, enrolled, id, refreshGamification, pushEngagement]);

  const openLeaderboard = async () => {
    setLeaderboardOpen(true);
    setLeaderboardLoading(true);
    try {
      const res = await api.get(`/gamification/course/${id}/leaderboard/`, { params: { limit: 20 } });
      setLeaderboardRows(res.data?.entries || []);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not load leaderboard');
      setLeaderboardRows([]);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const openClassroomOverview = async () => {
    setClassroomDialogOpen(true);
    setClassroomTab(0);
    setLeaderboardLoading(true);
    setInstructorStudentsLoading(true);
    try {
      const [lb, st] = await Promise.all([
        api.get(`/gamification/course/${id}/leaderboard/`, { params: { limit: 40 } }),
        api.get(`/gamification/instructor/course/${id}/students/`),
      ]);
      setLeaderboardRows(lb.data?.entries || []);
      setInstructorStudents(st.data?.students || []);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Could not load classroom overview');
      setLeaderboardRows([]);
      setInstructorStudents([]);
    } finally {
      setLeaderboardLoading(false);
      setInstructorStudentsLoading(false);
    }
  };

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

  useEffect(() => {
    if (user?.role !== 'student' || !id) {
      setMyAssignmentSubmissions({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ms = await api.get('/assignments/my-submissions/', { params: { course_id: id } });
        if (cancelled) return;
        const list = Array.isArray(ms.data) ? ms.data : ms.data.results || [];
        const byAid = {};
        list.forEach((s) => {
          const aid = s.assignment?.id;
          if (aid) byAid[aid] = s;
        });
        setMyAssignmentSubmissions(byAid);
      } catch {
        if (!cancelled) setMyAssignmentSubmissions({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user?.role]);

  const openStudentSubmitDialog = async (assignment) => {
    setStudentSubmitDialogAssignment(assignment);
    setStudentSubmitFile(null);
    if (user?.role !== 'student' || !id) {
      setStudentSubmitText('');
      return;
    }
    try {
      const ms = await api.get('/assignments/my-submissions/', { params: { course_id: id } });
      const list = Array.isArray(ms.data) ? ms.data : ms.data.results || [];
      const byAid = {};
      list.forEach((s) => {
        const aid = s.assignment?.id;
        if (aid) byAid[aid] = s;
      });
      setMyAssignmentSubmissions(byAid);
      setStudentSubmitText(byAid[assignment.id]?.submission_text || '');
    } catch {
      const sub = myAssignmentSubmissions[assignment.id];
      setStudentSubmitText(sub?.submission_text || '');
    }
  };

  const handleStudentSubmitSave = async () => {
    const a = studentSubmitDialogAssignment;
    if (!a) return;
    const sub = myAssignmentSubmissions[a.id];
    const text = (studentSubmitText || '').trim();
    const hasFile = !!studentSubmitFile;
    const hadPrior = sub && sub.grading_status && sub.grading_status !== 'not_submitted';
    if (!hadPrior && !hasFile && !text) {
      toast.error('Add a file and/or a written response.');
      return;
    }
    if (sub?.is_graded) {
      toast.error('This assignment is already graded.');
      return;
    }
    setStudentSubmitSaving(true);
    try {
      const formData = new FormData();
      if (hasFile) formData.append('submission_file', studentSubmitFile);
      formData.append('submission_text', studentSubmitText || '');
      const res = await api.post(`/assignments/${a.id}/submit/`, formData);
      setMyAssignmentSubmissions((prev) => ({ ...prev, [a.id]: res.data }));
      toast.success(sub && hadPrior ? 'Submission updated' : 'Assignment submitted');
      if (!hadPrior) {
        try {
          const ev = await api.post('/gamification/events/', {
            course_id: id,
            event_type: 'assignment_submitted',
            metadata: { assignment_id: a.id },
          });
          if (ev.data?.remark && ev.data?.points_awarded > 0) {
            pushEngagement({
              headline: 'Assignment turned in',
              body: ev.data.remark,
              sub: `+${ev.data.points_awarded || 0} XP`,
              badges: ev.data.badges || [],
            });
          }
          await refreshGamification();
        } catch (_) {
          /* ignore */
        }
      }
      setStudentSubmitDialogAssignment(null);
      setStudentSubmitFile(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed');
    } finally {
      setStudentSubmitSaving(false);
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

  const assignmentHasAiGradingExport = (s) => {
    const ai = s?.ai_grading;
    if (!ai || typeof ai !== 'object') return false;
    return (
      (Array.isArray(ai.rubric) && ai.rubric.length > 0) ||
      (ai.suggested_score != null && ai.suggested_score !== '') ||
      String(ai.overall_explanation || '').trim().length > 0 ||
      (Array.isArray(ai.strengths) && ai.strengths.length > 0) ||
      (Array.isArray(ai.improvements) && ai.improvements.length > 0) ||
      String(ai.grading_confidence || '').trim().length > 0
    );
  };

  /** mode: 'ai_review' | 'manual_new' | 'edit_finalized' */
  const openAssignmentGradeDialog = (submission, mode) => {
    const ai = submission.ai_grading || {};
    setAssignmentGradeSubmission(submission);
    const resolvedMode =
      mode || (submission.is_graded ? 'edit_finalized' : 'ai_review');
    if (resolvedMode === 'edit_finalized') {
      setAssignmentGradeScore(submission.score != null ? String(submission.score) : '');
      setAssignmentGradeFeedback(String(submission.feedback || ''));
    } else if (resolvedMode === 'manual_new') {
      setAssignmentGradeScore('');
      setAssignmentGradeFeedback('');
    } else {
      setAssignmentGradeScore(
        ai.suggested_score != null && ai.suggested_score !== '' ? String(ai.suggested_score) : ''
      );
      setAssignmentGradeFeedback(ai.overall_explanation != null ? String(ai.overall_explanation) : '');
    }
    setAssignmentGradeDialogOpen(true);
  };

  const handleAssignmentAiGrade = async (submission) => {
    if (submission.is_graded) {
      toast.error('This submission is already graded.');
      return;
    }
    if (!submission.submission_file && !submission.submission_text) {
      toast.error('No submission file or text to grade.');
      return;
    }
    setAssignmentAiGradingId(submission.id);
    try {
      const res = await api.post(`/assignments/submissions/${submission.id}/ai-grade/`);
      const updated = res.data;
      setAssignmentSubmissions((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      openAssignmentGradeDialog(updated, 'ai_review');
      toast.success('AI grading finished — review rubric and approve or edit the score.');
    } catch (e) {
      toast.error(e.response?.data?.error || 'AI grading failed');
    } finally {
      setAssignmentAiGradingId(null);
    }
  };

  const handleApproveAiGrade = async () => {
    if (!assignmentGradeSubmission) return;
    const scoreNum = Number.parseFloat(String(assignmentGradeScore).trim());
    if (Number.isNaN(scoreNum)) {
      toast.error('Enter a valid numeric score.');
      return;
    }
    try {
      const res = await api.post(`/assignments/submissions/${assignmentGradeSubmission.id}/approve-ai-grade/`, {
        score: scoreNum,
        feedback: assignmentGradeFeedback || undefined,
      });
      const updated = res.data;
      setAssignmentSubmissions((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setAssignmentGradeDialogOpen(false);
      setAssignmentGradeSubmission(null);
      toast.success('Grade saved and marked complete.');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Could not approve grade');
    }
  };

  const handleManualGradeSave = async () => {
    if (!assignmentGradeSubmission) return;
    const scoreNum = Number.parseFloat(String(assignmentGradeScore).trim());
    if (Number.isNaN(scoreNum)) {
      toast.error('Enter a valid numeric score.');
      return;
    }
    try {
      const wasGraded = !!assignmentGradeSubmission.is_graded;
      const res = await api.post(`/assignments/submissions/${assignmentGradeSubmission.id}/grade/`, {
        score: scoreNum,
        feedback: assignmentGradeFeedback || '',
      });
      const updated = res.data;
      setAssignmentSubmissions((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setAssignmentGradeDialogOpen(false);
      setAssignmentGradeSubmission(null);
      toast.success(wasGraded ? 'Grade updated.' : 'Manual grade saved.');
    } catch (e) {
      const errData = e.response?.data;
      let msg = 'Could not save grade';
      if (errData instanceof Blob) {
        try {
          const t = await errData.text();
          const j = JSON.parse(t);
          msg = j.error || msg;
        } catch {
          /* ignore */
        }
      } else if (errData?.error) {
        msg = errData.error;
      }
      toast.error(msg);
    }
  };

  const handleDownloadAiGradingPdf = async () => {
    if (!assignmentGradeSubmission?.id) return;
    try {
      const res = await api.get(
        `/assignments/submissions/${assignmentGradeSubmission.id}/ai-grading-pdf/`,
        { responseType: 'blob' }
      );
      const ct = (res.headers && res.headers['content-type']) || '';
      if (ct.includes('application/json')) {
        const text = await res.data.text();
        let msg = 'Could not generate PDF';
        try {
          const j = JSON.parse(text);
          msg = j.error || msg;
        } catch {
          /* ignore */
        }
        toast.error(msg);
        return;
      }
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ai_grading_${assignmentGradeSubmission.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded.');
    } catch (e) {
      let msg = 'Could not download PDF';
      if (e.response?.data instanceof Blob) {
        try {
          const t = await e.response.data.text();
          const j = JSON.parse(t);
          msg = j.error || msg;
        } catch {
          /* ignore */
        }
      } else if (e.response?.data?.error) {
        msg = e.response.data.error;
      }
      toast.error(msg);
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
    setPracticeSessionId(null);
    setPracticeSessionStartMs(null);
    setPracticeAnswerLog([]);
    setPracticeStepDisplay(1);
    setPracticeStepTotal(practiceNumQuestions);
    setPracticeShownAtMs(null);
    setPracticeNextLoading(false);
    try {
      const res = await api.post(
        '/quizzes/adaptive-practice/start/',
        {
          course_id: id,
          subsection_ids: practiceSelectedLectureIds,
          num_questions: practiceNumQuestions,
          sequential_generation: true,
        },
        { timeout: 360000 }
      );
      const q = res.data.question;
      if (!q) {
        toast.error('No questions generated');
        return;
      }
      setPracticeSessionId(res.data.session_id);
      setPracticeSessionStartMs(Date.now());
      setPracticeShownAtMs(Date.now());
      setPracticeQuestions([q]);
      setPracticeStepTotal(res.data.total_questions || practiceNumQuestions);
      setPracticeStepDisplay(1);
      pushEngagement({
        headline: 'Adaptive practice (one-by-one)',
        body: `Session: ${res.data.total_questions} questions. After each answer, Next generates the following MCQ from your updated performance (θ, topics, prior rounds).`,
        sub: 'Hybrid policy still updates from each response while the LLM targets weak areas.',
        flavor: 'practice',
      });
    } catch (e) {
      console.error('[Practice] Error starting adaptive practice:', e);
      console.error('[Practice] Response:', e?.response?.data);
      toast.error(e?.response?.data?.error || e?.message || 'Failed to start adaptive practice');
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
      try {
        const scoreNum = res.data.score != null ? parseFloat(res.data.score) : 0;
        const ev = await api.post('/gamification/events/', {
          course_id: id,
          event_type: 'quiz_submitted',
          metadata: { score: scoreNum },
        });
        if (ev.data?.remark && (ev.data?.points_awarded > 0 || ev.data?.badges?.length)) {
          pushEngagement({
            headline: 'Quiz rewards',
            body: ev.data.remark,
            sub: `+${ev.data.points_awarded || 0} XP${ev.data.level_up ? ' · Level up!' : ''}`,
            badges: ev.data.badges || [],
          });
        }
        await refreshGamification();
      } catch (_) {
        /* optional */
      }
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

  const formatAssignmentDueForInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const openEditAssignment = (a) => {
    setAssignmentEditingId(a.id);
    setAssignmentExistingInstructionUrl(a.instruction_file_url || null);
    setAssignmentForm({
      title: a.title || '',
      description: a.description || '',
      due_date: formatAssignmentDueForInput(a.due_date),
      max_score: a.max_score ?? 100,
      instruction_file: null,
      instruction_cleared: false,
    });
    setAssignmentDialogOpen(true);
  };

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
      if (!wasCompleted && user?.role === 'student') {
        try {
          const ev = await api.post('/gamification/events/', {
            course_id: id,
            event_type: 'lesson_completed',
            metadata: { subsection_id: subsectionId },
          });
          if (ev.data?.remark && ev.data?.points_awarded > 0) {
            pushEngagement({
              headline: 'Lesson milestone',
              body: ev.data.remark,
              sub: `+${ev.data.points_awarded || 0} XP`,
              badges: ev.data.badges || [],
            });
          }
          await refreshGamification();
        } catch (_) {
          /* ignore */
        }
      }
      checkEnrollment();
      fetchCourse();
    } catch (error) {
      toast.error(error.response?.data?.detail || error.response?.data?.error || 'Failed to update');
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

  if (!course) {
    return (
      <Box sx={workspacePageBackgroundSx}>
        <Container maxWidth="lg" sx={workspaceContentContainerSx}>
          <Typography variant="h6">Course not found</Typography>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={workspacePageBackgroundSx}>
      <Container maxWidth="lg" sx={workspaceContentContainerSx}>
      <Box sx={{ ...sectionHeaderBandSx, mb: 3 }}>
        <Typography variant="h5" component="h1" sx={{ ...pageHeadingTitleSx, mb: 1 }}>
          {course.title}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1.5 }}>
          {course.description}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', mt: 1 }}>
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
        {isInstructorOrAdmin && (
          <Button variant="outlined" startIcon={<People />} sx={{ ml: enrolled ? 1 : 0 }} onClick={openClassroomOverview}>
            Student progress & leaderboard
          </Button>
        )}
      </Box>

      {user?.role === 'student' && enrolled && (
        <Card variant="outlined" sx={{ mb: 2, borderColor: 'primary.light' }}>
          <CardContent sx={{ py: 1.5 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <EmojiEvents color="primary" />
                <Typography variant="subtitle2" color="text.secondary">
                  Engagement
                </Typography>
                {gamificationSummary?.state ? (
                  <>
                    <Chip size="small" color="primary" label={`Level ${gamificationSummary.state.level}`} />
                    <Chip size="small" variant="outlined" label={`${gamificationSummary.state.total_xp} XP`} />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`Streak ${gamificationSummary.state.current_streak_days}d`}
                    />
                    {gamificationSummary.badges?.length > 0 && (
                      <Chip size="small" label={`${gamificationSummary.badges.length} badges`} />
                    )}
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Complete activities to earn XP, badges, and personalized tips.
                  </Typography>
                )}
              </Box>
              <Button size="small" variant="outlined" startIcon={<EmojiEvents />} onClick={openLeaderboard}>
                Leaderboard
              </Button>
            </Box>
            {gamificationSummary?.recent_remarks?.[0]?.llm_remark && (
              <Alert severity="info" sx={{ mt: 1.5 }} icon={false}>
                <Typography variant="body2">{gamificationSummary.recent_remarks[0].llm_remark}</Typography>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {user?.role === 'student' && enrolled && engagementFeed.length > 0 && (
        <Card
          sx={{
            mb: 2,
            overflow: 'hidden',
            background: 'linear-gradient(145deg, #faf5ff 0%, #ffffff 40%, #f5f3ff 100%)',
            border: '1px solid rgba(139, 92, 246, 0.22)',
            boxShadow: '0 4px 24px rgba(124, 58, 237, 0.08)',
          }}
        >
          <CardContent sx={{ py: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#5b21b6', mb: 1.5, letterSpacing: 0.3 }}>
              Live learning analytics
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
              Rewards, coach notes, and milestones land here (not as pop-up toasts) so you can skim the story of your session.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {engagementFeed.map((row) => (
                <Box
                  key={row.id}
                  sx={{
                    p: 1.75,
                    borderRadius: 2,
                    position: 'relative',
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.95), rgba(237,233,254,0.65))',
                    border: '1px solid rgba(167, 139, 250, 0.45)',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: 8,
                      bottom: 8,
                      width: 4,
                      borderRadius: 4,
                      background: 'linear-gradient(180deg, #a78bfa, #7c3aed)',
                    },
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: 1 }}>
                    {row.headline}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.75, lineHeight: 1.55 }}>
                    {row.body}
                  </Typography>
                  {row.sub ? (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                      {row.sub}
                    </Typography>
                  ) : null}
                  {row.badges?.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                      {row.badges.map((b) => (
                        <Chip key={b.slug || b.title} size="small" color="secondary" variant="outlined" label={b.title || b.slug} />
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      <Box sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="Modules" />
          <Tab label="Assignments" />
          <Tab label="Quizzes" />
          <Tab label="Discussions" />
          <Tab label="Chat" />
          <Tab label="Practice" />
          {user?.role === 'student' && enrolled && <Tab label="Progress" />}
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
                      setAssignmentEditingId(null);
                      setAssignmentExistingInstructionUrl(null);
                      setAssignmentForm({
                        title: '',
                        description: '',
                        due_date: '',
                        max_score: 100,
                        instruction_file: null,
                        instruction_cleared: false,
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
                        {user?.role === 'student' && (() => {
                          const sub = myAssignmentSubmissions[a.id];
                          const st = sub?.grading_status || 'not_submitted';
                          const statusLabel =
                            st === 'graded'
                              ? 'Graded'
                              : st === 'submitted_pending'
                                ? 'Awaiting instructor grade'
                                : 'Not submitted';
                          return (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                              <Chip
                                size="small"
                                label={statusLabel}
                                color={st === 'graded' ? 'success' : st === 'submitted_pending' ? 'warning' : 'default'}
                                variant={st === 'not_submitted' ? 'outlined' : 'filled'}
                              />
                              <Button
                                size="small"
                                variant={st === 'graded' ? 'outlined' : 'contained'}
                                onClick={() => openStudentSubmitDialog(a)}
                              >
                                {st === 'graded' ? 'View grade' : 'Submit / manage'}
                              </Button>
                            </Box>
                          );
                        })()}
                        {isInstructorOrAdmin && (
                          <>
                            <Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => openEditAssignment(a)}>
                              Edit
                            </Button>
                            <Button size="small" variant="outlined" onClick={() => handleViewAssignmentSubmissions(a)}>
                              View submissions
                            </Button>
                          </>
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
            onClose={() => {
              setAssignmentDialogOpen(false);
              setAssignmentEditingId(null);
              setAssignmentExistingInstructionUrl(null);
            }}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>{assignmentEditingId ? 'Edit assignment' : 'Create assignment'}</DialogTitle>
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
              {assignmentEditingId &&
                assignmentExistingInstructionUrl &&
                !assignmentForm.instruction_cleared &&
                !assignmentForm.instruction_file && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      An instruction file is attached to this assignment.
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<GetApp />}
                      component="a"
                      href={assignmentExistingInstructionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ mr: 1 }}
                    >
                      View current file
                    </Button>
                    <Button
                      size="small"
                      color="warning"
                      variant="outlined"
                      onClick={() =>
                        setAssignmentForm((p) => ({ ...p, instruction_cleared: true, instruction_file: null }))
                      }
                    >
                      Delete instruction file
                    </Button>
                  </Alert>
                )}
              {assignmentEditingId && assignmentForm.instruction_cleared && !assignmentForm.instruction_file && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  The instruction file will be removed when you save (unless you upload a replacement).
                </Alert>
              )}
              <Box sx={{ mt: 2 }}>
                <Button component="label" variant="outlined" startIcon={<UploadFile />} fullWidth>
                  {assignmentForm.instruction_file
                    ? `Replace with: ${assignmentForm.instruction_file.name}`
                    : assignmentEditingId
                      ? 'Upload / replace instructions (optional)'
                      : 'Upload instructions file (optional)'}
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setAssignmentForm((p) => ({ ...p, instruction_file: f, instruction_cleared: false }));
                    }}
                  />
                </Button>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setAssignmentDialogOpen(false);
                  setAssignmentEditingId(null);
                  setAssignmentExistingInstructionUrl(null);
                }}
              >
                Cancel
              </Button>
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
                  if (assignmentForm.instruction_file) {
                    formData.append('instruction_file', assignmentForm.instruction_file);
                  }
                  if (assignmentEditingId) {
                    if (assignmentForm.instruction_cleared) {
                      formData.append('clear_instruction_file', 'true');
                    }
                    try {
                      await api.patch(`/assignments/${assignmentEditingId}/`, formData);
                      toast.success('Assignment updated');
                      setAssignmentDialogOpen(false);
                      setAssignmentEditingId(null);
                      setAssignmentExistingInstructionUrl(null);
                      fetchAssignments();
                    } catch (err) {
                      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Failed to update assignment');
                    }
                  } else {
                    formData.append('course_id', String(id));
                    try {
                      await api.post('/assignments/', formData);
                      toast.success('Assignment created');
                      setAssignmentDialogOpen(false);
                      setAssignmentEditingId(null);
                      setAssignmentExistingInstructionUrl(null);
                      fetchAssignments();
                    } catch (err) {
                      toast.error(err.response?.data?.error || 'Failed to create assignment');
                    }
                  }
                }}
              >
                {assignmentEditingId ? 'Save changes' : 'Create'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Student: submit, edit before grading, view marks after graded */}
          <Dialog
            open={!!studentSubmitDialogAssignment}
            onClose={() => {
              if (!studentSubmitSaving) {
                setStudentSubmitDialogAssignment(null);
                setStudentSubmitFile(null);
              }
            }}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              {studentSubmitDialogAssignment
                ? `Your submission — ${studentSubmitDialogAssignment.title}`
                : 'Your submission'}
            </DialogTitle>
            <DialogContent dividers>
              {studentSubmitDialogAssignment && (() => {
                const a = studentSubmitDialogAssignment;
                const sub = myAssignmentSubmissions[a.id];
                const st = sub?.grading_status || 'not_submitted';
                const graded = st === 'graded' || sub?.is_graded;
                if (graded) {
                  return (
                    <Box>
                      <Chip size="small" label="Graded" color="success" sx={{ mb: 2 }} />
                      <Typography variant="body1" sx={{ mb: 1 }}>
                        Score:{' '}
                        <strong>
                          {sub?.score != null ? sub.score : '—'} / {a.max_score ?? '—'}
                        </strong>
                      </Typography>
                      {sub?.graded_at && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                          Graded: {new Date(sub.graded_at).toLocaleString()}
                        </Typography>
                      )}
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Instructor feedback
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {sub?.feedback?.trim() ? sub.feedback : 'No written feedback.'}
                      </Typography>
                      {sub?.submission_file_name && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                          File submitted: {sub.submission_file_name}
                        </Typography>
                      )}
                    </Box>
                  );
                }
                return (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      You can update your file and written response until your instructor posts a final grade.
                    </Typography>
                    {sub?.submission_file_name && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                        Current file: {sub.submission_file_name}
                      </Typography>
                    )}
                    <Button variant="outlined" component="label" size="small" sx={{ mb: 2 }}>
                      {sub?.submission_file_name ? 'Replace file' : 'Attach file'}
                      <input
                        type="file"
                        hidden
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          setStudentSubmitFile(f || null);
                          e.target.value = '';
                        }}
                      />
                    </Button>
                    {studentSubmitFile && (
                      <Typography variant="caption" display="block" sx={{ mb: 2 }}>
                        New file: {studentSubmitFile.name}
                      </Typography>
                    )}
                    <TextField
                      fullWidth
                      multiline
                      minRows={4}
                      label="Written response (optional)"
                      value={studentSubmitText}
                      onChange={(e) => setStudentSubmitText(e.target.value)}
                      margin="normal"
                    />
                  </Box>
                );
              })()}
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  if (!studentSubmitSaving) {
                    setStudentSubmitDialogAssignment(null);
                    setStudentSubmitFile(null);
                  }
                }}
              >
                {(() => {
                  const sub = studentSubmitDialogAssignment
                    ? myAssignmentSubmissions[studentSubmitDialogAssignment.id]
                    : null;
                  const graded =
                    sub?.grading_status === 'graded' || sub?.is_graded;
                  return graded ? 'Close' : 'Cancel';
                })()}
              </Button>
              {(() => {
                const sub = studentSubmitDialogAssignment
                  ? myAssignmentSubmissions[studentSubmitDialogAssignment.id]
                  : null;
                const graded =
                  sub?.grading_status === 'graded' || sub?.is_graded;
                if (graded) return null;
                return (
                  <Button
                    variant="contained"
                    disabled={studentSubmitSaving}
                    onClick={handleStudentSubmitSave}
                  >
                    {studentSubmitSaving ? 'Saving…' : 'Save submission'}
                  </Button>
                );
              })()}
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
                    <ListItem key={s.id} divider alignItems="flex-start">
                      <ListItemText
                        primary={`${s.student?.first_name || ''} ${s.student?.last_name || ''}`.trim() || s.student?.username || 'Student'}
                        secondary={
                          <Box component="span" sx={{ mt: 0.5 }}>
                            <Typography variant="body2" color="text.secondary" component="span" display="block">
                              Submitted: {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'}
                            </Typography>
                            {s.is_graded && (
                              <Typography variant="body2" color="primary" component="span" display="block" sx={{ mt: 0.5 }}>
                                Final score: {s.score} / {assignmentSubmissionsAssignment?.max_score ?? '—'}
                              </Typography>
                            )}
                            {!s.is_graded && s.ai_grading?.suggested_score != null && s.ai_grading?.suggested_score !== '' && (
                              <Typography variant="caption" color="secondary" component="span" display="block">
                                AI suggested score: {s.ai_grading.suggested_score} (not finalized)
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'flex-end' }}>
                        {s.submission_file && (
                          <Button size="small" variant="outlined" component="a" href={s.submission_file} target="_blank" rel="noopener noreferrer">
                            Download
                          </Button>
                        )}
                        {!s.is_graded && (
                          <Button
                            size="small"
                            variant="contained"
                            color="secondary"
                            startIcon={<AutoAwesome />}
                            disabled={
                              assignmentAiGradingId === s.id ||
                              (!s.submission_file && !s.submission_text)
                            }
                            onClick={() => handleAssignmentAiGrade(s)}
                          >
                            {assignmentAiGradingId === s.id ? 'Grading…' : 'Grade using AI'}
                          </Button>
                        )}
                        {!s.is_graded && s.ai_grading && (s.ai_grading.rubric?.length > 0 || s.ai_grading.suggested_score != null) && (
                          <Button size="small" variant="outlined" onClick={() => openAssignmentGradeDialog(s, 'ai_review')}>
                            Review AI result
                          </Button>
                        )}
                        {!s.is_graded && (
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => openAssignmentGradeDialog(s, 'manual_new')}
                          >
                            Enter grade manually
                          </Button>
                        )}
                        {s.is_graded && (
                          <Button size="small" variant="outlined" onClick={() => openAssignmentGradeDialog(s, 'edit_finalized')}>
                            Edit grade
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

          <Dialog
            open={assignmentGradeDialogOpen}
            onClose={() => {
              setAssignmentGradeDialogOpen(false);
              setAssignmentGradeSubmission(null);
            }}
            maxWidth="lg"
            fullWidth
          >
            <DialogTitle>
              {assignmentGradeSubmission?.is_graded ? 'Edit student grade' : 'AI grading review'}
            </DialogTitle>
            <DialogContent dividers>
              {assignmentGradeSubmission && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    {`${assignmentGradeSubmission.student?.first_name || ''} ${assignmentGradeSubmission.student?.last_name || ''}`.trim() ||
                      assignmentGradeSubmission.student?.username}
                  </Typography>
                  {assignmentGradeSubmission.ai_grading?.grading_confidence && (
                    <Chip
                      size="small"
                      label={`Model confidence: ${assignmentGradeSubmission.ai_grading.grading_confidence}`}
                      sx={{ mb: 2 }}
                    />
                  )}
                  {(assignmentGradeSubmission.ai_grading?.rubric || []).length > 0 && (
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Criterion</TableCell>
                            <TableCell align="right">Max</TableCell>
                            <TableCell align="right">Awarded</TableCell>
                            <TableCell>Comment</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(assignmentGradeSubmission.ai_grading.rubric || []).map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{row.criterion}</TableCell>
                              <TableCell align="right">{row.max_points}</TableCell>
                              <TableCell align="right">{row.awarded_points}</TableCell>
                              <TableCell>{row.comment}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                  {(assignmentGradeSubmission.ai_grading?.strengths || []).length > 0 && (
                    <Typography variant="subtitle2" sx={{ mt: 1 }}>
                      Strengths
                    </Typography>
                  )}
                  <List dense>
                    {(assignmentGradeSubmission.ai_grading?.strengths || []).map((t, i) => (
                      <ListItem key={`st-${i}`} sx={{ py: 0 }}>
                        <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={`• ${t}`} />
                      </ListItem>
                    ))}
                  </List>
                  {(assignmentGradeSubmission.ai_grading?.improvements || []).length > 0 && (
                    <Typography variant="subtitle2" sx={{ mt: 1 }}>
                      Improvements
                    </Typography>
                  )}
                  <List dense>
                    {(assignmentGradeSubmission.ai_grading?.improvements || []).map((t, i) => (
                      <ListItem key={`im-${i}`} sx={{ py: 0 }}>
                        <ListItemText primaryTypographyProps={{ variant: 'body2' }} primary={`• ${t}`} />
                      </ListItem>
                    ))}
                  </List>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    {assignmentGradeSubmission.is_graded
                      ? 'Final score and feedback (visible to student)'
                      : 'Finalize grade (edit if needed)'}
                  </Typography>
                  <TextField
                    fullWidth
                    label={`Score (max ${assignmentSubmissionsAssignment?.max_score ?? 100})`}
                    value={assignmentGradeScore}
                    onChange={(e) => setAssignmentGradeScore(e.target.value)}
                    margin="normal"
                    type="number"
                    inputProps={{ step: 'any', min: 0, max: assignmentSubmissionsAssignment?.max_score ?? 100 }}
                  />
                  <TextField
                    fullWidth
                    label="Feedback for student (defaults to AI explanation if unchanged)"
                    value={assignmentGradeFeedback}
                    onChange={(e) => setAssignmentGradeFeedback(e.target.value)}
                    margin="normal"
                    multiline
                    minRows={4}
                  />
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Button
                onClick={() => {
                  setAssignmentGradeDialogOpen(false);
                  setAssignmentGradeSubmission(null);
                }}
              >
                Close
              </Button>
              {assignmentGradeSubmission && assignmentHasAiGradingExport(assignmentGradeSubmission) && (
                <Button
                  variant="outlined"
                  startIcon={<PictureAsPdf />}
                  onClick={handleDownloadAiGradingPdf}
                >
                  Download AI explanation (PDF)
                </Button>
              )}
              {assignmentGradeSubmission?.is_graded ? (
                <Button variant="contained" color="primary" onClick={handleManualGradeSave}>
                  Save grade changes
                </Button>
              ) : (
                <>
                  <Button variant="outlined" color="primary" onClick={handleManualGradeSave}>
                    Save manual grade only
                  </Button>
                  {assignmentGradeSubmission?.ai_grading &&
                    (assignmentGradeSubmission.ai_grading.rubric?.length > 0 ||
                      assignmentGradeSubmission.ai_grading.suggested_score != null) && (
                      <Button variant="contained" color="primary" onClick={handleApproveAiGrade}>
                        Approve AI-assisted grade
                      </Button>
                    )}
                </>
              )}
            </DialogActions>
          </Dialog>
        </>
      )}

      {tabValue === 4 && (
        <Card sx={{ position: 'relative' }}>
          <EngagementLoadingOverlay
            active={chatSending}
            messages={CHAT_WAIT_MESSAGES}
            subtitle="Groq → Gemini → local model (fastest available wins)."
          />
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
                Upload files once per chat. We try Groq first for speed, then Gemini, then your local Ollama.
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
        <Card sx={{ position: 'relative', overflow: 'hidden' }}>
          <EngagementLoadingOverlay
            active={practiceLoading || practiceNextLoading}
            messages={PRACTICE_WAIT_MESSAGES}
            subtitle={
              practiceNextLoading
                ? 'Generating your next adaptive MCQ from your latest performance (Groq → Gemini → local)…'
                : 'Building your first question from the selected PDFs (Groq → Gemini → local)…'
            }
          />
          <CardContent>
            <Typography variant="h6" gutterBottom>Practice</Typography>
            {user?.role !== 'student' ? (
              <Typography variant="body2" color="text.secondary">Practice is available for students.</Typography>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select lecture PDFs, then work through one MCQ at a time. After you check an answer, press{' '}
                  <strong>Next</strong> to generate the following question: each new item uses your latest accuracy, time
                  on the previous item, θ / topic history, and prior adaptive sessions so the model can target weak areas.
                  A hybrid policy (Q-learning + UCB + linear TD) still learns from every step.
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
                    sx={{ width: 120 }}
                    value={practiceNumQuestions}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(30, Number(e.target.value) || 5));
                      setPracticeNumQuestions(v);
                    }}
                  />
                  <Button variant="contained" startIcon={<AutoAwesome />} disabled={practiceLoading || practiceNextLoading} onClick={handleGeneratePractice}>
                    {practiceLoading ? 'Starting…' : 'Start adaptive practice'}
                  </Button>
                </Box>

                {practiceQuestions.length > 0 && (
                  <Card variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      Question {practiceSessionId ? practiceStepDisplay : practiceIndex + 1} of{' '}
                      {practiceSessionId ? practiceStepTotal : practiceQuestions.length}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                      {practiceQuestions[practiceIndex]?.difficulty && (
                        <Chip size="small" label={`Difficulty: ${practiceQuestions[practiceIndex].difficulty}`} />
                      )}
                      {practiceQuestions[practiceIndex]?.taxonomy && (
                        <Chip size="small" variant="outlined" label={`Taxonomy: ${practiceQuestions[practiceIndex].taxonomy}`} />
                      )}
                      {practiceQuestions[practiceIndex]?.lecture_title && (
                        <Chip size="small" variant="outlined" color="secondary" label={`Lecture: ${practiceQuestions[practiceIndex].lecture_title}`} />
                      )}
                    </Box>
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
                        disabled={practiceSessionId ? true : practiceIndex === 0}
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
                          disabled={practiceNextLoading}
                          onClick={async () => {
                            if (practiceSessionId) {
                              const elapsedSec =
                                practiceShownAtMs != null ? (Date.now() - practiceShownAtMs) / 1000 : 0;
                              const isCor = !!practiceWasCorrect;
                              setPracticeNextLoading(true);
                              try {
                                const res = await api.post(
                                  `/quizzes/adaptive-practice/session/${practiceSessionId}/step/`,
                                  {
                                    is_correct: isCor,
                                    time_seconds: elapsedSec,
                                  },
                                  { timeout: 360000 }
                                );
                                const nextLog = [...practiceAnswerLog, { is_correct: isCor, time_seconds: elapsedSec }];
                                setPracticeAnswerLog(nextLog);
                                if (res.data.done) {
                                  const numCorrect = nextLog.filter((x) => x.is_correct).length;
                                  const durSec = practiceSessionStartMs
                                    ? Math.max(0, Math.floor((Date.now() - practiceSessionStartMs) / 1000))
                                    : 0;
                                  try {
                                    await api.post(`/quizzes/practice-sessions/${practiceSessionId}/complete/`, {
                                      num_correct: numCorrect,
                                      duration_seconds: durSec,
                                      answers: nextLog,
                                    });
                                  } catch (ce) {
                                    console.error('[Practice] complete', ce);
                                  }
                                  try {
                                    const ev = await api.post('/gamification/events/', {
                                      course_id: id,
                                      event_type: 'practice_completed',
                                      metadata: {
                                        num_correct: numCorrect,
                                        total_questions: practiceStepTotal || nextLog.length,
                                      },
                                    });
                                    if (ev.data?.remark) {
                                      pushEngagement({
                                        headline: 'Practice wrap-up',
                                        body: ev.data.remark,
                                        sub: `+${ev.data.points_awarded || 0} XP · ${numCorrect}/${practiceStepTotal || nextLog.length} correct`,
                                        badges: ev.data.badges || [],
                                      });
                                    }
                                    await refreshGamification();
                                  } catch (_) {
                                    /* ignore */
                                  }
                                  pushEngagement({
                                    headline: res.data.bank_exhausted ? 'Bank exhausted' : 'Session complete',
                                    body: res.data.bank_exhausted
                                      ? 'You cleared the adaptive bank — nice run.'
                                      : 'You finished this adaptive session. Momentum looks good.',
                                    sub: `${numCorrect} correct this round`,
                                    flavor: 'practice',
                                  });
                                  setPracticeQuestions([]);
                                  setPracticeSessionId(null);
                                  setPracticeSessionStartMs(null);
                                  setPracticeShownAtMs(null);
                                  setPracticeAnswerLog([]);
                                  return;
                                }
                                const nq = res.data.question;
                                if (nq) {
                                  setPracticeQuestions([nq]);
                                  setPracticeIndex(0);
                                  setPracticeStepDisplay(res.data.step ?? practiceStepDisplay + 1);
                                  setPracticeShownAtMs(Date.now());
                                }
                                setPracticeSelectedChoice(null);
                                setPracticeChecked(false);
                                setPracticeShowHint(false);
                                setPracticeWasCorrect(null);
                              } catch (e) {
                                console.error('[Practice] step', e);
                                toast.error(e?.response?.data?.error || e?.message || 'Failed to fetch next question');
                              } finally {
                                setPracticeNextLoading(false);
                              }
                              return;
                            }
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
                          {practiceSessionId
                            ? practiceChecked &&
                              practiceStepDisplay === practiceStepTotal
                              ? 'Finish'
                              : 'Next'
                            : practiceIndex < practiceQuestions.length - 1
                              ? 'Next'
                              : 'Finish'}
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

      {user?.role === 'student' && enrolled && tabValue === 6 && (
        <Box>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700, color: '#4c1d95' }}>
            Progress & rewards (this course)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Track XP from logged events, badge unlocks, and how your activity mixes over time.
          </Typography>
          <CourseGamificationProgressTab courseId={id} />
        </Box>
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
                <Box sx={{ mb: 2 }}>
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
                <Box sx={{ py: 2, position: 'relative', minHeight: generateLoading ? 200 : undefined }}>
                  <EngagementLoadingOverlay
                    active={generateLoading}
                    messages={LLM_WAIT_MESSAGES}
                    subtitle="Provider chain: Groq (fast) → Gemini → local Ollama."
                  />
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

      <Dialog open={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Course leaderboard (XP)</DialogTitle>
        <DialogContent>
          {leaderboardLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Student</TableCell>
                  <TableCell align="right">XP</TableCell>
                  <TableCell align="right">Level</TableCell>
                  <TableCell align="right">Streak</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {leaderboardRows.map((row) => (
                  <TableRow key={`${row.rank}-${row.username}`} selected={row.is_you}>
                    <TableCell>{row.rank}</TableCell>
                    <TableCell>
                      {row.display_name || row.username}
                      {row.is_you ? ' (you)' : ''}
                    </TableCell>
                    <TableCell align="right">{row.total_xp}</TableCell>
                    <TableCell align="right">{row.level}</TableCell>
                    <TableCell align="right">{row.current_streak_days}d</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaderboardOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={classroomDialogOpen} onClose={() => setClassroomDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Student progress & leaderboard</DialogTitle>
        <DialogContent>
          <Tabs value={classroomTab} onChange={(e, v) => setClassroomTab(v)} sx={{ mb: 2 }}>
            <Tab label="Leaderboard (XP)" />
            <Tab label="All students" />
          </Tabs>
          {classroomTab === 0 && (
            <>
              {leaderboardLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Student</TableCell>
                      <TableCell align="right">XP</TableCell>
                      <TableCell align="right">Level</TableCell>
                      <TableCell align="right">Streak</TableCell>
                      <TableCell align="right">Badges</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leaderboardRows.map((row) => (
                      <TableRow key={`${row.rank}-${row.username}`}>
                        <TableCell>{row.rank}</TableCell>
                        <TableCell>{row.display_name || row.username}</TableCell>
                        <TableCell align="right">{row.total_xp}</TableCell>
                        <TableCell align="right">{row.level}</TableCell>
                        <TableCell align="right">{row.current_streak_days}d</TableCell>
                        <TableCell align="right">{row.badge_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
          {classroomTab === 1 && (
            <>
              {instructorStudentsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Student</TableCell>
                      <TableCell align="right">Course progress</TableCell>
                      <TableCell align="right">XP</TableCell>
                      <TableCell align="right">Level</TableCell>
                      <TableCell align="right">Streak</TableCell>
                      <TableCell align="right">Badges</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {instructorStudents.map((row) => (
                      <TableRow key={row.student_id}>
                        <TableCell>{row.display_name || row.username}</TableCell>
                        <TableCell align="right">{row.progress_percentage}%</TableCell>
                        <TableCell align="right">{row.total_xp}</TableCell>
                        <TableCell align="right">{row.level}</TableCell>
                        <TableCell align="right">{row.current_streak_days}d</TableCell>
                        <TableCell align="right">{row.badge_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClassroomDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      </Container>
    </Box>
  );
};

export default CourseDetail;

