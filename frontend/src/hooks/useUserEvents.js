import { useEffect } from 'react';
import socket from '../socket';
import { getToken } from '../api';

export default function useUserEvents({ currentUser, setCurrentUser, setUsers, setOnlineUserIds, onSuspended }) {
  const userId = currentUser ? currentUser.id : null;

  useEffect(() => {
    if (!userId) return;

    const identify = () => {
      socket.emit('identify', getToken());
    };

    identify();
    socket.on('connect', identify);
    return () => {
      socket.off('connect', identify);
    };
  }, [userId]);

  useEffect(() => {
    const handleOnlineUsers = (ids) => setOnlineUserIds(ids);
    const handleUserDeleted = (data) => setUsers(prev => prev.filter(u => u.id !== data.userId));

    socket.on('online-users', handleOnlineUsers);
    socket.on('user:deleted', handleUserDeleted);
    return () => {
      socket.off('online-users', handleOnlineUsers);
      socket.off('user:deleted', handleUserDeleted);
    };
  }, [setOnlineUserIds, setUsers]);

  useEffect(() => {
    const handleUserUpdated = (updatedUser) => {
      setUsers(prev => {
        if (prev.some(u => u.id === updatedUser.id)) {
          return prev.map(u => (u.id === updatedUser.id ? updatedUser : u));
        }
        return [...prev, updatedUser];
      });

      if (updatedUser.id === userId) {
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setCurrentUser(updatedUser);
      }
    };

    socket.on('user:updated', handleUserUpdated);
    socket.on('account:suspended', onSuspended);
    return () => {
      socket.off('user:updated', handleUserUpdated);
      socket.off('account:suspended', onSuspended);
    };
  }, [userId, setUsers, setCurrentUser, onSuspended]);
}
