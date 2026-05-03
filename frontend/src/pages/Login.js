import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Grid,
  Paper,
  TextField,
  Button,
  Typography,
  Link,
  InputAdornment,
  IconButton,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Email,
  Lock,
  Visibility,
  VisibilityOff,
  School,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.png'

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Invalid credentials');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Softer, lighter background for better contrast with the card
        background:
          'radial-gradient(circle at top, #e0e7ff 0%, #f9fafb 55%, #f5f3ff 100%)',
        px: 2,
        py: 4,
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} alignItems="stretch">
          {/* Left: brand / hero */}
          <Grid
            item
            xs={12}
            md={6}
            sx={{
              display: { xs: 'none', md: 'flex' },
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <Box sx={{ mb: 4 }}>
              <Chip
                label="Welcome to EduAgent"
                sx={{
                  mb: 2,
                  backgroundColor: 'rgba(139, 92, 246, 0.08)',
                  color: '#7c3aed',
                  fontWeight: 600,
                }}
              />
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 800,
                  mb: 2,
                  lineHeight: 1.15,
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #22c55e 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Learn smarter, not harder.
              </Typography>
              <Typography variant="body1" sx={{ color: '#475569', maxWidth: 480 }}>
                Access your personalized dashboard, track progress, and manage courses and quizzes
                — all from a single, beautifully designed workspace.
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Chip label="Smart Analytics" />
              <Chip label="Interactive Quizzes" />
            </Box>
          </Grid>

          {/* Right: login card */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={6}
              sx={{
                borderRadius: 3,
                p: { xs: 3, sm: 4 },
                maxWidth: 480,
                ml: { xs: 'auto', md: 'auto' },
                mr: { xs: 'auto', md: 0 },
                backdropFilter: 'blur(10px)',
              }}
            >
              {/* Header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 3,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {/* <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'linear-gradient(145deg, #8b5cf6, #6366f1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 10px 25px rgba(79, 70, 229, 0.35)',
                    }}
                  > */}
                    {/* <School sx={{ color: '#ffffff', fontSize: 22 }} /> */}
                    <img src={logo} alt="EduAgent" style={{ width: 40, height: 40 }} />
                  {/* </Box> */}
                  <Box>
                    <Typography
                      variant="h5"
                      sx={{ fontWeight: 700, letterSpacing: 0.4 }}
                    >
                      EduAgent
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      Learning Management System
                    </Typography>
                  </Box>
                </Box>

                <Button
                  component={RouterLink}
                  to="/register"
                  variant="outlined"
                  size="small"
                  sx={{
                    textTransform: 'none',
                    borderRadius: 999,
                    borderColor: '#c4b5fd',
                    color: '#7c3aed',
                    fontWeight: 600,
                    px: 2,
                    '&:hover': {
                      borderColor: '#7c3aed',
                      backgroundColor: 'rgba(124, 58, 237, 0.04)',
                    },
                  }}
                >
                  Create account
                </Button>
              </Box>

              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  mb: 1,
                  color: '#0f172a',
                }}
              >
                Sign in
              </Typography>
              <Typography variant="body2" sx={{ mb: 3, color: '#6b7280' }}>
                Enter your credentials to access your courses and dashboard.
              </Typography>

              {error && (
                <Box
                  sx={{
                    mb: 2,
                    p: 1.5,
                    borderRadius: 2,
                    backgroundColor: '#fef2f2',
                    color: '#b91c1c',
                    fontSize: '0.85rem',
                  }}
                >
                  {error}
                </Box>
              )}

              <form onSubmit={handleSubmit}>
                {/* Email Field */}
                <TextField
                  fullWidth
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': {
                        borderColor: '#8b5cf6',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#8b5cf6',
                      },
                    },
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Email sx={{ color: '#94a3b8' }} />
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Password Field */}
                <TextField
                  fullWidth
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  sx={{
                    mb: 1,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': {
                        borderColor: '#8b5cf6',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#8b5cf6',
                      },
                    },
                  }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          sx={{ color: '#94a3b8' }}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 3,
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#6b7280' }}>
                    Use the email you registered with.
                  </Typography>
                  <Link
                    component="button"
                    type="button"
                    sx={{
                      color: '#7c3aed',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      '&:hover': {
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    Forgot password?
                  </Link>
                </Box>

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={loading}
                  sx={{
                    py: 1.4,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                    color: '#ffffff',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    textTransform: 'none',
                    boxShadow: '0 10px 20px rgba(79, 70, 229, 0.45)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                      boxShadow: '0 12px 25px rgba(79, 70, 229, 0.55)',
                    },
                    '&:disabled': {
                      background: '#c4b5fd',
                      boxShadow: 'none',
                    },
                  }}
                >
                  {loading ? (
                    <CircularProgress size={22} color="inherit" />
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </form>

              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                  Don&apos;t have an account?{' '}
                  <Link
                    component={RouterLink}
                    to="/register"
                    sx={{
                      color: '#7c3aed',
                      fontWeight: 600,
                      textDecoration: 'none',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    Sign up now
                  </Link>
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Login;
