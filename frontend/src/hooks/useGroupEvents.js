import { useEffect } from 'react';
import socket from '../socket';
import { isGroupMember, canSeeProject } from '../utils/permissions';

export default function useGroupEvents({
  currentUser,
  currentGroup,
  inspecting,
  activeItem,
  channels,
  setMyGroups,
  setCurrentGroup,
  setActiveItem,
  fetchMyGroups,
  closeCurrentGroup,
  refreshChannels
}) {
  const currentGroupId = currentGroup ? currentGroup.id : null;

  useEffect(() => {
    if (!currentGroupId) return;

    const joinRoom = () => socket.emit('join-group', currentGroupId);

    joinRoom();
    socket.on('connect', joinRoom);
    return () => {
      socket.off('connect', joinRoom);
      socket.emit('join-group', null);
    };
  }, [currentGroupId]);

  useEffect(() => {
    if (!currentUser) return;

    const handleGroupUpdated = (group) => {
      setMyGroups(prev => prev.map(g => (g.id === group.id ? group : g)));
      if (!currentGroup || group.id !== currentGroup.id) return;

      if (!inspecting && !isGroupMember(group, currentUser.id)) {
        closeCurrentGroup();
        return;
      }

      setCurrentGroup(group);
      refreshChannels(group.id);

      if (activeItem.type === 'project' && !inspecting) {
        const project = (group.projects || []).find(p => p.id === activeItem.id);
        if (!project || !canSeeProject(group, project, currentUser.id)) {
          setActiveItem({ type: 'channel', id: channels.length > 0 ? channels[0].id : null });
        }
      }
    };

    const handleRemoved = (data) => {
      fetchMyGroups();
      if (!currentGroup || data.groupId !== currentGroup.id) return;
      alert('คุณถูกนำออกจากกลุ่มนี้แล้ว');
      closeCurrentGroup();
    };

    const handleDeleted = (data) => {
      fetchMyGroups();
      if (!currentGroup || data.groupId !== currentGroup.id) return;
      alert('กลุ่มนี้ถูกลบแล้ว');
      closeCurrentGroup();
    };

    const handleAdded = () => fetchMyGroups();

    socket.on('group:updated', handleGroupUpdated);
    socket.on('group:removed', handleRemoved);
    socket.on('group:deleted', handleDeleted);
    socket.on('group:added', handleAdded);
    return () => {
      socket.off('group:updated', handleGroupUpdated);
      socket.off('group:removed', handleRemoved);
      socket.off('group:deleted', handleDeleted);
      socket.off('group:added', handleAdded);
    };
  }, [currentUser, currentGroup, inspecting, activeItem, channels, setMyGroups, setCurrentGroup, setActiveItem, fetchMyGroups, closeCurrentGroup, refreshChannels]);
}
