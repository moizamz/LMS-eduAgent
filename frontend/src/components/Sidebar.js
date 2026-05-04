import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { SIDEBAR_NAV, navItemActive } from '../constants/navigation';
import { APP_BAR_HEIGHT, sidebarBrandChromeStyles } from '../constants/layout';
import EduAgentBrand from './EduAgentBrand';

export const DRAWER_WIDTH = 260;

const Sidebar = () => {
  const location = useLocation();
  const { user } = useAuth();

  const filtered = SIDEBAR_NAV.filter((item) => item.roles.includes(user?.role));

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
          bgcolor: '#fafafa',
          backgroundImage:
            'linear-gradient(180deg, rgba(124, 58, 237, 0.04) 0%, transparent 32%)',
        },
      }}
    >
      <Box
        sx={{
          height: APP_BAR_HEIGHT,
          minHeight: APP_BAR_HEIGHT,
          maxHeight: APP_BAR_HEIGHT,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          px: 1.5,
          boxSizing: 'border-box',
          overflow: 'hidden',
          ...sidebarBrandChromeStyles,
        }}
      >
        <EduAgentBrand to="/dashboard" size="toolbar" inverse sx={{ width: '100%', minWidth: 0 }} />
      </Box>
      <Box sx={{ px: 2, pt: 1.75, pb: 0.75 }}>
        <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 1.2 }}>
          Menu
        </Typography>
      </Box>
      <List sx={{ px: 1.5, py: 0 }}>
        {filtered.map((item) => {
          const active = navItemActive(location.pathname, item.path);
          const Icon = item.Icon;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                to={item.path}
                selected={active}
                sx={{
                  borderRadius: 2,
                  py: 1.1,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    boxShadow: '0 6px 18px rgba(124, 58, 237, 0.35)',
                    '&:hover': { bgcolor: 'primary.dark' },
                    '& .MuiListItemIcon-root': { color: 'inherit' },
                  },
                  '&:hover': {
                    bgcolor: active ? undefined : 'rgba(124, 58, 237, 0.08)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 42, color: active ? 'inherit' : 'text.secondary' }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: active ? 700 : 500,
                    fontSize: '0.9rem',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Drawer>
  );
};

export default Sidebar;
