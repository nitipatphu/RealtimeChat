import { useState, useEffect } from 'react';
import socket from '../socket';
import { apiGet, apiSend } from '../api';
import { loadSettings, playSound } from '../settings';

export default function useNotifications(currentUser) {
  const [notifications, setNotifications] = useState([]);
  const userId = currentUser ? currentUser.id : null;
  let presence = 'online';
  if (currentUser) presence = currentUser.presence;

  useEffect(() => {
    if (!userId) return;

    apiGet('/users/' + userId + '/notifications')
      .then(data => setNotifications(data))
      .catch(err => console.error(err));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const handleNew = (notification) => {
      setNotifications(prev => [notification, ...prev].slice(0, 100));

      const settings = loadSettings();
      if (presence === 'busy') return;
      if (notification.type === 'mention' && !settings.notifyMention) return;
      if (notification.type === 'task' && !settings.notifyTask) return;
      if (notification.type === 'mention') {
        playSound('mention');
      } else {
        playSound('normal');
      }
    };

    socket.on('notification:new', handleNew);
    return () => {
      socket.off('notification:new', handleNew);
    };
  }, [userId, presence]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = (notificationId) => {
    setNotifications(prev => prev.map(n => (!notificationId || n.id === notificationId ? { ...n, read: true } : n)));
    apiSend('POST', '/users/' + userId + '/notifications/read', { notificationId: notificationId || null }).catch(() => {});
  };

  return { notifications: notifications, unreadCount: unreadCount, markRead: markRead };
}
