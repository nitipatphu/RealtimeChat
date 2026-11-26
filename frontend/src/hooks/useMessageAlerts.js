import { useEffect } from 'react';
import socket from '../socket';
import { loadSettings, playSound, showDesktopNotification } from '../settings';
import { getDisplayName } from '../utils/permissions';

function shortText(message) {
  if (message.text) return message.text;
  if ((message.attachments || []).length > 0) return 'ส่งไฟล์แนบ';
  return '';
}

export default function useMessageAlerts({
  currentUser,
  currentGroup,
  activeItem,
  channels,
  users,
  view,
  inspecting,
  setUnread,
  setMentionUnread,
  markRead,
  showToast,
  isActiveConversation,
  blockedIds
}) {
  useEffect(() => {
    if (!currentUser) return;

    const addUnread = (key, isMention) => {
      setUnread(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
      if (isMention) {
        setMentionUnread(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
      }
    };

    const notify = (title, body, target, alwaysToast, isMention) => {
      if (currentUser.presence === 'busy') return;
      const settings = loadSettings();
      if (isMention) {
        playSound('mention');
      } else {
        playSound('normal');
      }
      if (settings.desktop) showDesktopNotification(title, body);
      if (alwaysToast) showToast(title, body, target);
    };

    const authorName = (message) => {
      const author = users.find(u => u.id === message.authorId);
      return author ? getDisplayName(currentGroup, author) : message.author;
    };

    const handleRoomMessage = (key, roomName, message, target) => {
      const isActive = view === 'workspace' && activeItem.type + ':' + activeItem.id === key;
      if (isActive) {
        markRead(key);
        return;
      }

      const isMention = (message.mentions || []).includes(currentUser.id);
      addUnread(key, isMention);

      const settings = loadSettings();
      const muted = (currentUser.mutedRooms || []).includes(key);
      if (muted && !isMention) return;
      if (isMention && settings.notifyMention) {
        notify(authorName(message) + ' กล่าวถึงคุณใน ' + roomName, shortText(message), target, true, true);
      } else if (settings.notifyChannel) {
        notify(authorName(message) + ' ใน ' + roomName, shortText(message), target, false);
      }
    };

    const handleChannelMessage = ({ channelId, message }) => {
      if (inspecting || message.authorId === currentUser.id) return;
      if ((blockedIds || []).includes(message.authorId)) return;
      const channel = channels.find(c => c.id === channelId);
      handleRoomMessage('channel:' + channelId, '#' + (channel ? channel.name : 'channel'), message, { type: 'channel', id: channelId });
    };

    const handleProjectMessage = ({ projectId, channelId, message }) => {
      if (inspecting || message.authorId === currentUser.id || !currentGroup) return;
      if ((blockedIds || []).includes(message.authorId)) return;
      const project = (currentGroup.projects || []).find(p => p.id === projectId);
      if (!project) return;
      handleRoomMessage('project:' + projectId, project.name, message, { type: 'project', id: projectId, channelId: channelId });
    };

    const handleDmMessage = ({ message }) => {
      if (message.authorId === currentUser.id) return;

      const key = 'dm:' + message.authorId;
      const openInWorkspace = view === 'workspace' && activeItem.type === 'dm' && activeItem.id === message.authorId;
      if (openInWorkspace || isActiveConversation('dm', message.authorId)) {
        markRead(key);
        return;
      }

      addUnread(key, false);
      if ((currentUser.mutedRooms || []).includes(key)) return;
      if (loadSettings().notifyDm) {
        notify('ข้อความจาก ' + message.author, shortText(message), { type: 'dm', id: message.authorId }, true);
      }
    };

    const handleGroupChatMessage = ({ conversationId, message, chat }) => {
      if (message.authorId === currentUser.id) return;
      if ((blockedIds || []).includes(message.authorId)) return;

      const key = 'gdm:' + conversationId;
      if (isActiveConversation('gdm', conversationId)) {
        markRead(key);
        return;
      }

      addUnread(key, false);
      if ((currentUser.mutedRooms || []).includes(key)) return;
      if (loadSettings().notifyDm) {
        const chatName = chat && chat.name ? chat.name : 'แชทกลุ่ม';
        notify(message.author + ' ใน ' + chatName, shortText(message), { type: 'gdm', id: conversationId }, true);
      }
    };

    const handleTaskAssigned = (data) => {
      if (!loadSettings().notifyTask) return;
      notify(data.byName + ' มอบหมายงานให้คุณ', data.taskTitle + ' (' + data.projectName + ')', { type: 'project', groupId: data.groupId, id: data.projectId }, true);
    };

    socket.on('message:new', handleChannelMessage);
    socket.on('project-message:new', handleProjectMessage);
    socket.on('dm:new', handleDmMessage);
    socket.on('gdm:new', handleGroupChatMessage);
    socket.on('task:assigned', handleTaskAssigned);
    return () => {
      socket.off('message:new', handleChannelMessage);
      socket.off('project-message:new', handleProjectMessage);
      socket.off('dm:new', handleDmMessage);
      socket.off('gdm:new', handleGroupChatMessage);
      socket.off('task:assigned', handleTaskAssigned);
    };
  }, [currentUser, currentGroup, activeItem, channels, users, view, inspecting, setUnread, setMentionUnread, markRead, showToast, isActiveConversation, blockedIds]);
}
