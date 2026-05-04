import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Button,
  Box,
  Menu,
  MenuItem,
  IconButton,
} from '@mui/material';
import { AccountCircle } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { APP_BAR_HEIGHT, appBarChromeStyles } from '../constants/layout';
import EduAgentBrand from './EduAgentBrand';

const Navbar = () => {
  const { logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleClose();
  };

  const brandTarget = isAuthenticated ? '/dashboard' : '/login';

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        height: APP_BAR_HEIGHT,
        ...appBarChromeStyles,
      }}
    >
      <Toolbar sx={{ minHeight: APP_BAR_HEIGHT, px: { xs: 2, sm: 3 }, gap: 2 }}>
        <EduAgentBrand to={brandTarget} size="toolbar" inverse />
        <Box sx={{ flexGrow: 1 }} />
        {isAuthenticated ? (
          <>
            <IconButton
              size="large"
              aria-label="account menu"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
              sx={{
                border: '1px solid rgba(255,255,255,0.35)',
                bgcolor: 'rgba(255,255,255,0.08)',
              }}
            >
              <AccountCircle />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem
                onClick={() => {
                  navigate('/profile');
                  handleClose();
                }}
              >
                Profile
              </MenuItem>
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </>
        ) : (
          <>
            <Button color="inherit" onClick={() => navigate('/login')} sx={{ fontWeight: 600 }}>
              Login
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => navigate('/register')}
              sx={{
                fontWeight: 600,
                borderColor: 'rgba(255,255,255,0.55)',
                '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
              }}
            >
              Register
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
