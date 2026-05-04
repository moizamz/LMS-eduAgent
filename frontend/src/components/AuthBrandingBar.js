import React from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Box, Button } from '@mui/material';
import { APP_BAR_HEIGHT } from '../constants/layout';
import EduAgentBrand from './EduAgentBrand';

/**
 * Top bar on /login and /register: same official logo + EduAgent as the app navbar,
 * on a light frosted strip so it matches the auth pages.
 */
export default function AuthBrandingBar() {
  const { pathname } = useLocation();

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        height: APP_BAR_HEIGHT,
        bgcolor: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar
        disableGutters
        sx={{
          minHeight: APP_BAR_HEIGHT,
          height: APP_BAR_HEIGHT,
          px: { xs: 2, sm: 3 },
          gap: 2,
        }}
      >
        <EduAgentBrand to="/login" size="toolbar" />
        <Box sx={{ flexGrow: 1 }} />
        {pathname === '/login' ? (
          <Button
            component={RouterLink}
            to="/register"
            variant="outlined"
            size="small"
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 999,
              borderColor: '#c4b5fd',
              color: '#7c3aed',
            }}
          >
            Create account
          </Button>
        ) : (
          <Button
            component={RouterLink}
            to="/login"
            variant="outlined"
            size="small"
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 999,
              borderColor: '#c4b5fd',
              color: '#7c3aed',
            }}
          >
            Sign in
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
}
