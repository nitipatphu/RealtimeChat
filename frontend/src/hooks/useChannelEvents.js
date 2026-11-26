import { useEffect } from 'react';
import socket from '../socket';
import { canSeeChannel } from '../utils/permissions';

export default function useChannelEvents(setChannels, currentGroup, currentUser, inspecting) {
  useEffect(() => {
    const handleNew = ({ channelId, message }) => {
      setChannels(prev => prev.map(ch => {
        if (ch.id !== channelId || !ch.loaded) return ch;
        if ((ch.messages || []).some(m => m.id === message.id)) return ch;
        return { ...ch, messages: [...(ch.messages || []), message] };
      }));
    };

    const handleUpdated = ({ channelId, message }) => {
      setChannels(prev => prev.map(ch => {
        if (ch.id !== channelId || !ch.loaded) return ch;
        return { ...ch, messages: (ch.messages || []).map(m => (m.id === message.id ? message : m)) };
      }));
    };

    const handleDeleted = ({ channelId, messageId }) => {
      setChannels(prev => prev.map(ch => {
        if (ch.id !== channelId || !ch.loaded) return ch;
        return { ...ch, messages: (ch.messages || []).filter(m => m.id !== messageId && m.parentId !== messageId) };
      }));
    };

    const handleChannelCreated = ({ channel }) => {
      setChannels(prev => (prev.some(c => c.id === channel.id) ? prev : [...prev, channel]));
    };

    const handleChannelUpdated = ({ channel }) => {
      if (!channel || !currentGroup || channel.groupId !== currentGroup.id) return;
      const visible = inspecting || canSeeChannel(currentGroup, channel, currentUser ? currentUser.id : null);

      setChannels(prev => {
        const exists = prev.some(c => c.id === channel.id);
        if (!visible) return prev.filter(c => c.id !== channel.id);
        if (!exists) return [...prev, channel];
        return prev.map(c => (c.id === channel.id ? { ...c, ...channel } : c));
      });
    };

    const handleChannelDeleted = ({ channelId }) => {
      setChannels(prev => prev.filter(c => c.id !== channelId && c.parentId !== channelId));
    };

    socket.on('message:new', handleNew);
    socket.on('message:updated', handleUpdated);
    socket.on('message:deleted', handleDeleted);
    socket.on('channel:created', handleChannelCreated);
    socket.on('channel:updated', handleChannelUpdated);
    socket.on('channel:deleted', handleChannelDeleted);
    return () => {
      socket.off('message:new', handleNew);
      socket.off('message:updated', handleUpdated);
      socket.off('message:deleted', handleDeleted);
      socket.off('channel:created', handleChannelCreated);
      socket.off('channel:updated', handleChannelUpdated);
      socket.off('channel:deleted', handleChannelDeleted);
    };
  }, [setChannels, currentGroup, currentUser, inspecting]);
}
