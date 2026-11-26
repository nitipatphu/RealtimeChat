import { useState, useEffect } from 'react';
import socket from '../socket';
import { apiGet, apiSend } from '../api';

export default function useNotifications(currentUser) {
  const [notifications, setNotifications] = useState([]);
  const userId = currentUser ? currentUser.id : null;

  useEffect(() => {
    if (!userId) return;

    apiGet('/users/' + userId + '/notifications')
      .then(data => setNotifications(data))
      .catch(err => console.error(err));

    const handleNew = (notification) => {
      setNotifications(prev => [notification, ...prev].slice(0, 100));
    };

    socket.on('notification:new', handleNew);
    return () => {
      socket.off('notification:new', handleNew);
    };
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = (notificationId) => {
    setNotifications(prev => prev.map(n => (!notificationId || n.id === notificationId ? { ...n, read: true } : n)));
    apiSend('POST', '/users/' + userId + '/notifications/read', { notificationId: notificationId || null }).catch(() => {});
  };

  return { notifications: notifications, unreadCount: unreadCount, markRead: markRead };
}
