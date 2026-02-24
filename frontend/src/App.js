import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
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
    borderRadius: 8,
  },
});

function AppContent() {
  const location = useLocation();
  const hideNavbar = location.pathname === '/login' || location.pathname === '/register';

  return (
    <div className="App">
      {!hideNavbar && <Navbar />}
      <Box sx={{ display: 'flex', mt: hideNavbar ? 0 : '64px' }}>
        {!hideNavbar && <Sidebar />}
        <Box component="main" sx={{ flexGrow: 1, ml: hideNavbar ? 0 : '240px' }}>
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

