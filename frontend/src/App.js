import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import AuthBrandingBar from './components/AuthBrandingBar';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import MyCourses from './pages/MyCourses';
import AdminPanel from './pages/AdminPanel';
import InstructorPanel from './pages/InstructorPanel';
import StudentPanel from './pages/StudentPanel';
import Notifications from './pages/Notifications';
import MyProgress from './pages/MyProgress';
import Profile from './pages/Profile';
import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#8b5cf6', // Primary purple (matches dashboard)
      light: '#a855f7',
      dark: '#7c3aed',
    },
    secondary: {
      main: '#616161', // Grey
      light: '#9e9e9e',
      dark: '#424242',
    },
    background: {
      default: '#f5f5f5', // Light grey
      paper: '#ffffff',
    },
    text: {
      primary: '#212121', // Dark grey/black
      secondary: '#757575', // Medium grey
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h3: {
      fontWeight: 700,
      color: '#212121',
    },
    h4: {
      fontWeight: 600,
      color: '#212121',
    },
    h5: {
      fontWeight: 600,
      color: '#212121',
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 12,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
          backgroundImage: `linear-gradient(165deg, ${theme.palette.background.paper} 0%, ${alpha(theme.palette.primary.main, 0.05)} 52%, ${alpha(theme.palette.primary.dark, 0.06)} 100%)`,
          boxShadow: `0 4px 18px ${alpha('#4c1d95', 0.07)}`,
          transition: theme.transitions.create(['box-shadow', 'transform', 'border-color'], {
            duration: theme.transitions.duration.shorter,
          }),
          '@media (hover: hover) and (pointer: fine)': {
            '&:hover': {
              transform: 'translateY(-3px)',
              boxShadow: `0 12px 32px ${alpha(theme.palette.primary.dark, 0.16)}`,
              borderColor: alpha(theme.palette.primary.main, 0.3),
            },
          },
        }),
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${alpha('#7c3aed', 0.12)}`,
          minHeight: 48,
        },
        indicator: {
          height: 3,
          borderRadius: '3px 3px 0 0',
          background: 'linear-gradient(90deg, #6d28d9, #a78bfa)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.9375rem',
          minHeight: 48,
          '&.Mui-selected': {
            color: '#5b21b6',
          },
        },
      },
    },
  },
});

const BRAND = 'EduAgent';

function tabTitleForPath(pathname) {
  const suffix = ` · ${BRAND}`;
  if (pathname === '/login') return `Sign in${suffix}`;
  if (pathname === '/register') return `Create account${suffix}`;
  if (pathname === '/dashboard') return `Dashboard${suffix}`;
  if (pathname === '/courses') return `Browse courses${suffix}`;
  if (/^\/courses\/[^/]+$/.test(pathname)) return `Course${suffix}`;
  if (pathname === '/my-courses') return `My courses${suffix}`;
  if (pathname === '/admin') return `Admin${suffix}`;
  if (pathname === '/instructor') return `Instructor hub${suffix}`;
  if (pathname === '/student') return `Workspace${suffix}`;
  if (pathname === '/notifications') return `Notifications${suffix}`;
  if (pathname === '/my-progress') return `My progress${suffix}`;
  if (pathname === '/profile') return `Profile${suffix}`;
  if (pathname === '/') return BRAND;
  return BRAND;
}

function AppContent() {
  const location = useLocation();
  const hideNavbar = location.pathname === '/login' || location.pathname === '/register';

  useEffect(() => {
    document.title = tabTitleForPath(location.pathname);
  }, [location.pathname]);

  return (
    <div className="App">
      {hideNavbar ? <AuthBrandingBar /> : <Navbar />}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          minHeight: { xs: 'auto', sm: 'calc(100vh - 64px)' },
        }}
      >
        {!hideNavbar && <Sidebar />}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            p: hideNavbar ? 0 : { xs: 2, sm: 3 },
            bgcolor: 'background.default',
          }}
        >
          <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/dashboard"
                element={
                  <PrivateRoute>
                    <Dashboard />
                  </PrivateRoute>
                }
              />
              <Route
                path="/courses"
                element={
                  <PrivateRoute>
                    <Courses />
                  </PrivateRoute>
                }
              />
              <Route
                path="/courses/:id"
                element={
                  <PrivateRoute>
                    <CourseDetail />
                  </PrivateRoute>
                }
              />
              <Route
                path="/my-courses"
                element={
                  <PrivateRoute>
                    <MyCourses />
                  </PrivateRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <PrivateRoute requiredRole="admin">
                    <AdminPanel />
                  </PrivateRoute>
                }
              />
              <Route
                path="/instructor"
                element={
                  <PrivateRoute requiredRole="instructor">
                    <InstructorPanel />
                  </PrivateRoute>
                }
              />
              <Route
                path="/student"
                element={
                  <PrivateRoute requiredRole="student">
                    <StudentPanel />
                  </PrivateRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <PrivateRoute>
                    <Notifications />
                  </PrivateRoute>
                }
              />
              <Route
                path="/my-progress"
                element={
                  <PrivateRoute>
                    <MyProgress />
                  </PrivateRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <PrivateRoute>
                    <Profile />
                  </PrivateRoute>
                }
              />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Box>
      </Box>
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

