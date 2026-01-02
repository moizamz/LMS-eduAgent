import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CircularProgress,
} from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import api from '../services/api';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      // Try fetching announcements (which serve as notifications for students)
      const response = await api.get('/announcements/');
      const announcementsData = Array.isArray(response.data) ? response.data : response.data.results || [];
      setNotifications(announcementsData);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ backgroundColor: '#f5f5f5', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="lg">
        <Box display="flex" alignItems="center" mb={3}>
          <NotificationsIcon sx={{ mr: 2, color: '#8b5cf6', fontSize: 32 }} />
          <Typography variant="h4" sx={{ color: '#212121', fontWeight: 700 }}>
            Notifications
          </Typography>
        </Box>

        <Card sx={{ backgroundColor: '#ffffff', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' }}>
          <CardContent>
            {loading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : notifications.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                No notifications yet
              </Typography>
            ) : (
              <Box>
                {notifications.map((notification) => (
                  <Card
                    key={notification.id}
                    variant="outlined"
                    sx={{ mb: 2, p: 2 }}
                  >
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      {notification.title}
                    </Typography>
                    {notification.course && (
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Course: {notification.course.title}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {notification.content}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(notification.created_at).toLocaleString()}
                    </Typography>
                  </Card>
                ))}
              </Box>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default Notifications;
