import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
} from '@mui/material';
import {
  Dashboard,
  Book,
  School,
  TrendingUp,
  Notifications,
  Settings,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const drawerWidth = 240;

const Sidebar = () => {
  const location = useLocation();
  const { user } = useAuth();

  const menuItems = [
    {
      text: 'Dashboard',
      icon: <Dashboard />,
      path: '/dashboard',
      roles: ['admin', 'instructor', 'student'],
    },
    {
      text: 'My Courses',
      icon: <Book />,
      path: '/my-courses',
      roles: ['student'],
    },
    {
      text: 'Available Courses',
      icon: <School />,
      path: '/courses',
      roles: ['student'],
    },
    {
      text: 'My Progress',
      icon: <TrendingUp />,
      path: '/my-progress',
      roles: ['student'],
    },
    {
      text: 'Notifications',
      icon: <Notifications />,
      path: '/notifications',
      roles: ['student'],
    },
    {
      text: 'Settings',
      icon: <Settings />,
      path: '/profile',
      roles: ['admin', 'instructor', 'student'],
    },
  ];

  const filteredMenuItems = menuItems.filter((item) =>
    item.roles.includes(user?.role)
  );

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          backgroundColor: '#f5f5f5',
          borderRight: '1px solid #e0e0e0',
        },
      }}
    >
      <List sx={{ pt: 2 }}>
        {filteredMenuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <ListItem
              key={item.text}
              component={Link}
              to={item.path}
              sx={{
                backgroundColor: isActive ? '#8b5cf6' : 'transparent',
                color: isActive ? '#ffffff' : '#424242',
                mb: 0.5,
                mx: 1,
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: isActive ? '#8b5cf6' : 'rgba(139, 92, 246, 0.1)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: isActive ? '#ffffff' : '#424242',
                  minWidth: 40,
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '0.95rem',
                }}
              />
            </ListItem>
          );
        })}
      </List>
    </Drawer>
  );
};

export default Sidebar;
